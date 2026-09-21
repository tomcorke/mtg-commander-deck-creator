import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { advanceRecommendationQueue, balanceThemeCoverage, batchRecommendations, buildEdhrecRecommendations, cardText, commanderThemes, curatedCollections, findSynergyPair, formatUsdPrice, freshRecommendationCycle, manualCardError, orderedPrintings, parseEdhrecEntries, preconFastMana, preferredPrintingIndex, rankRecommendationCards, recommendationScore, recommendationScoreBreakdown, recommendationScoreFactorMaximums, recommendedScoreThreshold, sharedThemes, supportedThemes, tagsFor, themeMatchesSearch, toRecommendationCard, type CollectionMode, type DeferredCard, type EdhrecThemeCount, type PowerTarget, type RecommendationScoreBreakdown, type RecommendationSource, type RecommendationStyle, type ScryfallCard } from './recommendations'
import { analyseDeck, basicLandNames, basicLandPlan, cardTypes, curveBucket, deckGuidance, deckRoleBoosts, deckSection, defaultDeckTargets, isBasicLandName, rolesForCard, targetKeys, targetLabels, type DeckTargets } from './deck-analysis'
import { clearDeckState, deleteSavedDeck, deckDelta, deckPageTitle, deckStateChanged, duplicateDeckName, loadDeckState, loadSavedDecks, saveDeckState, saveSavedDeck, suggestedDeckName, type PersistedDeckState, type SavedDeck } from './deck-state'
import { fetchScryfallCollection, matchImportedCard, missingCardNames, parseDeckList, type ImportedDeck } from './deck-import'
import './App.css'

type CardFinish = 'nonfoil' | 'foil' | 'etched'
type Printing = { image: string; art?: string; set: string; setName?: string; collectorNumber: string; scryfallUri?: string; price?: string; priceUri?: string; finish?: CardFinish }
type Card = { name: string; layout: string; typeLine: string; manaCost: string; manaValue: number; detail: string; producedMana: string[]; faces: { typeLine: string; manaCost: string }[]; power?: string; toughness?: string; reason: string; source?: RecommendationSource; image: string; set: string; setName?: string; collectorNumber: string; scryfallUri?: string; printsUri: string; price?: string; priceUri?: string; finish?: CardFinish; tags: string[]; collectionMatch?: boolean; printings?: Printing[]; printing?: number; printingManuallySelected?: boolean }
type DeckCard = { name: string; layout: string; typeLine: string; manaCost: string; manaValue: number; detail: string; producedMana: string[]; faces: { typeLine: string; manaCost: string }[]; power?: string; toughness?: string; set: string; setName?: string; collectorNumber: string; scryfallUri?: string; printsUri?: string; image: string; price?: string; priceUri?: string; tags: string[]; printings?: Printing[]; printing?: number; printingManuallySelected?: boolean; finish?: CardFinish }
type DeckCardLocation = { board: 'deck' | 'sideboard'; index: number }
type CommanderDetails = { images: string[]; art: string[]; colours: string[]; printings: Printing[][]; selections: number[] }
type CommanderCard = ScryfallCard & { related_uris?: { edhrec?: string }; image_uris?: { normal: string; art_crop?: string }; card_faces?: { mana_cost?: string; oracle_text?: string; power?: string; toughness?: string; image_uris?: { normal: string; art_crop?: string } }[] }
type ScryfallSet = { code: string; name: string; set_type?: string; released_at?: string; card_count?: number }
type ExportFormat = 'moxfield' | 'plain' | 'csv'
type AppView = 'start' | 'builder'
type AppModal = 'saved' | 'import' | 'search' | 'basics' | 'export' | 'card'
type AppHistoryState = { app: 'commander-deck-creator'; view: AppView; modal: AppModal | null; entry: boolean }
const appHistoryKey = 'commander-deck-creator'
const appModals: AppModal[] = ['saved', 'import', 'search', 'basics', 'export', 'card']

function routeHash(view: AppView, modal: AppModal | null) {
  return `#${view === 'builder' ? 'build' : 'start'}${modal ? `/${modal}` : ''}`
}

function readAppRoute(): AppHistoryState | null {
  const state = window.history.state as Partial<AppHistoryState> | null
  const hash = window.location.hash.slice(1).split('/')
  const view = hash[0] === 'build' ? 'builder' : hash[0] === 'start' ? 'start' : null
  const modal = appModals.includes(hash[1] as AppModal) ? hash[1] as AppModal : null
  if (view) return { app: appHistoryKey, view, modal, entry: state?.app === appHistoryKey && state.view === view && (state.modal ?? null) === modal && state.entry === true }
  return state?.app === appHistoryKey && (state.view === 'start' || state.view === 'builder') ? { app: appHistoryKey, view: state.view, modal: state.modal ?? null, entry: state.entry === true } : null
}

function writeAppRoute(route: AppHistoryState, replace = false) {
  const url = new URL(window.location.href)
  url.hash = routeHash(route.view, route.modal)
  window.history[replace ? 'replaceState' : 'pushState'](route, '', url.href)
}

const savedDeckState = loadDeckState()
const initialAppRoute = typeof window === 'undefined' ? null : readAppRoute()
const usableInitialRoute = initialAppRoute?.view === 'builder' && !savedDeckState?.commander ? null : initialAppRoute

const cardTags = (card: ScryfallCard, category = '') => tagsFor(`${card.type_line}\n${cardText(card)}\n${category}`, card.type_line)
const toCard = (card: ScryfallCard, reason: string, category = ''): Card => ({ ...toRecommendationCard(card, reason, category), source: 'scryfall' })
const edhrecSlug = (url: string | undefined, name: string) => url?.match(/\/commanders\/([^/?#]+)/)?.[1] ?? name.toLowerCase().normalize('NFKD').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const colourNames: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }
const colourThemes: Record<string, [string, string]> = {
  W: ['#9b772e', '#f3df9b'], U: ['#286da8', '#8dc9ee'], B: ['#67506f', '#bf9ac8'], R: ['#a83b32', '#ee8b68'], G: ['#32734c', '#8bc795'], C: ['#666879', '#b8bac7'],
}

const themeCommanders: Record<string, string[]> = {
  'Tokens': ['Chatterfang, Squirrel General', 'Rhys the Redeemed', 'Jetmir, Nexus of Revels', 'Baylen, the Haymaker', 'Adrix and Nev, Twincasters', 'Krenko, Mob Boss'],
  '+1/+1 counters': ['Atraxa, Praetors\' Voice', 'Shalai and Hallar', 'Hamza, Guardian of Arashin', 'Sovereign Okinec Ahau', 'Ezuri, Claw of Progress', 'Felisa, Fang of Silverquill'],
  'Enchantments': ['Anikthea, Hand of Erebos', 'Sythis, Harvest\'s Hand', 'Tom Bombadil', 'Go-Shintai of Life\'s Origin', 'Ellivere of the Wild Court', 'Zur the Enchanter'],
  'Graveyard': ['Meren of Clan Nel Toth', 'Muldrotha, the Gravetide', 'The Gitrog Monster', 'Karador, Ghost Chieftain', 'Chainer, Nightmare Adept', 'Sidisi, Brood Tyrant'],
  'Dragons': ['The Ur-Dragon', 'Miirym, Sentinel Wyrm', 'Tiamat', 'Lathliss, Dragon Queen', 'Rivaz of the Claw', 'Atarka, World Render'],
  'Spellslinger': ['Veyran, Voice of Duality', 'Kess, Dissident Mage', 'Niv-Mizzet, Parun', 'Mizzix of the Izmagnus', 'Kykar, Wind\'s Fury', 'Stella Lee, Wild Card'],
  'Artifacts': ['Urza, Lord High Artificer', 'Breya, Etherium Shaper', 'Chiss-Goria, Forge Tyrant', 'Osgir, the Reconstructor', 'Shorikai, Genesis Engine', 'Jhoira, Weatherlight Captain'],
  'Lifegain': ['Lathiel, the Bounteous Dawn', 'Oloro, Ageless Ascetic', 'Karlov of the Ghost Council', 'Willowdusk, Essence Seer', 'Heliod, Sun-Crowned', 'Amalia Benavides Aguirre'],
  'Sacrifice': ['Korvold, Fae-Cursed King', 'Meren of Clan Nel Toth', 'Teysa Karlov', 'Mazirek, Kraul Death Priest', 'Juri, Master of the Revue', 'Braids, Arisen Nightmare'],
  'Equipment': ['Syr Gwyn, Hero of Ashvale', 'Wyleth, Soul of Steel', 'Kellan, the Fae-Blooded', 'Ardenn, Intrepid Archaeologist', 'Akiri, Fearless Voyager', 'Nahiri, Forged in Fury'],
  'Group hug': ['Kynaios and Tiro of Meletis', 'Gluntch, the Bestower', 'Kwain, Itinerant Meddler', 'Ms. Bumbleflower', 'Phelddagrif', 'Kenrith, the Returned King'],
  'Landfall': ['The Gitrog Monster', 'Omnath, Locus of Creation', 'Aesi, Tyrant of Gyre Strait', 'Obuun, Mul Daya Ancestor', 'Lord Windgrace', 'Tatyova, Benthic Druid'],
  'Voltron': ['Light-Paws, Emperor\'s Voice', 'Uril, the Miststalker', 'Galea, Kindler of Hope', 'Rafiq of the Many', 'Slicer, Hired Muscle', 'Wilson, Refined Grizzly'],
  'Goad': ['Marisi, Breaker of the Coil', 'Kardur, Doomscourge', 'Baeloth Barrityl, Entertainer', 'Nelly Borca, Impulsive Accuser', 'Firkraag, Cunning Instigator', 'The Rani'],
  'Big mana': ['Zhulodok, Void Gorger', 'Goreclaw, Terror of Qal Sisma', 'Kozilek, the Great Distortion', 'Klauth, Unrivaled Ancient', 'Imoti, Celebrant of Bounty', 'Selvala, Heart of the Wilds'],
  'Blink': ['Brago, King Eternal', 'Roon of the Hidden Realm', 'Abdel Adrian, Gorion\'s Ward', 'Preston, the Vanisher', 'Yorion, Sky Nomad', 'Aminatou, the Fateshifter'],
  'ETB': ['Yarok, the Desecrated', 'Elesh Norn, Mother of Machines', 'Chulane, Teller of Tales', 'Roon of the Hidden Realm', 'Preston, the Vanisher', 'Abdel Adrian, Gorion\'s Ward'],
  'Death triggers': ['Teysa Karlov', 'Elas il-Kor, Sadistic Pilgrim', 'Athreos, God of Passage', 'Meren of Clan Nel Toth', 'Liesa, Forgotten Archangel', 'Kokusho, the Evening Star'],
  'Wither': ['The Scorpion God', 'Hapatra, Vizier of Poisons', 'Massacre Girl, Known Killer', 'Yawgmoth, Thran Physician', 'Volrath, the Shapestealer', 'Grismold, the Dreadsower'],
  'Political': ['Queen Marchesa', 'Breena, the Demagogue', 'Kenrith, the Returned King', 'The Council of Four', 'Pramikon, Sky Rampart', 'Xantcha, Sleeper Agent'],
  'Vampires': ['Edgar Markov', 'Clavileño, First of the Blessed', 'Strefan, Maurer Progenitor', 'Carmen, Cruel Skymarcher', 'Elenda, the Dusk Rose', 'Olivia, Crimson Bride'],
  'Angels': ['Giada, Font of Hope', 'Kaalia of the Vast', 'Liesa, Shroud of Dusk', 'Shalai and Hallar', 'Aurelia, the Warleader', 'Sigarda, Font of Blessings'],
  'Demons': ["Be'lakor, the Dark Master", 'Rakdos, Lord of Riots', "K'rrik, Son of Yawgmoth", 'Raphael, Fiendish Savior', 'Vilis, Broker of Blood', 'Beledros Witherbloom'],
  'Faeries': ['Alela, Cunning Conqueror', 'Tegwyll, Duke of Splendor', 'Obyra, Dreaming Duelist', 'Talion, the Kindly Lord', 'Alela, Artful Provocateur', 'Nymris, Oona\'s Trickster'],
  'Vehicles': ['Shorikai, Genesis Engine', 'Kotori, Pilot Prodigy', 'Sydri, Galvanic Genius', 'Depala, Pilot Exemplar', 'Greasefang, Okiba Boss', 'Magda, Brazen Outlaw'],
  'Indestructible': ['Karametra, God of Harvests', 'Avacyn, Angel of Hope', 'Zurgo Helmsmasher', 'Toski, Bearer of Secrets', 'Hazoret the Fervent', 'Mogis, God of Slaughter'],
  'Mill': ['The Wise Mothman', "Captain N'ghathrod", 'Phenax, God of Deception', 'Bruvac the Grandiloquent', 'Zellix, Sanity Flayer', 'Anowon, the Ruin Thief'],
  'Dual commanders': ['Thrasios & Tymna', 'Kraum & Tymna', 'Malcolm & Breeches', 'Akiri & Silas Renn', 'Ishai & Jeska', 'Kodama & Sakashima'],
  'Zombies': ['Wilhelt, the Rotcleaver', 'The Scarab God', 'Varina, Lich Queen', 'Gisa and Geralf', 'Sidisi, Brood Tyrant', "Temmet, Naktamun's Will"],
  'Elves': ['Lathril, Blade of the Elves', 'Marwyn, the Nurturer', 'Ezuri, Renegade Leader', 'Abomination of Llanowar', 'Galadriel, Light of Valinor', 'Tyvar the Bellicose'],
  'Goblins': ['Krenko, Mob Boss', 'Muxus, Goblin Grandee', 'Wort, Boggart Auntie', 'Krenko, Tin Street Kingpin', 'Shattergang Brothers', 'Moria Marauder'],
  'Dinosaurs': ['Pantlaza, Sun-Favored', "Gishath, Sun's Avatar", 'Atla Palani, Nest Tender', 'Indoraptor, the Perfect Hybrid', 'Owen Grady, Raptor Trainer', 'Wayta, Trainer Prodigy'],
  'Merfolk': ['Hakbal of the Surging Soul', 'Kumena, Tyrant of Orazca', 'Emperor Mihail II', 'Svyelun of Sea and Sky', 'Tishana, Voice of Thunder', 'Prime Speaker Zegana'],
  'Knights': ['Sidar Jabari of Zhalfir', 'Syr Gwyn, Hero of Ashvale', 'Éowyn, Shieldmaiden', 'Aryel, Knight of Windgrace', 'Wintermoor Commander', 'Elenda and Azor'],
  'Spirits': ['Millicent, Restless Revenant', 'Kykar, Wind\'s Fury', 'Shilgengar, Sire of Famine', 'Katilda, Dawnhart Martyr', 'O-Kagachi, Vengeful Kami', 'King of the Oathbreakers'],
  'Slivers': ['The First Sliver', 'Sliver Overlord', 'Sliver Gravemother', 'Sliver Legion', 'Morophon, the Boundless', 'Sliver Hivelord'],
}

const dualCommanders: Record<string, string[]> = {
  'Thrasios & Tymna': ['Thrasios, Triton Hero', 'Tymna the Weaver'],
  'Kraum & Tymna': ['Kraum, Ludevic\'s Opus', 'Tymna the Weaver'],
  'Malcolm & Breeches': ['Malcolm, Keen-Eyed Navigator', 'Breeches, Brazen Plunderer'],
  'Akiri & Silas Renn': ['Akiri, Line-Slinger', 'Silas Renn, Seeker Adept'],
  'Ishai & Jeska': ['Ishai, Ojutai Dragonspeaker', 'Jeska, Thrice Reborn'],
  'Kodama & Sakashima': ['Kodama of the East Tree', 'Sakashima of a Thousand Faces'],
}
const commanderNames = (name: string) => dualCommanders[name] ?? [name]
const deckColumnSections = [
  ['Commander', 'Planeswalkers', 'Creatures'],
  ['Enchantments', 'Artifacts', 'Other Permanents'],
  ['Sorceries', 'Instants', 'Other Non-permanents'],
  ['Other', 'Lands'],
] as const
const defaultCommanders = Object.values(themeCommanders).flat()
const selectableThemes = Object.keys(themeCommanders).filter((name) => supportedThemes.includes(name))
const randomItems = <T,>(items: T[], count: number) => [...items].sort(() => Math.random() - 0.5).slice(0, count)
const randomThree = (items: string[]) => randomItems(items, 3)
const basicNames = [...Object.values(basicLandNames), 'Wastes']
const themeSearchTerms: Record<string, string> = { Tokens: 'o:token', '+1/+1 counters': 'o:"+1/+1 counter"', Enchantments: 'o:enchantment', Graveyard: 'o:graveyard', Dragons: 't:dragon', Spellslinger: 'o:"instant" o:"sorcery"', Artifacts: 'o:artifact', Lifegain: 'o:"gain life"', Sacrifice: 'o:sacrifice', Equipment: 'o:equipment', Landfall: 'o:landfall', Voltron: 'o:"commander you control"', Goad: 'o:goad', 'Big mana': 'o:"add {"', Blink: 'o:"exile" o:"return"', ETB: 'o:"enters the battlefield"', "Death triggers": 'o:"dies"', Political: 'o:"each player"' }
const basicCardCache = new Map<string, ScryfallCard>()

function usePendingConfirmation<T>(empty: T) {
  const [pending, setPending] = useState(empty)
  useEffect(() => {
    if (pending === empty) return
    const timer = setTimeout(() => setPending(empty), 3000)
    return () => clearTimeout(timer)
  }, [empty, pending])
  return [pending, setPending] as const
}

function useStoredOption<T>(key: string, fallback: () => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`option:${key}`)
      return stored === null ? fallback() : JSON.parse(stored) as T
    } catch {
      return fallback()
    }
  })
  useEffect(() => localStorage.setItem(`option:${key}`, JSON.stringify(value)), [key, value])
  return [value, setValue] as const
}

async function preloadArt(sources: (string | undefined)[]) {
  await Promise.all(sources.filter(Boolean).map((source) => new Promise<void>((resolve) => {
    const image = new Image()
    image.onload = image.onerror = () => resolve()
    image.src = source!
  })))
}

const scryfallImage = (card: ScryfallCard) => card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? ''

function ArtLoading({ active }: { active: boolean }) {
  return active ? <span className="art-loading" role="status"><i />Loading art…</span> : null
}

function PrintingButton({ count, index, loading, name, onClick }: { count: number; index: number; loading: boolean; name: string; onClick: () => void }) {
  return count > 1 ? <button type="button" disabled={loading} onClick={onClick} aria-label={`Show alternate printing of ${name}`}>↻ Art {index + 1}/{count}</button> : null
}

