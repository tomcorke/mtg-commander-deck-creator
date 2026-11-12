import {
  scryfallBackImage,
  type CardFinish,
  type DeckCard,
  type Printing,
  type ScryfallCard,
} from './card-model.ts'
import { hasBackFace } from './card-layout.ts'

type PrintingRepairCard = Pick<DeckCard, 'layout' | 'backImage' | 'setName' | 'scryfallUri'> & {
  printings?: Pick<Printing, 'finish' | 'setName' | 'scryfallUri' | 'backImage'>[]
}

export const needsPrintingRepair = (card: PrintingRepairCard) =>
  !card.setName ||
  !card.scryfallUri ||
  (hasBackFace(card.layout) && !card.backImage) ||
  Boolean(
    card.printings?.some(
      (printing) =>
        !printing.finish ||
        !printing.setName ||
        !printing.scryfallUri ||
        (hasBackFace(card.layout) && !printing.backImage),
    ),
  )

export const defaultFinish = (finishes?: CardFinish[]) =>
  finishes?.includes('nonfoil') ? 'nonfoil' : finishes?.[0]

// Automatic choices take a matching nonfoil option. A foil or etched option qualifies only when its
// printing has no nonfoil option, so a price cap never swaps a nonfoil for a cheaper foil.
// Options without a finish predate finishes and count as nonfoil.
export const nonfoilFirstIndex = <T extends { image: string; finish?: CardFinish }>(
  printings: T[],
  matches: (printing: T) => boolean,
) => {
  const isNonfoil = (printing: T) => (printing.finish ?? 'nonfoil') === 'nonfoil'
  const nonfoil = printings.findIndex((printing) => matches(printing) && isNonfoil(printing))
  if (nonfoil >= 0) return nonfoil
  const nonfoilImages = new Set(printings.filter(isNonfoil).map((printing) => printing.image))
  return printings.findIndex((printing) => matches(printing) && !nonfoilImages.has(printing.image))
}

// Memorabilia sets (World Championship decks, Collectors' Edition, 30th Anniversary) are not
// tournament legal; the set picker drops them for the same reason.
const isNonStandard = (card: Pick<ScryfallCard, 'set_type' | 'lang' | 'digital' | 'oversized'>) =>
  card.set_type === 'memorabilia' ||
  Boolean(card.oversized) ||
  Boolean(card.digital) ||
  (card.lang !== undefined && card.lang !== 'en')

// With no set to prefer, an automatic choice takes the cheapest priced nonfoil option of a standard
// printing (#527). Ties keep the earlier option, so the original printing wins an equal price.
export const cheapestNonfoilIndex = <
  T extends { finish?: CardFinish; price?: string; nonStandard?: true },
>(
  printings: T[],
) => {
  let cheapest = -1
  let cheapestPrice = Infinity
  printings.forEach((printing, index) => {
    const price = printing.price?.trim() ? Number(printing.price) : NaN
    if (
      (printing.finish ?? 'nonfoil') === 'nonfoil' &&
      !printing.nonStandard &&
      Number.isFinite(price) &&
      price < cheapestPrice
    ) {
      cheapest = index
      cheapestPrice = price
    }
  })
  return cheapest
}

// Scryfall promo_types that name a foil treatment; names follow the mtg.wiki "Foil" page.
export const foilTypeNames: Record<string, string> = {
  surgefoil: 'Surge foil',
  galaxyfoil: 'Galaxy foil',
  silverfoil: 'Silverscreen foil',
  ripplefoil: 'Ripple foil',
  doublerainbow: 'Double rainbow foil',
  rainbowfoil: 'Rainbow foil',
  halofoil: 'Halo foil',
  firstplacefoil: 'First-place foil',
  embossed: 'Embossed foil',
  textured: 'Textured foil',
  stepandcompleat: 'Step-and-compleat foil',
  fracturefoil: 'Fracture foil',
  raisedfoil: 'Raised foil',
  silverscroll: 'Silver scroll foil',
  manafoil: 'Mana foil',
  gilded: 'Gilded foil',
  confettifoil: 'Confetti foil',
  neonink: 'Neon ink foil',
  oilslick: 'Oil slick foil',
  chocobotrackfoil: 'Chocobo track foil',
  invisibleink: 'Invisible ink foil',
  facetfoil: 'Facet foil',
  dazzlefoil: 'Dazzle foil',
  dragonscalefoil: 'Dragonscale foil',
  cosmicfoil: 'Cosmic foil',
  singularityfoil: 'Singularity foil',
  gleaminggold: 'Gleaming gold foil',
}

// Scryfall does not say which finish a promo type belongs to, so only the foil finish gets one.
export const foilTypeFor = (
  card: Pick<ScryfallCard, 'promo_types'>,
  finish: CardFinish | undefined,
) =>
  finish === 'foil'
    ? card.promo_types?.find((type) => Object.hasOwn(foilTypeNames, type))
    : undefined

export const finishLabel = (card: { finish?: CardFinish; foilType?: string }) =>
  card.finish === 'foil'
    ? ((card.foilType && foilTypeNames[card.foilType]) ?? 'Foil')
    : card.finish === 'etched'
      ? 'Etched'
      : undefined

export const finishPrice = (card: Pick<ScryfallCard, 'prices'>, finish: CardFinish | undefined) =>
  (finish === 'etched'
    ? card.prices?.usd_etched
    : finish === 'foil'
      ? card.prices?.usd_foil
      : card.prices?.usd) ?? undefined

export const printingOptions = (cards: ScryfallCard[]) =>
  cards
    .flatMap((printing) => {
      const image = printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal
      return image
        ? (printing.finishes ?? ['nonfoil']).map((finish) => ({
            image,
            backImage: scryfallBackImage(printing),
            art: printing.image_uris?.art_crop ?? printing.card_faces?.[0]?.image_uris?.art_crop,
            set: printing.set,
            setName: printing.set_name,
            collectorNumber: printing.collector_number,
            scryfallUri: printing.scryfall_uri,
            price: finishPrice(printing, finish),
            priceUri: printing.purchase_uris?.tcgplayer,
            finish,
            foilType: foilTypeFor(printing, finish),
            ...(isNonStandard(printing) && { nonStandard: true as const }),
          }))
        : []
    })
    .filter(
      (printing, index, all) =>
        all.findIndex(
          (item) => item.image === printing.image && item.finish === printing.finish,
        ) === index,
    )
