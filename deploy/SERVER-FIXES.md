# Server-side fixes — runbook

Four defects that cannot be fixed from this repository. They live in the nginx
and Caddy configuration on the VPS at `/srv/ramalho-apartments`.

Work through this in order. Each step is independently testable and independently
revertible. **Do step 1 and 2 first, verify, and only then do step 3** — HSTS is
the one change that is awkward to undo.

| # | Defect | Where | Risk |
|---|---|---|---|
| 1 | Every non-root URL 301s to an `http://` address | nginx | Low |
| 2 | `robots.txt` served without a charset | nginx | Low |
| 3 | `www.` serves a full duplicate of the site | Caddy | Low |
| 4 | No HSTS header | Caddy | **Do last — see the warning** |

---

## 0. Find the files

SSH in and work out how nginx is configured. The two cases behave differently:
a bind-mounted config only needs a restart, a config baked into an image needs a
rebuild.

```bash
ssh <you>@<your-vps>
cd /srv/ramalho-apartments

# What is running, and what is the nginx service actually called?
docker compose ps

# Is the nginx config mounted from the host, or baked into the image?
grep -A20 -i 'nginx\|static' docker-compose.yml
```

Look at the `volumes:` block for the nginx service. You are looking for a line
like `./nginx.conf:/etc/nginx/conf.d/default.conf`.

- **A volume line exists** → edit the file on the host, then `docker compose restart`.
- **No volume line** → the config is inside the image. Either add a bind mount
  (recommended, so it is editable) or edit the Dockerfile and rebuild.

Find the config inside the running container either way:

```bash
docker compose exec ramalho-static sh -c 'nginx -T' | head -60
```

`nginx -T` prints the full effective configuration and the filenames it came
from. That tells you exactly which file to edit.

Now find Caddy. It may be a separate compose project, or a system service, and it
may be shared with your other sites:

```bash
systemctl status caddy 2>/dev/null | head -5     # system service?
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i caddy   # or a container?
find / -name 'Caddyfile' 2>/dev/null | head
```

---

## 1. Stop the cross-protocol redirect (nginx)

### The problem

A request over HTTPS is answered with a redirect to an `http://` URL:

```
GET https://ramalhoapartments.com/properties
  → 301  location: http://ramalhoapartments.com/properties/     ← nginx, wrong scheme
  → 308  Location: https://ramalhoapartments.com/properties/    ← Caddy fixes it
  → 200
```

nginx serves `/properties/index.html`, so it redirects `/properties` to
`/properties/` to add the trailing slash. It builds that redirect as a full
absolute URL using `$scheme`. Because Caddy talks to nginx over plain HTTP
inside Docker, `$scheme` is `http` — so nginx sends visitors to the insecure
address. Caddy catches it, but the damage is done: crawlers that force HTTPS and
strip trailing slashes loop forever, which is the `ERR_TOO_MANY_REDIRECTS` the
external crawl reported.

### The fix

One line in the `server { }` block:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;

    # Emit "Location: /properties/" instead of
    # "Location: http://host/properties/". A relative redirect inherits the
    # scheme and host the visitor actually used, so it cannot downgrade HTTPS to
    # HTTP. Without this, nginx builds the URL from $scheme, which is "http"
    # because Caddy proxies to us over plain HTTP inside Docker.
    absolute_redirect off;

    # ... your existing location blocks
}
```

### Apply and test

```bash
docker compose exec ramalho-static nginx -t     # syntax check FIRST
docker compose restart ramalho-static
```

From anywhere:

```bash
curl -sSI https://ramalhoapartments.com/properties | grep -i '^location'
```

- Before: `location: http://ramalhoapartments.com/properties/`
- After: `location: /properties/`

The relative form is correct and is what you want.

---

## 2. Serve text files with a charset (nginx)

### The problem

```
content-type: text/plain      ← no charset
```

Browsers fall back to Latin-1 for `text/plain` with no declared charset, so any
UTF-8 character renders as mojibake. `robots.txt` has been rewritten in pure
ASCII so it is unaffected today, but this will bite any future text file, and
your HTML is only fine because it carries `<meta charset>` internally.

### The fix

In the same `server { }` block, or in the `http { }` block to cover every site:

```nginx
charset utf-8;

# By default nginx only adds the charset to text/html. This extends it to the
# other text formats we serve.
charset_types text/plain text/css text/xml application/javascript application/rss+xml image/svg+xml;
```

### Apply and test

```bash
docker compose exec ramalho-static nginx -t
docker compose restart ramalho-static

curl -sSI https://ramalhoapartments.com/robots.txt | grep -i content-type
```

Expect: `content-type: text/plain; charset=utf-8`

---

## 3. Redirect www to the apex (Caddy)

### The problem