const cardScryfallUri = (card: Pick<Card, 'scryfallUri' | 'set' | 'collectorNumber'>) => card.scryfallUri ?? `https://scryfall.com/card/${card.set}/${encodeURIComponent(card.collectorNumber)}`
const cardTypeLine = (card: Pick<DeckCard, 'typeLine' | 'power' | 'toughness'>) => card.power && card.toughness ? `${card.power}/${card.toughness} ${card.typeLine}` : card.typeLine
const planeswalkerType = /\bPlaneswalker\b/
const otherPermanentTypes = /\b(?:Artifact|Battle|Creature|Enchantment|Land|Planeswalker)\b/
const otherNonPermanentTypes = /\b(?:Instant|Sorcery)\b/
const displayDeckSection = (card: Pick<DeckCard, 'typeLine' | 'faces'>) => {
  const section = deckSection(card.typeLine)
  if (section !== 'Other') return section
  const typeLines = [card.typeLine, ...card.faces.map((face) => face.typeLine)].join(' ')
  if (planeswalkerType.test(typeLines)) return 'Planeswalkers'
  if (otherPermanentTypes.test(typeLines)) return 'Other Permanents'
  if (otherNonPermanentTypes.test(typeLines)) return 'Other Non-permanents'
  return 'Other'
}
const cardCanHavePowerToughness = (card: Pick<DeckCard, 'typeLine'>) => /Creature|Vehicle/.test(card.typeLine)
const cardPrintingsUri = (card: Pick<Card, 'name'>) => `https://scryfall.com/search?q=${encodeURIComponent(`!"${card.name}"`)}&unique=prints`

type CardSource = { label: string; uri: string }

function CardDetails({ card, source }: { card: Pick<Card, 'name' | 'set' | 'setName' | 'collectorNumber' | 'scryfallUri' | 'price' | 'priceUri' | 'finish'>; source: CardSource }) {
  const scryfallUri = cardScryfallUri(card)
  const priceUri = card.priceUri ?? scryfallUri
  const printingName = card.setName && card.setName.toLowerCase() !== card.set.toLowerCase() ? card.setName : undefined
  return <dl className="card-details">
    <div><dt>Printing</dt><dd><strong>{printingName ?? card.set.toUpperCase()}</strong> <span>{printingName ? `(${card.set.toUpperCase()}) · ` : '· '}#{card.collectorNumber}{card.finish && card.finish !== 'nonfoil' ? ` · ${card.finish}` : ''}</span></dd></div>
    <div><dt>Source</dt><dd><a href={source.uri} target="_blank" rel="noreferrer">{source.label} ↗</a></dd></div>
    {card.price && <div><dt>Price</dt><dd><a href={priceUri} target="_blank" rel="noreferrer">{formatUsdPrice(card.price)} <span>{card.priceUri ? 'TCGplayer' : 'Scryfall'} ↗</span></a></dd></div>}
    <div><dt>Links</dt><dd><a href={scryfallUri} target="_blank" rel="noreferrer">Scryfall ↗</a> <span aria-hidden="true">·</span> <a href={cardPrintingsUri(card)} target="_blank" rel="noreferrer">All printings ↗</a></dd></div>
  </dl>
}

const recommendationScoreFactors = [
  { key: 'evidence', label: 'Evidence', max: recommendationScoreFactorMaximums.evidence },
  { key: 'theme', label: 'Theme', max: recommendationScoreFactorMaximums.theme },
  { key: 'subThemes', label: 'Sub-themes', max: recommendationScoreFactorMaximums.subThemes },
  { key: 'collection', label: 'Collection', max: recommendationScoreFactorMaximums.collection },
  { key: 'deckFit', label: 'Deck fit', max: recommendationScoreFactorMaximums.deckFit },
  { key: 'preferences', label: 'Preferences', max: recommendationScoreFactorMaximums.preferences },
  { key: 'deckNeeds', label: 'Deck needs', max: recommendationScoreFactorMaximums.deckNeeds },
  { key: 'popularityPenalty', label: 'Popularity penalty', max: recommendationScoreFactorMaximums.popularityPenalty },
] as const

type RecommendationScoreFactor = typeof recommendationScoreFactors[number]['key']

function radarPoint(index: number, value: number, max: number, radius = 38) {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / recommendationScoreFactors.length
  const distance = radius * Math.min(1, Math.max(0, value / max))
  return { x: 50 + Math.cos(angle) * distance, y: 50 + Math.sin(angle) * distance }
}

function radarPoints(score: RecommendationScoreBreakdown, scale = 1) {
  return recommendationScoreFactors.map(({ key, max }, index) => {
    const point = radarPoint(index, score[key] * scale, max)
    return `${point.x},${point.y}`
  }).join(' ')
}

function ScoreBreakdown({ score }: { score: RecommendationScoreBreakdown }) {
  return <section className="score-breakdown" aria-label={`Score breakdown: ${score.total} out of 100`}>
    <div className="score-breakdown-heading"><h4>Score breakdown</h4><strong>{score.total}/100</strong></div>
    <div className="score-breakdown-content">
      <svg className="score-radar" viewBox="0 0 100 100" role="img" aria-label={`Radar chart showing score breakdown for ${score.total} out of 100`}>
        <title>Score breakdown: {score.total} out of 100</title>
        {[.25, .5, .75, 1].map((scale) => <polygon className="score-radar-grid" points={radarPoints({ total: 0, ...recommendationScoreFactorMaximums }, scale)} key={scale} />)}
        {recommendationScoreFactors.map(({ key, max }, index) => { const point = radarPoint(index, max, max); return <line className="score-radar-axis" x1="50" y1="50" x2={point.x} y2={point.y} key={key} /> })}
        <polygon className="score-radar-area" points={radarPoints(score)} />
      </svg>
      <dl className="score-factors">
        {recommendationScoreFactors.map(({ key, label, max }) => <div key={key}><dt>{label}</dt><dd>{score[key as RecommendationScoreFactor]} / {max}</dd></div>)}
      </dl>
    </div>
    <p className="score-note">Factors are normalized to a 100-point total.</p>
  </section>
}

const defaultFinish = (finishes?: CardFinish[]) => finishes?.includes('nonfoil') ? 'nonfoil' : finishes?.[0]
const commanderPrintingOptions = (cards: CommanderCard[]) => cards.flatMap((printing) => {
  const image = printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal
  return image ? (printing.finishes ?? ['nonfoil']).map((finish) => ({ image, art: printing.image_uris?.art_crop ?? printing.card_faces?.[0]?.image_uris?.art_crop, set: printing.set, setName: printing.set_name, collectorNumber: printing.collector_number, scryfallUri: printing.scryfall_uri, price: (finish === 'etched' ? printing.prices?.usd_etched : finish === 'foil' ? printing.prices?.usd_foil : printing.prices?.usd) ?? undefined, priceUri: printing.purchase_uris?.tcgplayer, finish })) : []
}).filter((printing, index, all) => all.findIndex((item) => item.image === printing.image && item.finish === printing.finish) === index)
const cardPrintingOptions = (cards: ScryfallCard[]) => cards.flatMap((printing) => {
  const image = printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal
  return image ? (printing.finishes ?? ['nonfoil']).map((finish) => ({ image, set: printing.set, setName: printing.set_name, collectorNumber: printing.collector_number, scryfallUri: printing.scryfall_uri, price: (finish === 'etched' ? printing.prices?.usd_etched : finish === 'foil' ? printing.prices?.usd_foil : printing.prices?.usd) ?? undefined, priceUri: printing.purchase_uris?.tcgplayer, finish })) : []
}).filter((printing, index, all) => all.findIndex((item) => item.image === printing.image && item.finish === printing.finish) === index)

function FinishedCardImage({ image, alt, finish, effectsEnabled, hasSynergyGlow = false, className = '' }: { image: string; alt: string; finish?: CardFinish; effectsEnabled: boolean; hasSynergyGlow?: boolean; className?: string }) {
  const [loadedImage, setLoadedImage] = useState('')
  const foilHue = [...image].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0) % 360
  const finishClass = effectsEnabled ? finish === 'foil' ? 'holo-card' : finish === 'etched' ? 'etched-card' : '' : ''
  return <span className={`finished-card ${loadedImage === image ? 'image-ready' : ''} ${effectsEnabled ? 'tilting-card' : ''} ${finishClass}`} style={effectsEnabled ? { '--foil-hue': `${foilHue}deg` } as CSSProperties : undefined} onPointerMove={effectsEnabled ? moveFoil : undefined} onPointerLeave={effectsEnabled ? resetFoil : undefined} onPointerCancel={effectsEnabled ? resetFoil : undefined}><img className={className} src={image} alt={alt} onLoad={() => setLoadedImage(image)} onError={() => setLoadedImage(image)} />{hasSynergyGlow && <span className="synergy-connector" aria-hidden="true" />}{effectsEnabled && finish && finish !== 'nonfoil' && <img className={`finish-edges ${finish}-edges ${className}`} src={image} alt="" aria-hidden="true" />}</span>
}

function symbolName(symbol: string) {
  const names: Record<string, string> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green', C: 'colourless', X: 'X mana', T: 'tap', Q: 'untap', P: 'Phyrexian' }
  if (/^\d+$/.test(symbol)) return `${symbol} generic mana`
  return symbol.split('/').map((part) => names[part] ?? part).join(' or ')
}

function ManaSymbols({ symbols }: { symbols: string[] }) {
  return <>{symbols.map((symbol) => <img className="mana-symbol" src={`https://svgs.scryfall.io/card-symbols/${symbol}.svg`} alt={colourNames[symbol] ?? 'Colourless'} title={colourNames[symbol] ?? 'Colourless'} key={symbol} />)}</>
}

function OracleText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/)
  return <>{lines.map((line, lineIndex) => <span className={lines.length > 1 ? 'oracle-line' : undefined} key={`${line}-${lineIndex}`}>{line.split(/(\{[^}]+\})/g).map((part, index) => {
    const symbol = part.match(/^\{(.+)\}$/)?.[1]
    if (!symbol) return part
    const file = symbol.replace('/', '')
    const label = symbolName(symbol)
    return <img className="mana-symbol" src={`https://svgs.scryfall.io/card-symbols/${file}.svg`} alt={label} title={label} key={`${part}-${index}`} />
  })}</span>)}</>
}

function moveFoil(event: PointerEvent<HTMLElement>) {
  const card = event.currentTarget
  const bounds = card.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
  const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))
  card.style.setProperty('--foil-x', `${x * 100}%`)
  card.style.setProperty('--foil-y', `${y * 100}%`)
  card.style.setProperty('--foil-rotate-x', `${(0.5 - y) * 16}deg`)
  card.style.setProperty('--foil-rotate-y', `${(x - 0.5) * 16}deg`)
  card.style.setProperty('--foil-shift', `${(x + y - 1) * 100}deg`)
}

function resetFoil(event: PointerEvent<HTMLElement>) {
  for (const property of ['--foil-x', '--foil-y', '--foil-rotate-x', '--foil-rotate-y', '--foil-shift']) event.currentTarget.style.removeProperty(property)
}

