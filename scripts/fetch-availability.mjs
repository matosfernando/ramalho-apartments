/**
 * Fetch booked dates from iCal feeds and bake them into the static build.
 *
 * Runs automatically before `npm run build` (see the `prebuild` script) and
 * writes src/data/availability.json, which AvailabilityCalendar.astro imports.
 * The site stays fully static: no runtime server, no database, no browser fetch,
 * and therefore no CORS problem and no exposed feed URL.
 *
 * PRIVACY. Feed URLs are credentials — anyone holding one can read the booking
 * pattern of that unit. They come from the environment, never the repo, and the
 * generated JSON is gitignored. Only DTSTART and DTEND are ever read; every
 * other field, including SUMMARY and any DESCRIPTION a channel may add, is
 * discarded, so nothing but "this night is unavailable" can reach the page.
 *
 * FAILURE. A channel being down must never break a deploy. On any error the
 * previous JSON is kept and marked stale; if there is no previous file, the
 * unit is written as unavailable and the calendar section simply does not
 * render. The script always exits 0.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/availability.json');

/** How far ahead the calendar shows. */
const HORIZON_MONTHS = 12;

/**
 * Which feeds belong to which unit.
 *
 * Add a channel by adding an entry — everything downstream merges automatically.
 * A unit is only as accurate as the feeds listed here: a reservation taken on a
 * channel that is not represented will show as available.
 */
const UNITS = {
  ramalho: {
    // The owner advertises a two-night standard but accepts single nights, so
    // no gap is closed. Raise this to 2 to hide unsellable orphan nights.
    minimumNights: 1,
    feeds: [
      { channel: 'airbnb', env: 'AIRBNB_ICAL_RAMALHO' },
      { channel: 'booking', env: 'BOOKING_ICAL_RAMALHO' },
      { channel: 'vrbo', env: 'VRBO_ICAL_RAMALHO' },
    ],
  },
  // amorim / duplex open in October 2026 and have no live calendar yet.
};

// ── date helpers: strings only, so no timezone can shift a day ──────────
const toKey = (d) => d.toISOString().slice(0, 10);
const fromICal = (s) =>
  new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

/**
 * A single event longer than this is treated as "this channel is closed for that
 * period", not as a booking. Vrbo in particular exports the far end of a
 * listing's availability window as one enormous Blocked event — currently
 * 2027-01-01 to 2029-01-01. Merging that would black out two years of a
 * calendar whose whole purpose is to show direct availability.
 */
const CHANNEL_CLOSURE_NIGHTS = 90;

/** Unfold RFC 5545 line continuations, then pull out the VEVENT date ranges. */
function parseICal(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const ranges = [];
  const skipped = [];

  for (const [, body] of unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)) {
    const start = body.match(/^DTSTART(?:;[^:]*)?:(\d{8})/m);
    const end = body.match(/^DTEND(?:;[^:]*)?:(\d{8})/m);
    if (!start || !end) continue;

    const from = fromICal(start[1]);
    const to = fromICal(end[1]);
    const length = Math.round((to - from) / 86400000);

    // SUMMARY is read here only to count closures for the build log. It is not
    // returned, stored or rendered — Vrbo puts guest names in it
    // ("Reserved - <name>") and none of that may reach the page.
    if (length > CHANNEL_CLOSURE_NIGHTS) {
      skipped.push({ from: toKey(from), to: toKey(to), nights: length });
      continue;
    }
    ranges.push({ start: from, end: to });
  }
  return { ranges, skipped };
}

/**
 * Expand ranges into individual blocked nights.
 *
 * DTEND is exclusive in iCal: a stay of the 12th to the 15th occupies the 12th,
 * 13th and 14th, and the 15th is free for the next arrival. Treating DTEND as
 * blocked is the classic bug here and makes a property look fully booked.
 */
function expandNights(ranges, horizonEnd) {
  const nights = new Set();
  for (const { start, end } of ranges) {
    for (let d = start; d < end && d <= horizonEnd; d = addDays(d, 1)) {
      nights.add(toKey(d));
    }
  }
  return nights;
}

