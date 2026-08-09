/**
 * Alt text for every property photo, in gallery order, per language.
 *
 * Written from the actual images, not from the filenames. The previous alt text
 * was "{property name} – photo 1", "… – photo 2" and so on, which tells a screen
 * reader user nothing and gives image search nothing to index.
 *
 * IMPORTANT — the Amorim and Duplex images are architectural renders, not
 * photographs. Those units open in October 2026 and are not yet furnished. The
 * alt text says so explicitly: describing a computer-generated image as a room
 * photo is misleading to anyone who cannot see it, and to a guest deciding
 * whether to book. See SEO-AUDIT.md for the matching recommendation to label
 * them visibly too.
 *
 * Order must match the [heroImage, ...galleryImages] array on each page.
 */

export const imageAlt = {
  en: {
    ramalho: [
      'Kitchen and dining area with a white table for six, gas hob and oven, Ramalho three-bedroom apartment',
      'Entrance hall with a black console table and round wall mirror',
      'Kitchen with dining table for six and a door to the enclosed utility balcony',
      'Kitchen worktop with sink, gas hob, oven and kettle',
      'Living room with a grey corner sofa, coffee table and flat-screen TV',
      'Double bedroom with wooden floor, bedside lamps and folded towels on the bed',
      'Bathroom washbasin with storage drawers and a backlit mirror',
      'Bathroom with bath and shower screen, toilet and bidet',
      'Second double bedroom with a large window and open shelving unit',
      'Third double bedroom with a dark wood bed frame and bedside lamps',
      'Hallway with an open shelf of folded towels and a wall coat rack',
      'Shower room with a glass shower enclosure and toilet',
      'Enclosed utility balcony with a washing machine',
      'Exterior of the white apartment building on Rua Rodrigo Rodrigues, Ponta Delgada',
    ],
    amorim: [
      'Architectural render of the open-plan living room and kitchen with a dining nook and green banquette seating, Amorim two-bedroom apartment',
      'Architectural render of the living area looking out to the private patio, with a wall-mounted TV',
      'Architectural render of a double bedroom with mustard bedding and a full-length mirror',
      'Architectural render of a second double bedroom with terracotta bedding',
    ],
    duplex: [
      'Architectural render of the dining area with an oval table, woven green chairs and a breakfast bar, Amorim two-bedroom duplex',
      'Architectural render of the internal staircase with oak treads and a glass balustrade',
      'Architectural render of the living room with a grey corner sofa, green armchair and wall-mounted TV',
      'Architectural render of the open-plan kitchen island and dining table',
      'Architectural render of the private terrace with outdoor sofa and armchairs',
      'Architectural render of a twin bedroom with two single beds and a pink bedside table',
      "Architectural render of a children's bedroom with a study desk and twin beds",
      'Architectural render of the main double bedroom with navy bedding, balcony door and fitted wardrobes',
    ],
  },

  pt: {
    ramalho: [
      'Cozinha e zona de refeições com mesa branca para seis pessoas, placa a gás e forno, apartamento Ramalho T3',
      'Hall de entrada com consola preta e espelho redondo na parede',
      'Cozinha com mesa de refeições para seis e porta para a marquise',
      'Bancada da cozinha com lava-loiça, placa a gás, forno e jarro elétrico',
      'Sala de estar com sofá de canto cinzento, mesa de centro e televisão',
      'Quarto de casal com pavimento em madeira, candeeiros de cabeceira e toalhas dobradas sobre a cama',
      'Lavatório da casa de banho com gavetas e espelho com iluminação',
      'Casa de banho com banheira e resguardo, sanita e bidé',
      'Segundo quarto de casal com janela ampla e estante aberta',
      'Terceiro quarto de casal com cama em madeira escura e candeeiros de cabeceira',
      'Corredor com prateleira de toalhas dobradas e cabide de parede',
      'Casa de banho com base de duche em vidro e sanita',
      'Marquise fechada com máquina de lavar roupa',
      'Exterior do edifício branco na Rua Rodrigo Rodrigues, Ponta Delgada',
    ],
    amorim: [
      'Imagem 3D da sala e cozinha em plano aberto com zona de refeições e banco verde, apartamento Amorim T2',
      'Imagem 3D da sala com vista para o pátio privado e televisão na parede',
      'Imagem 3D de um quarto de casal com roupa de cama em tom mostarda e espelho de corpo inteiro',
      'Imagem 3D de um segundo quarto de casal com roupa de cama em tom terracota',
    ],
    duplex: [
      'Imagem 3D da zona de refeições com mesa oval, cadeiras verdes e bancada de pequeno-almoço, duplex Amorim T2',
      'Imagem 3D da escada interior com degraus em carvalho e guarda em vidro',
      'Imagem 3D da sala de estar com sofá de canto cinzento, cadeirão verde e televisão na parede',
      'Imagem 3D da ilha de cozinha em plano aberto e mesa de refeições',
      'Imagem 3D do terraço privado com sofá e cadeirões de exterior',
      'Imagem 3D de um quarto com duas camas individuais e mesa de cabeceira cor-de-rosa',
      'Imagem 3D de um quarto de criança com secretária e duas camas individuais',
      'Imagem 3D do quarto principal com roupa de cama azul-escura, porta de varanda e roupeiros embutidos',
    ],
  },
} as const;

export type ImageAltSlug = keyof typeof imageAlt.en;