function App() {
  const [commander, setCommander] = useState(savedDeckState?.commander ?? '')
  const [commanderDetails, setCommanderDetails] = useState<CommanderDetails | null>(savedDeckState?.commanderDetails ?? null)
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState(savedDeckState?.theme ?? '')
  const [recommendationStyle, setRecommendationStyle] = useStoredOption<RecommendationStyle>('recommendationStyle', () => savedDeckState?.recommendationStyle ?? 'balanced')
  const [collectionSets, setCollectionSets] = useState<string[]>(savedDeckState?.collectionSets ?? [])
  const [collectionGroups, setCollectionGroups] = useState<string[]>(savedDeckState?.collectionGroups ?? [])
  const [collectionMode, setCollectionMode] = useState<CollectionMode>(savedDeckState?.collectionMode ?? 'none')
  const [prioritizeDeckHealth, setPrioritizeDeckHealth] = useState(savedDeckState?.prioritizeDeckHealth ?? true)
  const [setOptions, setSetOptions] = useState<ScryfallSet[]>([])
  const [collectionSearch, setCollectionSearch] = useState('')
  const [collectionPoolSize, setCollectionPoolSize] = useState<number | null>(null)
  const [collectionState, setCollectionState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [collectionError, setCollectionError] = useState('')
  const [collectionBrowserCards, setCollectionBrowserCards] = useState<ScryfallCard[]>([])
  const [collectionBrowserState, setCollectionBrowserState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [collectionBrowserError, setCollectionBrowserError] = useState('')
  const [collectionBrowserType, setCollectionBrowserType] = useState('all')
  const [collectionBrowserMana, setCollectionBrowserMana] = useState('')
  const [showCollectionBrowser, setShowCollectionBrowser] = useState(false)
  const [visibleThemes, setVisibleThemes] = useState(() => randomItems(selectableThemes, 6))
  const [colours, setColours] = useState<string[]>([])
  const [matches, setMatches] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState(() => randomThree(defaultCommanders))
  const [suggestionPool, setSuggestionPool] = useState(defaultCommanders)
  const [commanderCosts, setCommanderCosts] = useState<Record<string, string>>({})
  const [commanderImages, setCommanderImages] = useState<Record<string, string[]>>({})
  const [queue, setQueue] = useState<Card[]>(savedDeckState?.queue ?? [])
  const [recommendationState, setRecommendationState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [recommendationLoadingStep, setRecommendationLoadingStep] = useState<'commander' | 'recommendations'>('commander')
  const [limitedRecommendations, setLimitedRecommendations] = useState(savedDeckState?.limitedRecommendations ?? false)
  const [includeCreature, setIncludeCreature] = useStoredOption('includeCreature', () => true)
  const [powerTarget, setPowerTarget] = useStoredOption<PowerTarget>('powerTarget', () => 'precon')
  const [excludeGameChangers, setExcludeGameChangers] = useStoredOption('excludeGameChangers', () => true)
  const [excludeTutors, setExcludeTutors] = useStoredOption('excludeTutors', () => true)
  const [excludeExtraTurns, setExcludeExtraTurns] = useStoredOption('excludeExtraTurns', () => true)
  const [excludeUnreleased, setExcludeUnreleased] = useStoredOption('excludeUnreleased', () => true)
  const [decisions, setDecisions] = useState<Record<string, 'add' | 'later' | 'ignore'>>(savedDeckState?.decisions ?? {})
  const [ignoredCards, setIgnoredCards] = useState<string[]>(savedDeckState?.ignoredCards ?? [])
  const [liked, setLiked] = useState<string[]>(savedDeckState?.liked ?? [])
  const [activeSubThemes, setActiveSubThemes] = useState<string[]>(savedDeckState?.activeSubThemes ?? [])
  const [dismissedSubThemes, setDismissedSubThemes] = useState<string[]>(savedDeckState?.dismissedSubThemes ?? [])
  const [showSubThemePicker, setShowSubThemePicker] = useState(false)
  const [subThemeSearch, setSubThemeSearch] = useState('')
  const [preferenceScores, setPreferenceScores] = useState<Record<string, number>>(savedDeckState?.preferenceScores ?? {})
  const [commanderSubThemes, setCommanderSubThemes] = useState<string[]>(savedDeckState?.commanderSubThemes ?? [])
  const [deferredCards, setDeferredCards] = useState<DeferredCard<Card>[]>(savedDeckState?.deferredCards ?? [])
  const [batchNumber, setBatchNumber] = useState(savedDeckState?.batchNumber ?? 1)
  const [batchAnnouncement, setBatchAnnouncement] = useState('')
  const [deck, setDeck] = useState<DeckCard[]>(savedDeckState?.deck ?? [])
  const [sideboard, setSideboard] = useState<DeckCard[]>(savedDeckState?.sideboard ?? [])
  const [selectedDeckCardLocation, setSelectedDeckCardLocation] = useState<DeckCardLocation | null>(null)
  const [pendingCardRemoval, setPendingCardRemoval] = usePendingConfirmation<DeckCardLocation | null>(null)
  const [showBuilder, setShowBuilder] = useState(() => (usableInitialRoute?.view ?? (savedDeckState?.commander ? 'builder' : 'start')) === 'builder')
  const [activeModal, setActiveModal] = useState<AppModal | null>(() => usableInitialRoute?.modal ?? null)
  const [basicLandState, setBasicLandState] = useState<'idle' | 'loading' | 'error'>('idle')
  const showExport = activeModal === 'export'
  const showBasicLands = activeModal === 'basics'
  const showCardSearch = activeModal === 'search'
  const selectedDeckCard = useMemo(() => selectedDeckCardLocation ? (selectedDeckCardLocation.board === 'deck' ? deck : sideboard)[selectedDeckCardLocation.index] ?? null : null, [deck, selectedDeckCardLocation, sideboard])
  const showDeckCard = activeModal === 'card' && selectedDeckCard !== null
  const selectedDeckCardIsCommander = selectedDeckCardLocation?.board === 'deck' && selectedDeckCardLocation.index < commanderNames(commander).length
  const [cardSearch, setCardSearch] = useState('')
  const [cardSearchResults, setCardSearchResults] = useState<ScryfallCard[]>([])
  const [cardSearchState, setCardSearchState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [filterCardIdentity, setFilterCardIdentity] = useState(true)
  const [selectedManualCard, setSelectedManualCard] = useState<ScryfallCard | null>(null)
  const [manualPrintings, setManualPrintings] = useState<ScryfallCard[]>([])
  const [manualPrinting, setManualPrinting] = useState(0)
  const cardSearchButton = useRef<HTMLButtonElement>(null)
  const cardSearchInput = useRef<HTMLInputElement>(null)
  const cardSearchDialog = useRef<HTMLElement>(null)
  const repairedPrintingBatches = useRef(new Set<string>())
  const [exportFormat, setExportFormat] = useStoredOption<ExportFormat>('exportFormat', () => 'moxfield')
  const [copied, setCopied] = useState(false)
  const [darkMode, setDarkMode] = useStoredOption('darkMode', () => localStorage.getItem('theme') !== 'light')
  const [commanderStyling, setCommanderStyling] = useStoredOption('commanderStyling', () => true)
  const [cardEffects, setCardEffects] = useStoredOption('cardEffects', () => true)
  const [preferredPrintSet, setPreferredPrintSet] = useState(savedDeckState?.preferredPrintSet ?? '')
  const [loadingArt, setLoadingArt] = useState('')
  const [recommendationOptionsChanged, setRecommendationOptionsChanged] = useState(false)
  const [deckTargets, setDeckTargets] = useState<DeckTargets>(savedDeckState?.deckTargets ?? defaultDeckTargets)
  const [highlightedManaValue, setHighlightedManaValue] = useState<number | null>(null)
  const [pendingRemoval, setPendingRemoval] = usePendingConfirmation<number | null>(null)
  const [pendingSavedDeckRemoval, setPendingSavedDeckRemoval] = usePendingConfirmation('')
  const [savedDecks, setSavedDecks] = useState(loadSavedDecks)
  const [activeSavedDeckId, setActiveSavedDeckId] = useState(savedDeckState?.savedDeckId ?? '')
  const [deckName, setDeckName] = useState(() => loadSavedDecks().find(({ id }) => id === savedDeckState?.savedDeckId)?.name ?? '')
  const showSavedDecks = activeModal === 'saved'
  const showImport = activeModal === 'import'
  const [importSource, setImportSource] = useState('')
  const [importState, setImportState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [importError, setImportError] = useState('')
  const activeSavedDeck = savedDecks.find(({ id }) => id === activeSavedDeckId)
  const currentDeckState = useMemo<PersistedDeckState | null>(() => commander && commanderDetails && deck.length ? { savedDeckId: activeSavedDeckId, commander, commanderDetails, theme, recommendationStyle, collectionSets, collectionGroups, collectionMode, prioritizeDeckHealth, queue, limitedRecommendations, decisions, ignoredCards, liked, activeSubThemes, dismissedSubThemes, preferenceScores, commanderSubThemes, deferredCards, batchNumber, deck, sideboard, preferredPrintSet, deckTargets } : null, [activeSavedDeckId, commander, commanderDetails, theme, recommendationStyle, collectionSets, collectionGroups, collectionMode, prioritizeDeckHealth, queue, limitedRecommendations, decisions, ignoredCards, liked, activeSubThemes, dismissedSubThemes, preferenceScores, commanderSubThemes, deferredCards, batchNumber, deck, sideboard, preferredPrintSet, deckTargets])
  const savedDeckChanged = Boolean(activeSavedDeck && currentDeckState && deckStateChanged(activeSavedDeck.state, currentDeckState))
  const activeDeckDelta = activeSavedDeck ? deckDelta([...activeSavedDeck.state.deck, ...activeSavedDeck.state.sideboard], [...deck, ...sideboard]) : null
  const historyReady = useRef(false)

  function navigateView(view: AppView, modal: AppModal | null = null, replace = false) {
    const current = readAppRoute()
    const route = { app: appHistoryKey, view, modal, entry: Boolean(modal && !replace) } satisfies AppHistoryState
    setShowBuilder(view === 'builder')
    setActiveModal(modal)
    if (!historyReady.current || (current?.view === view && current.modal === modal)) return
    writeAppRoute(route, replace)
  }

  function openModal(modal: AppModal) {
    navigateView(showBuilder ? 'builder' : 'start', modal)
  }

  function closeModal(replace = false) {
    const current = readAppRoute()
    if (!replace && current?.modal && current.entry) {
      window.history.back()
      return
    }
    navigateView(current?.view ?? (showBuilder ? 'builder' : 'start'), null, true)
  }

  useEffect(() => {
    const route = usableInitialRoute ?? { app: appHistoryKey, view: savedDeckState?.commander ? 'builder' : 'start', modal: null, entry: false } satisfies AppHistoryState
    writeAppRoute(route, true)
    historyReady.current = true
    const applyRoute = () => {
      const next = readAppRoute() ?? { app: appHistoryKey, view: 'start', modal: null, entry: false } satisfies AppHistoryState
      setShowBuilder(next.view === 'builder')
      setActiveModal(next.modal)
    }
    window.addEventListener('popstate', applyRoute)
    window.addEventListener('hashchange', applyRoute)
    return () => {
      window.removeEventListener('popstate', applyRoute)
      window.removeEventListener('hashchange', applyRoute)
    }
  }, [])

  useEffect(() => {
    if (recommendationState !== 'idle' || !currentDeckState) return
    saveDeckState(currentDeckState)
  }, [currentDeckState, recommendationState])

  useEffect(() => {
    document.title = showBuilder && commander ? deckPageTitle(deck.length, activeSavedDeck?.name ?? commander, savedDeckChanged) : 'Commander Deck Creator'
  }, [activeSavedDeck?.name, commander, deck.length, savedDeckChanged, showBuilder])

  useEffect(() => {
    if (!commanderDetails || commanderDetails.printings.every((printings) => printings.every((printing) => printing.finish && printing.setName && printing.scryfallUri))) return
    void Promise.all(commanderNames(commander).map(async (name) => {
      const cardResponse = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`)
      const card = await cardResponse.json() as CommanderCard
      const response = await fetch(card.prints_search_uri)
      return commanderPrintingOptions((await response.json() as { data: CommanderCard[] }).data)
    })).then((printings) => {
      setCommanderDetails((current) => current && ({ ...current, printings, selections: printings.map((options, index) => Math.max(0, options.findIndex((printing) => printing.image === current.images[index] && printing.finish === 'nonfoil'))) }))
      setDeck((current) => current.map((card, index) => {
        if (index >= printings.length) return card
        const matching = printings[index].findIndex((printing) => printing.image === card.image && printing.finish === card.finish)
        const selectedIndex = matching >= 0 ? matching : Math.max(0, printings[index].findIndex((printing) => printing.image === card.image && printing.finish === 'nonfoil'))
        const selected = printings[index][selectedIndex]
        return selected ? { ...card, printings: printings[index], printing: selectedIndex, image: selected.image, set: selected.set, setName: selected.setName, collectorNumber: selected.collectorNumber, scryfallUri: selected.scryfallUri, price: selected.price, priceUri: selected.priceUri, finish: selected.finish } : card
      }))
    }).catch(() => undefined)
  }, [commander, commanderDetails])

  useEffect(() => {
    void fetch('https://api.scryfall.com/cards/collection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers: basicNames.map((name) => ({ name })) }) })
      .then((response) => response.ok ? response.json() as Promise<{ data: ScryfallCard[] }> : Promise.reject())
      .then(({ data }) => data.forEach((card) => basicCardCache.set(card.name, card)))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    void fetch('https://api.scryfall.com/sets')
      .then((response) => response.ok ? response.json() as Promise<{ data: ScryfallSet[] }> : Promise.reject())
      .then(({ data }) => setSetOptions(data.filter((set) => set.set_type !== 'token' && set.set_type !== 'memorabilia').sort((left, right) => (right.released_at ?? '').localeCompare(left.released_at ?? ''))))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!showCardSearch || cardSearch.trim().length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setCardSearchState('loading')
      try {
        const identity = commanderDetails?.colours.join('').toLowerCase() || 'c'
        const query = `name:${cardSearch.trim()}${filterCardIdentity ? ` id<=${identity}` : ''}${excludeUnreleased ? ' date<=today' : ''}`
        const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards`, { signal: controller.signal })
        if (!response.ok && response.status !== 404) throw new Error('Scryfall unavailable')
        const result = response.ok ? await response.json() as { data: ScryfallCard[] } : { data: [] }
        setCardSearchResults(result.data.filter((card, index, cards) => cards.findIndex((item) => item.name === card.name) === index).slice(0, 8))
        setCardSearchState('idle')
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setCardSearchState('error')
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [cardSearch, showCardSearch, filterCardIdentity, excludeUnreleased, commanderDetails?.colours])

  useEffect(() => {
    if (showCardSearch) cardSearchInput.current?.focus()
  }, [showCardSearch])

  useEffect(() => {
    if (search.trim().length < 2) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const query = encodeURIComponent(`is:commander name:${search.trim()}`)
        const response = await fetch(`https://api.scryfall.com/cards/search?q=${query}`, { signal: controller.signal })
        const result = await response.json() as { data?: { name: string; mana_cost?: string; card_faces?: { mana_cost?: string }[] }[] }
        const cards = result.data ?? []
        setMatches([...new Set(cards.map((card) => card.name))].slice(0, 6))
        setCommanderCosts((current) => ({ ...current, ...Object.fromEntries(cards.map((card) => [card.name, card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? ''])) }))
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setMatches([])
      }
    }, 250)

    return () => { clearTimeout(timer); controller.abort() }
  }, [search])

  useEffect(() => {
    if (!colours.length) return
    const controller = new AbortController()
    const load = async () => {
      try {
        const identity = colours.join('').toLowerCase()
        const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`is:commander id=${identity}`)}&order=edhrec`, { signal: controller.signal })
        const result = await response.json() as { data?: { name: string; mana_cost?: string; card_faces?: { mana_cost?: string }[] }[] }
        const cards = result.data ?? []
        const names = cards.map((card) => card.name)
        setSuggestionPool(names)
        setSuggestions(randomThree(names))
        setCommanderCosts((current) => ({ ...current, ...Object.fromEntries(cards.map((card) => [card.name, card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? ''])) }))
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setSuggestions([])
      }
    }
    void load()
    return () => controller.abort()
  }, [colours])

  useEffect(() => {
    const shown = search.trim().length >= 2 ? matches : suggestions
    const missing = shown.filter((name) => commanderCosts[name] === undefined || commanderImages[name] === undefined)
    if (!missing.length) return
    const controller = new AbortController()
    const load = async () => {
      for (const name of missing) {
        const costs: string[] = []
        const images: string[] = []
        for (const cardName of commanderNames(name)) {
          const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`, { signal: controller.signal })
          if (!response.ok) continue
          const card = await response.json() as { mana_cost?: string; image_uris?: { normal: string }; card_faces?: { mana_cost?: string; image_uris?: { normal: string } }[] }
          costs.push(card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '')
          const image = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal
          if (image) images.push(image)
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        setCommanderCosts((current) => ({ ...current, [name]: costs.join(' ') }))
        setCommanderImages((current) => ({ ...current, [name]: images }))
      }
    }
    void load().catch(() => undefined)
    return () => controller.abort()
  }, [suggestions, matches, search, commanderCosts, commanderImages])

  function chooseTheme(name: string) {
    setTheme(name)
    setColours([])
    setSearch('')
    setSuggestionPool(themeCommanders[name])
    setSuggestions(randomThree(themeCommanders[name]))
  }

  function toggleColour(colour: string) {
    setTheme('')
    setSearch('')
    setColours((selected) => selected.includes(colour) ? selected.filter((item) => item !== colour) : [...selected, colour])
  }

  function choosePowerTarget(target: PowerTarget) {
    setPowerTarget(target)
    setRecommendationOptionsChanged(true)
    const exclude = target !== 'high'
    setExcludeGameChangers(exclude)
    setExcludeTutors(exclude)
    setExcludeExtraTurns(exclude)
  }

  async function fallbackRecommendations(identityColours: string[]) {
    const identity = identityColours.join('').toLowerCase() || 'c'
    const bracketFilters = [excludeGameChangers && '-is:gamechanger', excludeTutors && '-otag:tutor', excludeExtraTurns && '-otag:extra-turn', excludeUnreleased && 'date<=today'].filter(Boolean).join(' ')
    const baseQuery = `id<=${identity} legal:commander -is:commander ${bracketFilters}`
    const [mainResponse, manaResponse] = await Promise.all([
      fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${baseQuery} -t:land -o:"add {"`)}&order=edhrec`),
      fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${baseQuery} (t:land or o:"add {")`)}&order=edhrec`),
    ])
    if (!mainResponse.ok || !manaResponse.ok) throw new Error('Scryfall unavailable')
    const allowed = (cards: ScryfallCard[]) => cards.filter((card) => powerTarget !== 'precon' || !preconFastMana.has(card.name))
    const main = allowed((await mainResponse.json() as { data: ScryfallCard[] }).data).sort(() => Math.random() - 0.5)
    const mana = allowed((await manaResponse.json() as { data: ScryfallCard[] }).data).sort(() => Math.random() - 0.5)
    return batchRecommendations([...main.map((card) => toCard(card, 'Popular inclusion')), ...mana.map((card) => toCard(card, 'Land or mana'))], includeCreature)
  }

  async function fetchCollectionCards(identityColours: string[], selectedSets: string[]) {
    const identity = identityColours.join('').toLowerCase() || 'c'
    const bracketFilters = [excludeGameChangers && '-is:gamechanger', excludeTutors && '-otag:tutor', excludeExtraTurns && '-otag:extra-turn', excludeUnreleased && 'date<=today'].filter(Boolean).join(' ')
    const setQuery = selectedSets.map((code) => `set:${code}`).join(' or ')
    const query = `id<=${identity} legal:commander -is:commander (${setQuery}) ${bracketFilters}`
    const cards: ScryfallCard[] = []
    let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=set`
    while (url) {
      const response = await fetch(url)
      if (!response.ok) {
        if (response.status === 404 && !cards.length) return []
        throw new Error('Scryfall unavailable')
      }
      const result = await response.json() as { data: ScryfallCard[]; has_more?: boolean; next_page?: string }
      cards.push(...result.data)
      url = result.has_more && result.next_page ? result.next_page : ''
    }
    return cards.filter((card) => powerTarget !== 'precon' || !preconFastMana.has(card.name)).filter((card, index, all) => all.findIndex((item) => item.name === card.name) === index)
  }

  async function collectionRecommendations(identityColours: string[], selectedSets = collectionSets) {
    if (!selectedSets.length) return []
    setCollectionState('loading')
    setCollectionError('')
    try {
      const unique = await fetchCollectionCards(identityColours, selectedSets)
      setCollectionPoolSize(unique.length)
      setCollectionState('idle')
      return unique.map((card) => ({ ...toCard(card, 'Collection match', `collection ${selectedSets.join(' ')}`), collectionMatch: true }))
    } catch (error) {
      setCollectionState('error')
      setCollectionError(error instanceof Error ? error.message : 'Collection unavailable')
      throw error
    }
  }

  async function themeRecommendations(identityColours: string[], themes: string[]) {
    const terms = [...new Set(themes.map((name) => themeSearchTerms[name]).filter(Boolean))]
    if (!terms.length) return []
    const identity = identityColours.join('').toLowerCase() || 'c'
    const bracketFilters = [excludeGameChangers && '-is:gamechanger', excludeTutors && '-otag:tutor', excludeExtraTurns && '-otag:extra-turn', excludeUnreleased && 'date<=today'].filter(Boolean).join(' ')
    const query = `id<=${identity} legal:commander -is:commander (${terms.join(' or ')}) ${bracketFilters}`
    const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=random`)
    if (!response.ok) return []
    const cards = (await response.json() as { data: ScryfallCard[] }).data
    return cards.filter((card) => powerTarget !== 'precon' || !preconFastMana.has(card.name)).map((card) => toCard(card, 'Interesting new pick', `theme ${themes.join(' ')}`))
  }

  async function edhrecRecommendations(slug: string) {
    const response = await fetch(`https://json.edhrec.com/pages/commanders/${slug}.json`)
    if (!response.ok) throw new Error('EDHREC unavailable')
    const result = await response.json() as { tag_counts?: EdhrecThemeCount[]; container?: { json_dict?: { cardlists?: { header: string; tag: string; cardviews: { name: string }[] }[] } } }
    setCommanderSubThemes(commanderThemes(result.tag_counts ?? []))
    const lists = result.container?.json_dict?.cardlists ?? []
    const entries = parseEdhrecEntries(lists)
    if (!entries.length) throw new Error('No EDHREC cards')

    const responseCards: ScryfallCard[] = []
    for (let index = 0; index < entries.length; index += 75) {
      const cardsResponse = await fetch('https://api.scryfall.com/cards/collection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers: entries.slice(index, index + 75).map(({ name }) => ({ name })) }) })
      if (!cardsResponse.ok) throw new Error('Scryfall unavailable')
      responseCards.push(...(await cardsResponse.json() as { data: ScryfallCard[] }).data)
    }
    return buildEdhrecRecommendations(entries, responseCards, { includeCreature, excludeGameChangers, excludeTutors, excludeExtraTurns, excludeUnreleased, powerTarget })
  }

  const loadPrintings = useCallback(async (cards: Card[], preferredSet = '', selectedCollectionSets = collectionSets, selectedCollectionMode = collectionMode) => {
    const analysis = analyseDeck(deck)
    const pickedTags = new Set([...deck.slice(commanderNames(commander).length).flatMap((card) => card.tags), ...Object.entries(preferenceScores).filter(([, score]) => score > 0).map(([tag]) => tag)])
    const roleBoosts: Record<string, number> = prioritizeDeckHealth ? deckRoleBoosts(deck.length, analysis.counts, deckTargets) : {}
    roleBoosts.lands = 0
    const neededRoles = new Set(prioritizeDeckHealth ? targetKeys.filter((key) => analysis.counts[key] < deckTargets[key]) : [])
    const roleSupply = Object.fromEntries(targetKeys.map((role) => [role, cards.filter((card) => rolesForCard(card).includes(role)).length]))
    const score = (card: Card) => recommendationScore(card, { theme, activeSubThemes, pickedTags, preferenceScores, neededRoles, cardRoles: rolesForCard(card), recommendationStyle, collectionSets: selectedCollectionMode === 'none' ? [] : selectedCollectionSets, collectionMode: selectedCollectionMode, roleBoosts, roleSupply, batchNumber })
    const specialCards = new Set([0, 4].flatMap((start) => {
      const recommended = cards.slice(start, start + 4).reduce<Card | null>((best, card) => !best || score(card) > score(best) ? card : best, null)
      return recommended && score(recommended) >= recommendedScoreThreshold && Math.random() < .5 ? [recommended] : []
    }))
    for (const offered of cards.slice(0, 8)) {
      if (offered.printings?.length && offered.printings.every((printing) => printing.finish && printing.setName && printing.scryfallUri)) continue
      await new Promise((resolve) => setTimeout(resolve, 100))
      const response = await fetch(offered.printsUri)
      if (!response.ok) continue
      const result = await response.json() as { data: ScryfallCard[] }
      const printings = orderedPrintings(offered, result.data.flatMap((printing) => {
        const image = printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal
        return image ? (printing.finishes ?? ['nonfoil']).map((finish) => ({ image, set: printing.set, setName: printing.set_name, collectorNumber: printing.collector_number, scryfallUri: printing.scryfall_uri, price: (finish === 'etched' ? printing.prices?.usd_etched : finish === 'foil' ? printing.prices?.usd_foil : printing.prices?.usd) ?? undefined, priceUri: printing.purchase_uris?.tcgplayer, finish })) : []
      }))
      const specialOptions = printings.map((printing, index) => printing.finish === 'foil' || printing.finish === 'etched' ? index : -1).filter((index) => index >= 0)
      const special = specialCards.has(offered) && specialOptions.length ? specialOptions[Math.floor(Math.random() * specialOptions.length)] : -1
      const collectionPrinting = !offered.printingManuallySelected && selectedCollectionMode !== 'none' && selectedCollectionSets.length ? printings.findIndex((printing) => selectedCollectionSets.includes(printing.set)) : -1
      const selectedIndex = special >= 0 ? special : collectionPrinting >= 0 ? collectionPrinting : preferredPrintingIndex(printings, preferredSet)
      const selected = printings[selectedIndex]
      setQueue((current) => current.map((item) => item.name === offered.name ? { ...item, printings, image: selected.image, set: selected.set, setName: selected.setName, collectorNumber: selected.collectorNumber, scryfallUri: selected.scryfallUri, price: selected.price, priceUri: selected.priceUri, finish: selected.finish, printing: selectedIndex } : item))
    }
  }, [activeSubThemes, batchNumber, collectionMode, collectionSets, commander, deck, deckTargets, preferenceScores, prioritizeDeckHealth, recommendationStyle, theme])

  useEffect(() => {
    const cards = queue.slice(0, 8)
    if (!cards.some((card) => !card.setName || !card.scryfallUri || card.printings?.some((printing) => !printing.finish || !printing.setName || !printing.scryfallUri))) return
    const repairKey = `${activeSavedDeckId}:${batchNumber}:${commander}:${cards.map((card) => card.name).join('|')}`
    if (repairedPrintingBatches.current.has(repairKey)) return
    repairedPrintingBatches.current.add(repairKey)
    void loadPrintings(cards, collectionSets[0] || preferredPrintSet)
  }, [activeSavedDeckId, batchNumber, collectionSets, commander, loadPrintings, preferredPrintSet, queue])

  async function start(name: string, preserveDeck = false) {
    const chosen = name.trim()
    if (!chosen) return
    const activeCollectionSets = preserveDeck ? collectionSets : []
    const activeCollectionMode = preserveDeck ? collectionMode : 'none' as const
    navigateView('builder', null, activeModal !== null)
    setCommander(chosen)
    const cycle = freshRecommendationCycle()
    setDeferredCards(cycle.deferredCards)
    setBatchNumber(cycle.batchNumber)
    setDecisions({})
    setLiked([])
    setBatchAnnouncement('')
    setCommanderSubThemes([])
    if (!preserveDeck) {
      setDeck([])
      setSideboard([])
      setIgnoredCards([])
      setActiveSubThemes([])
      setDismissedSubThemes([])
      setPreferenceScores({})
      setCollectionSets([])
      setCollectionGroups([])
      setCollectionMode('none')
      setCollectionPoolSize(null)
      setPrioritizeDeckHealth(recommendationStyle !== 'story')
    }
    setCommanderDetails(null)
    setQueue([])
    setLimitedRecommendations(false)
    setCollectionState('idle')
    setCollectionError('')
    if (!preserveDeck) setPreferredPrintSet('')
    setRecommendationLoadingStep('commander')
    setRecommendationState('loading')

    try {
      const responses = await Promise.all(commanderNames(chosen).map((name) => fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`)))
      if (responses.some((response) => !response.ok)) throw new Error('Commander unavailable')
      const commanders = await Promise.all(responses.map((response) => response.json() as Promise<CommanderCard>))
      const images = commanders.flatMap((card) => card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? [])
      const art = commanders.flatMap((card) => card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop ?? [])
      const identityColours = [...new Set(commanders.flatMap((card) => card.color_identity))]
      const commanderPrintings = await Promise.all(commanders.map(async (card) => {
        const finish = defaultFinish(card.finishes)
        const primary = { image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '', art: card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop, set: card.set, setName: card.set_name, collectorNumber: card.collector_number, scryfallUri: card.scryfall_uri, price: (finish === 'etched' ? card.prices?.usd_etched : finish === 'foil' ? card.prices?.usd_foil : card.prices?.usd) ?? undefined, priceUri: card.purchase_uris?.tcgplayer, finish }
        const response = await fetch(card.prints_search_uri)
        if (!response.ok) return [primary]
        const result = await response.json() as { data: CommanderCard[] }
        const alternatives = commanderPrintingOptions(result.data)
        return [primary, ...alternatives.filter((printing) => printing.image !== primary.image || printing.finish !== primary.finish)]
      }))
      if (images.length) setCommanderDetails({ images, art, colours: identityColours, printings: commanderPrintings, selections: commanders.map(() => 0) })
      if (!preserveDeck) setDeck(commanders.map((card, index) => ({ name: card.name, layout: card.layout ?? 'normal', typeLine: card.type_line, manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '', manaValue: card.cmc ?? 0, detail: cardText(card), producedMana: card.produced_mana ?? [], faces: card.card_faces?.map((face) => ({ typeLine: face.type_line ?? '', manaCost: face.mana_cost ?? '' })) ?? [], power: card.power ?? card.card_faces?.[0]?.power, toughness: card.toughness ?? card.card_faces?.[0]?.toughness, set: card.set, setName: card.set_name, collectorNumber: card.collector_number, scryfallUri: card.scryfall_uri, printsUri: card.prints_search_uri, image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '', price: card.prices?.usd ?? undefined, priceUri: card.purchase_uris?.tcgplayer, tags: cardTags(card), printings: commanderPrintings[index], printing: 0, finish: commanderPrintings[index][0].finish })))

      setRecommendationLoadingStep('recommendations')
      if (activeCollectionMode === 'only' && !activeCollectionSets.length) throw new Error('Select at least one collection for Only collection mode.')
      if (activeCollectionMode === 'only') setLimitedRecommendations(true)
      let offeredCards: Card[] = []
      if (activeCollectionMode !== 'only') {
        try {
          if (commanders.length !== 1) throw new Error('Partner pair has no single EDHREC page')
          offeredCards = await edhrecRecommendations(edhrecSlug(commanders[0].related_uris?.edhrec, commanders[0].name))
          if (offeredCards.length < 4) throw new Error('Too few EDHREC cards')
        } catch {
          offeredCards = await fallbackRecommendations(identityColours)
          setLimitedRecommendations(true)
        }
        try {
          const themeCards = await themeRecommendations(identityColours, [theme, ...(preserveDeck ? activeSubThemes : [])])
          const names = new Set(themeCards.map((card) => card.name))
          offeredCards = [...themeCards, ...offeredCards.filter((card) => !names.has(card.name))]
        } catch {
          // EDHREC or fallback cards remain usable when the optional theme source is unavailable.
        }
      }
      if (activeCollectionMode !== 'none' && activeCollectionSets.length) {
        try {
          const collectionCards = await collectionRecommendations(identityColours, activeCollectionSets)
          if (activeCollectionMode === 'only') offeredCards = collectionCards
          else {
            const collectionNames = new Set(collectionCards.map((card) => card.name))
            offeredCards = [...collectionCards, ...offeredCards.filter((card) => !collectionNames.has(card.name))]
          }
        } catch (error) {
          if (activeCollectionMode === 'only') throw error
        }
      }
      if (offeredCards.length < 4) throw new Error(activeCollectionMode === 'only' ? 'Selected collection has too few legal cards.' : 'Too few recommendation cards')
      if (preserveDeck) offeredCards = offeredCards.filter((card) => !ignoredCards.includes(card.name) && ![...deck, ...sideboard].some((deckCard) => deckCard.name === card.name))
      const rankingDeck = preserveDeck ? deck.slice(commanderNames(chosen).length) : []
      const rankingAnalysis = analyseDeck(preserveDeck ? deck : [])
      const rankingRoleBoosts: Record<string, number> = prioritizeDeckHealth ? deckRoleBoosts(deck.length, rankingAnalysis.counts, deckTargets) : {}
      rankingRoleBoosts.lands = 0
      const rankingRoles = new Set(prioritizeDeckHealth ? targetKeys.filter((key) => rankingAnalysis.counts[key] < deckTargets[key]) : [])
      const rankingContext = { theme, activeSubThemes, pickedTags: new Set([...rankingDeck.flatMap((card) => card.tags), ...Object.entries(preferenceScores).filter(([, score]) => score > 0).map(([tag]) => tag)]), preferenceScores, neededRoles: rankingRoles, cardRoles: [], recommendationStyle, collectionSets: activeCollectionSets, collectionMode: activeCollectionMode, roleBoosts: rankingRoleBoosts, roleSupply: Object.fromEntries(targetKeys.map((role) => [role, offeredCards.filter((card) => rolesForCard(card).includes(role)).length])), batchNumber: 1 }
      offeredCards = rankRecommendationCards(offeredCards, rankingContext, includeCreature, rolesForCard)
      setQueue(offeredCards)
      setRecommendationState('idle')
      void loadPrintings(offeredCards.slice(0, 8), activeCollectionSets[0] || (preserveDeck ? preferredPrintSet : ''), activeCollectionSets, activeCollectionMode)
      return true
    } catch (error) {
      setCollectionError(error instanceof Error ? error.message : 'Suggestions unavailable')
      setRecommendationState('error')
      return false
    }
  }

  function addRecommendationCard(card: Card) {
    const added: DeckCard = { name: card.name, layout: card.layout, typeLine: card.typeLine, manaCost: card.manaCost, manaValue: card.manaValue, detail: card.detail, producedMana: card.producedMana, faces: card.faces, power: card.power, toughness: card.toughness, set: card.set, setName: card.setName, collectorNumber: card.collectorNumber, scryfallUri: card.scryfallUri, printsUri: card.printsUri, image: card.image, price: card.price, priceUri: card.priceUri, tags: card.tags, printings: card.printings, printing: card.printing ?? 0, printingManuallySelected: card.printingManuallySelected, finish: card.finish }
    if (deck.length < 100) setDeck((list) => list.some((item) => item.name === card.name) ? list : [...list, added])
    else setSideboard((list) => list.some((item) => item.name === card.name) ? list : [...list, added])
    setQueue((current) => current.filter((item) => item.name !== card.name))
    setBatchAnnouncement(`${card.name} added from deck-health guidance.`)
  }

  function addCollectionCard(card: ScryfallCard) {
    if (manualCardError(card, [...deck, ...sideboard].map((item) => item.name), commanderDetails?.colours ?? [])) return
    const added = toDeckCard(card)
    if (deck.length < 100) setDeck((current) => [...current, added])
    else setSideboard((current) => [...current, added])
    setBatchAnnouncement(`${card.name} added from collection browsing.`)
  }

  function decide(card: Card, action: 'add' | 'later' | 'ignore') {
    const previous = decisions[card.name]
    if (previous === action) {
      if (action === 'add') {
        setDeck((list) => list.filter((item) => item.name !== card.name))
        setSideboard((list) => list.filter((item) => item.name !== card.name))
      }
      if (action === 'ignore') setIgnoredCards((current) => current.filter((name) => name !== card.name))
      setDecisions((current) => { const next = { ...current }; delete next[card.name]; return next })
      return
    }
    if (previous === 'add') {
      setDeck((list) => list.filter((item) => item.name !== card.name))
      setSideboard((list) => list.filter((item) => item.name !== card.name))
    }
    if (previous !== 'add' && action === 'add') {
      const added = { name: card.name, layout: card.layout, typeLine: card.typeLine, manaCost: card.manaCost, manaValue: card.manaValue, detail: card.detail, producedMana: card.producedMana, faces: card.faces, power: card.power, toughness: card.toughness, set: card.set, setName: card.setName, collectorNumber: card.collectorNumber, scryfallUri: card.scryfallUri, printsUri: card.printsUri, image: card.image, price: card.price, priceUri: card.priceUri, tags: card.tags, printings: card.printings, printing: card.printing ?? 0, printingManuallySelected: card.printingManuallySelected, finish: card.finish }
      if (deck.length < 100) setDeck((list) => card.typeLine.includes('Basic Land') || !list.some((item) => item.name === card.name) ? [...list, added] : list)
      else setSideboard((list) => card.typeLine.includes('Basic Land') || !list.some((item) => item.name === card.name) ? [...list, added] : list)
    }
    if (action === 'ignore') {
      setLiked((current) => current.filter((name) => name !== card.name))
      setIgnoredCards((current) => current.includes(card.name) ? current : [...current, card.name])
    } else setIgnoredCards((current) => current.filter((name) => name !== card.name))
    setDecisions((current) => ({ ...current, [card.name]: action }))
  }

  async function changeArt(name: string, sources: (string | undefined)[], apply: () => void) {
    setLoadingArt(`pending:${name}`)
    const loadingTimer = setTimeout(() => setLoadingArt(name), 50)
    await preloadArt(sources)
    clearTimeout(loadingTimer)
    apply()
    setLoadingArt('')
  }

  async function cycleCommanderPrinting(commanderIndex: number) {
    if (!commanderDetails || commanderDetails.printings[commanderIndex].length < 2 || loadingArt) return
    const selection = (commanderDetails.selections[commanderIndex] + 1) % commanderDetails.printings[commanderIndex].length
    const selected = commanderDetails.printings[commanderIndex][selection]
    const name = commanderNames(commander)[commanderIndex]
    await changeArt(name, [selected.image, selected.art], () => {
      setPreferredPrintSet(selected.set)
      setCommanderDetails((current) => current && ({ ...current, images: current.images.map((image, index) => index === commanderIndex ? selected.image : image), art: current.art.map((image, index) => index === commanderIndex ? selected.art ?? image : image), selections: current.selections.map((value, index) => index === commanderIndex ? selection : value) }))
      setDeck((current) => current.map((card, index) => index === commanderIndex ? { ...card, image: selected.image, set: selected.set, setName: selected.setName, collectorNumber: selected.collectorNumber, scryfallUri: selected.scryfallUri, price: selected.price, priceUri: selected.priceUri, printing: selection, finish: selected.finish } : card))
      setQueue((current) => current.map((card) => {
        if (!card.printings?.length) return card
        const matching = preferredPrintingIndex(card.printings, selected.set, card.printing, card.printingManuallySelected)
        const printing = card.printings[matching]
        return { ...card, image: printing.image, set: printing.set, setName: printing.setName, collectorNumber: printing.collectorNumber, scryfallUri: printing.scryfallUri, price: printing.price, priceUri: printing.priceUri, printing: matching, finish: printing.finish }
      }))
    })
  }

  async function cyclePrinting(card: Card) {
    if (!card.printings || card.printings.length < 2 || loadingArt) return
    const index = ((card.printing ?? 0) + 1) % card.printings.length
    const selected = card.printings[index]
    await changeArt(card.name, [selected.image], () => {
      setQueue((current) => current.map((item) => item.name === card.name ? { ...item, printing: index, image: selected.image, set: selected.set, setName: selected.setName, collectorNumber: selected.collectorNumber, scryfallUri: selected.scryfallUri, price: selected.price, priceUri: selected.priceUri, printingManuallySelected: true, finish: selected.finish } : item))
      if (decisions[card.name] === 'add') {
        const update = (item: DeckCard) => item.name === card.name ? { ...item, set: selected.set, setName: selected.setName, collectorNumber: selected.collectorNumber, scryfallUri: selected.scryfallUri, image: selected.image, price: selected.price, priceUri: selected.priceUri, printing: index, printingManuallySelected: true, finish: selected.finish } : item
        setDeck((current) => current.map(update))
        setSideboard((current) => current.map(update))
      }
    })
  }

  async function cycleDeckPrinting(cardIndex: number) {
    if (cardIndex < commanderNames(commander).length) {
      await cycleCommanderPrinting(cardIndex)
      return
    }
    const card = deck[cardIndex]
    if (!card.printings || card.printings.length < 2 || loadingArt) return
    const printing = ((card.printing ?? 0) + 1) % card.printings.length
    const selected = card.printings[printing]
    await changeArt(card.name, [selected.image], () => setDeck((current) => current.map((item, index) => index === cardIndex ? { ...item, image: selected.image, set: selected.set, setName: selected.setName, collectorNumber: selected.collectorNumber, scryfallUri: selected.scryfallUri, price: selected.price, priceUri: selected.priceUri, printing, printingManuallySelected: true, finish: selected.finish } : item)))
  }

  async function cycleSideboardPrinting(cardIndex: number) {
    const card = sideboard[cardIndex]
    if (!card?.printings || card.printings.length < 2 || loadingArt) return
    const printing = ((card.printing ?? 0) + 1) % card.printings.length
    const selected = card.printings[printing]
    await changeArt(card.name, [selected.image], () => setSideboard((current) => current.map((item, index) => index === cardIndex ? { ...item, image: selected.image, set: selected.set, setName: selected.setName, collectorNumber: selected.collectorNumber, scryfallUri: selected.scryfallUri, price: selected.price, priceUri: selected.priceUri, printing, printingManuallySelected: true, finish: selected.finish } : item)))
  }

  async function cycleSelectedDeckCardPrinting() {
    if (!selectedDeckCardLocation) return
    if (selectedDeckCardLocation.board === 'deck') await cycleDeckPrinting(selectedDeckCardLocation.index)
    else await cycleSideboardPrinting(selectedDeckCardLocation.index)
  }

  function deckList(format: ExportFormat) {
    const commanderCount = commanderNames(commander).length
    const section = (cards: DeckCard[]) => cards.map((card) => { const finish = card.finish === 'foil' ? ' *F*' : card.finish === 'etched' ? ' *E*' : ''; return format === 'plain' ? `1 ${card.name}${finish}` : format === 'csv' ? `1,"${card.name.replaceAll('"', '""')}",${card.set.toUpperCase()},${card.collectorNumber},${card.finish ?? ''}` : `1 ${card.name} (${card.set.toUpperCase()}) ${card.collectorNumber}${finish}` }).join('\n')
    if (format === 'csv') return ['Quantity,Name,Set,Collector Number,Foil,Board', ...deck.map((card, index) => `${section([card])},${index < commanderCount ? 'Commander' : 'Mainboard'}`), ...sideboard.map((card) => `${section([card])},Sideboard`)].join('\n')
    if (format === 'moxfield') return `${section(deck.slice(commanderCount))}${sideboard.length ? `\n\nSIDEBOARD:\n${section(sideboard)}` : ''}`
    return `${section(deck)}${sideboard.length ? `\n\nSIDEBOARD:\n${section(sideboard)}` : ''}`
  }

  async function copyDeck() {
    await navigator.clipboard.writeText(deckList(exportFormat))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const toDeckCard = (card: ScryfallCard): DeckCard => ({ name: card.name, layout: card.layout ?? 'normal', typeLine: card.type_line, manaCost: card.mana_cost ?? '', manaValue: card.cmc ?? 0, detail: cardText(card), producedMana: card.produced_mana ?? [], faces: card.card_faces?.map((face) => ({ typeLine: face.type_line ?? '', manaCost: face.mana_cost ?? '' })) ?? [], power: card.power ?? card.card_faces?.[0]?.power, toughness: card.toughness ?? card.card_faces?.[0]?.toughness, set: card.set, setName: card.set_name, collectorNumber: card.collector_number, scryfallUri: card.scryfall_uri, printsUri: card.prints_search_uri, image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '', price: card.prices?.usd ?? undefined, priceUri: card.purchase_uris?.tcgplayer, tags: cardTags(card), printing: 0 })

  async function fetchBasic(name: string) {
    const cached = basicCardCache.get(name)
    if (cached) return toDeckCard(cached)
    const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`)
    if (!response.ok) throw new Error('Basic land unavailable')
    const card = await response.json() as ScryfallCard
    basicCardCache.set(name, card)
    return toDeckCard(card)
  }

  async function addBasicLands(plan: { name: string; count: number }[]) {
    setBasicLandState('loading')
    try {
      const cards = await Promise.all(plan.map(async ({ name, count }) => ({ card: await fetchBasic(name), count })))
      setDeck((current) => [...current, ...cards.flatMap(({ card, count }) => Array.from({ length: count }, () => ({ ...card })))].slice(0, 100))
      setBasicLandState('idle')
      closeModal()
    } catch {
      setBasicLandState('error')
    }
  }

  function closeCardSearch() {
    closeModal()
    setCardSearch('')
    setCardSearchResults([])
    setSelectedManualCard(null)
    setManualPrintings([])
    setManualPrinting(0)
    setCardSearchState('idle')
    requestAnimationFrame(() => cardSearchButton.current?.focus())
  }

  async function selectManualCard(card: ScryfallCard) {
    setSelectedManualCard(card)
    setManualPrintings([card])
    setManualPrinting(0)
    if (!card.prints_search_uri) return
    const response = await fetch(card.prints_search_uri)
    if (!response.ok) return
    const printings = (await response.json() as { data: ScryfallCard[] }).data.filter((printing) => printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal)
    const selected = printings.findIndex((printing) => printing.set === card.set && printing.collector_number === card.collector_number)
    setManualPrintings(printings)
    setManualPrinting(Math.max(0, selected))
  }

  async function cycleManualPrinting() {
    if (manualPrintings.length < 2 || loadingArt) return
    const index = (manualPrinting + 1) % manualPrintings.length
    const selected = manualPrintings[index]
    await changeArt(selected.name, [scryfallImage(selected)], () => {
      setSelectedManualCard(selected)
      setManualPrinting(index)
    })
  }

  function addManualCard() {
    if (!selectedManualCard || manualCardError(selectedManualCard, [...deck, ...sideboard].map((card) => card.name), commanderDetails?.colours ?? [])) return
    const added = { ...toDeckCard(selectedManualCard), finish: selectedManualCard.finishes?.includes('nonfoil') ? 'nonfoil' as const : selectedManualCard.finishes?.[0] }
    if (deck.length < 100) setDeck((current) => [...current, added])
    else setSideboard((current) => [...current, added])
    closeCardSearch()
  }

  function handleCardSearchKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeCardSearch()
      return
    }
    const focusable = [...(cardSearchDialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])]
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const index = focusable.indexOf(document.activeElement as HTMLElement)
      const next = event.key === 'ArrowDown' ? Math.min(index + 1, focusable.length - 1) : Math.max(index - 1, 0)
      if (index >= 0 && next !== index) {
        event.preventDefault()
        focusable[next]?.focus()
      }
      return
    }
    if (event.key !== 'Tab' || !focusable.length) return
    const next = event.shiftKey ? focusable.at(-1) : focusable[0]
    if ((event.shiftKey && document.activeElement === focusable[0]) || (!event.shiftKey && document.activeElement === focusable.at(-1))) {
      event.preventDefault()
      next?.focus()
    }
  }

  async function addOneBasic(name: string) {
    if (deck.length >= 100) return
    try {
      const existing = deck.find((card) => card.name === name)
      const added = existing ? { ...existing } : await fetchBasic(name)
      setDeck((current) => current.length < 100 ? [...current, added] : current)
    } catch {
      setBasicLandState('error')
    }
  }

  function clearAddedDecision(name: string) {
    setDecisions((current) => {
      if (current[name] !== 'add') return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function positionDeckPreview(rowOrEvent: HTMLLIElement | MouseEvent<HTMLLIElement>, pointerX = window.innerWidth * .5) {
    const row = 'currentTarget' in rowOrEvent ? rowOrEvent.currentTarget : rowOrEvent
    if (!row || typeof row.getBoundingClientRect !== 'function') return
    const bounds = row.getBoundingClientRect()
    const edge = 16
    const gap = 12
    const previewWidth = Math.min(320, window.innerWidth * .25)
    const previewHeight = Math.min(window.innerHeight - edge * 2, previewWidth * 680 / 488 + 24)
    const maxTop = Math.max(edge, window.innerHeight - previewHeight - edge)
    const top = Math.min(maxTop, Math.max(edge, bounds.top + (bounds.height - previewHeight) / 2))
    const rightPosition = bounds.right + gap
    const leftPosition = window.innerWidth - bounds.left + gap
    const rightFits = rightPosition + previewWidth <= window.innerWidth - edge
    const leftFits = leftPosition + previewWidth <= window.innerWidth - edge
    const showRight = rightFits && (pointerX < window.innerWidth * .6 || !leftFits)
    row.style.setProperty('--preview-top', `${top}px`)
    row.style.setProperty('--preview-left', showRight ? `${Math.max(edge, Math.min(rightPosition, window.innerWidth - previewWidth - edge))}px` : 'auto')
    row.style.setProperty('--preview-right', showRight ? 'auto' : `${Math.max(edge, Math.min(leftPosition, window.innerWidth - previewWidth - edge))}px`)
  }

  async function hydrateDeckCardDetails(card: DeckCard) {
    try {
      let fetched: ScryfallCard | undefined
      if (!card.setName || !card.scryfallUri || !card.printsUri || (cardCanHavePowerToughness(card) && (!card.power || !card.toughness))) {
        const response = await fetchScryfallCollection([{ set: card.set, collector_number: card.collectorNumber }])
        if (!response.ok) return
        fetched = (await response.json() as { data: ScryfallCard[] }).data[0]
        if (!fetched) return
      }
      const printsUri = card.printsUri ?? fetched?.prints_search_uri
      let printings = card.printings
      if ((!printings || printings.length < 2) && printsUri) {
        const response = await fetch(printsUri)
        if (response.ok) {
          const result = await response.json() as { data: ScryfallCard[] }
          const options = cardPrintingOptions(result.data)
          if (options.length) printings = orderedPrintings(card, options)
        }
      }
      const desiredFinish = card.finish ?? 'nonfoil'
      const selectedIndex = printings?.findIndex((printing) => printing.set === card.set && printing.collectorNumber === card.collectorNumber && printing.finish === desiredFinish) ?? -1
      const selected = selectedIndex >= 0 ? printings?.[selectedIndex] : undefined
      const metadata = {
        setName: selected?.setName ?? fetched?.set_name ?? card.setName,
        scryfallUri: selected?.scryfallUri ?? fetched?.scryfall_uri ?? card.scryfallUri,
        power: fetched?.power ?? fetched?.card_faces?.[0]?.power ?? card.power,
        toughness: fetched?.toughness ?? fetched?.card_faces?.[0]?.toughness ?? card.toughness,
        printsUri,
        price: selected?.price ?? fetched?.prices?.usd ?? card.price,
        priceUri: selected?.priceUri ?? fetched?.purchase_uris?.tcgplayer ?? card.priceUri,
        printings,
        printing: selectedIndex >= 0 ? selectedIndex : card.printing,
        finish: selected?.finish ?? card.finish,
      }
      const isSamePrinting = (item: DeckCard) => item.name === card.name && item.set === card.set && item.collectorNumber === card.collectorNumber
      setDeck((current) => current.map((item) => isSamePrinting(item) ? { ...item, ...metadata } : item))
      setSideboard((current) => current.map((item) => isSamePrinting(item) ? { ...item, ...metadata } : item))
    } catch {
      // The modal still shows the locally stored card details when Scryfall is unavailable.
    }
  }

  function openDeckCard(card: DeckCard, location: DeckCardLocation) {
    setSelectedDeckCardLocation(location)
    openModal('card')
    if (!card.setName || !card.scryfallUri || !card.printings || card.printings.length < 2 || (cardCanHavePowerToughness(card) && (!card.power || !card.toughness))) void hydrateDeckCardDetails(card)
  }

  function openCommanderCard(index: number) {
    const card = deck[index]
    if (card) openDeckCard(card, { board: 'deck', index })
  }

  function closeDeckCard() {
    setPendingCardRemoval(null)
    setSelectedDeckCardLocation(null)
    closeModal()
  }

  function removeSelectedDeckCard() {
    const location = selectedDeckCardLocation
    if (!location) return
    const pending = pendingCardRemoval?.board === location.board && pendingCardRemoval.index === location.index
    if (!pending) {
      setPendingCardRemoval({ ...location })
      return
    }
    if (location.board === 'deck') removeDeckCard(location.index)
    else removeSideboardCard(location.index)
    closeDeckCard()
  }

  function removeDeckCard(index: number) {
    const removed = deck[index]
    setPendingRemoval(null)
    setDeck((current) => current.filter((_, cardIndex) => cardIndex !== index))
    clearAddedDecision(removed.name)
  }

  function removeSideboardCard(index: number) {
    const removed = sideboard[index]
    setSideboard((current) => current.filter((_, cardIndex) => cardIndex !== index))
    clearAddedDecision(removed.name)
  }

  function moveSideboardCard(index: number) {
    if (deck.length >= 100) return
    const card = sideboard[index]
    setSideboard((current) => current.filter((_, cardIndex) => cardIndex !== index))
    setDeck((current) => [...current, card])
  }

  function currentState(): PersistedDeckState | null {
    return currentDeckState
  }

  function openSavedDecks() {
    if (commander && !activeSavedDeckId && !deckName) setDeckName(suggestedDeckName(commander, theme, activeSubThemes))
    openModal('saved')
  }

  function storeDeck() {
    const state = currentState()
    const name = deckName.trim()
    if (!state || !name || duplicateDeckName(savedDecks, name, activeSavedDeckId)) return
    const id = activeSavedDeckId || crypto.randomUUID()
    setSavedDecks(saveSavedDeck({ id, name, updatedAt: new Date().toISOString(), state: { ...state, savedDeckId: id } }))
    setActiveSavedDeckId(id)
  }

  function loadSavedDeck(saved: SavedDeck) {
    const state = saved.state
    setCommander(state.commander)
    setCommanderDetails(state.commanderDetails)
    setTheme(state.theme)
    setRecommendationStyle(state.recommendationStyle)
    setCollectionSets(state.collectionSets)
    setCollectionGroups(state.collectionGroups)
    setCollectionMode(state.collectionMode)
    setPrioritizeDeckHealth(state.prioritizeDeckHealth)
    setCollectionPoolSize(null)
    setQueue(state.queue)
    setLimitedRecommendations(state.limitedRecommendations)
    setDecisions(state.decisions)
    setIgnoredCards(state.ignoredCards)
    setLiked(state.liked)
    setActiveSubThemes(state.activeSubThemes)
    setDismissedSubThemes(state.dismissedSubThemes)
    setPreferenceScores(state.preferenceScores)
    setCommanderSubThemes(state.commanderSubThemes)
    setDeferredCards(state.deferredCards)
    setBatchNumber(state.batchNumber)
    setDeck(state.deck)
    setSideboard(state.sideboard)
    setPreferredPrintSet(state.preferredPrintSet)
    setDeckTargets(state.deckTargets)
    setActiveSavedDeckId(state.savedDeckId || saved.id)
    setDeckName(saved.name)
    navigateView('builder', null, true)
  }

  function removeSavedDeck(saved: SavedDeck) {
    setPendingSavedDeckRemoval('')
    setSavedDecks(deleteSavedDeck(saved.id))
    if (activeSavedDeckId === saved.id) {
      setActiveSavedDeckId('')
      setDeckName('')
    }
  }

  async function importDeck() {
    setImportState('loading')
    setImportError('')
    try {
      if (/^https?:\/\//i.test(importSource.trim())) throw new Error('URL import is unavailable in this client-only app. Paste the exported deck list instead.')
      await applyImportedDeck(parseDeckList(importSource))
      closeModal(true)
      setImportSource('')
      setImportState('idle')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not import deck.')
      setImportState('error')
    }
  }

  async function applyImportedDeck(imported: ImportedDeck) {
    const commanderEntries = imported.cards.filter(({ board }) => board === 'commander')
    if (!commanderEntries.length) throw new Error('Mark commander with a COMMANDER section.')
    if (commanderEntries.reduce((sum, card) => sum + card.quantity, 0) > 2) throw new Error('Commander section must contain one commander or partner pair.')
    const mainCount = imported.cards.filter(({ board }) => board !== 'sideboard').reduce((sum, card) => sum + card.quantity, 0)
    if (mainCount > 100) throw new Error('Main deck exceeds 100 cards.')

    const identifiers = imported.cards.map((card) => card.set && card.collectorNumber ? { set: card.set, collector_number: card.collectorNumber } : { name: card.name })
    const fetched: ScryfallCard[] = []
    const unresolved: typeof imported.cards = []
    for (let index = 0; index < identifiers.length; index += 75) {
      const entries = imported.cards.slice(index, index + 75)
      const response = await fetchScryfallCollection(identifiers.slice(index, index + 75))
      if (!response.ok) throw new Error('Scryfall unavailable. Try again.')
      const result = await response.json() as { data: ScryfallCard[]; not_found?: { name?: string; set?: string; collector_number?: string }[] }
      fetched.push(...result.data)
      unresolved.push(...entries.filter((entry) => !matchImportedCard(entry, result.data)))
    }
    if (unresolved.length) {
      const response = await fetchScryfallCollection(unresolved.map(({ name }) => ({ name })))
      if (!response.ok) throw new Error('Scryfall unavailable. Try again.')
      const result = await response.json() as { data: ScryfallCard[]; not_found?: { name?: string; set?: string; collector_number?: string }[] }
      fetched.push(...result.data)
      if (result.not_found?.length) throw new Error(`Not found: ${missingCardNames(result.not_found, unresolved).join(', ')}. Check spelling, set, and collector number.`)
    }
    const resolved = imported.cards.map((entry) => matchImportedCard(entry, fetched))
    const stillMissing = imported.cards.filter((_, index) => !resolved[index])
    if (stillMissing.length) throw new Error(`Not found: ${stillMissing.map(({ name }) => name).join(', ')}. Check spelling, set, and collector number.`)

    const expanded = imported.cards.flatMap((entry, index) => Array.from({ length: entry.quantity }, () => ({ entry, card: resolved[index]! })))
    const commanderCards = expanded.filter(({ entry }) => entry.board === 'commander')
    if (commanderCards.some(({ card }) => !card.type_line.includes('Legendary') && !card.type_line.includes('Background'))) throw new Error('Commander section contains a card that cannot be a commander.')
    const identity = [...new Set(commanderCards.flatMap(({ card }) => card.color_identity))]
    const illegal = expanded.find(({ card }) => card.color_identity.some((colour) => !identity.includes(colour)))
    if (illegal) throw new Error(`${illegal.card.name} is outside commander colour identity.`)

    const name = commanderCards.map(({ card }) => card.name).join(' & ')
    const loaded = await start(name)
    if (!loaded) throw new Error('Could not load commander recommendations.')
    const toImportedCard = ({ card }: (typeof expanded)[number]) => toDeckCard(card)
    const importedMain = expanded.filter(({ entry }) => entry.board !== 'sideboard').sort((a, b) => Number(b.entry.board === 'commander') - Number(a.entry.board === 'commander')).map(toImportedCard)
    const importedSideboard = expanded.filter(({ entry }) => entry.board === 'sideboard').map(toImportedCard)
    setDeck(importedMain)
    setSideboard(importedSideboard)
    setQueue((current) => current.filter((card) => !expanded.some(({ card: importedCard }) => importedCard.name === card.name)))
    setDeckName(imported.name ?? '')
    setActiveSavedDeckId('')
  }

  function startOver() {
    if (!window.confirm('Start over? This clears your current deck and recommendation history. Saved decks remain available.')) return
    clearDeckState()
    setCommander('')
    setCommanderDetails(null)
    setTheme('')
    setCollectionSets([])
    setCollectionGroups([])
    setCollectionMode('none')
    setPrioritizeDeckHealth(recommendationStyle !== 'story')
    setCollectionPoolSize(null)
    setDeck([])
    setSideboard([])
    setQueue([])
    setDecisions({})
    setIgnoredCards([])
    setLiked([])
    setActiveSubThemes([])
    setDismissedSubThemes([])
    setPreferenceScores({})
    setCommanderSubThemes([])
    setDeferredCards([])
    setBatchNumber(1)
    setPreferredPrintSet('')
    setDeckTargets(defaultDeckTargets)
    setActiveSavedDeckId('')
    setDeckName('')
    navigateView('start', null, true)
  }

  const importModal = showImport && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && importState !== 'loading') closeModal() }}>
    <section className="export-modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="export-heading"><div><p className="eyebrow">Bring an existing deck</p><h2 id="import-title">Import deck</h2></div><button className="modal-close" disabled={importState === 'loading'} onClick={() => closeModal()} aria-label="Close import">×</button></div>
      <p className="import-help">Paste an exported deck list. Put commander cards below a <b>COMMANDER:</b> heading. Set and collector number syntax is preserved.</p>
      <p className="import-note">Moxfield and Archidekt URLs are not supported because this is a client-only app and those sites block browser access. Export the deck as text, then paste it here.</p>
      <textarea value={importSource} onChange={(event) => { setImportSource(event.target.value); setImportState('idle'); setImportError('') }} placeholder={'COMMANDER:\n1 Commander Name (SET) 123\n\nMAINBOARD:\n1 Card Name (SET) 456'} aria-label="Exported deck list" />
      {importError && <p className="form-error" role="alert">{importError}</p>}
      <div className="export-actions"><button onClick={() => closeModal()} disabled={importState === 'loading'}>Cancel</button><button className="primary" disabled={!importSource.trim() || importState === 'loading'} onClick={() => void importDeck()}>{importState === 'loading' ? 'Importing…' : 'Import deck'}</button></div>
    </section>
  </div>

  const deckNameDuplicate = duplicateDeckName(savedDecks, deckName, activeSavedDeckId)
  const savedDecksModal = showSavedDecks && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal() }}>
    <section className="export-modal saved-decks-modal" role="dialog" aria-modal="true" aria-labelledby="saved-decks-title">
      <div className="export-heading"><div><p className="eyebrow">Local decks</p><h2 id="saved-decks-title">Saved decks</h2></div><button className="modal-close" onClick={() => closeModal()} aria-label="Close saved decks">×</button></div>
      {commander && <><form className="save-deck-form" onSubmit={(event) => { event.preventDefault(); storeDeck() }}><label><span className="sr-only">Deck name</span><input value={deckName} onChange={(event) => setDeckName(event.target.value)} aria-label="Deck name" aria-invalid={deckNameDuplicate} aria-describedby={deckNameDuplicate ? 'deck-name-warning' : undefined} /><button type="button" className="clear-deck-name" onClick={() => setDeckName('')} aria-label="Clear deck name">×</button>{deckNameDuplicate && <small id="deck-name-warning" className="deck-name-warning">Name already used</small>}</label><button className="primary" disabled={!deckName.trim() || deckNameDuplicate}>{activeSavedDeck ? 'Overwrite save' : 'Save deck'}</button></form>{activeSavedDeck && <p className="overwrite-notice">This will overwrite <b>{activeSavedDeck.name}</b> with <span className="delta-added">+{activeDeckDelta?.added} added</span> and <span className="delta-removed">−{activeDeckDelta?.removed} removed</span>.</p>}</>}
      <div className="saved-deck-list">{savedDecks.map((saved) => <article key={saved.id}><div className="saved-deck-details"><b>{saved.name}</b><span>{saved.state.commander} · {saved.state.deck.length}/100 cards</span><small>Updated {new Date(saved.updatedAt).toLocaleString()}</small></div><button className="saved-deck-load" onClick={() => loadSavedDeck(saved)}>Load</button><span className="saved-deck-delete-wrap"><button className={`saved-deck-delete ${pendingSavedDeckRemoval === saved.id ? 'confirm' : ''}`} onClick={() => pendingSavedDeckRemoval === saved.id ? removeSavedDeck(saved) : setPendingSavedDeckRemoval(saved.id)} aria-label={pendingSavedDeckRemoval === saved.id ? `Confirm deletion of ${saved.name}` : `Delete ${saved.name}`}>{pendingSavedDeckRemoval === saved.id ? 'Confirm' : 'Delete'}</button>{pendingSavedDeckRemoval === saved.id && <span className="saved-delete-confirm" role="tooltip">Click again to delete</span>}</span></article>)}</div>
      {!savedDecks.length && <p className="saved-decks-empty">No saved decks yet.</p>}
    </section>
  </div>

  const deckCardModal = showDeckCard && selectedDeckCard && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeckCard() }}>
    <section className="export-modal deck-card-modal" role="dialog" aria-modal="true" aria-labelledby="deck-card-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeDeckCard() } }}>
      <div className="export-heading"><p className="eyebrow">Deck card</p><button className="modal-close" autoFocus onClick={closeDeckCard} aria-label={`Close ${selectedDeckCard.name} details`}>×</button></div>
      <div className="deck-card-modal-content">
        <figure className="deck-card-modal-art"><FinishedCardImage image={selectedDeckCard.image} alt={`${selectedDeckCard.name} card`} finish={selectedDeckCard.finish} effectsEnabled={cardEffects} className="deck-card-modal-image" /><ArtLoading active={loadingArt === selectedDeckCard.name} /><PrintingButton count={selectedDeckCard.printings?.length ?? 0} index={selectedDeckCard.printing ?? 0} loading={Boolean(loadingArt)} name={selectedDeckCard.name} onClick={() => void cycleSelectedDeckCardPrinting()} /></figure>
        <div className="deck-card-modal-copy"><div className="deck-card-modal-title"><h2 id="deck-card-title">{selectedDeckCard.name}</h2><span className="deck-card-modal-mana"><OracleText text={selectedDeckCard.manaCost} /></span></div><p className="card-type-line">{cardTypeLine(selectedDeckCard)}</p><p className="deck-card-description"><OracleText text={selectedDeckCard.detail} /></p><CardDetails card={selectedDeckCard} source={{ label: 'Scryfall', uri: cardScryfallUri(selectedDeckCard) }} /></div>
      </div>
      {!selectedDeckCardIsCommander && <div className="deck-card-modal-actions"><button type="button" className={`deck-card-modal-remove ${pendingCardRemoval?.board === selectedDeckCardLocation?.board && pendingCardRemoval?.index === selectedDeckCardLocation?.index ? 'confirm' : ''}`} onClick={removeSelectedDeckCard}>{pendingCardRemoval?.board === selectedDeckCardLocation?.board && pendingCardRemoval?.index === selectedDeckCardLocation?.index ? 'Confirm removal' : `Remove from ${selectedDeckCardLocation?.board === 'sideboard' ? 'sideboard' : 'deck'}`}</button></div>}
    </section>
  </div>

  function fanCards(event: MouseEvent<HTMLDivElement>) {
    const cards = event.currentTarget.querySelectorAll<HTMLElement>('.card-offer')
    cards.forEach((card) => {
      const { left, width } = card.getBoundingClientRect()
      const proximity = Math.max(0, 1 - Math.abs(event.clientX - (left + width / 2)) / Math.max(width * 1.5, 1))
      const image = card.querySelector('.offered-image')?.getBoundingClientRect()
      card.style.setProperty('--pointer-proximity', proximity.toFixed(3))
      card.style.cursor = image && event.clientX >= image.left && event.clientX <= image.right && event.clientY >= image.top && event.clientY <= image.bottom ? 'pointer' : ''
    })
  }

  function resetFan(event: MouseEvent<HTMLDivElement>) {
    event.currentTarget.querySelectorAll<HTMLElement>('.card-offer').forEach((card) => { card.style.removeProperty('--pointer-proximity'); card.style.cursor = '' })
  }

  function clickCardImage(event: MouseEvent<HTMLElement>, card: Card) {
    if ((event.target as HTMLElement).closest('button')) return
    const image = event.currentTarget.querySelector('.offered-image')?.getBoundingClientRect()
    if (image && event.clientX >= image.left && event.clientX <= image.right && event.clientY >= image.top && event.clientY <= image.bottom) decide(card, 'add')
  }

  async function nextBatch(extraSubTheme = '') {
    if (recommendationOptionsChanged) {
      if (await start(commander, true)) setRecommendationOptionsChanged(false)
      return
    }
    const batch = queue.slice(0, 4)
    const analysis = analyseDeck(deck)
    const roleBoosts: Record<string, number> = prioritizeDeckHealth ? deckRoleBoosts(deck.length, analysis.counts, deckTargets) : {}
    roleBoosts.lands = 0
    const next = advanceRecommendationQueue({ queue, deferredCards, batchNumber, decisions, liked, preferenceScores, activeSubThemes, extraSubTheme, theme, includeCreature, roleBoosts, cardRoles: rolesForCard, recommendationStyle, collectionSets, collectionMode })
    setPreferenceScores(next.preferenceScores)
    setDeferredCards(next.deferredCards)
    setBatchNumber(next.batchNumber)
    setQueue(next.queue)
    setDecisions({})
    setLiked((current) => current.filter((name) => !batch.some((card) => card.name === name)))
    setBatchAnnouncement(next.queue.length ? `Recommendation batch ${next.batchNumber} loaded: ${next.queue.slice(0, 4).map((card) => card.name).join(', ')}.` : 'No recommendations currently eligible. Deferred cards will return after their waiting period.')
    void loadPrintings(next.queue.slice(0, 8), collectionSets[0] || preferredPrintSet)
  }

  if (!showBuilder) return (
    <main className={darkMode ? 'dark' : ''}>
      <header><button className="brand reset" type="button" onClick={() => navigateView('start')}>Commander Deck Creator <small>v{__APP_VERSION__}</small></button><div className="header-actions"><label className="theme-option"><input type="checkbox" checked={commanderStyling} onChange={(event) => setCommanderStyling(event.target.checked)} /> Commander art and colours</label><label className="theme-option" title="Enable card movement and foil or etched finish effects"><input type="checkbox" checked={cardEffects} onChange={(event) => setCardEffects(event.target.checked)} /> Motion and finishes</label><button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>{darkMode ? '◐ Dark' : '☀ Light'}</button><button className="export" type="button" onClick={() => openModal('import')}>Import deck</button><button className="export" type="button" onClick={openSavedDecks}>Saved decks ({savedDecks.length})</button></div></header>
      {savedDecksModal}
      {importModal}
      <section className="start">
        <p className="eyebrow">Build from scratch</p>
        <h1>What do you want to play?</h1>
        <p className="lead">Start with an idea, browse suggestions, or find any commander.</p>

        <div className="start-grid">
          <article className="start-panel">
            <span className="step">01</span>
            <h2>Start with a theme</h2>
            <p>Pick something you enjoy. We'll suggest commanders next.</p>
            <div className="themes">
              {visibleThemes.map((name) => <button className={theme === name ? 'selected' : ''} key={name} type="button" onClick={() => chooseTheme(name)}>{name}</button>)}
            </div>
            {visibleThemes.length < selectableThemes.length && <div className="theme-actions">
              <button className="reroll" type="button" onClick={() => setVisibleThemes((current) => [...current, ...randomItems(selectableThemes.filter((name) => !current.includes(name)), 6)])}>+ Show more themes</button>
              <button className="reroll" type="button" onClick={() => { setTheme(''); setVisibleThemes(randomItems(selectableThemes, 6)) }}>↻ Show different themes</button>
            </div>}
            <h3 className="filter-heading">Or choose colours</h3>
            <div className="colour-picker">
              {Object.entries(colourNames).map(([symbol, name]) => <button className={colours.includes(symbol) ? 'selected' : ''} key={symbol} onClick={() => toggleColour(symbol)} aria-label={name}><img src={`https://svgs.scryfall.io/card-symbols/${symbol}.svg`} alt="" /></button>)}
            </div>
          </article>

          <article className="start-panel">
            <span className="step">02</span>
            <h2>Choose a commander</h2>
            <p>{theme ? `${theme} commanders selected for you.` : colours.length ? `${colours.map((colour) => colourNames[colour]).join(' + ')} commanders.` : "Search by name, or try today's suggestions."}</p>
            <form onSubmit={(event) => { event.preventDefault(); start(search) }}>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search commanders…" aria-label="Search commanders" autoComplete="off" />
              <button className="primary" type="submit">Choose</button>
            </form>
            <div className="suggestions" aria-live="polite">
              {(search.trim().length >= 2 ? matches : suggestions).map((name) => <button key={name} onClick={() => start(name)}><span className="commander-option"><span className={`commander-cost ${commanderCosts[name] === undefined ? 'loading' : 'loaded'}`}>{commanderCosts[name] === undefined ? <span className="cost-placeholder" aria-label="Loading mana cost" /> : <OracleText text={commanderCosts[name]} />}</span><span>{name}</span></span><span>→</span>{commanderImages[name]?.length > 0 && <span className={`suggestion-preview ${commanderImages[name].length > 1 ? 'pair' : ''}`}>{commanderImages[name].map((image, index) => <img src={image} alt={`${commanderNames(name)[index]} card`} key={image} />)}</span>}</button>)}
            </div>
            {search.trim().length < 2 && <button className="reroll" onClick={() => setSuggestions(randomThree(suggestionPool))}>↻ Show different commanders</button>}
          </article>
        </div>
      </section>
    </main>
  )

  const primaryTheme = colourThemes[commanderDetails?.colours[0] ?? 'C']
  const secondaryTheme = colourThemes[commanderDetails?.colours[1] ?? commanderDetails?.colours[0] ?? 'C']
  const deckCards = deck.slice(commanderNames(commander).length)
  const dismissedThemeCounts = new Map(dismissedSubThemes.map((item) => { const split = item.lastIndexOf(':'); return split > 0 ? [item.slice(0, split), Number(item.slice(split + 1))] : [item, Infinity] }))
  const inferredSubThemes = activeSubThemes.length < 2 ? sharedThemes(deckCards, [theme, ...activeSubThemes]).filter((name) => deckCards.filter((card) => card.tags.includes(name)).length > (dismissedThemeCounts.get(name) ?? -1)).slice(0, 1) : []
  const chooseSubTheme = (name: string) => {
    const themes = [...activeSubThemes, name].slice(0, 2)
    setActiveSubThemes(themes)
    setQueue((current) => balanceThemeCoverage(current, themes))
    setShowSubThemePicker(false)
    setSubThemeSearch('')
  }
  const chooseRecommendationStyle = (style: RecommendationStyle) => {
    setRecommendationStyle(style)
    setPrioritizeDeckHealth(style !== 'story')
    setRecommendationOptionsChanged(true)
  }
  const chooseCollectionMode = (mode: CollectionMode) => {
    setCollectionMode(mode)
    if (mode === 'none') {
      setCollectionSets([])
      setCollectionGroups([])
    }
    setCollectionPoolSize(null)
    setRecommendationOptionsChanged(true)
  }
  const toggleCollectionSet = (code: string) => {
    setCollectionSets((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code])
    if (collectionMode === 'none') setCollectionMode('prefer')
    setCollectionPoolSize(null)
    setRecommendationOptionsChanged(true)
  }
  const toggleCollectionGroup = (id: string) => {
    const group = curatedCollections.find((item) => item.id === id)
    if (!group) return
    const codes = group.setCodes.filter((code) => !setOptions.length || setOptions.some((set) => set.code === code))
    setCollectionGroups((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    setCollectionSets((current) => collectionGroups.includes(id) ? current.filter((code) => !codes.includes(code)) : [...current, ...codes.filter((code) => !current.includes(code))])
    if (collectionMode === 'none') setCollectionMode('prefer')
    setCollectionPoolSize(null)
    setRecommendationOptionsChanged(true)
  }
  async function browseCollection() {
    if (!collectionSets.length) return
    setShowCollectionBrowser(true)
    setCollectionBrowserState('loading')
    setCollectionBrowserError('')
    try {
      const cards = await fetchCollectionCards(commanderDetails?.colours ?? [], collectionSets)
      setCollectionBrowserCards(randomItems(cards, cards.length))
      setCollectionPoolSize(cards.length)
      setCollectionBrowserState('idle')
    } catch (error) {
      setCollectionBrowserState('error')
      setCollectionBrowserError(error instanceof Error ? error.message : 'Collection unavailable')
    }
  }
  const filteredCollectionCards = collectionBrowserCards.filter((card) => {
    const type = collectionBrowserType === 'all' || card.type_line.toLowerCase().includes(collectionBrowserType)
    const mana = collectionBrowserMana.trim()
    const value = mana ? Number(mana) : NaN
    return type && (!mana || (Number.isFinite(value) && (value >= 7 ? (card.cmc ?? 0) >= 7 : (card.cmc ?? 0) === value)))
  }).slice(0, 60)
  const filteredSetOptions = setOptions.filter((set) => {
    const query = collectionSearch.trim().toLowerCase()
    return !query || `${set.name} ${set.code}`.toLowerCase().includes(query)
  }).filter((set) => !collectionSets.includes(set.code)).slice(0, 8)
  const rawBatch = queue.slice(0, 4)
  const synergyPair = findSynergyPair(rawBatch.filter((card) => card.reason !== 'Land or mana'))
  const pairCards = synergyPair?.cards ?? []
  const visibleBatch = pairCards.length ? [...pairCards, ...rawBatch.filter((card) => !pairCards.includes(card))] : rawBatch
  const inferredThemeOptions = [...new Set(deck.slice(commanderNames(commander).length).flatMap((card) => card.tags))].filter((name) => supportedThemes.includes(name))
  const subThemeOptions = [...new Set([...commanderSubThemes, ...inferredThemeOptions, ...supportedThemes])]
  const filteredSubThemes = subThemeOptions.filter((name) => themeMatchesSearch(name, subThemeSearch) && name !== theme && !activeSubThemes.includes(name))
  const analysis = analyseDeck(deck)
  const missingHealthRoles = targetKeys.filter((key) => analysis.counts[key] < deckTargets[key])
  const healthSuggestions = recommendationStyle === 'story' && !prioritizeDeckHealth ? queue.slice(4).filter((card, index, cards) => rolesForCard(card).some((role) => missingHealthRoles.includes(role)) && cards.findIndex((item) => item.name === card.name) === index).slice(0, 3) : []
  const guidance = deckGuidance(deck.length, analysis.counts, deckTargets)
  const calculatedLandTarget = deckTargets.lands
  const representativeSpellCount = deck.slice(commanderNames(commander).length).filter((card) => !card.typeLine.includes('Land')).length
  const basicLands = representativeSpellCount >= 5 ? basicLandPlan(commanderDetails?.colours ?? [], analysis.required, analysis.counts.lands, calculatedLandTarget, deck.length) : []
  const indexedDeck = deck.map((card, index) => ({ card, index }))
  const commanders = indexedDeck.slice(0, commanderNames(commander).length)
  const groupedBasics = [...new Set(indexedDeck.filter(({ card }) => isBasicLandName(card.name)).map(({ card }) => card.name))].map((name) => ({ name, cards: indexedDeck.filter(({ card }) => card.name === name) }))
  const mainboardDeck = indexedDeck.slice(commanderNames(commander).length)
  const groupedDeckColumns = deckColumnSections.map((sections) => sections.map((section) => {
    const cards = section === 'Commander' ? commanders : mainboardDeck.filter(({ card }) => displayDeckSection(card) === section && !isBasicLandName(card.name))
    return { section, cards, count: cards.length + (section === 'Lands' ? groupedBasics.reduce((sum, basic) => sum + basic.cards.length, 0) : 0) }
  }).filter(({ section, cards }) => cards.length || (section === 'Lands' && groupedBasics.length)))
  const legalBasicNames = commanderDetails?.colours.length ? commanderDetails.colours.map((colour) => basicLandNames[colour as keyof typeof basicLandNames]) : ['Wastes']
  const maxCurveCount = Math.max(1, ...analysis.curve.map((point) => point.permanents + point.nonPermanents))
  const displayedTypeCounts = [['Land', analysis.counts.lands], ...cardTypes.map((type) => [type, analysis.typeCounts[type]] as const), ['Other', deck.filter((card) => deckSection(card.typeLine) === 'Other').length]] as const
  const maxTypeCount = Math.max(1, ...displayedTypeCounts.map(([, count]) => count))
  const manaColours = (['W', 'U', 'B', 'R', 'G'] as const)
  const pickedTags = new Set([...deck.slice(commanderNames(commander).length).flatMap((card) => card.tags), ...Object.entries(preferenceScores).filter(([, score]) => score > 0).map(([tag]) => tag)])
  const cardReason = (card: Card) => {
    const subThemes = activeSubThemes.filter((tag) => card.tags.includes(tag))
    if (subThemes.length) return `${subThemes.join(' + ')} sub-theme`
    if (theme && card.tags.includes(theme)) return `${theme} theme`
    if (collectionMode !== 'none' && card.collectionMatch) return 'Selected collection card'
    if (collectionMode !== 'none' && collectionSets.includes(card.set)) return 'Selected collection printing'
    const missingRole = rolesForCard(card).find((role) => role !== 'lands' && analysis.counts[role] < deckTargets[role])
    if (missingRole) return targetLabels[missingRole]
    const preference = card.tags.filter((tag) => pickedTags.has(tag) && (preferenceScores[tag] ?? 0) > 0).sort((a, b) => (preferenceScores[b] ?? 0) - (preferenceScores[a] ?? 0))[0]
    return preference ? `Matches your ${preference} picks` : card.reason
  }
  const recommendationRoleBoosts: Record<string, number> = prioritizeDeckHealth ? deckRoleBoosts(deck.length, analysis.counts, deckTargets) : {}
  recommendationRoleBoosts.lands = 0
  const neededRoles = new Set(prioritizeDeckHealth ? targetKeys.filter((key) => analysis.counts[key] < deckTargets[key]) : [])
  const recommendationRoleSupply = Object.fromEntries(targetKeys.map((role) => [role, queue.filter((card) => rolesForCard(card).includes(role)).length]))
  const scoredBatch = visibleBatch.map((card) => ({ card, score: recommendationScoreBreakdown(card, { theme, activeSubThemes, pickedTags, preferenceScores, neededRoles, cardRoles: rolesForCard(card), recommendationStyle, collectionSets, collectionMode, roleBoosts: recommendationRoleBoosts, roleSupply: recommendationRoleSupply, batchNumber }) }))
  const recommendedCard = scoredBatch.reduce((best, item) => item.score.total > best.score ? { card: item.card, score: item.score.total } : best, { card: null as Card | null, score: recommendedScoreThreshold - 1 })

  return (
    <main className={`${darkMode ? 'dark ' : ''}${commanderStyling ? 'commander-themed' : ''}`} style={{ '--commander-accent': primaryTheme[0], '--commander-highlight': secondaryTheme[1] } as CSSProperties}>
      {commanderStyling && commanderDetails?.art.length ? <div className="commander-backdrop" aria-hidden="true">{commanderDetails.art.map((image) => <span style={{ backgroundImage: `url(${image})` }} key={image} />)}</div> : null}
      <header>
        <button className="brand reset" onClick={startOver}>Commander Deck Creator <small>v{__APP_VERSION__}</small></button>
        <div className="deck-status">{activeSavedDeck && <div className="saved-status"><b>{activeSavedDeck.name}</b><small>Saved {new Date(activeSavedDeck.updatedAt).toLocaleString()} <span className="delta-added">+{activeDeckDelta?.added}</span> <span className="delta-removed">−{activeDeckDelta?.removed}</span></small></div>}<div className="progress"><span style={{ background: `linear-gradient(90deg, var(--commander-accent, #7650ae) ${deck.length}%, #dedcea ${deck.length}%)` }} />{deck.length} / 100 cards</div></div>
        <div className="header-actions"><label className="theme-option"><input type="checkbox" checked={commanderStyling} onChange={(event) => setCommanderStyling(event.target.checked)} /> Commander art and colours</label><label className="theme-option" title="Enable card movement and foil or etched finish effects"><input type="checkbox" checked={cardEffects} onChange={(event) => setCardEffects(event.target.checked)} /> Motion and finishes</label><button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>{darkMode ? '◐ Dark' : '☀ Light'}</button><button className="start-over" type="button" onClick={startOver}>Start over</button><button className="export" type="button" onClick={() => openModal('import')}>Import</button><button className="export" type="button" onClick={openSavedDecks}>Save / load</button><button className="export" type="button" onClick={() => openModal('export')}>Export deck</button></div>
      </header>
      {savedDecksModal}
      {importModal}
      {deckCardModal}
      <section className="intro commander-header">
        {commanderDetails ? <figure className={`commander-card ${commanderDetails.images.length > 1 ? 'pair' : ''}`} tabIndex={0} aria-label={`View ${commander} card${commanderDetails.images.length > 1 ? 's' : ''}`}>
          {commanderDetails.images.map((image, index) => <img src={image} alt={`${commanderNames(commander)[index]} card`} onClick={() => openCommanderCard(index)} key={commanderNames(commander)[index]} />)}
          {commanderDetails.printings.some((printings) => printings.length > 1) && <span className="printing-indicator" aria-hidden="true">↻ Art</span>}
          <span className="card-zoom">{commanderDetails.images.map((image, index) => <span className="commander-printing" key={commanderNames(commander)[index]}><FinishedCardImage image={image} alt={`${commanderNames(commander)[index]} full card`} finish={commanderDetails.printings[index][commanderDetails.selections[index]]?.finish} effectsEnabled={cardEffects} /><ArtLoading active={loadingArt === commanderNames(commander)[index]} /><PrintingButton count={commanderDetails.printings[index].length} index={commanderDetails.selections[index]} loading={Boolean(loadingArt)} name={commanderNames(commander)[index]} onClick={() => void cycleCommanderPrinting(index)} /></span>)}</span>
        </figure> : <span className="commander-card commander-placeholder" aria-hidden="true" />}
        <div className="commander-summary"><p className="eyebrow">Building around</p><h1><button type="button" className="commander-name" onClick={() => openCommanderCard(0)}>{commander}</button></h1>
          <div className="identity" aria-label={`Colour identity: ${commanderDetails?.colours.map((colour) => colourNames[colour]).join(', ') || 'loading'}`}>
            <span>Colour identity</span>
            {commanderDetails?.colours.length === 0 && <img className="colour" src="https://svgs.scryfall.io/card-symbols/C.svg" alt="Colourless" />}
            {commanderDetails?.colours.map((colour) => <img className="colour" src={`https://svgs.scryfall.io/card-symbols/${colour}.svg`} alt={colourNames[colour]} key={colour} />)}
          </div>
          <button className="change" onClick={startOver}>Change commander</button>
        </div>
        <div className="recommendation-setup">
          <div className="section-title"><div><p className="eyebrow">Next pick</p><h2>Add to your deck</h2></div><span>Batch {batchNumber}</span></div>
          <div className="recommendation-options">
            <label>Recommendation style <select value={recommendationStyle} onChange={(event) => chooseRecommendationStyle(event.target.value as RecommendationStyle)}><option value="story">Story deck</option><option value="balanced">Balanced</option><option value="optimized">Optimized</option></select></label>
            <label>Power target <select value={powerTarget} onChange={(event) => choosePowerTarget(event.target.value as PowerTarget)}><option value="precon">Core (Bracket 2)</option><option value="upgraded">Upgraded (Bracket 3)</option><option value="high">High power / Optimized (Bracket 4)</option></select></label>
            <label><input type="checkbox" checked={prioritizeDeckHealth} onChange={(event) => { setPrioritizeDeckHealth(event.target.checked); setRecommendationOptionsChanged(true) }} /> Prioritize deck health</label>
            <label><input type="checkbox" checked={includeCreature} onChange={(event) => { setIncludeCreature(event.target.checked); setRecommendationOptionsChanged(true) }} /> Include a creature when possible</label>
            <fieldset className="collection-picker"><legend>Collection affinity</legend>
              <label><span className="sr-only">Search sets</span><input value={collectionSearch} onChange={(event) => setCollectionSearch(event.target.value)} placeholder="Search sets…" aria-label="Search sets" /></label>
              <div className="collection-groups" aria-label="Curated collections">{curatedCollections.map((group) => <button type="button" aria-pressed={collectionGroups.includes(group.id)} className={collectionGroups.includes(group.id) ? 'selected' : ''} key={group.id} onClick={() => toggleCollectionGroup(group.id)}>{group.name}</button>)}</div>
              {collectionSets.length > 0 && <div className="collection-chips">{collectionSets.map((code) => <button type="button" key={code} onClick={() => toggleCollectionSet(code)}>{setOptions.find((set) => set.code === code)?.name ?? code.toUpperCase()} ×</button>)}</div>}
              {filteredSetOptions.length > 0 && <div className="collection-set-results">{filteredSetOptions.map((set) => <button type="button" key={set.code} onClick={() => toggleCollectionSet(set.code)}>{set.name} <small>{set.code.toUpperCase()}</small></button>)}</div>}
              <label>Match <select value={collectionMode} onChange={(event) => chooseCollectionMode(event.target.value as CollectionMode)}><option value="none">No collection preference</option><option value="prefer">Prefer selected collection</option><option value="only">Only selected collection</option></select></label>
              <button type="button" disabled={!collectionSets.length || collectionBrowserState === 'loading'} onClick={() => void browseCollection()}>{collectionBrowserState === 'loading' ? 'Loading collection…' : 'Browse collection'}</button>
              {collectionState === 'loading' && <small role="status">Checking legal collection…</small>}
              {collectionError && <small className="form-error" role="alert">{collectionError}</small>}
              {collectionSets.length > 0 && collectionPoolSize !== null && <small>{collectionPoolSize} legal unique cards found.</small>}
            </fieldset>
            <fieldset><legend>Exclude from recommendations</legend>
              <label><input type="checkbox" checked={excludeGameChangers} onChange={(event) => { setExcludeGameChangers(event.target.checked); setRecommendationOptionsChanged(true) }} /> Exclude Game Changers</label>
              <label><input type="checkbox" checked={excludeTutors} onChange={(event) => { setExcludeTutors(event.target.checked); setRecommendationOptionsChanged(true) }} /> Exclude tutors</label>
              <label><input type="checkbox" checked={excludeExtraTurns} onChange={(event) => { setExcludeExtraTurns(event.target.checked); setRecommendationOptionsChanged(true) }} /> Exclude extra turns</label>
              <label><input type="checkbox" checked={excludeUnreleased} onChange={(event) => { setExcludeUnreleased(event.target.checked); setRecommendationOptionsChanged(true) }} /> Exclude unreleased cards</label>
            </fieldset>
            {recommendationOptionsChanged && <span className="options-pending" role="status">Changes apply with next recommendations.</span>}
          </div>
        </div>
      </section>
      {showCollectionBrowser && <section className="collection-browser" aria-labelledby="collection-browser-title">
        <div className="collection-browser-heading"><div><p className="eyebrow">Discovery</p><h2 id="collection-browser-title">Browse selected collection</h2><p>{collectionPoolSize ?? collectionBrowserCards.length} legal unique cards, shown in random order.</p></div><button type="button" onClick={() => setShowCollectionBrowser(false)}>Close</button></div>
        <div className="collection-browser-filters"><label>Card type <select value={collectionBrowserType} onChange={(event) => setCollectionBrowserType(event.target.value)}><option value="all">All types</option><option value="creature">Creatures</option><option value="artifact">Artifacts</option><option value="enchantment">Enchantments</option><option value="instant">Instants</option><option value="sorcery">Sorceries</option><option value="land">Lands</option></select></label><label>Mana value <input type="number" min="0" max="16" value={collectionBrowserMana} onChange={(event) => setCollectionBrowserMana(event.target.value)} placeholder="Any" /></label></div>
        {collectionBrowserState === 'loading' && <p role="status">Loading legal collection cards…</p>}
        {collectionBrowserState === 'error' && <p className="form-error" role="alert">{collectionBrowserError}</p>}
        {collectionBrowserState === 'idle' && <div className="collection-browser-grid">{filteredCollectionCards.map((card) => <article key={`${card.name}-${card.set}-${card.collector_number}`}><div>{scryfallImage(card) && <img src={scryfallImage(card)} alt="" />}</div><h3>{card.name}</h3><p>{card.type_line}</p><span>{card.cmc ?? 0} mana · {card.set.toUpperCase()}</span><button type="button" disabled={Boolean(manualCardError(card, [...deck, ...sideboard].map((item) => item.name), commanderDetails?.colours ?? []))} onClick={() => addCollectionCard(card)}>Add to deck</button></article>)}</div>}
        {collectionBrowserState === 'idle' && !filteredCollectionCards.length && <p>No cards match those filters.</p>}
      </section>}
      {showCardSearch && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCardSearch() }}>
        <section className="export-modal card-search-modal" ref={cardSearchDialog} role="dialog" aria-modal="true" aria-labelledby="card-search-title" onKeyDown={handleCardSearchKeys}>
          <div className="export-heading"><div><p className="eyebrow">Add any legal card</p><h2 id="card-search-title">Find a card</h2></div><button className="modal-close" onClick={closeCardSearch} aria-label="Close card search">×</button></div>
          <form className="card-search-form" onSubmit={(event) => { event.preventDefault(); const card = cardSearchResults.find((item) => item.name.toLowerCase() === cardSearch.trim().toLowerCase()) ?? cardSearchResults[0]; if (card) selectManualCard(card) }}>
            <input ref={cardSearchInput} value={cardSearch} onChange={(event) => { setCardSearch(event.target.value); setCardSearchResults([]); setCardSearchState('idle'); setSelectedManualCard(null) }} placeholder="Search card names…" aria-label="Card name" autoComplete="off" />
            <button className="primary" disabled={!cardSearchResults.length || cardSearchState === 'loading'}>Search</button>
          </form>
          <label className="card-search-filter"><input type="checkbox" checked={filterCardIdentity} onChange={(event) => { setFilterCardIdentity(event.target.checked); setCardSearchResults([]); setSelectedManualCard(null) }} /> Only show cards in commander colour identity</label>
          {cardSearchState === 'loading' && <p className="card-search-status" role="status">Searching…</p>}
          {cardSearchState === 'error' && <p className="form-error" role="alert">Scryfall unavailable. Try again.</p>}
          {cardSearch.length >= 2 && cardSearchState === 'idle' && !cardSearchResults.length && !selectedManualCard && <p className="card-search-status">No cards found.</p>}
          {!selectedManualCard && cardSearchResults.length > 0 && <div className="card-search-results" aria-label="Card search results">{cardSearchResults.map((card) => <button type="button" key={card.name} onClick={() => void selectManualCard(card)}><span><b>{card.name}</b><small>{card.type_line}</small></span><span className="search-result-mana"><OracleText text={card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? ''} /></span>{(card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal) && <span className="search-card-popover"><FinishedCardImage image={card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? ''} alt={`${card.name} card`} finish={defaultFinish(card.finishes)} effectsEnabled={cardEffects} /></span>}</button>)}</div>}
          {selectedManualCard && <div className="manual-card-preview">
            {scryfallImage(selectedManualCard) && <figure className="manual-card-image" tabIndex={0}><img src={scryfallImage(selectedManualCard)} alt={`${selectedManualCard.name} card`} /><span className="manual-card-zoom"><FinishedCardImage image={scryfallImage(selectedManualCard)} alt={`${selectedManualCard.name} enlarged card`} finish={defaultFinish(selectedManualCard.finishes)} effectsEnabled={cardEffects} /></span><ArtLoading active={loadingArt === selectedManualCard.name} /><PrintingButton count={manualPrintings.length} index={manualPrinting} loading={Boolean(loadingArt)} name={selectedManualCard.name} onClick={() => void cycleManualPrinting()} /></figure>}
            <div><p className="eyebrow">{selectedManualCard.set.toUpperCase()} · {selectedManualCard.collector_number}</p><h3>{selectedManualCard.name}</h3><p>{selectedManualCard.type_line}</p><p><OracleText text={cardText(selectedManualCard)} /></p>
              {manualCardError(selectedManualCard, [...deck, ...sideboard].map((card) => card.name), commanderDetails?.colours ?? []) && <p className="form-error" role="alert">{manualCardError(selectedManualCard, [...deck, ...sideboard].map((card) => card.name), commanderDetails?.colours ?? [])}</p>}
              <div className="export-actions"><button type="button" onClick={() => setSelectedManualCard(null)}>Back</button><button className="primary" type="button" disabled={Boolean(manualCardError(selectedManualCard, [...deck, ...sideboard].map((card) => card.name), commanderDetails?.colours ?? []))} onClick={addManualCard}>{deck.length >= 100 ? 'Add to sideboard' : 'Add to deck'}</button></div>
            </div>
          </div>}
        </section>
      </div>}
      {showBasicLands && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && basicLandState !== 'loading') closeModal() }}>
        <section className="export-modal basic-land-modal" role="dialog" aria-modal="true" aria-labelledby="basic-land-title">
          <div className="export-heading"><div><p className="eyebrow">Complete mana base</p><h2 id="basic-land-title">Add basic lands?</h2></div><button className="modal-close" disabled={basicLandState === 'loading'} onClick={() => closeModal()} aria-label="Close basic land review">×</button></div>
          <p>This fills {basicLands.reduce((sum, land) => sum + land.count, 0)} slots toward your {calculatedLandTarget}-land target. Existing cards stay unchanged.</p>
          <ul className="basic-land-plan">{basicLands.map((land) => <li key={land.name}><span>{land.name}</span><b>{land.count}</b></li>)}</ul>
          {basicLandState === 'error' && <p className="form-error" role="alert">Could not load basic lands. Try again.</p>}
          <div className="export-actions"><button onClick={() => closeModal()} disabled={basicLandState === 'loading'}>Cancel</button><button className="primary" disabled={basicLandState === 'loading'} onClick={() => void addBasicLands(basicLands)}>{basicLandState === 'loading' ? 'Adding…' : 'Add lands'}</button></div>
        </section>
      </div>}
      {showExport && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal() }}>
        <section className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
          <div className="export-heading"><div><p className="eyebrow">Export deck</p><h2 id="export-title">Copy your deck list</h2></div><button className="modal-close" onClick={() => closeModal()} aria-label="Close export">×</button></div>
          <div className="format-tabs" role="group" aria-label="Deck list format">
            <button className={exportFormat === 'moxfield' ? 'selected' : ''} onClick={() => setExportFormat('moxfield')}>Moxfield</button>
            <button className={exportFormat === 'plain' ? 'selected' : ''} onClick={() => setExportFormat('plain')}>Plain text</button>
            <button className={exportFormat === 'csv' ? 'selected' : ''} onClick={() => setExportFormat('csv')}>CSV</button>
          </div>
          {exportFormat === 'moxfield' && <p className="moxfield-instructions"><b>Commander must be selected manually in Moxfield.</b> Moxfield does not support importing a deck with its commander included. Choose Commander format, set {commanderNames(commander).length > 1 ? 'commanders' : 'commander'} to <b>{commanderNames(commander).join(' and ')}</b>, then paste this {deck.length - commanderNames(commander).length}-card mainboard list.</p>}
          <textarea readOnly value={deckList(exportFormat)} onFocus={(event) => event.currentTarget.select()} aria-label={`${exportFormat} deck list`} />
          <div className="export-actions"><a href="https://www.moxfield.com/decks/personal" target="_blank" rel="noreferrer">Open Moxfield decks ↗</a><button className="primary" onClick={() => void copyDeck()}>{copied ? 'Copied' : 'Copy to clipboard'}</button></div>
        </section>
      </div>}
      <div className="workspace">
        <section className="recommendations">
          <p className="sr-only" aria-live="polite" aria-atomic="true">{batchAnnouncement}</p>
          {limitedRecommendations && recommendationState === 'idle' && <p className="limited-mode" role="status">{collectionMode === 'only' ? 'Collection-only recommendations use legal Scryfall cards.' : 'Limited recommendations - EDHREC unavailable, using Scryfall popularity.'}</p>}
          <div className="recommendation-toolbar">
            <div className="subthemes" aria-label="Deck themes">
              {theme && <button type="button" onClick={() => setTheme('')} title="Remove declared theme">{theme} <span>×</span></button>}
              {activeSubThemes.map((name) => <button type="button" onClick={() => setActiveSubThemes((current) => current.filter((item) => item !== name))} title={`Remove ${name} sub-theme`} key={name}>{name} <span>×</span></button>)}
              {inferredSubThemes.map((inferredSubTheme) => <span className="suggested-subtheme" key={inferredSubTheme}><span>{inferredSubTheme}?</span><button type="button" onClick={() => chooseSubTheme(inferredSubTheme)} aria-label={`Accept ${inferredSubTheme} sub-theme`}>✓</button><button type="button" onClick={() => setDismissedSubThemes((current) => [...current.filter((item) => !item.startsWith(`${inferredSubTheme}:`) && item !== inferredSubTheme), `${inferredSubTheme}:${deckCards.filter((card) => card.tags.includes(inferredSubTheme)).length}`])} aria-label={`Dismiss ${inferredSubTheme} sub-theme`}>×</button></span>)}
              {activeSubThemes.length < 2 && <button className="add-subtheme" type="button" onClick={() => setShowSubThemePicker((current) => !current)}>+ Choose sub-theme</button>}
            </div>
            <div className="toolbar-actions">
              <button className="manual-card-button" type="button" onClick={() => openModal('search')}>+ Add card by name</button>
              {(queue.length > 0 || deferredCards.length > 0) && recommendationState === 'idle' && <div className="batch-controls"><button className="primary" onClick={() => void nextBatch()}>Next recommendations →</button></div>}
            </div>
          </div>
          {showSubThemePicker && <div className="subtheme-picker">
            <input value={subThemeSearch} onChange={(event) => setSubThemeSearch(event.target.value)} placeholder="Search sub-themes…" aria-label="Search sub-themes" />
            <div>{filteredSubThemes.slice(0, 8).map((name) => <button type="button" key={name} onClick={() => chooseSubTheme(name)}>{name}</button>)}</div>
          </div>}
          {deck.length >= 100 && <div className="completion sideboard-completion"><p className="eyebrow">Main deck complete</p><h2>Build your sideboard</h2><p>Further picks go to sideboard. Move cards into main deck after removing a card.</p><button className="primary" type="button" onClick={() => openModal('export')}>Review and export deck</button></div>}
          {recommendationState === 'loading' ? <div className="recommendation-loading" role="status" aria-live="polite"><span className="loading-orb" aria-hidden="true" /><div><p className="eyebrow">Building your first batch</p><h3>{recommendationLoadingStep === 'commander' ? 'Checking commander details…' : 'Finding cards that work together…'}</h3><ol><li className={recommendationLoadingStep === 'commander' ? 'active' : 'done'}>Commander</li><li className={recommendationLoadingStep === 'recommendations' ? 'active' : ''}>Recommendations</li></ol></div></div> : recommendationState === 'error' ? <div className="empty"><h3>Suggestions unavailable</h3><p>{collectionError || 'Scryfall is busy. Try this commander again shortly.'}</p><button className="primary" onClick={() => void start(commander)}>Retry</button></div> : queue.length ? <div className={`card-grid connector-glow juicy-fan ${cardEffects ? '' : 'static-fan'}`} onMouseMove={cardEffects ? fanCards : undefined} onMouseLeave={cardEffects ? resetFan : undefined}>
            {scoredBatch.map(({ card, score }, index) => <article className={`card-offer ${decisions[card.name] ?? ''} ${pairCards.includes(card) ? `synergy-pair synergy-${pairCards.indexOf(card) + 1}` : ''}`} style={{ '--fan-position': index - (scoredBatch.length - 1) / 2, '--fan-drop': `${Math.abs(index - (scoredBatch.length - 1) / 2) * 7}px` } as CSSProperties} onClick={(event) => clickCardImage(event, card)} key={card.name}>
              {decisions[card.name] && <span className="decision-badge">{decisions[card.name] === 'add' ? sideboard.some((item) => item.name === card.name) ? 'Added to sideboard' : 'Added to deck' : decisions[card.name] === 'later' ? 'Later' : 'Ignored'}</span>}
              <div className="offer-heading"><h3 className="suggestion-type">{cardReason(card)}</h3>{recommendedCard.card === card && <span className="recommended-badge">Recommended</span>}</div>
              <div className={`actions ${deck.length >= 100 ? 'sideboard-actions' : ''}`}>
                <div><button className="primary" aria-pressed={decisions[card.name] === 'add'} onClick={() => decide(card, 'add')}>{deck.length >= 100 && decisions[card.name] !== 'add' ? 'Sideboard' : 'Add'}</button><span className="action-help-wrap"><button aria-pressed={decisions[card.name] === 'later'} onClick={() => decide(card, 'later')} aria-describedby={`later-${card.name}`}>Later</button><span className="action-help" id={`later-${card.name}`} role="tooltip">Skip for now. This card may return in a later batch.</span></span><span className="action-help-wrap"><button className="quiet" aria-pressed={decisions[card.name] === 'ignore'} onClick={() => decide(card, 'ignore')} aria-describedby={`ignore-${card.name}`}>Ignore</button><span className="action-help" id={`ignore-${card.name}`} role="tooltip">Remove this card from all future recommendations.</span></span></div>
                <span className="similar-wrap"><button className={`similar ${liked.includes(card.name) ? 'selected' : ''}`} type="button" disabled={decisions[card.name] === 'ignore'} aria-pressed={liked.includes(card.name)} onClick={() => setLiked((current) => current.includes(card.name) ? current.filter((name) => name !== card.name) : [...current, card.name])} aria-label={`Find more cards like ${card.name}`} aria-describedby={`similar-${card.name}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg></button><span className="similar-help" id={`similar-${card.name}`} role="tooltip">Prioritise similar cards in future recommendations.</span></span>
              </div>
              <div className="offered-image"><FinishedCardImage image={card.image} alt={`${card.name} card`} finish={card.finish} effectsEnabled={cardEffects} hasSynergyGlow={pairCards.includes(card)} className="card-face-image" />{pairCards.includes(card) && synergyPair && <span className="synergy-info"><button type="button" aria-describedby={`synergy-${card.name}`}>ⓘ Synergy</button><span className="synergy-popover" id={`synergy-${card.name}`} role="tooltip"><strong>{card.name} + {pairCards.find((item) => item !== card)?.name}</strong><span>{synergyPair.explanation}.</span></span></span>}<ArtLoading active={loadingArt === card.name} /><PrintingButton count={card.printings?.length ?? 0} index={card.printing ?? 0} loading={Boolean(loadingArt)} name={card.name} onClick={() => void cyclePrinting(card)} /></div>
              <div className="card-copy"><h3>{card.name}</h3><p><OracleText text={card.detail} /></p><CardDetails card={card} source={limitedRecommendations || card.source === 'scryfall' || card.collectionMatch ? { label: 'Scryfall', uri: cardScryfallUri(card) } : { label: 'EDHREC', uri: `https://edhrec.com/cards/${edhrecSlug(undefined, card.name)}` }} /><ScoreBreakdown score={score} /></div>
            </article>)}
          </div> : <div className="empty"><h3>{deferredCards.length ? 'Suggestions resting' : 'No more suggestions'}</h3><p>{deferredCards.length ? 'Advance recommendations to keep their waiting period, then bring them back.' : 'Review your deck or choose another commander.'}</p></div>}
          {healthSuggestions.length > 0 && <section className="health-lane" aria-labelledby="health-lane-title"><div><p className="eyebrow">Optional guidance</p><h3 id="health-lane-title">Deck health suggestions</h3><p>Story mode keeps these separate from your theme picks.</p></div><div>{healthSuggestions.map((card) => { const role = rolesForCard(card).find((item) => missingHealthRoles.includes(item)); return <article key={card.name}><span>{role ? targetLabels[role as keyof typeof targetLabels] : 'Deck support'}</span><b>{card.name}</b><button type="button" onClick={() => addRecommendationCard(card)}>Add</button></article> })}</div></section>}
        </section>
        <aside className="analysis-panel">
          <section className="deck-analysis" aria-labelledby="analysis-title">
            <h3 id="analysis-title">Deck analysis</h3>
            <p className="sr-only" aria-live="polite">{highlightedManaValue === null ? 'Mana-value filter cleared.' : `Showing mana value ${highlightedManaValue === 7 ? '7 or more' : highlightedManaValue} cards.`}</p>
            <div className="curve-scroll">
              <div className="mana-curve" aria-label="Mana-value curve">
                {analysis.curve.map((point) => <button type="button" className={highlightedManaValue === point.manaValue ? 'selected' : ''} onClick={() => setHighlightedManaValue((current) => current === point.manaValue ? null : point.manaValue)} aria-pressed={highlightedManaValue === point.manaValue} aria-label={`Mana value ${point.manaValue === 7 ? '7 or more' : point.manaValue}: ${point.permanents} permanents, ${point.nonPermanents} non-permanents`} key={point.manaValue}>
                  <span className="curve-bars"><i className="permanent" style={{ height: `${point.permanents / maxCurveCount * 100}%` }} /><i className="non-permanent" style={{ height: `${point.nonPermanents / maxCurveCount * 100}%` }} /></span><b>{point.manaValue === 7 ? '7+' : point.manaValue}</b>{highlightedManaValue === point.manaValue && <span className="sr-only">Selected</span>}
                </button>)}
              </div>
            </div>
            <div className="curve-legend"><span><i className="permanent" /> Permanent</span><span><i className="non-permanent" /> Non-permanent</span><b>Avg {analysis.averageManaValue.toFixed(1)}</b></div>
            <div className="mana-balance"><h4>Colour balance</h4>{([['Pips', analysis.required], ['Sources', analysis.produced]] as const).map(([label, values]) => <div className="mana-balance-row" key={label}><span>{label}</span><div className="colour-bar">{manaColours.some((colour) => values[colour] > 0) ? manaColours.filter((colour) => values[colour] > 0).map((colour) => <span className={`colour-segment colour-${colour.toLowerCase()}`} style={{ flexGrow: values[colour] }} title={`${colourNames[colour]}: ${values[colour]} ${label.toLowerCase()}`} key={colour}><img src={`https://svgs.scryfall.io/card-symbols/${colour}.svg`} alt="" /><b><span className="sr-only">{colourNames[colour]}: </span>{values[colour]}</b></span>) : <span className="colour-empty">None</span>}</div></div>)}</div>
            <div className="target-heading"><h4>Deck targets</h4><span>Suggested lands {analysis.landRange[0]}-{analysis.landRange[1]}</span></div>
            {representativeSpellCount < 5 && analysis.counts.lands < calculatedLandTarget ? <p className="basic-land-wait">Add {5 - representativeSpellCount} more non-land {5 - representativeSpellCount === 1 ? 'card' : 'cards'} to calculate basic land colours.</p> : basicLands.length > 0 && <button className="basic-land-button" type="button" onClick={() => { setBasicLandState('idle'); openModal('basics') }}><span>Fill to land target</span><b>+{basicLands.reduce((sum, land) => sum + land.count, 0)} basics</b></button>}
            <div className="deck-targets">{targetKeys.map((key) => <label key={key}><span className="bar-label"><span>{targetLabels[key]}</span><span className="ratio-bar"><i style={{ width: `${Math.min(100, analysis.counts[key] / Math.max(1, deckTargets[key]) * 100)}%` }} /></span><b>{analysis.counts[key]} / <input type="number" min="0" max="99" value={deckTargets[key]} onChange={(event) => setDeckTargets((current) => ({ ...current, [key]: Math.max(0, Number(event.target.value)) }))} aria-label={`${targetLabels[key]} target`} /></b></span></label>)}</div>
            {displayedTypeCounts.some(([, count]) => count > 0) && <><h4>Card type distribution</h4><div className="type-counts">{displayedTypeCounts.filter(([, count]) => count > 0).map(([type, count]) => <span key={type}><span className="bar-label"><span>{type}</span><span className="ratio-bar"><i style={{ width: `${count / maxTypeCount * 100}%` }} /></span><b>{count}</b></span></span>)}</div></>}
            {guidance.length > 0 && <div className="deck-guidance" aria-live="polite">{guidance.map((item) => <p className={item.strong ? 'strong' : ''} key={item.key}>{item.text}</p>)}</div>}
          </section>
        </aside>
        <section className="deck-board" aria-labelledby="deck-list-title">
          <div className="deck-board-heading"><div><p className="eyebrow">Your deck</p><h2 id="deck-list-title">{deck.length} cards</h2></div><div><span>{deck.length}% complete</span><button className="manual-card-button" ref={cardSearchButton} type="button" onClick={() => openModal('search')}>+ Add card by name</button></div></div>
          <div className="meter"><span style={{ width: `${deck.length}%` }} /></div>
          <div className={`deck-list ${sideboard.length ? 'has-sideboard' : ''}`}>{groupedDeckColumns.map((column, columnIndex) => <div className="deck-column" key={`deck-column-${columnIndex}`}>{column.map(({ section, cards, count }) => <section className="deck-group" key={section}><h3>{section}<span>{count}</span></h3><ol>{cards.map(({ card, index }) => {
            const curveValue = curveBucket(card)
            const highlighted = highlightedManaValue === null || highlightedManaValue === curveValue
            return <li className={highlighted ? '' : 'curve-dimmed'} key={`${card.name}-${index}`} tabIndex={0} onMouseEnter={(event) => positionDeckPreview(event.currentTarget, event.clientX)} onFocus={(event) => positionDeckPreview(event.currentTarget)}>{highlightedManaValue !== null && highlighted && <span className="sr-only">Matches active mana-value filter. </span>}<button type="button" className={`deck-card-name ${card.finish === 'foil' ? 'foil-card-name' : card.finish === 'etched' ? 'etched-card-name' : ''}`} onClick={() => openDeckCard(card, { board: 'deck', index })}>{(card.printing ?? 0) > 0 && <span className="alternate-printing" title="Alternate printing selected" aria-label="Alternate printing selected" />}{card.name}{card.finish && card.finish !== 'nonfoil' && <small className="finish-label">{card.finish}</small>}</button><span className="deck-card-meta"><span className="deck-mana">{card.typeLine.includes('Land') && card.producedMana.length ? <ManaSymbols symbols={card.producedMana} /> : <OracleText text={card.manaCost} />}</span>{index >= commanderNames(commander).length && <span className="deck-remove-wrap"><button className={`deck-remove ${pendingRemoval === index ? 'confirm' : ''}`} type="button" onClick={() => pendingRemoval === index ? removeDeckCard(index) : setPendingRemoval(index)} aria-label={pendingRemoval === index ? `Confirm removal of ${card.name}` : `Remove ${card.name}`}>{pendingRemoval === index ? '✓' : '×'}</button>{pendingRemoval === index && <span className="remove-confirm" role="tooltip">Click again to confirm removal</span>}</span>}</span>{card.image && <span className="deck-card-popover"><FinishedCardImage image={card.image} alt={`${card.name} card`} finish={card.finish} effectsEnabled={cardEffects} className="deck-card-preview" /><ArtLoading active={loadingArt === card.name} /><PrintingButton count={card.printings?.length ?? 0} index={card.printing ?? 0} loading={Boolean(loadingArt)} name={card.name} onClick={() => void cycleDeckPrinting(index)} /></span>}</li>
          })}{section === 'Lands' && <>{groupedBasics.map(({ name, cards: basics }) => { const { card, index } = basics[0]; return <li className="basic-land-row" key={name}><button type="button" className="deck-card-name" onClick={() => openDeckCard(card, { board: 'deck', index })}><b className="card-quantity">{basics.length}x</b> {card.name}</button><span className="deck-card-meta"><span className="deck-mana"><ManaSymbols symbols={card.producedMana} /></span><button className="deck-add" type="button" disabled={deck.length >= 100} onClick={() => void addOneBasic(card.name)} aria-label={`Add another ${card.name}`}>+</button><button className="deck-remove" type="button" onClick={() => removeDeckCard(index)} aria-label={`Remove one ${card.name}`}>×</button></span></li> })}{legalBasicNames.filter((name) => !groupedBasics.some((group) => group.name === name)).map((name) => <li className="basic-placeholder" key={name}><button type="button" disabled={deck.length >= 100} onClick={() => void addOneBasic(name)}><span>Add {name}</span><b>+</b></button></li>)}</>}</ol></section>)}</div>)}{sideboard.length > 0 && <section className="deck-column deck-group sideboard-column"><h3>Sideboard<span>{sideboard.length}</span></h3><ol>{sideboard.map((card, index) => <li key={`${card.name}-${index}`} tabIndex={0} onMouseEnter={(event) => positionDeckPreview(event.currentTarget, event.clientX)} onFocus={(event) => positionDeckPreview(event.currentTarget)}><button type="button" className={`deck-card-name ${card.finish === 'foil' ? 'foil-card-name' : card.finish === 'etched' ? 'etched-card-name' : ''}`} onClick={() => openDeckCard(card, { board: 'sideboard', index })}>{card.name}{card.finish && card.finish !== 'nonfoil' && <small className="finish-label">{card.finish}</small>}</button><span className="deck-card-meta"><button className="sideboard-move" type="button" disabled={deck.length >= 100} onClick={() => moveSideboardCard(index)}>Move to deck</button><button className="deck-remove" type="button" onClick={() => removeSideboardCard(index)} aria-label={`Remove ${card.name} from sideboard`}>×</button></span>{card.image && <span className="deck-card-popover"><FinishedCardImage image={card.image} alt={`${card.name} card`} finish={card.finish} effectsEnabled={cardEffects} className="deck-card-preview" /></span>}</li>)}</ol></section>}</div>
        </section>
        <svg className="filter-definitions" aria-hidden="true"><filter id="etched-edges" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB"><feColorMatrix type="saturate" values="0" result="grey" /><feConvolveMatrix in="grey" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="edges" /><feColorMatrix in="edges" values="0 0 0 0 1 0 0 0 0 .88 0 0 0 0 .55 1 1 1 0 -.12" /></filter></svg>
      </div>
    </main>
  )
}

export default App
