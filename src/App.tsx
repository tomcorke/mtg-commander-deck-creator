import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { advanceRecommendationQueue, balanceThemeCoverage, batchRecommendations, buildEdhrecRecommendations, cardText, commanderThemes, findSynergyPair, formatUsdPrice, freshRecommendationCycle, manualCardError, orderedPrintings, parseEdhrecEntries, preconFastMana, preferredPrintingIndex, recommendationScore, recommendedScoreThreshold, sharedThemes, supportedThemes, tagsFor, themeMatchesSearch, toRecommendationCard, type DeferredCard, type EdhrecThemeCount, type PowerTarget, type ScryfallCard } from './recommendations'
import { analyseDeck, basicLandNames, basicLandPlan, cardTypes, curveBucket, deckGuidance, deckRoleBoosts, deckSection, defaultDeckTargets, isBasicLandName, rolesForCard, targetKeys, targetLabels, type DeckTargets } from './deck-analysis'
import { clearDeckState, deleteSavedDeck, deckDelta, duplicateDeckName, loadDeckState, loadSavedDecks, saveDeckState, saveSavedDeck, suggestedDeckName, type PersistedDeckState, type SavedDeck } from './deck-state'
import { fetchScryfallCollection, matchImportedCard, missingCardNames, parseDeckList, type ImportedDeck } from './deck-import'
import './App.css'

type CardFinish = 'nonfoil' | 'foil' | 'etched'
type Printing = { image: string; art?: string; set: string; collectorNumber: string; price?: string; finish?: CardFinish }
type Card = { name: string; layout: string; typeLine: string; manaCost: string; manaValue: number; detail: string; producedMana: string[]; faces: { typeLine: string; manaCost: string }[]; reason: string; image: string; set: string; collectorNumber: string; printsUri: string; price?: string; finish?: CardFinish; tags: string[]; printings?: Printing[]; printing?: number; printingManuallySelected?: boolean }
type DeckCard = { name: string; layout: string; typeLine: string; manaCost: string; manaValue: number; detail: string; producedMana: string[]; faces: { typeLine: string; manaCost: string }[]; set: string; collectorNumber: string; image: string; tags: string[]; printings?: Printing[]; printing?: number; printingManuallySelected?: boolean; finish?: CardFinish }
type CommanderDetails = { images: string[]; art: string[]; colours: string[]; printings: Printing[][]; selections: number[] }
type CommanderCard = ScryfallCard & { related_uris?: { edhrec?: string }; image_uris?: { normal: string; art_crop?: string }; card_faces?: { mana_cost?: string; oracle_text?: string; image_uris?: { normal: string; art_crop?: string } }[] }
type ExportFormat = 'moxfield' | 'plain' | 'csv'

const savedDeckState = loadDeckState()

const cardTags = (card: ScryfallCard, category = '') => tagsFor(`${card.type_line}\n${cardText(card)}\n${category}`, card.type_line)
const toCard = (card: ScryfallCard, reason: string, category = ''): Card => toRecommendationCard(card, reason, category)
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
const deckSections = ['Creatures', 'Enchantments', 'Artifacts', 'Sorceries', 'Instants', 'Other', 'Lands']
const defaultCommanders = Object.values(themeCommanders).flat()
const selectableThemes = Object.keys(themeCommanders).filter((name) => supportedThemes.includes(name))
const randomItems = <T,>(items: T[], count: number) => [...items].sort(() => Math.random() - 0.5).slice(0, count)
const randomThree = (items: string[]) => randomItems(items, 3)
const basicNames = [...Object.values(basicLandNames), 'Wastes']
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

function PriceBadge({ price }: { price?: string }) {
  return price ? <span className="card-price" title="Scryfall market price">{formatUsdPrice(price)}</span> : null
}

const defaultFinish = (finishes?: CardFinish[]) => finishes?.includes('nonfoil') ? 'nonfoil' : finishes?.[0]
const commanderPrintingOptions = (cards: CommanderCard[]) => cards.flatMap((printing) => {
  const image = printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal
  return image ? (printing.finishes ?? ['nonfoil']).map((finish) => ({ image, art: printing.image_uris?.art_crop ?? printing.card_faces?.[0]?.image_uris?.art_crop, set: printing.set, collectorNumber: printing.collector_number, finish })) : []
}).filter((printing, index, all) => all.findIndex((item) => item.image === printing.image && item.finish === printing.finish) === index)

