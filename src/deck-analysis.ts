export const targetKeys = ['lands', 'ramp', 'draw', 'removal', 'wipes'] as const
export type TargetKey = typeof targetKeys[number]
export type DeckTargets = Record<TargetKey, number>
export type AnalysisCard = { name: string; layout: string; typeLine: string; manaCost: string; manaValue: number; detail: string; producedMana: string[]; faces: { typeLine: string; manaCost: string }[] }

export const defaultDeckTargets: DeckTargets = { lands: 35, ramp: 10, draw: 10, removal: 8, wipes: 3 }
export const targetLabels: Record<TargetKey, string> = { lands: 'Lands', ramp: 'Ramp', draw: 'Card draw', removal: 'Targeted removal', wipes: 'Board wipes' }
export const cardTypes = ['Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Planeswalker', 'Battle'] as const
const colours = ['W', 'U', 'B', 'R', 'G'] as const
export type ManaColour = typeof colours[number]
export const basicLandNames: Record<ManaColour, string> = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' }
export const isBasicLandName = (name: string) => name === 'Wastes' || Object.values(basicLandNames).includes(name)

const isLand = (card: AnalysisCard) => card.typeLine.includes('Land') || card.faces.some((face) => face.typeLine.includes('Land'))
const curveType = (card: AnalysisCard) => card.layout === 'modal_dfc' ? card.faces.find((face) => !face.typeLine.includes('Land'))?.typeLine : card.faces[0]?.typeLine ?? card.typeLine
export const curveBucket = (card: AnalysisCard) => curveType(card) === undefined || (isLand(card) && card.layout !== 'modal_dfc') ? null : Math.min(Math.floor(card.manaValue), 7)
const isPermanent = (card: AnalysisCard) => !/\b(?:Instant|Sorcery)\b/.test(curveType(card) ?? '')
const isWipe = (text: string) => /(?:destroy|exile) all|all (?:creatures|artifacts|enchantments|permanents)|each (?:creature|artifact|enchantment|player) (?:sacrifices|exiles) (?:all|any number)/i.test(text)
const isRemoval = (text: string) => !isWipe(text) && /(?:destroy|exile|return) target|target .* gets -(?:\d+|x)\/(?:-\d+|-x)|(?:deals?.* to|fights?) target|counter target/i.test(text)
const isRamp = (card: AnalysisCard) => !isLand(card) && (card.producedMana.length > 0 || /search your library for (?:a|up to \w+) (?:basic )?land|add \{/i.test(card.detail))
const isDraw = (text: string) => /draw (?:(?:a|one|two|three|\d+|that many|x) cards?|cards? equal to)/i.test(text)
const manaCosts = (card: AnalysisCard) => card.faces.length ? card.faces.filter((face) => !face.typeLine.includes('Land')).map((face) => face.manaCost) : [card.manaCost]

export function analyseDeck(cards: AnalysisCard[]) {
  const spells = cards.filter((card) => curveBucket(card) !== null)
  const curve = Array.from({ length: 8 }, (_, manaValue) => ({
    manaValue,
    permanents: spells.filter((card) => isPermanent(card) && curveBucket(card) === manaValue).length,
    nonPermanents: spells.filter((card) => !isPermanent(card) && curveBucket(card) === manaValue).length,
  }))
  const required = Object.fromEntries(colours.map((colour) => [colour, cards.reduce((count, card) => count + manaCosts(card).flatMap((cost) => [...cost.matchAll(/\{([^}]+)\}/g)]).filter(([, symbol]) => symbol.split('/').includes(colour)).length, 0)])) as Record<typeof colours[number], number>
  const produced = Object.fromEntries(colours.map((colour) => [colour, cards.filter((card) => card.producedMana.includes(colour)).length])) as Record<typeof colours[number], number>
  const counts: DeckTargets = {
    lands: cards.filter(isLand).length,
    ramp: cards.filter(isRamp).length,
    draw: cards.filter((card) => isDraw(card.detail)).length,
    removal: cards.filter((card) => isRemoval(card.detail)).length,
    wipes: cards.filter((card) => isWipe(card.detail)).length,
  }
  const typeCounts = Object.fromEntries(cardTypes.map((type) => [type, cards.filter((card) => [card.typeLine, ...card.faces.map((face) => face.typeLine)].some((line) => new RegExp(`\\b${type}\\b`).test(line))).length])) as Record<typeof cardTypes[number], number>
  const averageManaValue = spells.length ? spells.reduce((sum, card) => sum + card.manaValue, 0) / spells.length : 0
  const landCentre = Math.max(32, Math.min(40, Math.round(35 + (averageManaValue - 3) * 2 - (counts.ramp - 10) / 3)))
  return { curve, required, produced, counts, typeCounts, averageManaValue, landRange: [Math.max(30, landCentre - 1), Math.min(42, landCentre + 1)] as [number, number] }
}

export function deckSection(typeLine: string) {
  if (typeLine.includes('Creature')) return 'Creatures'
  if (typeLine.includes('Enchantment')) return 'Enchantments'
  if (typeLine.includes('Artifact')) return 'Artifacts'
  if (typeLine.includes('Sorcery')) return 'Sorceries'
  if (typeLine.includes('Instant')) return 'Instants'
  if (typeLine.includes('Land')) return 'Lands'
  return 'Other'
}

export function basicLandPlan(identity: string[], demand: Record<ManaColour, number>, currentLands: number, targetLands: number, cardCount: number) {
  const count = Math.min(Math.max(0, 100 - cardCount), Math.max(0, targetLands - currentLands))
  if (!count) return []
  const legalColours = colours.filter((colour) => identity.includes(colour))
  if (!legalColours.length) return [{ name: 'Wastes', colour: 'C', count }]
  const totalDemand = legalColours.reduce((sum, colour) => sum + demand[colour], 0)
  const weights = legalColours.map((colour) => totalDemand ? demand[colour] / totalDemand : 1 / legalColours.length)
  const base = weights.map((weight) => Math.floor(weight * count))
  let remainder = count - base.reduce((sum, value) => sum + value, 0)
  const order = legalColours.map((_, index) => index).sort((a, b) => (weights[b] * count - base[b]) - (weights[a] * count - base[a]))
  for (const index of order) if (remainder-- > 0) base[index]++
  return legalColours.flatMap((colour, index) => base[index] ? [{ name: basicLandNames[colour], colour, count: base[index] }] : [])
}

export function deckGuidance(cardCount: number, counts: DeckTargets, targets: DeckTargets) {
  if (cardCount < 70) return []
  const remaining = Math.max(0, 100 - cardCount)
  const gaps = Object.fromEntries(targetKeys.map((key) => [key, Math.max(0, targets[key] - counts[key])])) as DeckTargets
  const totalGap = targetKeys.reduce((sum, key) => sum + gaps[key], 0)
  return targetKeys.flatMap((key) => {
    const gap = gaps[key]
    if (!gap) return []
    const strong = cardCount >= 85 && totalGap > Math.max(0, remaining - 2)
    return [{ key, strong, text: `${targetLabels[key]}: ${gap} short of target${strong ? ` with ${remaining} slots left` : ''}.` }]
  })
}
