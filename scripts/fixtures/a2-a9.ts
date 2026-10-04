import type { ScryfallCard } from '../../src/domain/card-model.ts'
// Primary Scryfall data fetched 2026-10-04. Image URLs only; browser providers are mocked.
export const firstUseCards: ScryfallCard[] = [
  {
    id: 'b91dadcb-31e9-43b0-b425-c9311af3e9d7',
    oracle_id: 'f7252190-ad24-4ba3-a644-2790dd1d680d',
    name: 'Rhys the Redeemed',
    layout: 'normal',
    type_line: 'Legendary Creature — Elf Warrior',
    cmc: 1,
    mana_cost: '{G/W}',
    oracle_text:
      "{2}{G/W}, {T}: Create a 1/1 green and white Elf Warrior creature token.\n{4}{G/W}{G/W}, {T}: For each creature token you control, create a token that's a copy of that creature.",
    color_identity: ['G', 'W'],
    power: '1',
    toughness: '1',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.jpg?1783930128',
      normal:
        'https://cards.scryfall.io/normal/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.jpg?1783930128',
      large:
        'https://cards.scryfall.io/large/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.jpg?1783930128',
      png: 'https://cards.scryfall.io/png/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.png?1783930128',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.jpg?1783930128',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.jpg?1783930128',
      thumb:
        'https://cards.scryfall.io/thumb/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.webp?1783930128',
      grid: 'https://cards.scryfall.io/grid/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.webp?1783930128',
      display:
        'https://cards.scryfall.io/display/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.webp?1783930128',
      art: 'https://cards.scryfall.io/art/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.webp?1783930128',
      crop: 'https://cards.scryfall.io/crop/front/b/9/b91dadcb-31e9-43b0-b425-c9311af3e9d7.webp?1783930128',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'not_legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'legal',
      tlr: 'legal',
    },
    game_changer: false,
    set: '2xm',
    set_name: 'Double Masters',
    collector_number: '213',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Af7252190-ad24-4ba3-a644-2790dd1d680d&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/2xm/213/rhys-the-redeemed?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '5.74',
      usd_foil: '8.29',
      usd_etched: null,
      eur: '3.76',
      eur_foil: '7.06',
      tix: '0.03',
    },
    released_at: '2020-08-07',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=489886&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DRhys%2Bthe%2BRedeemed',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DRhys%2Bthe%2BRedeemed',
      edhrec: 'https://edhrec.com/route/?cc=Rhys+the+Redeemed',
    },
  },
  {
    id: '34ea44f2-cb2f-4b86-83fc-fe507f05bb9d',
    oracle_id: 'e94ef397-f5c5-4b8d-ae27-528352fa1d1e',
    name: "Trostani, Selesnya's Voice",
    layout: 'normal',
    type_line: 'Legendary Creature — Dryad',
    cmc: 4,
    mana_cost: '{G}{G}{W}{W}',
    oracle_text:
      "Whenever another creature you control enters, you gain life equal to that creature's toughness.\n{1}{G}{W}, {T}: Populate. (Create a token that's a copy of a creature token you control.)",
    color_identity: ['G', 'W'],
    power: '2',
    toughness: '5',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/3/4/34ea44f2-cb2f-4b86-83fc-fe507f05bb9d.jpg?1783932732',
      normal:
        'https://cards.scryfall.io/normal/front/3/4/34ea44f2-cb2f-4b86-83fc-fe507f05bb9d.jpg?1783932732',
      large:
        'https://cards.scryfall.io/large/front/3/4/34ea44f2-cb2f-4b86-83fc-fe507f05bb9d.jpg?1783932732',
      png: 'https://cards.scryfall.io/png/front/3/4/34ea44f2-cb2f-4b86-83fc-fe507f05bb9d.png?1783932732',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/3/4/34ea44f2-cb2f-4b86-83fc-fe507f05bb9d.jpg?1783932732',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/3/4/34ea44f2-cb2f-4b86-83fc-fe507f05bb9d.jpg?1783932732',
      thumb:
        'https://cards.scryfall.io/thumb/front/3/4/34ea44f2-cb2f-4b86-83fc-fe507f05bb9d.webp?1783932732',
      grid: 'https://cards.scryfall.io/grid/front/3/4/34ea44f2-cb2f-4b86-83fc-fe507f05bb9d.webp?1783932732',
      display:
        'https://cards.scryfall.io/display/front/3/4/34ea44f2-cb2f-4b86-83fc-fe507f05bb9d.webp?1783932732',
      art: 'https://cards.scryfall.io/art/front/3/4/34ea44f2-cb2f-4b86-83fc-fe507f05bb9d.webp?1783932732',
      crop: 'https://cards.scryfall.io/crop/front/3/4/34ea44f2-cb2f-4b86-83fc-fe507f05bb9d.webp?1783932732',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'not_legal',
      timeless: 'not_legal',
      gladiator: 'not_legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'not_legal',
      competitivebrawl: 'not_legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'not_legal',
    },
    game_changer: false,
    set: 'c19',
    set_name: 'Commander 2019',
    collector_number: '204',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Ae94ef397-f5c5-4b8d-ae27-528352fa1d1e&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/c19/204/trostani-selesnyas-voice?utm_source=api',
    finishes: ['nonfoil'],
    prices: {
      usd: '3.78',
      usd_foil: null,
      usd_etched: null,
      eur: '1.64',
      eur_foil: null,
      tix: null,
    },
    released_at: '2019-08-23',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=470750&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DTrostani%252C%2BSelesnya%2527s%2BVoice',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DTrostani%252C%2BSelesnya%2527s%2BVoice',
      edhrec: 'https://edhrec.com/route/?cc=Trostani%2C+Selesnya%27s+Voice',
    },
  },
  {
    id: '8296a455-21d5-498e-9029-2bdf0da855a8',
    oracle_id: 'fe83087d-c6c1-40be-9295-baaa1c6b2db1',
    name: 'Mondrak, Glory Dominus',
    layout: 'normal',
    type_line: 'Legendary Creature — Phyrexian Horror',
    cmc: 4,
    mana_cost: '{2}{W}{W}',
    oracle_text:
      'If one or more tokens would be created under your control, twice that many of those tokens are created instead.\n{1}{W/P}{W/P}, Sacrifice two other artifacts and/or creatures: Put an indestructible counter on Mondrak. ({W/P} can be paid with either {W} or 2 life.)',
    color_identity: ['W'],
    power: '4',
    toughness: '4',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/8/2/8296a455-21d5-498e-9029-2bdf0da855a8.jpg?1783918077',
      normal:
        'https://cards.scryfall.io/normal/front/8/2/8296a455-21d5-498e-9029-2bdf0da855a8.jpg?1783918077',
      large:
        'https://cards.scryfall.io/large/front/8/2/8296a455-21d5-498e-9029-2bdf0da855a8.jpg?1783918077',
      png: 'https://cards.scryfall.io/png/front/8/2/8296a455-21d5-498e-9029-2bdf0da855a8.png?1783918077',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/8/2/8296a455-21d5-498e-9029-2bdf0da855a8.jpg?1783918077',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/8/2/8296a455-21d5-498e-9029-2bdf0da855a8.jpg?1783918077',
      thumb:
        'https://cards.scryfall.io/thumb/front/8/2/8296a455-21d5-498e-9029-2bdf0da855a8.webp?1783918077',
      grid: 'https://cards.scryfall.io/grid/front/8/2/8296a455-21d5-498e-9029-2bdf0da855a8.webp?1783918077',
      display:
        'https://cards.scryfall.io/display/front/8/2/8296a455-21d5-498e-9029-2bdf0da855a8.webp?1783918077',
      art: 'https://cards.scryfall.io/art/front/8/2/8296a455-21d5-498e-9029-2bdf0da855a8.webp?1783918077',
      crop: 'https://cards.scryfall.io/crop/front/8/2/8296a455-21d5-498e-9029-2bdf0da855a8.webp?1783918077',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'not_legal',
    },
    game_changer: false,
    set: 'one',
    set_name: 'Phyrexia: All Will Be One',
    collector_number: '23',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Afe83087d-c6c1-40be-9295-baaa1c6b2db1&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/one/23/mondrak-glory-dominus?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '42.90',
      usd_foil: '47.47',
      usd_etched: null,
      eur: '30.84',
      eur_foil: '36.60',
      tix: '0.07',
    },
    released_at: '2023-02-10',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=602553&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DMondrak%252C%2BGlory%2BDominus',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DMondrak%252C%2BGlory%2BDominus',
      edhrec: 'https://edhrec.com/route/?cc=Mondrak%2C+Glory+Dominus',
    },
  },
  {
    id: '1de30c12-2011-495a-be25-f7a46b23e142',
    oracle_id: '38515f89-348b-4cf3-b7bd-1f6fe4ce2fba',
    name: 'Adeline, Resplendent Cathar',
    layout: 'normal',
    type_line: 'Legendary Creature — Human Knight',
    cmc: 3,
    mana_cost: '{1}{W}{W}',
    oracle_text:
      "Vigilance\nAdeline's power is equal to the number of creatures you control.\nWhenever you attack, for each opponent, create a 1/1 white Human creature token that's tapped and attacking that player or a planeswalker they control.",
    color_identity: ['W'],
    power: '*',
    toughness: '4',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/1/d/1de30c12-2011-495a-be25-f7a46b23e142.jpg?1783907131',
      normal:
        'https://cards.scryfall.io/normal/front/1/d/1de30c12-2011-495a-be25-f7a46b23e142.jpg?1783907131',
      large:
        'https://cards.scryfall.io/large/front/1/d/1de30c12-2011-495a-be25-f7a46b23e142.jpg?1783907131',
      png: 'https://cards.scryfall.io/png/front/1/d/1de30c12-2011-495a-be25-f7a46b23e142.png?1783907131',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/1/d/1de30c12-2011-495a-be25-f7a46b23e142.jpg?1783907131',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/1/d/1de30c12-2011-495a-be25-f7a46b23e142.jpg?1783907131',
      thumb:
        'https://cards.scryfall.io/thumb/front/1/d/1de30c12-2011-495a-be25-f7a46b23e142.webp?1783907131',
      grid: 'https://cards.scryfall.io/grid/front/1/d/1de30c12-2011-495a-be25-f7a46b23e142.webp?1783907131',
      display:
        'https://cards.scryfall.io/display/front/1/d/1de30c12-2011-495a-be25-f7a46b23e142.webp?1783907131',
      art: 'https://cards.scryfall.io/art/front/1/d/1de30c12-2011-495a-be25-f7a46b23e142.webp?1783907131',
      crop: 'https://cards.scryfall.io/crop/front/1/d/1de30c12-2011-495a-be25-f7a46b23e142.webp?1783907131',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'legal',
    },
    game_changer: false,
    set: 'tdc',
    set_name: 'Tarkir: Dragonstorm Commander',
    collector_number: '108',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A38515f89-348b-4cf3-b7bd-1f6fe4ce2fba&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/tdc/108/adeline-resplendent-cathar?utm_source=api',
    finishes: ['nonfoil'],
    prices: {
      usd: '2.83',
      usd_foil: null,
      usd_etched: null,
      eur: '3.78',
      eur_foil: null,
      tix: '0.33',
    },
    released_at: '2025-04-11',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=696264&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DAdeline%252C%2BResplendent%2BCathar',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DAdeline%252C%2BResplendent%2BCathar',
      edhrec: 'https://edhrec.com/route/?cc=Adeline%2C+Resplendent+Cathar',
    },
  },
  {
    id: 'cc3707f1-ed9d-412e-a7be-b6d8b554bd6c',
    oracle_id: '0a2075b5-9609-433d-bcd2-e0a637456cf8',
    name: 'Maja, Bretagard Protector',
    layout: 'normal',
    type_line: 'Legendary Creature — Human Warrior',
    cmc: 5,
    mana_cost: '{2}{G}{W}{W}',
    oracle_text:
      'Other creatures you control get +1/+1.\nLandfall — Whenever a land you control enters, create a 1/1 white Human Warrior creature token.',
    color_identity: ['G', 'W'],
    power: '2',
    toughness: '3',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/c/c/cc3707f1-ed9d-412e-a7be-b6d8b554bd6c.jpg?1783928194',
      normal:
        'https://cards.scryfall.io/normal/front/c/c/cc3707f1-ed9d-412e-a7be-b6d8b554bd6c.jpg?1783928194',
      large:
        'https://cards.scryfall.io/large/front/c/c/cc3707f1-ed9d-412e-a7be-b6d8b554bd6c.jpg?1783928194',
      png: 'https://cards.scryfall.io/png/front/c/c/cc3707f1-ed9d-412e-a7be-b6d8b554bd6c.png?1783928194',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/c/c/cc3707f1-ed9d-412e-a7be-b6d8b554bd6c.jpg?1783928194',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/c/c/cc3707f1-ed9d-412e-a7be-b6d8b554bd6c.jpg?1783928194',
      thumb:
        'https://cards.scryfall.io/thumb/front/c/c/cc3707f1-ed9d-412e-a7be-b6d8b554bd6c.webp?1783928194',
      grid: 'https://cards.scryfall.io/grid/front/c/c/cc3707f1-ed9d-412e-a7be-b6d8b554bd6c.webp?1783928194',
      display:
        'https://cards.scryfall.io/display/front/c/c/cc3707f1-ed9d-412e-a7be-b6d8b554bd6c.webp?1783928194',
      art: 'https://cards.scryfall.io/art/front/c/c/cc3707f1-ed9d-412e-a7be-b6d8b554bd6c.webp?1783928194',
      crop: 'https://cards.scryfall.io/crop/front/c/c/cc3707f1-ed9d-412e-a7be-b6d8b554bd6c.webp?1783928194',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'not_legal',
    },
    game_changer: false,
    set: 'khm',
    set_name: 'Kaldheim',
    collector_number: '222',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A0a2075b5-9609-433d-bcd2-e0a637456cf8&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/khm/222/maja-bretagard-protector?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '0.27',
      usd_foil: '0.41',
      usd_etched: null,
      eur: '0.15',
      eur_foil: '0.24',
      tix: '0.03',
    },
    released_at: '2021-02-05',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=503838&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DMaja%252C%2BBretagard%2BProtector',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DMaja%252C%2BBretagard%2BProtector',
      edhrec: 'https://edhrec.com/route/?cc=Maja%2C+Bretagard+Protector',
    },
  },
  {
    id: 'f9c69d75-651f-4b75-b65d-79999d2069f6',
    oracle_id: 'da72a4bc-ce6f-4b72-bc66-2ee33cfa87df',
    name: 'Jetmir, Nexus of Revels',
    layout: 'normal',
    type_line: 'Legendary Creature — Cat Demon',
    cmc: 4,
    mana_cost: '{1}{R}{G}{W}',
    oracle_text:
      'Creatures you control get +1/+0 and have vigilance as long as you control three or more creatures.\nCreatures you control also get +1/+0 and have trample as long as you control six or more creatures.\nCreatures you control also get +1/+0 and have double strike as long as you control nine or more creatures.',
    color_identity: ['G', 'R', 'W'],
    power: '5',
    toughness: '4',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/f/9/f9c69d75-651f-4b75-b65d-79999d2069f6.jpg?1783923081',
      normal:
        'https://cards.scryfall.io/normal/front/f/9/f9c69d75-651f-4b75-b65d-79999d2069f6.jpg?1783923081',
      large:
        'https://cards.scryfall.io/large/front/f/9/f9c69d75-651f-4b75-b65d-79999d2069f6.jpg?1783923081',
      png: 'https://cards.scryfall.io/png/front/f/9/f9c69d75-651f-4b75-b65d-79999d2069f6.png?1783923081',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/f/9/f9c69d75-651f-4b75-b65d-79999d2069f6.jpg?1783923081',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/f/9/f9c69d75-651f-4b75-b65d-79999d2069f6.jpg?1783923081',
      thumb:
        'https://cards.scryfall.io/thumb/front/f/9/f9c69d75-651f-4b75-b65d-79999d2069f6.webp?1783923081',
      grid: 'https://cards.scryfall.io/grid/front/f/9/f9c69d75-651f-4b75-b65d-79999d2069f6.webp?1783923081',
      display:
        'https://cards.scryfall.io/display/front/f/9/f9c69d75-651f-4b75-b65d-79999d2069f6.webp?1783923081',
      art: 'https://cards.scryfall.io/art/front/f/9/f9c69d75-651f-4b75-b65d-79999d2069f6.webp?1783923081',
      crop: 'https://cards.scryfall.io/crop/front/f/9/f9c69d75-651f-4b75-b65d-79999d2069f6.webp?1783923081',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'not_legal',
    },
    game_changer: false,
    set: 'snc',
    set_name: 'Streets of New Capenna',
    collector_number: '193',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Ada72a4bc-ce6f-4b72-bc66-2ee33cfa87df&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/snc/193/jetmir-nexus-of-revels?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '9.63',
      usd_foil: '12.54',
      usd_etched: null,
      eur: '9.68',
      eur_foil: '9.29',
      tix: '0.02',
    },
    released_at: '2022-04-29',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=555394&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DJetmir%252C%2BNexus%2Bof%2BRevels',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DJetmir%252C%2BNexus%2Bof%2BRevels',
      edhrec: 'https://edhrec.com/route/?cc=Jetmir%2C+Nexus+of+Revels',
    },
  },
  {
    id: '1785cf85-1ac0-4246-9b89-1a8221a8e1b2',
    oracle_id: 'f15b3b76-d38a-48db-bb44-3296183c8641',
    name: 'Chatterfang, Squirrel General',
    layout: 'normal',
    type_line: 'Legendary Creature — Squirrel Warrior',
    cmc: 3,
    mana_cost: '{2}{G}',
    oracle_text:
      "Forestwalk (This creature can't be blocked as long as defending player controls a Forest.)\nIf one or more tokens would be created under your control, those tokens plus that many 1/1 green Squirrel creature tokens are created instead.\n{B}, Sacrifice X Squirrels: Target creature gets +X/-X until end of turn.",
    color_identity: ['B', 'G'],
    power: '3',
    toughness: '3',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/1/7/1785cf85-1ac0-4246-9b89-1a8221a8e1b2.jpg?1783926835',
      normal:
        'https://cards.scryfall.io/normal/front/1/7/1785cf85-1ac0-4246-9b89-1a8221a8e1b2.jpg?1783926835',
      large:
        'https://cards.scryfall.io/large/front/1/7/1785cf85-1ac0-4246-9b89-1a8221a8e1b2.jpg?1783926835',
      png: 'https://cards.scryfall.io/png/front/1/7/1785cf85-1ac0-4246-9b89-1a8221a8e1b2.png?1783926835',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/1/7/1785cf85-1ac0-4246-9b89-1a8221a8e1b2.jpg?1783926835',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/1/7/1785cf85-1ac0-4246-9b89-1a8221a8e1b2.jpg?1783926835',
      thumb:
        'https://cards.scryfall.io/thumb/front/1/7/1785cf85-1ac0-4246-9b89-1a8221a8e1b2.webp?1783926835',
      grid: 'https://cards.scryfall.io/grid/front/1/7/1785cf85-1ac0-4246-9b89-1a8221a8e1b2.webp?1783926835',
      display:
        'https://cards.scryfall.io/display/front/1/7/1785cf85-1ac0-4246-9b89-1a8221a8e1b2.webp?1783926835',
      art: 'https://cards.scryfall.io/art/front/1/7/1785cf85-1ac0-4246-9b89-1a8221a8e1b2.webp?1783926835',
      crop: 'https://cards.scryfall.io/crop/front/1/7/1785cf85-1ac0-4246-9b89-1a8221a8e1b2.webp?1783926835',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'not_legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'legal',
    },
    game_changer: false,
    set: 'mh2',
    set_name: 'Modern Horizons 2',
    collector_number: '151',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Af15b3b76-d38a-48db-bb44-3296183c8641&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/mh2/151/chatterfang-squirrel-general?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '10.94',
      usd_foil: '17.18',
      usd_etched: null,
      eur: '7.21',
      eur_foil: '8.62',
      tix: '0.02',
    },
    released_at: '2021-06-18',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=522227&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DChatterfang%252C%2BSquirrel%2BGeneral',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DChatterfang%252C%2BSquirrel%2BGeneral',
      edhrec: 'https://edhrec.com/route/?cc=Chatterfang%2C+Squirrel+General',
    },
  },
  {
    id: '00e93be2-e06b-4774-8ba5-ccf82a6da1d8',
    oracle_id: '73dc28a7-37ac-4b16-aa00-967c9c44d979',
    name: 'Baylen, the Haymaker',
    layout: 'normal',
    type_line: 'Legendary Creature — Rabbit Warrior',
    cmc: 3,
    mana_cost: '{R}{G}{W}',
    oracle_text:
      'Tap two untapped tokens you control: Add one mana of any color.\nTap three untapped tokens you control: Draw a card.\nTap four untapped tokens you control: Put three +1/+1 counters on Baylen. It gains trample until end of turn.',
    color_identity: ['G', 'R', 'W'],
    power: '4',
    toughness: '3',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/0/0/00e93be2-e06b-4774-8ba5-ccf82a6da1d8.jpg?1783910800',
      normal:
        'https://cards.scryfall.io/normal/front/0/0/00e93be2-e06b-4774-8ba5-ccf82a6da1d8.jpg?1783910800',
      large:
        'https://cards.scryfall.io/large/front/0/0/00e93be2-e06b-4774-8ba5-ccf82a6da1d8.jpg?1783910800',
      png: 'https://cards.scryfall.io/png/front/0/0/00e93be2-e06b-4774-8ba5-ccf82a6da1d8.png?1783910800',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/0/0/00e93be2-e06b-4774-8ba5-ccf82a6da1d8.jpg?1783910800',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/0/0/00e93be2-e06b-4774-8ba5-ccf82a6da1d8.jpg?1783910800',
      thumb:
        'https://cards.scryfall.io/thumb/front/0/0/00e93be2-e06b-4774-8ba5-ccf82a6da1d8.webp?1783910800',
      grid: 'https://cards.scryfall.io/grid/front/0/0/00e93be2-e06b-4774-8ba5-ccf82a6da1d8.webp?1783910800',
      display:
        'https://cards.scryfall.io/display/front/0/0/00e93be2-e06b-4774-8ba5-ccf82a6da1d8.webp?1783910800',
      art: 'https://cards.scryfall.io/art/front/0/0/00e93be2-e06b-4774-8ba5-ccf82a6da1d8.webp?1783910800',
      crop: 'https://cards.scryfall.io/crop/front/0/0/00e93be2-e06b-4774-8ba5-ccf82a6da1d8.webp?1783910800',
    },
    legalities: {
      standard: 'legal',
      future: 'legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'legal',
    },
    game_changer: false,
    set: 'blb',
    set_name: 'Bloomburrow',
    collector_number: '205',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A73dc28a7-37ac-4b16-aa00-967c9c44d979&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/blb/205/baylen-the-haymaker?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '1.08',
      usd_foil: '2.42',
      usd_etched: null,
      eur: '0.75',
      eur_foil: '2.01',
      tix: '0.02',
    },
    produced_mana: ['B', 'G', 'R', 'U', 'W'],
    released_at: '2024-08-02',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=669119&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DBaylen%252C%2Bthe%2BHaymaker',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DBaylen%252C%2Bthe%2BHaymaker',
      edhrec: 'https://edhrec.com/route/?cc=Baylen%2C+the+Haymaker',
    },
  },
  {
    id: 'b9c11061-bb34-4904-b9f1-ea106b517bbe',
    oracle_id: '12a6cad9-eb42-43bd-9e68-aaf862cd83db',
    name: 'Adrix and Nev, Twincasters',
    layout: 'normal',
    type_line: 'Legendary Creature — Merfolk Wizard',
    cmc: 4,
    mana_cost: '{2}{G}{U}',
    oracle_text:
      'Ward {2} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {2}.)\nIf one or more tokens would be created under your control, twice that many of those tokens are created instead.',
    color_identity: ['G', 'U'],
    power: '2',
    toughness: '2',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/b/9/b9c11061-bb34-4904-b9f1-ea106b517bbe.jpg?1783912983',
      normal:
        'https://cards.scryfall.io/normal/front/b/9/b9c11061-bb34-4904-b9f1-ea106b517bbe.jpg?1783912983',
      large:
        'https://cards.scryfall.io/large/front/b/9/b9c11061-bb34-4904-b9f1-ea106b517bbe.jpg?1783912983',
      png: 'https://cards.scryfall.io/png/front/b/9/b9c11061-bb34-4904-b9f1-ea106b517bbe.png?1783912983',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/b/9/b9c11061-bb34-4904-b9f1-ea106b517bbe.jpg?1783912983',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/b/9/b9c11061-bb34-4904-b9f1-ea106b517bbe.jpg?1783912983',
      thumb:
        'https://cards.scryfall.io/thumb/front/b/9/b9c11061-bb34-4904-b9f1-ea106b517bbe.webp?1783912983',
      grid: 'https://cards.scryfall.io/grid/front/b/9/b9c11061-bb34-4904-b9f1-ea106b517bbe.webp?1783912983',
      display:
        'https://cards.scryfall.io/display/front/b/9/b9c11061-bb34-4904-b9f1-ea106b517bbe.webp?1783912983',
      art: 'https://cards.scryfall.io/art/front/b/9/b9c11061-bb34-4904-b9f1-ea106b517bbe.webp?1783912983',
      crop: 'https://cards.scryfall.io/crop/front/b/9/b9c11061-bb34-4904-b9f1-ea106b517bbe.webp?1783912983',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'not_legal',
      modern: 'not_legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'not_legal',
    },
    game_changer: false,
    set: 'mkc',
    set_name: 'Murders at Karlov Manor Commander',
    collector_number: '198',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A12a6cad9-eb42-43bd-9e68-aaf862cd83db&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/mkc/198/adrix-and-nev-twincasters?utm_source=api',
    finishes: ['nonfoil'],
    prices: {
      usd: '8.59',
      usd_foil: null,
      usd_etched: null,
      eur: '6.12',
      eur_foil: null,
      tix: '3.70',
    },
    released_at: '2024-02-09',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=650292&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DAdrix%2Band%2BNev%252C%2BTwincasters',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DAdrix%2Band%2BNev%252C%2BTwincasters',
      edhrec: 'https://edhrec.com/route/?cc=Adrix+and+Nev%2C+Twincasters',
    },
  },
  {
    id: '824b2d73-2151-4e5e-9f05-8f63e2bdcaa9',
    oracle_id: '68418069-f615-40ef-ae0d-764192acae00',
    name: 'Krenko, Mob Boss',
    layout: 'normal',
    type_line: 'Legendary Creature — Goblin Warrior',
    cmc: 4,
    mana_cost: '{2}{R}{R}',
    oracle_text:
      '{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.',
    color_identity: ['R'],
    power: '3',
    toughness: '3',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.jpg?1783909065',
      normal:
        'https://cards.scryfall.io/normal/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.jpg?1783909065',
      large:
        'https://cards.scryfall.io/large/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.jpg?1783909065',
      png: 'https://cards.scryfall.io/png/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.png?1783909065',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.jpg?1783909065',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.jpg?1783909065',
      thumb:
        'https://cards.scryfall.io/thumb/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.webp?1783909065',
      grid: 'https://cards.scryfall.io/grid/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.webp?1783909065',
      display:
        'https://cards.scryfall.io/display/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.webp?1783909065',
      art: 'https://cards.scryfall.io/art/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.webp?1783909065',
      crop: 'https://cards.scryfall.io/crop/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.webp?1783909065',
    },
    legalities: {
      standard: 'legal',
      future: 'legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'not_legal',
    },
    game_changer: false,
    set: 'fdn',
    set_name: 'Foundations',
    collector_number: '204',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A68418069-f615-40ef-ae0d-764192acae00&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/fdn/204/krenko-mob-boss?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '2.81',
      usd_foil: '3.28',
      usd_etched: null,
      eur: '1.73',
      eur_foil: '2.30',
      tix: '0.02',
    },
    released_at: '2024-11-15',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=679946&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DKrenko%252C%2BMob%2BBoss',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DKrenko%252C%2BMob%2BBoss',
      edhrec: 'https://edhrec.com/route/?cc=Krenko%2C+Mob+Boss',
    },
  },
  {
    id: '1ca79dd4-67fc-496c-96fc-489b039c4932',
    oracle_id: '486bb9a5-73f1-4cec-b097-fb07ac80b72e',
    name: 'Ojer Taq, Deepest Foundation // Temple of Civilization',
    layout: 'transform',
    type_line: 'Legendary Creature — God // Land',
    cmc: 6,
    color_identity: ['W'],
    card_faces: [
      {
        object: 'card_face',
        name: 'Ojer Taq, Deepest Foundation',
        mana_cost: '{4}{W}{W}',
        type_line: 'Legendary Creature — God',
        oracle_text:
          "Vigilance\nIf one or more creature tokens would be created under your control, three times that many of those tokens are created instead.\nWhen Ojer Taq dies, return it to the battlefield tapped and transformed under its owner's control.",
        colors: ['W'],
        power: '6',
        toughness: '6',
        artist: 'Cristi Balanescu',
        artist_id: 'c09ede88-a1b5-4a18-9895-dc8a965d28a5',
        illustration_id: 'b48923ff-64d7-4329-a572-04e8235d6f1c',
        image_uris: {
          small:
            'https://cards.scryfall.io/small/front/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.jpg?1783913811',
          normal:
            'https://cards.scryfall.io/normal/front/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.jpg?1783913811',
          large:
            'https://cards.scryfall.io/large/front/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.jpg?1783913811',
          png: 'https://cards.scryfall.io/png/front/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.png?1783913811',
          art_crop:
            'https://cards.scryfall.io/art_crop/front/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.jpg?1783913811',
          border_crop:
            'https://cards.scryfall.io/border_crop/front/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.jpg?1783913811',
          thumb:
            'https://cards.scryfall.io/thumb/front/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.webp?1783913811',
          grid: 'https://cards.scryfall.io/grid/front/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.webp?1783913811',
          display:
            'https://cards.scryfall.io/display/front/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.webp?1783913811',
          art: 'https://cards.scryfall.io/art/front/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.webp?1783913811',
          crop: 'https://cards.scryfall.io/crop/front/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.webp?1783913811',
        },
      },
      {
        object: 'card_face',
        name: 'Temple of Civilization',
        mana_cost: '',
        type_line: 'Land',
        oracle_text:
          '(Transforms from Ojer Taq, Deepest Foundation.)\n{T}: Add {W}.\n{2}{W}, {T}: Transform this land. Activate only if you attacked with three or more creatures this turn and only as a sorcery.',
        colors: [],
        flavor_text: 'Chimil gave the Oltec life. Ojer Taq taught them how to live together.',
        artist: 'Cristi Balanescu',
        artist_id: 'c09ede88-a1b5-4a18-9895-dc8a965d28a5',
        illustration_id: '993edfed-2a1f-4604-88df-cd0217e143cd',
        image_uris: {
          small:
            'https://cards.scryfall.io/small/back/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.jpg?1783913811',
          normal:
            'https://cards.scryfall.io/normal/back/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.jpg?1783913811',
          large:
            'https://cards.scryfall.io/large/back/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.jpg?1783913811',
          png: 'https://cards.scryfall.io/png/back/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.png?1783913811',
          art_crop:
            'https://cards.scryfall.io/art_crop/back/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.jpg?1783913811',
          border_crop:
            'https://cards.scryfall.io/border_crop/back/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.jpg?1783913811',
          thumb:
            'https://cards.scryfall.io/thumb/back/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.webp?1783913811',
          grid: 'https://cards.scryfall.io/grid/back/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.webp?1783913811',
          display:
            'https://cards.scryfall.io/display/back/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.webp?1783913811',
          art: 'https://cards.scryfall.io/art/back/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.webp?1783913811',
          crop: 'https://cards.scryfall.io/crop/back/1/c/1ca79dd4-67fc-496c-96fc-489b039c4932.webp?1783913811',
        },
      },
    ],
    legalities: {
      standard: 'legal',
      future: 'legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'not_legal',
    },
    game_changer: false,
    set: 'lci',
    set_name: 'The Lost Caverns of Ixalan',
    collector_number: '26',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A486bb9a5-73f1-4cec-b097-fb07ac80b72e&unique=prints',
    scryfall_uri:
      'https://scryfall.com/card/lci/26/ojer-taq-deepest-foundation-temple-of-civilization?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '30.28',
      usd_foil: '38.01',
      usd_etched: null,
      eur: '20.20',
      eur_foil: '22.16',
      tix: '0.06',
    },
    produced_mana: ['W'],
    released_at: '2023-11-17',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=636717&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DOjer%2BTaq%252C%2BDeepest%2BFoundation%2B%252F%252F%2BTemple%2Bof%2BCivilization',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DOjer%2BTaq%252C%2BDeepest%2BFoundation%2B%252F%252F%2BTemple%2Bof%2BCivilization',
      edhrec: 'https://edhrec.com/route/?cc=Ojer+Taq%2C+Deepest+Foundation',
    },
  },
  {
    id: '8fbd18ce-0ac3-4b52-9cd0-0af7e0244207',
    oracle_id: '7e00b0cd-d212-4604-ba07-da21f4fe00b0',
    name: 'Sram, Senior Edificer',
    layout: 'normal',
    type_line: 'Legendary Creature — Dwarf Advisor',
    cmc: 2,
    mana_cost: '{1}{W}',
    oracle_text: 'Whenever you cast an Aura, Equipment, or Vehicle spell, draw a card.',
    color_identity: ['W'],
    power: '2',
    toughness: '2',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/8/f/8fbd18ce-0ac3-4b52-9cd0-0af7e0244207.jpg?1783903797',
      normal:
        'https://cards.scryfall.io/normal/front/8/f/8fbd18ce-0ac3-4b52-9cd0-0af7e0244207.jpg?1783903797',
      large:
        'https://cards.scryfall.io/large/front/8/f/8fbd18ce-0ac3-4b52-9cd0-0af7e0244207.jpg?1783903797',
      png: 'https://cards.scryfall.io/png/front/8/f/8fbd18ce-0ac3-4b52-9cd0-0af7e0244207.png?1783903797',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/8/f/8fbd18ce-0ac3-4b52-9cd0-0af7e0244207.jpg?1783903797',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/8/f/8fbd18ce-0ac3-4b52-9cd0-0af7e0244207.jpg?1783903797',
      thumb:
        'https://cards.scryfall.io/thumb/front/8/f/8fbd18ce-0ac3-4b52-9cd0-0af7e0244207.webp?1783903797',
      grid: 'https://cards.scryfall.io/grid/front/8/f/8fbd18ce-0ac3-4b52-9cd0-0af7e0244207.webp?1783903797',
      display:
        'https://cards.scryfall.io/display/front/8/f/8fbd18ce-0ac3-4b52-9cd0-0af7e0244207.webp?1783903797',
      art: 'https://cards.scryfall.io/art/front/8/f/8fbd18ce-0ac3-4b52-9cd0-0af7e0244207.webp?1783903797',
      crop: 'https://cards.scryfall.io/crop/front/8/f/8fbd18ce-0ac3-4b52-9cd0-0af7e0244207.webp?1783903797',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'legal',
    },
    game_changer: false,
    set: 'soc',
    set_name: 'Secrets of Strixhaven Commander',
    collector_number: '176',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A7e00b0cd-d212-4604-ba07-da21f4fe00b0&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/soc/176/sram-senior-edificer?utm_source=api',
    finishes: ['nonfoil'],
    prices: {
      usd: '1.61',
      usd_foil: null,
      usd_etched: null,
      eur: '1.52',
      eur_foil: null,
      tix: '0.17',
    },
    released_at: '2026-04-24',
    related_uris: {
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DSram%252C%2BSenior%2BEdificer',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DSram%252C%2BSenior%2BEdificer',
      edhrec: 'https://edhrec.com/route/?cc=Sram%2C+Senior+Edificer',
    },
  },
  {
    id: '8ee443cc-e17a-493b-9c93-1f9e141a30e4',
    oracle_id: '6ad8011d-3471-4369-9d68-b264cc027487',
    name: 'Sol Ring',
    layout: 'normal',
    type_line: 'Artifact',
    cmc: 1,
    mana_cost: '{1}',
    oracle_text: '{T}: Add {C}{C}.',
    color_identity: [],
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.jpg?1789644446',
      normal:
        'https://cards.scryfall.io/normal/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.jpg?1789644446',
      large:
        'https://cards.scryfall.io/large/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.jpg?1789644446',
      png: 'https://cards.scryfall.io/png/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.png?1789644446',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.jpg?1789644446',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.jpg?1789644446',
      thumb:
        'https://cards.scryfall.io/thumb/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.webp?1789644446',
      grid: 'https://cards.scryfall.io/grid/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.webp?1789644446',
      display:
        'https://cards.scryfall.io/display/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.webp?1789644446',
      art: 'https://cards.scryfall.io/art/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.webp?1789644446',
      crop: 'https://cards.scryfall.io/crop/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.webp?1789644446',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'not_legal',
      timeless: 'not_legal',
      gladiator: 'not_legal',
      pioneer: 'not_legal',
      modern: 'not_legal',
      legacy: 'banned',
      pauper: 'not_legal',
      vintage: 'restricted',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'banned',
      standardbrawl: 'not_legal',
      brawl: 'not_legal',
      competitivebrawl: 'not_legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'banned',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'legal',
      tlr: 'banned',
    },
    game_changer: false,
    set: 'frc',
    set_name: 'Reality Fracture Commander',
    collector_number: '21',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A6ad8011d-3471-4369-9d68-b264cc027487&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/frc/21/sol-ring?utm_source=api',
    finishes: ['nonfoil'],
    prices: {
      usd: '1.28',
      usd_foil: null,
      usd_etched: null,
      eur: '1.13',
      eur_foil: null,
      tix: '0.02',
    },
    produced_mana: ['C'],
    released_at: '2026-10-02',
    related_uris: {
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DSol%2BRing',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DSol%2BRing',
      edhrec: 'https://edhrec.com/route/?cc=Sol+Ring',
    },
  },
  {
    id: 'c6b6117c-faab-4bbb-b851-07bd8061ef03',
    oracle_id: '0bc7f093-bef0-4f1a-852c-4b75ebf54838',
    name: 'Arcane Signet',
    layout: 'normal',
    type_line: 'Artifact',
    cmc: 2,
    mana_cost: '{2}',
    oracle_text: "{T}: Add one mana of any color in your commander's color identity.",
    color_identity: [],
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.jpg?1789644435',
      normal:
        'https://cards.scryfall.io/normal/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.jpg?1789644435',
      large:
        'https://cards.scryfall.io/large/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.jpg?1789644435',
      png: 'https://cards.scryfall.io/png/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.png?1789644435',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.jpg?1789644435',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.jpg?1789644435',
      thumb:
        'https://cards.scryfall.io/thumb/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.webp?1789644435',
      grid: 'https://cards.scryfall.io/grid/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.webp?1789644435',
      display:
        'https://cards.scryfall.io/display/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.webp?1789644435',
      art: 'https://cards.scryfall.io/art/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.webp?1789644435',
      crop: 'https://cards.scryfall.io/crop/front/c/6/c6b6117c-faab-4bbb-b851-07bd8061ef03.webp?1789644435',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'legal',
      paupercommander: 'legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'not_legal',
      tlr: 'legal',
    },
    game_changer: false,
    set: 'frc',
    set_name: 'Reality Fracture Commander',
    collector_number: '20',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A0bc7f093-bef0-4f1a-852c-4b75ebf54838&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/frc/20/arcane-signet?utm_source=api',
    finishes: ['nonfoil'],
    prices: {
      usd: '0.34',
      usd_foil: null,
      usd_etched: null,
      eur: '0.27',
      eur_foil: null,
      tix: '0.02',
    },
    produced_mana: ['B', 'G', 'R', 'U', 'W'],
    released_at: '2026-10-02',
    related_uris: {
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DArcane%2BSignet',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DArcane%2BSignet',
      edhrec: 'https://edhrec.com/route/?cc=Arcane+Signet',
    },
  },
  {
    id: '6a0b230b-d391-4998-a3f7-7b158a0ec2cd',
    oracle_id: '68954295-54e3-4303-a6bc-fc4547a4e3a3',
    name: 'Llanowar Elves',
    layout: 'normal',
    type_line: 'Creature — Elf Druid',
    cmc: 1,
    mana_cost: '{G}',
    oracle_text: '{T}: Add {G}.',
    color_identity: ['G'],
    power: '1',
    toughness: '1',
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.jpg?1783909057',
      normal:
        'https://cards.scryfall.io/normal/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.jpg?1783909057',
      large:
        'https://cards.scryfall.io/large/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.jpg?1783909057',
      png: 'https://cards.scryfall.io/png/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.png?1783909057',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.jpg?1783909057',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.jpg?1783909057',
      thumb:
        'https://cards.scryfall.io/thumb/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.webp?1783909057',
      grid: 'https://cards.scryfall.io/grid/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.webp?1783909057',
      display:
        'https://cards.scryfall.io/display/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.webp?1783909057',
      art: 'https://cards.scryfall.io/art/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.webp?1783909057',
      crop: 'https://cards.scryfall.io/crop/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.webp?1783909057',
    },
    legalities: {
      standard: 'legal',
      future: 'legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'legal',
      paupercommander: 'legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'legal',
      predh: 'legal',
      tlr: 'legal',
    },
    game_changer: false,
    set: 'fdn',
    set_name: 'Foundations',
    collector_number: '227',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A68954295-54e3-4303-a6bc-fc4547a4e3a3&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/fdn/227/llanowar-elves?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '0.24',
      usd_foil: '1.67',
      usd_etched: null,
      eur: '0.21',
      eur_foil: '0.52',
      tix: '0.03',
    },
    produced_mana: ['G'],
    released_at: '2024-11-15',
    related_uris: {
      gatherer:
        'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=679969&printed=false',
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DLlanowar%2BElves',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DLlanowar%2BElves',
      edhrec: 'https://edhrec.com/route/?cc=Llanowar+Elves',
    },
  },
  {
    id: '400b43aa-c1d2-4435-b863-061f43889422',
    oracle_id: '7735eeba-693b-47e2-bd51-414379cf1016',
    name: 'Beast Within',
    layout: 'normal',
    type_line: 'Instant',
    cmc: 3,
    mana_cost: '{2}{G}',
    oracle_text:
      'Destroy target permanent. Its controller creates a 3/3 green Beast creature token.',
    color_identity: ['G'],
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.jpg?1783903232',
      normal:
        'https://cards.scryfall.io/normal/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.jpg?1783903232',
      large:
        'https://cards.scryfall.io/large/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.jpg?1783903232',
      png: 'https://cards.scryfall.io/png/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.png?1783903232',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.jpg?1783903232',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.jpg?1783903232',
      thumb:
        'https://cards.scryfall.io/thumb/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.webp?1783903232',
      grid: 'https://cards.scryfall.io/grid/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.webp?1783903232',
      display:
        'https://cards.scryfall.io/display/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.webp?1783903232',
      art: 'https://cards.scryfall.io/art/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.webp?1783903232',
      crop: 'https://cards.scryfall.io/crop/front/4/0/400b43aa-c1d2-4435-b863-061f43889422.webp?1783903232',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'not_legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'legal',
      tlr: 'legal',
    },
    game_changer: false,
    set: 'msc',
    set_name: 'Marvel Super Heroes Commander',
    collector_number: '169',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A7735eeba-693b-47e2-bd51-414379cf1016&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/msc/169/beast-within?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '0.72',
      usd_foil: null,
      usd_etched: null,
      eur: '0.89',
      eur_foil: null,
      tix: '0.06',
    },
    released_at: '2026-06-26',
    related_uris: {
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DBeast%2BWithin',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DBeast%2BWithin',
      edhrec: 'https://edhrec.com/route/?cc=Beast+Within',
    },
  },
  {
    id: 'f7e12477-d59f-442b-a678-1be746d0b7be',
    oracle_id: 'b1544f21-7e98-461b-aed5-e748b0168c52',
    name: 'Swords to Plowshares',
    layout: 'normal',
    type_line: 'Instant',
    cmc: 1,
    mana_cost: '{W}',
    oracle_text: 'Exile target creature. Its controller gains life equal to its power.',
    color_identity: ['W'],
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.jpg?1789599810',
      normal:
        'https://cards.scryfall.io/normal/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.jpg?1789599810',
      large:
        'https://cards.scryfall.io/large/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.jpg?1789599810',
      png: 'https://cards.scryfall.io/png/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.png?1789599810',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.jpg?1789599810',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.jpg?1789599810',
      thumb:
        'https://cards.scryfall.io/thumb/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.webp?1789599810',
      grid: 'https://cards.scryfall.io/grid/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.webp?1789599810',
      display:
        'https://cards.scryfall.io/display/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.webp?1789599810',
      art: 'https://cards.scryfall.io/art/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.webp?1789599810',
      crop: 'https://cards.scryfall.io/crop/front/f/7/f7e12477-d59f-442b-a678-1be746d0b7be.webp?1789599810',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'banned',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'not_legal',
      modern: 'not_legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'legal',
      predh: 'legal',
      tlr: 'legal',
    },
    game_changer: false,
    set: 'frc',
    set_name: 'Reality Fracture Commander',
    collector_number: '37',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Ab1544f21-7e98-461b-aed5-e748b0168c52&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/frc/37/swords-to-plowshares?utm_source=api',
    finishes: ['nonfoil'],
    prices: {
      usd: '0.69',
      usd_foil: null,
      usd_etched: null,
      eur: '1.51',
      eur_foil: null,
      tix: '0.02',
    },
    released_at: '2026-10-02',
    related_uris: {
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DSwords%2Bto%2BPlowshares',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DSwords%2Bto%2BPlowshares',
      edhrec: 'https://edhrec.com/route/?cc=Swords+to+Plowshares',
    },
  },
  {
    id: 'e60deb92-f7dd-4f4e-9036-e47dd586f985',
    oracle_id: '8b755881-a72d-4e21-a369-d2924eb4585a',
    name: 'Cultivate',
    layout: 'normal',
    type_line: 'Sorcery',
    cmc: 3,
    mana_cost: '{2}{G}',
    oracle_text:
      'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.',
    color_identity: ['G'],
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.jpg?1783903229',
      normal:
        'https://cards.scryfall.io/normal/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.jpg?1783903229',
      large:
        'https://cards.scryfall.io/large/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.jpg?1783903229',
      png: 'https://cards.scryfall.io/png/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.png?1783903229',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.jpg?1783903229',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.jpg?1783903229',
      thumb:
        'https://cards.scryfall.io/thumb/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.webp?1783903229',
      grid: 'https://cards.scryfall.io/grid/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.webp?1783903229',
      display:
        'https://cards.scryfall.io/display/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.webp?1783903229',
      art: 'https://cards.scryfall.io/art/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.webp?1783903229',
      crop: 'https://cards.scryfall.io/crop/front/e/6/e60deb92-f7dd-4f4e-9036-e47dd586f985.webp?1783903229',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'legal',
      vintage: 'legal',
      penny: 'legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'not_legal',
      paupercommander: 'legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'legal',
      tlr: 'legal',
    },
    game_changer: false,
    set: 'msc',
    set_name: 'Marvel Super Heroes Commander',
    collector_number: '172',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A8b755881-a72d-4e21-a369-d2924eb4585a&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/msc/172/cultivate?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '0.43',
      usd_foil: null,
      usd_etched: null,
      eur: '0.50',
      eur_foil: null,
      tix: '0.04',
    },
    released_at: '2026-06-26',
    related_uris: {
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DCultivate',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DCultivate',
      edhrec: 'https://edhrec.com/route/?cc=Cultivate',
    },
  },
  {
    id: '1d8b007b-3169-4ee3-80c7-781fc096fc7a',
    oracle_id: '65986c1b-8e51-4604-b685-d82fa7d1263a',
    name: 'Skullclamp',
    layout: 'normal',
    type_line: 'Artifact — Equipment',
    cmc: 1,
    mana_cost: '{1}',
    oracle_text:
      'Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}',
    color_identity: [],
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/1/d/1d8b007b-3169-4ee3-80c7-781fc096fc7a.jpg?1783903215',
      normal:
        'https://cards.scryfall.io/normal/front/1/d/1d8b007b-3169-4ee3-80c7-781fc096fc7a.jpg?1783903215',
      large:
        'https://cards.scryfall.io/large/front/1/d/1d8b007b-3169-4ee3-80c7-781fc096fc7a.jpg?1783903215',
      png: 'https://cards.scryfall.io/png/front/1/d/1d8b007b-3169-4ee3-80c7-781fc096fc7a.png?1783903215',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/1/d/1d8b007b-3169-4ee3-80c7-781fc096fc7a.jpg?1783903215',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/1/d/1d8b007b-3169-4ee3-80c7-781fc096fc7a.jpg?1783903215',
      thumb:
        'https://cards.scryfall.io/thumb/front/1/d/1d8b007b-3169-4ee3-80c7-781fc096fc7a.webp?1783903215',
      grid: 'https://cards.scryfall.io/grid/front/1/d/1d8b007b-3169-4ee3-80c7-781fc096fc7a.webp?1783903215',
      display:
        'https://cards.scryfall.io/display/front/1/d/1d8b007b-3169-4ee3-80c7-781fc096fc7a.webp?1783903215',
      art: 'https://cards.scryfall.io/art/front/1/d/1d8b007b-3169-4ee3-80c7-781fc096fc7a.webp?1783903215',
      crop: 'https://cards.scryfall.io/crop/front/1/d/1d8b007b-3169-4ee3-80c7-781fc096fc7a.webp?1783903215',
    },
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'not_legal',
      timeless: 'not_legal',
      gladiator: 'not_legal',
      pioneer: 'not_legal',
      modern: 'banned',
      legacy: 'banned',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'not_legal',
      competitivebrawl: 'not_legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'legal',
      tlr: 'banned',
    },
    game_changer: false,
    set: 'msc',
    set_name: 'Marvel Super Heroes Commander',
    collector_number: '210',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A65986c1b-8e51-4604-b685-d82fa7d1263a&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/msc/210/skullclamp?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: '5.23',
      usd_foil: null,
      usd_etched: null,
      eur: '5.75',
      eur_foil: null,
      tix: '0.81',
    },
    released_at: '2026-06-26',
    related_uris: {
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DSkullclamp',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DSkullclamp',
      edhrec: 'https://edhrec.com/route/?cc=Skullclamp',
    },
  },
  {
    id: 'b9b0589d-f327-46a7-8bac-06b7654c547a',
    oracle_id: 'f413a83d-a40d-434c-b20a-4c707c0527fa',
    name: 'Temple Garden',
    layout: 'normal',
    type_line: 'Land — Forest Plains',
    cmc: 0,
    mana_cost: '',
    oracle_text:
      "({T}: Add {G} or {W}.)\nAs this land enters, you may pay 2 life. If you don't, it enters tapped.",
    color_identity: ['G', 'W'],
    image_uris: {
      small:
        'https://cards.scryfall.io/small/front/b/9/b9b0589d-f327-46a7-8bac-06b7654c547a.jpg?1784036854',
      normal:
        'https://cards.scryfall.io/normal/front/b/9/b9b0589d-f327-46a7-8bac-06b7654c547a.jpg?1784036854',
      large:
        'https://cards.scryfall.io/large/front/b/9/b9b0589d-f327-46a7-8bac-06b7654c547a.jpg?1784036854',
      png: 'https://cards.scryfall.io/png/front/b/9/b9b0589d-f327-46a7-8bac-06b7654c547a.png?1784036854',
      art_crop:
        'https://cards.scryfall.io/art_crop/front/b/9/b9b0589d-f327-46a7-8bac-06b7654c547a.jpg?1784036854',
      border_crop:
        'https://cards.scryfall.io/border_crop/front/b/9/b9b0589d-f327-46a7-8bac-06b7654c547a.jpg?1784036854',
      thumb:
        'https://cards.scryfall.io/thumb/front/b/9/b9b0589d-f327-46a7-8bac-06b7654c547a.webp?1784036854',
      grid: 'https://cards.scryfall.io/grid/front/b/9/b9b0589d-f327-46a7-8bac-06b7654c547a.webp?1784036854',
      display:
        'https://cards.scryfall.io/display/front/b/9/b9b0589d-f327-46a7-8bac-06b7654c547a.webp?1784036854',
      art: 'https://cards.scryfall.io/art/front/b/9/b9b0589d-f327-46a7-8bac-06b7654c547a.webp?1784036854',
      crop: 'https://cards.scryfall.io/crop/front/b/9/b9b0589d-f327-46a7-8bac-06b7654c547a.webp?1784036854',
    },
    legalities: {
      standard: 'legal',
      future: 'legal',
      historic: 'legal',
      timeless: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'legal',
      brawl: 'legal',
      competitivebrawl: 'legal',
      alchemy: 'legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'not_legal',
      predh: 'legal',
      tlr: 'legal',
    },
    game_changer: false,
    set: 'trk',
    set_name: 'Star Trek',
    collector_number: '301',
    prints_search_uri:
      'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Af413a83d-a40d-434c-b20a-4c707c0527fa&unique=prints',
    scryfall_uri: 'https://scryfall.com/card/trk/301/temple-garden?utm_source=api',
    finishes: ['nonfoil', 'foil'],
    prices: {
      usd: null,
      usd_foil: null,
      usd_etched: null,
      eur: null,
      eur_foil: null,
      tix: null,
    },
    produced_mana: ['G', 'W'],
    released_at: '2026-11-13',
    related_uris: {
      tcgplayer_infinite_articles:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Farticles&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Farticles%3FproductLineName%3Dmagic%26q%3DTemple%2BGarden',
      tcgplayer_infinite_decks:
        'https://partner.tcgplayer.com/c/4931599/1830156/21018?subId1=api&trafcat=tcgplayer.com%2Fsearch%2Fdecks&u=https%3A%2F%2Fwww.tcgplayer.com%2Fsearch%2Fdecks%3FproductLineName%3Dmagic%26q%3DTemple%2BGarden',
      edhrec: 'https://edhrec.com/route/?cc=Temple+Garden',
    },
  },
]