function FinishedCardImage({ image, alt, finish, className = '' }: { image: string; alt: string; finish?: CardFinish; className?: string }) {
  const foilHue = [...image].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0) % 360
  return <span className={`finished-card tilting-card ${finish === 'foil' ? 'holo-card' : finish === 'etched' ? 'etched-card' : ''}`} style={{ '--foil-hue': `${foilHue}deg` } as CSSProperties} onPointerMove={moveFoil} onPointerLeave={resetFoil} onPointerCancel={resetFoil}><img className={className} src={image} alt={alt} />{finish && finish !== 'nonfoil' && <img className={`finish-edges ${finish}-edges ${className}`} src={image} alt="" aria-hidden="true" />}</span>
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
  return <>{text.split(/(\{[^}]+\})/g).map((part, index) => {
    const symbol = part.match(/^\{(.+)\}$/)?.[1]
    if (!symbol) return part
    const file = symbol.replace('/', '')
    const label = symbolName(symbol)
    return <img className="mana-symbol" src={`https://svgs.scryfall.io/card-symbols/${file}.svg`} alt={label} title={label} key={`${part}-${index}`} />
  })}</>
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
  const [showExport, setShowExport] = useState(false)
  const [showBasicLands, setShowBasicLands] = useState(false)
  const [basicLandState, setBasicLandState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showCardSearch, setShowCardSearch] = useState(false)
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
  const [exportFormat, setExportFormat] = useStoredOption<ExportFormat>('exportFormat', () => 'moxfield')
  const [copied, setCopied] = useState(false)
  const [darkMode, setDarkMode] = useStoredOption('darkMode', () => localStorage.getItem('theme') !== 'light')
  const [commanderStyling, setCommanderStyling] = useStoredOption('commanderStyling', () => true)
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
  const [showSavedDecks, setShowSavedDecks] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importSource, setImportSource] = useState('')
  const [importState, setImportState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    if (!commander || recommendationState !== 'idle' || !commanderDetails || !deck.length) return
    saveDeckState({ savedDeckId: activeSavedDeckId, commander, commanderDetails, theme, queue, limitedRecommendations, decisions, ignoredCards, liked, activeSubThemes, dismissedSubThemes, preferenceScores, commanderSubThemes, deferredCards, batchNumber, deck, sideboard, preferredPrintSet, deckTargets } satisfies PersistedDeckState)
  }, [activeSavedDeckId, commander, commanderDetails, theme, queue, recommendationState, limitedRecommendations, decisions, ignoredCards, liked, activeSubThemes, dismissedSubThemes, preferenceScores, commanderSubThemes, deferredCards, batchNumber, deck, sideboard, preferredPrintSet, deckTargets])

  useEffect(() => {
    if (!commanderDetails || commanderDetails.printings.every((printings) => printings.every((printing) => printing.finish))) return
    void Promise.all(commanderNames(commander).map(async (name) => {
      const cardResponse = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`)
      const card = await cardResponse.json() as CommanderCard
      const response = await fetch(card.prints_search_uri)
      return commanderPrintingOptions((await response.json() as { data: CommanderCard[] }).data)
    })).then((printings) => {
      setCommanderDetails((current) => current && ({ ...current, printings, selections: printings.map((options, index) => Math.max(0, options.findIndex((printing) => printing.image === current.images[index] && printing.finish === 'nonfoil'))) }))
      setDeck((current) => current.map((card, index) => index < printings.length ? { ...card, printings: printings[index], printing: Math.max(0, printings[index].findIndex((printing) => printing.image === card.image && printing.finish === 'nonfoil')), finish: 'nonfoil' } : card))
    }).catch(() => undefined)
  }, [commander, commanderDetails])

  useEffect(() => {
    void fetch('https://api.scryfall.com/cards/collection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers: basicNames.map((name) => ({ name })) }) })
      .then((response) => response.ok ? response.json() as Promise<{ data: ScryfallCard[] }> : Promise.reject())
      .then(({ data }) => data.forEach((card) => basicCardCache.set(card.name, card)))
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

  async function loadPrintings(cards: Card[], preferredSet = '') {
    const analysis = analyseDeck(deck)
    const pickedTags = new Set(deck.slice(commanderNames(commander).length).flatMap((card) => card.tags))
    const neededRoles = new Set(targetKeys.filter((key) => analysis.counts[key] < deckTargets[key]))
    const score = (card: Card) => recommendationScore(card, { theme, activeSubThemes, pickedTags, preferenceScores, neededRoles, cardRoles: rolesForCard(card) })
    const specialCards = new Set([0, 4].flatMap((start) => {
      const recommended = cards.slice(start, start + 4).reduce<Card | null>((best, card) => !best || score(card) > score(best) ? card : best, null)
      return recommended && score(recommended) >= recommendedScoreThreshold && Math.random() < .5 ? [recommended] : []
    }))
    for (const offered of cards.slice(0, 8)) {
      if (offered.printings?.length) continue
      await new Promise((resolve) => setTimeout(resolve, 100))
      const response = await fetch(offered.printsUri)
      if (!response.ok) continue
      const result = await response.json() as { data: ScryfallCard[] }
      const printings = orderedPrintings(offered, result.data.flatMap((printing) => {
        const image = printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal
        return image ? (printing.finishes ?? ['nonfoil']).map((finish) => ({ image, set: printing.set, collectorNumber: printing.collector_number, price: (finish === 'etched' ? printing.prices?.usd_etched : finish === 'foil' ? printing.prices?.usd_foil : printing.prices?.usd) ?? undefined, finish })) : []
      }))
      const specialOptions = printings.map((printing, index) => printing.finish === 'foil' || printing.finish === 'etched' ? index : -1).filter((index) => index >= 0)
      const special = specialCards.has(offered) && specialOptions.length ? specialOptions[Math.floor(Math.random() * specialOptions.length)] : -1
      const selectedIndex = special >= 0 ? special : preferredPrintingIndex(printings, preferredSet)
      const selected = printings[selectedIndex]
      setQueue((current) => current.map((item) => item.name === offered.name ? { ...item, printings, image: selected.image, set: selected.set, collectorNumber: selected.collectorNumber, price: selected.price, finish: selected.finish, printing: selectedIndex } : item))
    }
  }

  async function start(name: string, preserveDeck = false) {
    const chosen = name.trim()
    if (!chosen) return
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
    }
    setCommanderDetails(null)
    setQueue([])
    setLimitedRecommendations(false)
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
        const primary = { image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '', art: card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop, set: card.set, collectorNumber: card.collector_number, finish: defaultFinish(card.finishes) }
        const response = await fetch(card.prints_search_uri)
        if (!response.ok) return [primary]
        const result = await response.json() as { data: CommanderCard[] }
        const alternatives = commanderPrintingOptions(result.data)
        return [primary, ...alternatives.filter((printing) => printing.image !== primary.image || printing.finish !== primary.finish)]
      }))
      if (images.length) setCommanderDetails({ images, art, colours: identityColours, printings: commanderPrintings, selections: commanders.map(() => 0) })
      if (!preserveDeck) setDeck(commanders.map((card, index) => ({ name: card.name, layout: card.layout ?? 'normal', typeLine: card.type_line, manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '', manaValue: card.cmc ?? 0, detail: cardText(card), producedMana: card.produced_mana ?? [], faces: card.card_faces?.map((face) => ({ typeLine: face.type_line ?? '', manaCost: face.mana_cost ?? '' })) ?? [], set: card.set, collectorNumber: card.collector_number, image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '', tags: cardTags(card), printings: commanderPrintings[index], printing: 0, finish: commanderPrintings[index][0].finish })))

      setRecommendationLoadingStep('recommendations')
      let offeredCards: Card[]
      try {
        if (commanders.length !== 1) throw new Error('Partner pair has no single EDHREC page')
        offeredCards = await edhrecRecommendations(edhrecSlug(commanders[0].related_uris?.edhrec, commanders[0].name))
        if (offeredCards.length < 4) throw new Error('Too few EDHREC cards')
      } catch {
        offeredCards = await fallbackRecommendations(identityColours)
        setLimitedRecommendations(true)
      }
      if (preserveDeck) offeredCards = offeredCards.filter((card) => !ignoredCards.includes(card.name) && ![...deck, ...sideboard].some((deckCard) => deckCard.name === card.name))
      setQueue(offeredCards)
      setRecommendationState('idle')
      void loadPrintings(offeredCards.slice(0, 8), preferredPrintSet)
      return true
    } catch {
      setRecommendationState('error')
      return false
    }
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
      const added = { name: card.name, layout: card.layout, typeLine: card.typeLine, manaCost: card.manaCost, manaValue: card.manaValue, detail: card.detail, producedMana: card.producedMana, faces: card.faces, set: card.set, collectorNumber: card.collectorNumber, image: card.image, tags: card.tags, printings: card.printings, printing: card.printing ?? 0, printingManuallySelected: card.printingManuallySelected, finish: card.finish }
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
      setDeck((current) => current.map((card, index) => index === commanderIndex ? { ...card, image: selected.image, set: selected.set, collectorNumber: selected.collectorNumber, printing: selection, finish: selected.finish } : card))
      setQueue((current) => current.map((card) => {
        if (!card.printings?.length) return card
        const matching = preferredPrintingIndex(card.printings, selected.set, card.printing, card.printingManuallySelected)
        const printing = card.printings[matching]
        return { ...card, image: printing.image, set: printing.set, collectorNumber: printing.collectorNumber, printing: matching, finish: printing.finish }
      }))
    })
  }

  async function cyclePrinting(card: Card) {
    if (!card.printings || card.printings.length < 2 || loadingArt) return
    const index = ((card.printing ?? 0) + 1) % card.printings.length
    const selected = card.printings[index]
    await changeArt(card.name, [selected.image], () => {
      setQueue((current) => current.map((item) => item.name === card.name ? { ...item, printing: index, image: selected.image, set: selected.set, collectorNumber: selected.collectorNumber, price: selected.price, printingManuallySelected: true, finish: selected.finish } : item))
      if (decisions[card.name] === 'add') {
        const update = (item: DeckCard) => item.name === card.name ? { ...item, set: selected.set, collectorNumber: selected.collectorNumber, image: selected.image, printing: index, printingManuallySelected: true, finish: selected.finish } : item
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
    await changeArt(card.name, [selected.image], () => setDeck((current) => current.map((item, index) => index === cardIndex ? { ...item, image: selected.image, set: selected.set, collectorNumber: selected.collectorNumber, printing, printingManuallySelected: true, finish: selected.finish } : item)))
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

  const toDeckCard = (card: ScryfallCard): DeckCard => ({ name: card.name, layout: card.layout ?? 'normal', typeLine: card.type_line, manaCost: card.mana_cost ?? '', manaValue: card.cmc ?? 0, detail: cardText(card), producedMana: card.produced_mana ?? [], faces: card.card_faces?.map((face) => ({ typeLine: face.type_line ?? '', manaCost: face.mana_cost ?? '' })) ?? [], set: card.set, collectorNumber: card.collector_number, image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '', tags: cardTags(card), printing: 0 })

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
      setShowBasicLands(false)
    } catch {
      setBasicLandState('error')
    }
  }

  function closeCardSearch() {
    setShowCardSearch(false)
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

  function positionDeckPreview(event: MouseEvent<HTMLLIElement>) {
    const row = event.currentTarget.getBoundingClientRect()
    const showRight = event.clientX < window.innerWidth * .6
    event.currentTarget.style.setProperty('--preview-left', showRight ? `${row.right + 12}px` : 'auto')
    event.currentTarget.style.setProperty('--preview-right', showRight ? 'auto' : `${window.innerWidth - row.left + 12}px`)
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
    if (!commander || !commanderDetails || !deck.length) return null
    return { savedDeckId: activeSavedDeckId, commander, commanderDetails, theme, queue, limitedRecommendations, decisions, ignoredCards, liked, activeSubThemes, dismissedSubThemes, preferenceScores, commanderSubThemes, deferredCards, batchNumber, deck, sideboard, preferredPrintSet, deckTargets }
  }

  function openSavedDecks() {
    if (commander && !activeSavedDeckId && !deckName) setDeckName(suggestedDeckName(commander, theme, activeSubThemes))
    setShowSavedDecks(true)
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
    setShowSavedDecks(false)
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
      setShowImport(false)
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
  }

  const importModal = showImport && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && importState !== 'loading') setShowImport(false) }}>
    <section className="export-modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="export-heading"><div><p className="eyebrow">Bring an existing deck</p><h2 id="import-title">Import deck</h2></div><button className="modal-close" disabled={importState === 'loading'} onClick={() => setShowImport(false)} aria-label="Close import">×</button></div>
      <p className="import-help">Paste an exported deck list. Put commander cards below a <b>COMMANDER:</b> heading. Set and collector number syntax is preserved.</p>
      <p className="import-note">Moxfield and Archidekt URLs are not supported because this is a client-only app and those sites block browser access. Export the deck as text, then paste it here.</p>
      <textarea value={importSource} onChange={(event) => { setImportSource(event.target.value); setImportState('idle'); setImportError('') }} placeholder={'COMMANDER:\n1 Commander Name (SET) 123\n\nMAINBOARD:\n1 Card Name (SET) 456'} aria-label="Exported deck list" />
      {importError && <p className="form-error" role="alert">{importError}</p>}
      <div className="export-actions"><button onClick={() => setShowImport(false)} disabled={importState === 'loading'}>Cancel</button><button className="primary" disabled={!importSource.trim() || importState === 'loading'} onClick={() => void importDeck()}>{importState === 'loading' ? 'Importing…' : 'Import deck'}</button></div>
    </section>
  </div>

  const deckNameDuplicate = duplicateDeckName(savedDecks, deckName, activeSavedDeckId)
  const activeSavedDeck = savedDecks.find(({ id }) => id === activeSavedDeckId)
  const activeDeckDelta = activeSavedDeck ? deckDelta([...activeSavedDeck.state.deck, ...activeSavedDeck.state.sideboard], [...deck, ...sideboard]) : null
  const savedDecksModal = showSavedDecks && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSavedDecks(false) }}>
    <section className="export-modal saved-decks-modal" role="dialog" aria-modal="true" aria-labelledby="saved-decks-title">
      <div className="export-heading"><div><p className="eyebrow">Local decks</p><h2 id="saved-decks-title">Saved decks</h2></div><button className="modal-close" onClick={() => setShowSavedDecks(false)} aria-label="Close saved decks">×</button></div>
      {commander && <><form className="save-deck-form" onSubmit={(event) => { event.preventDefault(); storeDeck() }}><label><span className="sr-only">Deck name</span><input value={deckName} onChange={(event) => setDeckName(event.target.value)} aria-label="Deck name" aria-invalid={deckNameDuplicate} aria-describedby={deckNameDuplicate ? 'deck-name-warning' : undefined} /><button type="button" className="clear-deck-name" onClick={() => setDeckName('')} aria-label="Clear deck name">×</button>{deckNameDuplicate && <small id="deck-name-warning" className="deck-name-warning">Name already used</small>}</label><button className="primary" disabled={!deckName.trim() || deckNameDuplicate}>{activeSavedDeck ? 'Overwrite save' : 'Save deck'}</button></form>{activeSavedDeck && <p className="overwrite-notice">This will overwrite <b>{activeSavedDeck.name}</b> with <span className="delta-added">+{activeDeckDelta?.added} added</span> and <span className="delta-removed">−{activeDeckDelta?.removed} removed</span>.</p>}</>}
      <div className="saved-deck-list">{savedDecks.map((saved) => <article key={saved.id}><div className="saved-deck-details"><b>{saved.name}</b><span>{saved.state.commander} · {saved.state.deck.length}/100 cards</span><small>Updated {new Date(saved.updatedAt).toLocaleString()}</small></div><button className="saved-deck-load" onClick={() => loadSavedDeck(saved)}>Load</button><span className="saved-deck-delete-wrap"><button className={`saved-deck-delete ${pendingSavedDeckRemoval === saved.id ? 'confirm' : ''}`} onClick={() => pendingSavedDeckRemoval === saved.id ? removeSavedDeck(saved) : setPendingSavedDeckRemoval(saved.id)} aria-label={pendingSavedDeckRemoval === saved.id ? `Confirm deletion of ${saved.name}` : `Delete ${saved.name}`}>{pendingSavedDeckRemoval === saved.id ? 'Confirm' : 'Delete'}</button>{pendingSavedDeckRemoval === saved.id && <span className="saved-delete-confirm" role="tooltip">Click again to delete</span>}</span></article>)}</div>
      {!savedDecks.length && <p className="saved-decks-empty">No saved decks yet.</p>}
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
    const roleBoosts = deckRoleBoosts(deck.length, analysis.counts, deckTargets)
    roleBoosts.lands = 0
    const next = advanceRecommendationQueue({ queue, deferredCards, batchNumber, decisions, liked, preferenceScores, activeSubThemes, extraSubTheme, theme, includeCreature, roleBoosts, cardRoles: rolesForCard })
    setPreferenceScores(next.preferenceScores)
    setDeferredCards(next.deferredCards)
    setBatchNumber(next.batchNumber)
    setQueue(next.queue)
    setDecisions({})
    setLiked((current) => current.filter((name) => !batch.some((card) => card.name === name)))
    setBatchAnnouncement(next.queue.length ? `Recommendation batch ${next.batchNumber} loaded: ${next.queue.slice(0, 4).map((card) => card.name).join(', ')}.` : 'No recommendations currently eligible. Deferred cards will return after their waiting period.')
    void loadPrintings(next.queue.slice(0, 8), preferredPrintSet)
  }

  if (!commander) return (
    <main className={darkMode ? 'dark' : ''}>
      <header><a className="brand" href="/">Commander Deck Creator <small>v{__APP_VERSION__}</small></a><div className="header-actions"><label className="theme-option"><input type="checkbox" checked={commanderStyling} onChange={(event) => setCommanderStyling(event.target.checked)} /> Commander art and colours</label><button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>{darkMode ? '◐ Dark' : '☀ Light'}</button><button className="export" type="button" onClick={() => setShowImport(true)}>Import deck</button><button className="export" type="button" onClick={openSavedDecks}>Saved decks ({savedDecks.length})</button></div></header>
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
  const rawBatch = queue.slice(0, 4)
  const synergyPair = findSynergyPair(rawBatch.filter((card) => card.reason !== 'Land or mana'))
  const pairCards = synergyPair?.cards ?? []
  const visibleBatch = pairCards.length ? [...pairCards, ...rawBatch.filter((card) => !pairCards.includes(card))] : rawBatch
  const inferredThemeOptions = [...new Set(deck.slice(commanderNames(commander).length).flatMap((card) => card.tags))].filter((name) => supportedThemes.includes(name))
  const subThemeOptions = [...new Set([...commanderSubThemes, ...inferredThemeOptions, ...supportedThemes])]
  const filteredSubThemes = subThemeOptions.filter((name) => themeMatchesSearch(name, subThemeSearch) && name !== theme && !activeSubThemes.includes(name))
  const analysis = analyseDeck(deck)
  const guidance = deckGuidance(deck.length, analysis.counts, deckTargets)
  const calculatedLandTarget = deckTargets.lands
  const representativeSpellCount = deck.slice(commanderNames(commander).length).filter((card) => !card.typeLine.includes('Land')).length
  const basicLands = representativeSpellCount >= 5 ? basicLandPlan(commanderDetails?.colours ?? [], analysis.required, analysis.counts.lands, calculatedLandTarget, deck.length) : []
  const indexedDeck = deck.map((card, index) => ({ card, index }))
  const commanders = indexedDeck.slice(0, commanderNames(commander).length)
  const groupedBasics = [...new Set(indexedDeck.filter(({ card }) => isBasicLandName(card.name)).map(({ card }) => card.name))].map((name) => ({ name, cards: indexedDeck.filter(({ card }) => card.name === name) }))
  const groupedDeck = deckSections.map((section) => ({ section, cards: indexedDeck.slice(commanderNames(commander).length).filter(({ card }) => deckSection(card.typeLine) === section && !isBasicLandName(card.name)) })).filter(({ section, cards }) => cards.length || (section === 'Lands' && groupedBasics.length))
  const legalBasicNames = commanderDetails?.colours.length ? commanderDetails.colours.map((colour) => basicLandNames[colour as keyof typeof basicLandNames]) : ['Wastes']
  const maxCurveCount = Math.max(1, ...analysis.curve.map((point) => point.permanents + point.nonPermanents))
  const displayedTypeCounts = [['Land', analysis.counts.lands], ...cardTypes.map((type) => [type, analysis.typeCounts[type]] as const), ['Other', deck.filter((card) => deckSection(card.typeLine) === 'Other').length]] as const
  const maxTypeCount = Math.max(1, ...displayedTypeCounts.map(([, count]) => count))
  const manaColours = (['W', 'U', 'B', 'R', 'G'] as const)
  const pickedTags = new Set(deck.slice(commanderNames(commander).length).flatMap((card) => card.tags))
  const cardReason = (card: Card) => {
    const subThemes = activeSubThemes.filter((tag) => card.tags.includes(tag))
    if (subThemes.length) return `${subThemes.join(' + ')} sub-theme`
    if (theme && card.tags.includes(theme)) return `${theme} theme`
    const missingRole = rolesForCard(card).find((role) => role !== 'lands' && analysis.counts[role] < deckTargets[role])
    if (missingRole) return targetLabels[missingRole]
    const preference = card.tags.filter((tag) => pickedTags.has(tag) && (preferenceScores[tag] ?? 0) > 0).sort((a, b) => (preferenceScores[b] ?? 0) - (preferenceScores[a] ?? 0))[0]
    return preference ? `Matches your ${preference} picks` : card.reason
  }
  const neededRoles = new Set(targetKeys.filter((key) => analysis.counts[key] < deckTargets[key]))
  const scoredBatch = visibleBatch.map((card) => ({ card, score: recommendationScore(card, { theme, activeSubThemes, pickedTags, preferenceScores, neededRoles, cardRoles: rolesForCard(card) }) }))
  const recommendedCard = scoredBatch.reduce((best, item) => item.score > best.score ? item : best, { card: null as Card | null, score: recommendedScoreThreshold - 1 })

  return (
    <main className={`${darkMode ? 'dark ' : ''}${commanderStyling ? 'commander-themed' : ''}`} style={{ '--commander-accent': primaryTheme[0], '--commander-highlight': secondaryTheme[1] } as CSSProperties}>
      <svg className="filter-definitions" aria-hidden="true"><filter id="etched-edges" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB"><feColorMatrix type="saturate" values="0" result="grey" /><feConvolveMatrix in="grey" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="edges" /><feColorMatrix in="edges" values="0 0 0 0 1 0 0 0 0 .88 0 0 0 0 .55 1 1 1 0 -.12" /></filter></svg>
      {commanderStyling && commanderDetails?.art.length ? <div className="commander-backdrop" aria-hidden="true">{commanderDetails.art.map((image) => <span style={{ backgroundImage: `url(${image})` }} key={image} />)}</div> : null}
      <header>
        <button className="brand reset" onClick={startOver}>Commander Deck Creator <small>v{__APP_VERSION__}</small></button>
        <div className="deck-status">{activeSavedDeck && <div className="saved-status"><b>{activeSavedDeck.name}</b><small>Saved {new Date(activeSavedDeck.updatedAt).toLocaleString()} <span className="delta-added">+{activeDeckDelta?.added}</span> <span className="delta-removed">−{activeDeckDelta?.removed}</span></small></div>}<div className="progress"><span style={{ background: `linear-gradient(90deg, var(--commander-accent, #7650ae) ${deck.length}%, #dedcea ${deck.length}%)` }} />{deck.length} / 100 cards</div></div>
        <div className="header-actions"><label className="theme-option"><input type="checkbox" checked={commanderStyling} onChange={(event) => setCommanderStyling(event.target.checked)} /> Commander art and colours</label><button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>{darkMode ? '◐ Dark' : '☀ Light'}</button><button className="start-over" type="button" onClick={startOver}>Start over</button><button className="export" type="button" onClick={() => setShowImport(true)}>Import</button><button className="export" type="button" onClick={openSavedDecks}>Save / load</button><button className="export" type="button" onClick={() => setShowExport(true)}>Export deck</button></div>
      </header>
      {savedDecksModal}
      {importModal}
      <section className="intro commander-header">
        {commanderDetails ? <figure className={`commander-card ${commanderDetails.images.length > 1 ? 'pair' : ''}`} tabIndex={0} aria-label={`View ${commander} card${commanderDetails.images.length > 1 ? 's' : ''}`}>
          {commanderDetails.images.map((image, index) => <img src={image} alt={`${commanderNames(commander)[index]} card`} key={commanderNames(commander)[index]} />)}
          {commanderDetails.printings.some((printings) => printings.length > 1) && <span className="printing-indicator" aria-hidden="true">↻ Art</span>}
          <span className="card-zoom">{commanderDetails.images.map((image, index) => <span className="commander-printing" key={commanderNames(commander)[index]}><FinishedCardImage image={image} alt={`${commanderNames(commander)[index]} full card`} finish={commanderDetails.printings[index][commanderDetails.selections[index]]?.finish} /><ArtLoading active={loadingArt === commanderNames(commander)[index]} /><PrintingButton count={commanderDetails.printings[index].length} index={commanderDetails.selections[index]} loading={Boolean(loadingArt)} name={commanderNames(commander)[index]} onClick={() => void cycleCommanderPrinting(index)} /></span>)}</span>
        </figure> : <span className="commander-card commander-placeholder" aria-hidden="true" />}
        <div className="commander-summary"><p className="eyebrow">Building around</p><h1>{commander}</h1>
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
            <label>Power target <select value={powerTarget} onChange={(event) => choosePowerTarget(event.target.value as PowerTarget)}><option value="precon">Core (Bracket 2)</option><option value="upgraded">Upgraded (Bracket 3)</option><option value="high">High power / Optimized (Bracket 4)</option></select></label>
            <label><input type="checkbox" checked={includeCreature} onChange={(event) => { setIncludeCreature(event.target.checked); setRecommendationOptionsChanged(true) }} /> Include a creature when possible</label>
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
          {!selectedManualCard && cardSearchResults.length > 0 && <div className="card-search-results" aria-label="Card search results">{cardSearchResults.map((card) => <button type="button" key={card.name} onClick={() => void selectManualCard(card)}><span><b>{card.name}</b><small>{card.type_line}</small></span><span className="search-result-mana"><OracleText text={card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? ''} /></span>{(card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal) && <span className="search-card-popover"><FinishedCardImage image={card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? ''} alt={`${card.name} card`} finish={defaultFinish(card.finishes)} /></span>}</button>)}</div>}
          {selectedManualCard && <div className="manual-card-preview">
            {scryfallImage(selectedManualCard) && <figure className="manual-card-image" tabIndex={0}><img src={scryfallImage(selectedManualCard)} alt={`${selectedManualCard.name} card`} /><span className="manual-card-zoom"><FinishedCardImage image={scryfallImage(selectedManualCard)} alt={`${selectedManualCard.name} enlarged card`} finish={defaultFinish(selectedManualCard.finishes)} /></span><ArtLoading active={loadingArt === selectedManualCard.name} /><PrintingButton count={manualPrintings.length} index={manualPrinting} loading={Boolean(loadingArt)} name={selectedManualCard.name} onClick={() => void cycleManualPrinting()} /></figure>}
            <div><p className="eyebrow">{selectedManualCard.set.toUpperCase()} · {selectedManualCard.collector_number}</p><h3>{selectedManualCard.name}</h3><p>{selectedManualCard.type_line}</p><p><OracleText text={cardText(selectedManualCard)} /></p>
              {manualCardError(selectedManualCard, [...deck, ...sideboard].map((card) => card.name), commanderDetails?.colours ?? []) && <p className="form-error" role="alert">{manualCardError(selectedManualCard, [...deck, ...sideboard].map((card) => card.name), commanderDetails?.colours ?? [])}</p>}
              <div className="export-actions"><button type="button" onClick={() => setSelectedManualCard(null)}>Back</button><button className="primary" type="button" disabled={Boolean(manualCardError(selectedManualCard, [...deck, ...sideboard].map((card) => card.name), commanderDetails?.colours ?? []))} onClick={addManualCard}>{deck.length >= 100 ? 'Add to sideboard' : 'Add to deck'}</button></div>
            </div>
          </div>}
        </section>
      </div>}
      {showBasicLands && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && basicLandState !== 'loading') setShowBasicLands(false) }}>
        <section className="export-modal basic-land-modal" role="dialog" aria-modal="true" aria-labelledby="basic-land-title">
          <div className="export-heading"><div><p className="eyebrow">Complete mana base</p><h2 id="basic-land-title">Add basic lands?</h2></div><button className="modal-close" disabled={basicLandState === 'loading'} onClick={() => setShowBasicLands(false)} aria-label="Close basic land review">×</button></div>
          <p>This fills {basicLands.reduce((sum, land) => sum + land.count, 0)} slots toward your {calculatedLandTarget}-land target. Existing cards stay unchanged.</p>
          <ul className="basic-land-plan">{basicLands.map((land) => <li key={land.name}><span>{land.name}</span><b>{land.count}</b></li>)}</ul>
          {basicLandState === 'error' && <p className="form-error" role="alert">Could not load basic lands. Try again.</p>}
          <div className="export-actions"><button onClick={() => setShowBasicLands(false)} disabled={basicLandState === 'loading'}>Cancel</button><button className="primary" disabled={basicLandState === 'loading'} onClick={() => void addBasicLands(basicLands)}>{basicLandState === 'loading' ? 'Adding…' : 'Add lands'}</button></div>
        </section>
      </div>}
      {showExport && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowExport(false) }}>
        <section className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
          <div className="export-heading"><div><p className="eyebrow">Export deck</p><h2 id="export-title">Copy your deck list</h2></div><button className="modal-close" onClick={() => setShowExport(false)} aria-label="Close export">×</button></div>
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
          {limitedRecommendations && recommendationState === 'idle' && <p className="limited-mode" role="status">Limited recommendations - EDHREC unavailable, using Scryfall popularity.</p>}
          <div className="recommendation-toolbar">
            <div className="subthemes" aria-label="Deck themes">
              {theme && <button type="button" onClick={() => setTheme('')} title="Remove declared theme">{theme} <span>×</span></button>}
              {activeSubThemes.map((name) => <button type="button" onClick={() => setActiveSubThemes((current) => current.filter((item) => item !== name))} title={`Remove ${name} sub-theme`} key={name}>{name} <span>×</span></button>)}
              {inferredSubThemes.map((inferredSubTheme) => <span className="suggested-subtheme" key={inferredSubTheme}><span>{inferredSubTheme}?</span><button type="button" onClick={() => chooseSubTheme(inferredSubTheme)} aria-label={`Accept ${inferredSubTheme} sub-theme`}>✓</button><button type="button" onClick={() => setDismissedSubThemes((current) => [...current.filter((item) => !item.startsWith(`${inferredSubTheme}:`) && item !== inferredSubTheme), `${inferredSubTheme}:${deckCards.filter((card) => card.tags.includes(inferredSubTheme)).length}`])} aria-label={`Dismiss ${inferredSubTheme} sub-theme`}>×</button></span>)}
              {activeSubThemes.length < 2 && <button className="add-subtheme" type="button" onClick={() => setShowSubThemePicker((current) => !current)}>+ Choose sub-theme</button>}
            </div>
            <div className="toolbar-actions">
              <button className="manual-card-button" type="button" onClick={() => setShowCardSearch(true)}>+ Add card by name</button>
              {(queue.length > 0 || deferredCards.length > 0) && recommendationState === 'idle' && <div className="batch-controls"><button className="primary" onClick={() => void nextBatch()}>Next recommendations →</button></div>}
            </div>
          </div>
          {showSubThemePicker && <div className="subtheme-picker">
            <input value={subThemeSearch} onChange={(event) => setSubThemeSearch(event.target.value)} placeholder="Search sub-themes…" aria-label="Search sub-themes" />
            <div>{filteredSubThemes.slice(0, 8).map((name) => <button type="button" key={name} onClick={() => chooseSubTheme(name)}>{name}</button>)}</div>
          </div>}
          {deck.length >= 100 && <div className="completion sideboard-completion"><p className="eyebrow">Main deck complete</p><h2>Build your sideboard</h2><p>Further picks go to sideboard. Move cards into main deck after removing a card.</p><button className="primary" type="button" onClick={() => setShowExport(true)}>Review and export deck</button></div>}
          {recommendationState === 'loading' ? <div className="recommendation-loading" role="status" aria-live="polite"><span className="loading-orb" aria-hidden="true" /><div><p className="eyebrow">Building your first batch</p><h3>{recommendationLoadingStep === 'commander' ? 'Checking commander details…' : 'Finding cards that work together…'}</h3><ol><li className={recommendationLoadingStep === 'commander' ? 'active' : 'done'}>Commander</li><li className={recommendationLoadingStep === 'recommendations' ? 'active' : ''}>Recommendations</li></ol></div></div> : recommendationState === 'error' ? <div className="empty"><h3>Suggestions unavailable</h3><p>Scryfall is busy. Try this commander again shortly.</p><button className="primary" onClick={() => void start(commander)}>Retry</button></div> : queue.length ? <div className="card-grid connector-glow juicy-fan" onMouseMove={fanCards} onMouseLeave={resetFan}>
            {scoredBatch.map(({ card }, index) => <article className={`card-offer ${decisions[card.name] ?? ''} ${pairCards.includes(card) ? `synergy-pair synergy-${pairCards.indexOf(card) + 1}` : ''}`} style={{ '--fan-position': index - (scoredBatch.length - 1) / 2, '--fan-drop': `${Math.abs(index - (scoredBatch.length - 1) / 2) * 7}px` } as CSSProperties} onClick={(event) => clickCardImage(event, card)} key={card.name}>
              {decisions[card.name] && <span className="decision-badge">{decisions[card.name] === 'add' ? sideboard.some((item) => item.name === card.name) ? 'Added to sideboard' : 'Added to deck' : decisions[card.name] === 'later' ? 'Later' : 'Ignored'}</span>}
              <div className="offer-heading"><h3 className="suggestion-type">{cardReason(card)}</h3>{recommendedCard.card === card && <span className="recommended-badge">Recommended</span>}</div>
              <div className={`actions ${deck.length >= 100 ? 'sideboard-actions' : ''}`}>
                <div><button className="primary" aria-pressed={decisions[card.name] === 'add'} onClick={() => decide(card, 'add')}>{deck.length >= 100 && decisions[card.name] !== 'add' ? 'Sideboard' : 'Add'}</button><span className="action-help-wrap"><button aria-pressed={decisions[card.name] === 'later'} onClick={() => decide(card, 'later')} aria-describedby={`later-${card.name}`}>Later</button><span className="action-help" id={`later-${card.name}`} role="tooltip">Skip for now. This card may return in a later batch.</span></span><span className="action-help-wrap"><button className="quiet" aria-pressed={decisions[card.name] === 'ignore'} onClick={() => decide(card, 'ignore')} aria-describedby={`ignore-${card.name}`}>Ignore</button><span className="action-help" id={`ignore-${card.name}`} role="tooltip">Remove this card from all future recommendations.</span></span></div>
                <span className="similar-wrap"><button className={`similar ${liked.includes(card.name) ? 'selected' : ''}`} type="button" disabled={decisions[card.name] === 'ignore'} aria-pressed={liked.includes(card.name)} onClick={() => setLiked((current) => current.includes(card.name) ? current.filter((name) => name !== card.name) : [...current, card.name])} aria-label={`Find more cards like ${card.name}`} aria-describedby={`similar-${card.name}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg></button><span className="similar-help" id={`similar-${card.name}`} role="tooltip">Prioritise similar cards in future recommendations.</span></span>
              </div>
              <div className="offered-image"><FinishedCardImage image={card.image} alt={`${card.name} card`} finish={card.finish} className="card-face-image" /><PriceBadge price={card.price} />{pairCards.includes(card) && synergyPair && <span className="synergy-info"><button type="button" aria-describedby={`synergy-${card.name}`}>ⓘ Synergy</button><span className="synergy-popover" id={`synergy-${card.name}`} role="tooltip"><strong>{card.name} + {pairCards.find((item) => item !== card)?.name}</strong><span>{synergyPair.explanation}.</span></span></span>}<ArtLoading active={loadingArt === card.name} /><PrintingButton count={card.printings?.length ?? 0} index={card.printing ?? 0} loading={Boolean(loadingArt)} name={card.name} onClick={() => void cyclePrinting(card)} /></div>
              <div className="card-copy"><h3>{card.name}</h3><p><OracleText text={card.detail} /></p></div>
            </article>)}
          </div> : <div className="empty"><h3>{deferredCards.length ? 'Suggestions resting' : 'No more suggestions'}</h3><p>{deferredCards.length ? 'Advance recommendations to keep their waiting period, then bring them back.' : 'Review your deck or choose another commander.'}</p></div>}
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
            {representativeSpellCount < 5 && analysis.counts.lands < calculatedLandTarget ? <p className="basic-land-wait">Add {5 - representativeSpellCount} more non-land {5 - representativeSpellCount === 1 ? 'card' : 'cards'} to calculate basic land colours.</p> : basicLands.length > 0 && <button className="basic-land-button" type="button" onClick={() => { setBasicLandState('idle'); setShowBasicLands(true) }}><span>Fill to land target</span><b>+{basicLands.reduce((sum, land) => sum + land.count, 0)} basics</b></button>}
            <div className="deck-targets">{targetKeys.map((key) => <label key={key}><span className="bar-label"><span>{targetLabels[key]}</span><span className="ratio-bar"><i style={{ width: `${Math.min(100, analysis.counts[key] / Math.max(1, deckTargets[key]) * 100)}%` }} /></span><b>{analysis.counts[key]} / <input type="number" min="0" max="99" value={deckTargets[key]} onChange={(event) => setDeckTargets((current) => ({ ...current, [key]: Math.max(0, Number(event.target.value)) }))} aria-label={`${targetLabels[key]} target`} /></b></span></label>)}</div>
            {displayedTypeCounts.some(([, count]) => count > 0) && <><h4>Card type distribution</h4><div className="type-counts">{displayedTypeCounts.filter(([, count]) => count > 0).map(([type, count]) => <span key={type}><span className="bar-label"><span>{type}</span><span className="ratio-bar"><i style={{ width: `${count / maxTypeCount * 100}%` }} /></span><b>{count}</b></span></span>)}</div></>}
            {guidance.length > 0 && <div className="deck-guidance" aria-live="polite">{guidance.map((item) => <p className={item.strong ? 'strong' : ''} key={item.key}>{item.text}</p>)}</div>}
          </section>
        </aside>
        <section className="deck-board" aria-labelledby="deck-list-title">
          <div className="deck-board-heading"><div><p className="eyebrow">Your deck</p><h2 id="deck-list-title">{deck.length} cards</h2></div><div><span>{deck.length}% complete</span><button className="manual-card-button" ref={cardSearchButton} type="button" onClick={() => setShowCardSearch(true)}>+ Add card by name</button></div></div>
          <div className="meter"><span style={{ width: `${deck.length}%` }} /></div>
          <ol className="deck-list">{[{ section: 'Commander', cards: commanders, count: commanders.length }, ...groupedDeck.map((group) => ({ ...group, count: group.cards.length + (group.section === 'Lands' ? groupedBasics.reduce((sum, basic) => sum + basic.cards.length, 0) : 0) }))].map(({ section, cards, count }) => <li className="deck-group" key={section}><h3>{section}<span>{count}</span></h3><ol>{cards.map(({ card, index }) => {
            const curveValue = curveBucket(card)
            const highlighted = highlightedManaValue === null || highlightedManaValue === curveValue
            return <li className={highlighted ? '' : 'curve-dimmed'} key={`${card.name}-${index}`} tabIndex={0} onMouseEnter={positionDeckPreview}>{highlightedManaValue !== null && highlighted && <span className="sr-only">Matches active mana-value filter. </span>}<span className={`deck-card-name ${card.finish === 'foil' ? 'foil-card-name' : card.finish === 'etched' ? 'etched-card-name' : ''}`}>{(card.printing ?? 0) > 0 && <span className="alternate-printing" title="Alternate printing selected" aria-label="Alternate printing selected" />}{card.name}{card.finish && card.finish !== 'nonfoil' && <small className="finish-label">{card.finish}</small>}</span><span className="deck-card-meta"><span className="deck-mana">{card.typeLine.includes('Land') && card.producedMana.length ? <ManaSymbols symbols={card.producedMana} /> : <OracleText text={card.manaCost} />}</span>{index >= commanderNames(commander).length && <span className="deck-remove-wrap"><button className={`deck-remove ${pendingRemoval === index ? 'confirm' : ''}`} type="button" onClick={() => pendingRemoval === index ? removeDeckCard(index) : setPendingRemoval(index)} aria-label={pendingRemoval === index ? `Confirm removal of ${card.name}` : `Remove ${card.name}`}>{pendingRemoval === index ? '✓' : '×'}</button>{pendingRemoval === index && <span className="remove-confirm" role="tooltip">Click again to confirm removal</span>}</span>}</span>{card.image && <span className="deck-card-popover"><FinishedCardImage image={card.image} alt={`${card.name} card`} finish={card.finish} className="deck-card-preview" /><ArtLoading active={loadingArt === card.name} /><PrintingButton count={card.printings?.length ?? 0} index={card.printing ?? 0} loading={Boolean(loadingArt)} name={card.name} onClick={() => void cycleDeckPrinting(index)} /></span>}</li>
          })}{section === 'Lands' && <>{groupedBasics.map(({ name, cards: basics }) => { const { card, index } = basics[0]; return <li className="basic-land-row" key={name}><span className="deck-card-name"><b className="card-quantity">{basics.length}x</b> {card.name}</span><span className="deck-card-meta"><span className="deck-mana"><ManaSymbols symbols={card.producedMana} /></span><button className="deck-add" type="button" disabled={deck.length >= 100} onClick={() => void addOneBasic(card.name)} aria-label={`Add another ${card.name}`}>+</button><button className="deck-remove" type="button" onClick={() => removeDeckCard(index)} aria-label={`Remove one ${card.name}`}>×</button></span></li> })}{legalBasicNames.filter((name) => !groupedBasics.some((group) => group.name === name)).map((name) => <li className="basic-placeholder" key={name}><button type="button" disabled={deck.length >= 100} onClick={() => void addOneBasic(name)}><span>Add {name}</span><b>+</b></button></li>)}</>}</ol></li>)}
          {sideboard.length > 0 && <li className="deck-group sideboard-group"><h3>Sideboard<span>{sideboard.length}</span></h3><ol>{sideboard.map((card, index) => <li key={`${card.name}-${index}`} tabIndex={0} onMouseEnter={positionDeckPreview}><span className={`deck-card-name ${card.finish === 'foil' ? 'foil-card-name' : card.finish === 'etched' ? 'etched-card-name' : ''}`}>{card.name}{card.finish && card.finish !== 'nonfoil' && <small className="finish-label">{card.finish}</small>}</span><span className="deck-card-meta"><button className="sideboard-move" type="button" disabled={deck.length >= 100} onClick={() => moveSideboardCard(index)}>Move to deck</button><button className="deck-remove" type="button" onClick={() => removeSideboardCard(index)} aria-label={`Remove ${card.name} from sideboard`}>×</button></span>{card.image && <span className="deck-card-popover"><FinishedCardImage image={card.image} alt={`${card.name} card`} finish={card.finish} className="deck-card-preview" /></span>}</li>)}</ol></li>}</ol>
        </section>
      </div>
    </main>
  )
}

export default App