/**
 * Close gaps shorter than the minimum stay.
 *
 * A single free night between two bookings cannot be sold under a two-night
 * minimum, so showing it as available only produces enquiries that have to be
 * turned down. Only gaps bounded by blocked nights on both sides are closed —
 * a short run at the end of the horizon is genuinely bookable, we just cannot
 * see far enough to know how long it runs.
 */
function closeOrphanGaps(blocked, from, to, minimumNights) {
  if (minimumNights <= 1) return blocked;
  const out = new Set(blocked);
  let runStart = null;

  for (let d = from; d <= addDays(to, 1); d = addDays(d, 1)) {
    const key = toKey(d);
    const isBlocked = out.has(key) || d > to;

    if (!isBlocked && runStart === null) {
      runStart = d;
    } else if (isBlocked && runStart !== null) {
      const runLength = Math.round((d - runStart) / 86400000);
      const boundedBefore = out.has(toKey(addDays(runStart, -1)));
      if (boundedBefore && runLength < minimumNights) {
        for (let x = runStart; x < d; x = addDays(x, 1)) out.add(toKey(x));
      }
      runStart = null;
    }
  }
  return out;
}

async function fetchFeed(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ramalhoapartments.com availability sync' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── main ────────────────────────────────────────────────────────────────
const today = new Date(Date.UTC(
  new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(),
));
const horizonEnd = new Date(Date.UTC(
  today.getUTCFullYear(), today.getUTCMonth() + HORIZON_MONTHS, today.getUTCDate(),
));

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
const result = {
  generatedAt: new Date().toISOString(),
  horizonMonths: HORIZON_MONTHS,
  units: {},
};

for (const [slug, config] of Object.entries(UNITS)) {
  const configured = config.feeds.filter((f) => process.env[f.env]);
  const missing = config.feeds.filter((f) => !process.env[f.env]).map((f) => f.env);

  if (configured.length === 0) {
    console.log(`  ${slug}: no feed configured (${missing.join(', ')}) — calendar will not render`);
    result.units[slug] = { ok: false, reason: 'not-configured', channels: [], blocked: [] };
    continue;
  }

  // Loudly, because a partially configured unit still renders a calendar — one
  // that shows nights as free which another channel has already sold.
  for (const env of missing) {
    console.log(`  ${slug}: WARNING — ${env} is not set. Bookings from that channel will show as AVAILABLE.`);
  }

  const ranges = [];
  const channels = [];
  let failed = false;

  for (const feed of configured) {
    try {
      const text = await fetchFeed(process.env[feed.env]);
      const { ranges: parsed, skipped } = parseICal(text);
      ranges.push(...parsed);
      channels.push(feed.channel);
      console.log(`  ${slug}/${feed.channel}: ${parsed.length} booking event(s)`);
      for (const s of skipped) {
        console.log(
          `  ${slug}/${feed.channel}: IGNORED ${s.nights}-night block ${s.from} to ${s.to} ` +
          `— longer than ${CHANNEL_CLOSURE_NIGHTS} nights, treated as a closed channel window`,
        );
      }
    } catch (err) {
      failed = true;
      console.log(`  ${slug}/${feed.channel}: FAILED — ${err.message}`);
    }
  }

  if (failed) {
    const kept = previous?.units?.[slug];
    if (kept?.ok) {
      console.log(`  ${slug}: keeping previous data, marked stale`);
      result.units[slug] = { ...kept, stale: true };
    } else {
      result.units[slug] = { ok: false, reason: 'fetch-failed', channels: [], blocked: [] };
    }
    continue;
  }

  const nights = expandNights(ranges, horizonEnd);
  const withGaps = closeOrphanGaps(nights, today, horizonEnd, config.minimumNights);

  result.units[slug] = {
    ok: true,
    stale: false,
    channels,
    minimumNights: config.minimumNights,
    blocked: [...withGaps].sort(),
  };
  console.log(
    `  ${slug}: ${nights.size} night(s) booked, ` +
    `${withGaps.size - nights.size} closed as below minimum stay`,
  );
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(`  written -> src/data/availability.json`);
