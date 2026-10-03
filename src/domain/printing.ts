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
export const commanderPrintingOptions = (cards: ScryfallCard[]) =>
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
            price:
              (finish === 'etched'
                ? printing.prices?.usd_etched
                : finish === 'foil'
                  ? printing.prices?.usd_foil
                  : printing.prices?.usd) ?? undefined,
            priceUri: printing.purchase_uris?.tcgplayer,
            finish,
          }))
        : []
    })
    .filter(
      (printing, index, all) =>
        all.findIndex(
          (item) => item.image === printing.image && item.finish === printing.finish,
        ) === index,
    )
export const cardPrintingOptions = (cards: ScryfallCard[]) =>
  cards
    .flatMap((printing) => {
      const image = printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal
      return image
        ? (printing.finishes ?? ['nonfoil']).map((finish) => ({
            image,
            backImage: scryfallBackImage(printing),
            set: printing.set,
            setName: printing.set_name,
            collectorNumber: printing.collector_number,
            scryfallUri: printing.scryfall_uri,
            price:
              (finish === 'etched'
                ? printing.prices?.usd_etched
                : finish === 'foil'
                  ? printing.prices?.usd_foil
                  : printing.prices?.usd) ?? undefined,
            priceUri: printing.purchase_uris?.tcgplayer,
            finish,
          }))
        : []
    })
    .filter(
      (printing, index, all) =>
        all.findIndex(
          (item) => item.image === printing.image && item.finish === printing.finish,
        ) === index,
    )