`https://www.ramalhoapartments.com/` returns `200`, not a redirect. Your entire
site is reachable on two hostnames. Every page's `<link rel="canonical">` points
at the apex, which stops Google indexing both — but it still doubles crawl
budget, and any link anyone posts to `www` passes its value to a second hostname.

### The fix

Your Caddyfile almost certainly has both names on one site block:

```caddy
ramalhoapartments.com, www.ramalhoapartments.com {
    reverse_proxy ramalho-static:80
}
```

Split them:

```caddy
# Send www to the apex, permanently. {uri} preserves the path and query string,
# so https://www.example.com/ramalho/ lands on https://example.com/ramalho/ and
# not on the homepage.
www.ramalhoapartments.com {
    redir https://ramalhoapartments.com{uri} permanent
}

ramalhoapartments.com {
    reverse_proxy ramalho-static:80
}
```

Keep the `www` block — do not just delete the name. If you remove it, `www`
stops resolving entirely and anyone with an old `www` link gets a connection
error instead of being forwarded. The DNS record must keep pointing at this
server.

### Apply and test

```bash
caddy validate --config /etc/caddy/Caddyfile     # adjust path
systemctl reload caddy
# or, if Caddy is a container:
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

```bash
curl -sSI https://www.ramalhoapartments.com/ramalho/ | grep -iE '^(HTTP|location)'
```

Expect `301` and `location: https://ramalhoapartments.com/ramalho/` — note the
path is preserved.

---

## 4. HSTS (Caddy) — do this last, and stage it

### ⚠️ Read before applying

HSTS tells browsers "never talk to this domain over HTTP again, for the next
N seconds". A browser that has seen the header **will refuse to connect over
HTTP at all** until it expires — and you cannot revoke it early. If HTTPS breaks
during that window, affected visitors cannot reach the site at all.

So roll it out in two stages.

### Stage 1 — a short max-age

```caddy
ramalhoapartments.com {
    # 300 seconds. Deliberately short while we confirm nothing breaks.
    header Strict-Transport-Security "max-age=300"
    reverse_proxy ramalho-static:80
}
```

Reload, then check:

```bash
curl -sSI https://ramalhoapartments.com/ | grep -i strict-transport
```

Now browse the site properly: both languages, all three property pages, the
gallery lightbox, the WhatsApp buttons. Confirm nothing is served over plain
HTTP anywhere — a single HTTP asset will now fail to load.

### Stage 2 — the real value, after a day or two

```caddy
header Strict-Transport-Security "max-age=31536000; includeSubDomains"
```

One year, covering subdomains.

**Only add `includeSubDomains` if every subdomain you have is HTTPS.** It applies
to all of them, including ones that do not exist yet. If you ever run something
like `staging.ramalhoapartments.com` on plain HTTP, it will become unreachable
in any browser that has seen this header.

### Do not add `preload` yet

Adding the `preload` directive and submitting to the browser preload list is
effectively permanent — removal takes months and ships with browser releases.
There is no reason to do it for this site.

---

## Verify everything at once

After all four steps, from any machine:

```bash
echo "1. redirect scheme:"
curl -sSI https://ramalhoapartments.com/properties | grep -i '^location'

echo "2. charset:"
curl -sSI https://ramalhoapartments.com/robots.txt | grep -i content-type

echo "3. www redirect:"
curl -sSI https://www.ramalhoapartments.com/ramalho/ | grep -iE '^(HTTP|location)'

echo "4. HSTS:"
curl -sSI https://ramalhoapartments.com/ | grep -i strict-transport

echo "5. full chain — should be ONE hop, no http:// anywhere:"
curl -sSIL https://ramalhoapartments.com/properties | grep -iE '^(HTTP|location)'
```

Expected after all four:

```
1. location: /properties/
2. content-type: text/plain; charset=utf-8
3. HTTP/2 301 + location: https://ramalhoapartments.com/ramalho/
4. strict-transport-security: max-age=...
5. HTTP/2 301, location: /properties/, HTTP/2 200   ← no http:// at any point
```

---

## If something breaks

Every step is a config edit plus a reload, so rollback is: undo the edit, reload.

```bash
# nginx
docker compose exec ramalho-static nginx -t    # always syntax-check before restarting
docker compose restart ramalho-static
docker compose logs --tail=50 ramalho-static

# Caddy
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy && journalctl -u caddy -n 50 --no-pager
```

The one exception is HSTS: removing the header stops it being sent to new
visitors, but browsers that already received it will honour it until the
`max-age` expires. That is exactly why stage 1 uses 300 seconds.

---

## Afterwards: put these files under version control

The nginx config and `docker-compose.yml` are not in this repository, which is
why the redirect defect survived unnoticed and why it cannot be fixed by a
deploy. Copy them into `deploy/` here and mount them from the checkout, so
server behaviour is reviewable in a diff like everything else.
