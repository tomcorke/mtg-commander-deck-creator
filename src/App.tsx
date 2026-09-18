import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { advanceRecommendationQueue, batchRecommendations, buildEdhrecRecommendations, cardText, commanderThemes, findSynergyPair, freshRecommendationCycle, manualCardError, orderedPrintings, parseEdhrecEntries, preconFastMana, preferredPrintingIndex, supportedThemes, tagsFor, toRecommendationCard, type DeferredCard, type EdhrecThemeCount, type PowerTarget, type ScryfallCard } from './recommendations'
import { analyseDeck, basicLandNames, basicLandPlan, cardTypes, curveBucket, deckGuidance, deckSection, defaultDeckTargets, isBasicLandName, targetKeys, targetLabels, type DeckTargets } from './deck-analysis'
import { clearDeckState, loadDeckState, saveDeckState } from './deck-state'
import './App.css'

type Printing = { image: string; art?: string; set: string; collectorNumber: string }
type Card = { name: string; layout: string; typeLine: string; manaCost: string; manaValue: number; detail: string; producedMana: string[]; faces: { typeLine: string; manaCost: string }[]; reason: string; image: string; set: string; collectorNumber: string; printsUri: string; tags: string[]; printings?: Printing[]; printing?: number; printingManuallySelected?: boolean }
type DeckCard = { name: string; layout: string; typeLine: string; manaCost: string; manaValue: number; detail: string; producedMana: string[]; faces: { typeLine: string; manaCost: string }[]; set: string; collectorNumber: string; image: string; tags: string[]; printings?: Printing[]; printing?: number; printingManuallySelected?: boolean }
type CommanderDetails = { images: string[]; art: string[]; colours: string[]; printings: Printing[][]; selections: number[] }
type ExportFormat = 'moxfield' | 'plain' | 'csv'
type PersistedDeckState = {
  commander: string
  commanderDetails: CommanderDetails | null
  theme: string
  queue: Card[]
  limitedRecommendations: boolean
  decisions: Record<string, 'add' | 'later' | 'ignore'>
  ignoredCards: string[]
  liked: string[]
  activeSubThemes: string[]
  dismissedSubThemes: string[]
  preferenceScores: Record<string, number>
  commanderSubThemes: string[]
  deferredCards: DeferredCard<Card>[]
  batchNumber: number
  deck: DeckCard[]
  preferredPrintSet: string
  deckTargets: DeckTargets
}

const isPersistedDeckState = (state: unknown): state is PersistedDeckState => {
  if (!state || typeof state !== 'object') return false
  const saved = state as Partial<PersistedDeckState>
  const arrays = [saved.queue, saved.deck, saved.ignoredCards, saved.liked, saved.activeSubThemes, saved.dismissedSubThemes, saved.commanderSubThemes, saved.deferredCards]
  const records = [saved.decisions, saved.preferenceScores, saved.deckTargets]
  return typeof saved.commander === 'string' && saved.commander.length > 0 && saved.commanderDetails !== null && typeof saved.commanderDetails === 'object' && arrays.every(Array.isArray) && saved.deck!.length > 0 && records.every((value) => value !== null && typeof value === 'object') && typeof saved.theme === 'string' && typeof saved.limitedRecommendations === 'boolean' && typeof saved.batchNumber === 'number' && typeof saved.preferredPrintSet === 'string'
}

const savedDeckState = loadDeckState<PersistedDeckState>(localStorage, isPersistedDeckState)

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
  'Typal': ['The First Sliver', 'Wilhelt, the Rotcleaver', 'Hakbal of the Surging Soul', 'Pantlaza, Sun-Favored', 'Voja, Jaws of the Conclave', 'Edgar Markov'],
  'Big mana': ['Zhulodok, Void Gorger', 'Goreclaw, Terror of Qal Sisma', 'Kozilek, the Great Distortion', 'Klauth, Unrivaled Ancient', 'Imoti, Celebrant of Bounty', 'Selvala, Heart of the Wilds'],
  'Blink': ['Brago, King Eternal', 'Roon of the Hidden Realm', 'Abdel Adrian, Gorion\'s Ward', 'Preston, the Vanisher', 'Yorion, Sky Nomad', 'Aminatou, the Fateshifter'],
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

function sharedTheme(cards: { tags: string[] }[], excluded: string[] = []) {
  const counts = new Map<string, number>()
  for (const card of cards) for (const tag of card.tags) if (!excluded.includes(tag) && !['Creatures', 'Lands'].includes(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).find(([, count]) => count >= 2)?.[0] ?? ''
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
  const [limitedRecommendations, setLimitedRecommendations] = useState(savedDeckState?.limitedRecommendations ?? false)
  const [includeCreature, setIncludeCreature] = useStoredOption('includeCreature', () => true)
  const [powerTarget, setPowerTarget] = useStoredOption<PowerTarget>('powerTarget', () => 'precon')
  const [excludeGameChangers, setExcludeGameChangers] = useStoredOption('excludeGameChangers', () => true)
  const [excludeTutors, setExcludeTutors] = useStoredOption('excludeTutors', () => true)
  const [excludeExtraTurns, setExcludeExtraTurns] = useStoredOption('excludeExtraTurns', () => true)
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
  const [showExport, setShowExport] = useState(false)
  const [showBasicLands, setShowBasicLands] = useState(false)
  const [basicLandState, setBasicLandState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showCardSearch, setShowCardSearch] = useState(false)
  const [cardSearch, setCardSearch] = useState('')
  const [cardSearchResults, setCardSearchResults] = useState<ScryfallCard[]>([])
  const [cardSearchState, setCardSearchState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [filterCardIdentity, setFilterCardIdentity] = useState(true)
  const [selectedManualCard, setSelectedManualCard] = useState<ScryfallCard | null>(null)
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
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null)

  useEffect(() => {
    if (!commander || recommendationState !== 'idle' || !commanderDetails || !deck.length) return
    saveDeckState<PersistedDeckState>({ commander, commanderDetails, theme, queue, limitedRecommendations, decisions, ignoredCards, liked, activeSubThemes, dismissedSubThemes, preferenceScores, commanderSubThemes, deferredCards, batchNumber, deck, preferredPrintSet, deckTargets })
  }, [commander, commanderDetails, theme, queue, recommendationState, limitedRecommendations, decisions, ignoredCards, liked, activeSubThemes, dismissedSubThemes, preferenceScores, commanderSubThemes, deferredCards, batchNumber, deck, preferredPrintSet, deckTargets])

  useEffect(() => {
    void fetch('https://api.scryfall.com/cards/collection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers: basicNames.map((name) => ({ name })) }) })
      .then((response) => response.ok ? response.json() as Promise<{ data: ScryfallCard[] }> : Promise.reject())
      .then(({ data }) => data.forEach((card) => basicCardCache.set(card.name, card)))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (pendingRemoval === null) return
    const timer = setTimeout(() => setPendingRemoval(null), 1500)
    return () => clearTimeout(timer)
  }, [pendingRemoval])

  useEffect(() => {
    if (!showCardSearch || cardSearch.trim().length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setCardSearchState('loading')
      try {
        const identity = commanderDetails?.colours.join('').toLowerCase() || 'c'
        const query = `name:${cardSearch.trim()}${filterCardIdentity ? ` id<=${identity}` : ''}`
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
  }, [cardSearch, showCardSearch, filterCardIdentity, commanderDetails?.colours])

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
    const bracketFilters = [excludeGameChangers && '-is:gamechanger', excludeTutors && '-otag:tutor', excludeExtraTurns && '-otag:extra-turn'].filter(Boolean).join(' ')
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
    return buildEdhrecRecommendations(entries, responseCards, { includeCreature, excludeGameChangers, excludeTutors, excludeExtraTurns, powerTarget })
  }

  async function loadPrintings(cards: Card[], preferredSet = '') {
    for (const offered of cards) {
      await new Promise((resolve) => setTimeout(resolve, 150))
      const response = await fetch(offered.printsUri)
      if (!response.ok) continue
      const result = await response.json() as { data: ScryfallCard[] }
      const printings = orderedPrintings(offered, result.data.flatMap((printing) => {
        const image = printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal
        return image ? [{ image, set: printing.set, collectorNumber: printing.collector_number }] : []
      }))
      const selectedIndex = preferredPrintingIndex(printings, preferredSet)
      const selected = printings[selectedIndex]
      setQueue((current) => current.map((item) => item.name === offered.name ? { ...item, printings, image: selected.image, set: selected.set, collectorNumber: selected.collectorNumber, printing: selectedIndex } : item))
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
      setIgnoredCards([])
      setActiveSubThemes([])
      setDismissedSubThemes([])
      setPreferenceScores({})
    }
    setCommanderDetails(null)
    setQueue([])
    setLimitedRecommendations(false)
    if (!preserveDeck) setPreferredPrintSet('')
    setRecommendationState('loading')

    try {
      const responses = await Promise.all(commanderNames(chosen).map((name) => fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`)))
      if (responses.some((response) => !response.ok)) throw new Error('Commander unavailable')
      type CommanderCard = ScryfallCard & { related_uris?: { edhrec?: string }; image_uris?: { normal: string; art_crop?: string }; card_faces?: { mana_cost?: string; oracle_text?: string; image_uris?: { normal: string; art_crop?: string } }[] }
      const commanders = await Promise.all(responses.map((response) => response.json() as Promise<CommanderCard>))
      const images = commanders.flatMap((card) => card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? [])
      const art = commanders.flatMap((card) => card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop ?? [])
      const identityColours = [...new Set(commanders.flatMap((card) => card.color_identity))]
      const commanderPrintings = await Promise.all(commanders.map(async (card) => {
        const primary = { image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '', art: card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop, set: card.set, collectorNumber: card.collector_number }
        const response = await fetch(card.prints_search_uri)
        if (!response.ok) return [primary]
        const result = await response.json() as { data: CommanderCard[] }
        const alternatives = result.data.flatMap((printing) => {
          const image = printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal
          return image && image !== primary.image ? [{ image, art: printing.image_uris?.art_crop ?? printing.card_faces?.[0]?.image_uris?.art_crop, set: printing.set, collectorNumber: printing.collector_number }] : []
        }).filter((printing, index, all) => all.findIndex((item) => item.image === printing.image) === index)
        return [primary, ...alternatives]
      }))
      if (images.length) setCommanderDetails({ images, art, colours: identityColours, printings: commanderPrintings, selections: commanders.map(() => 0) })
      if (!preserveDeck) setDeck(commanders.map((card, index) => ({ name: card.name, layout: card.layout ?? 'normal', typeLine: card.type_line, manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '', manaValue: card.cmc ?? 0, detail: cardText(card), producedMana: card.produced_mana ?? [], faces: card.card_faces?.map((face) => ({ typeLine: face.type_line ?? '', manaCost: face.mana_cost ?? '' })) ?? [], set: card.set, collectorNumber: card.collector_number, image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '', tags: cardTags(card), printings: commanderPrintings[index], printing: 0 })))

      let offeredCards: Card[]
      try {
        if (commanders.length !== 1) throw new Error('Partner pair has no single EDHREC page')
        offeredCards = await edhrecRecommendations(edhrecSlug(commanders[0].related_uris?.edhrec, commanders[0].name))
        if (offeredCards.length < 4) throw new Error('Too few EDHREC cards')
      } catch {
        offeredCards = await fallbackRecommendations(identityColours)
        setLimitedRecommendations(true)
      }
      if (preserveDeck) offeredCards = offeredCards.filter((card) => !ignoredCards.includes(card.name) && !deck.some((deckCard) => deckCard.name === card.name))
      setQueue(offeredCards)
      setRecommendationState('idle')
      await loadPrintings(offeredCards.slice(0, 4), preferredPrintSet)
      return true
    } catch {
      setRecommendationState('error')
      return false
    }
  }

  function decide(card: Card, action: 'add' | 'later' | 'ignore') {
    const previous = decisions[card.name]
    if (previous === 'add' && action !== 'add') setDeck((list) => list.filter((item) => item.name !== card.name))
    if (previous !== 'add' && action === 'add' && deck.length >= 100) return
    if (previous !== 'add' && action === 'add') setDeck((list) => list.length < 100 && (card.typeLine.includes('Basic Land') || !list.some((item) => item.name === card.name)) ? [...list, { name: card.name, layout: card.layout, typeLine: card.typeLine, manaCost: card.manaCost, manaValue: card.manaValue, detail: card.detail, producedMana: card.producedMana, faces: card.faces, set: card.set, collectorNumber: card.collectorNumber, image: card.image, tags: card.tags, printings: card.printings, printing: card.printing ?? 0, printingManuallySelected: card.printingManuallySelected }] : list)
    if (action === 'ignore') {
      setLiked((current) => current.filter((name) => name !== card.name))
      setIgnoredCards((current) => current.includes(card.name) ? current : [...current, card.name])
    } else setIgnoredCards((current) => current.filter((name) => name !== card.name))
    setDecisions((current) => ({ ...current, [card.name]: action }))
  }

  async function cycleCommanderPrinting(commanderIndex: number) {
    if (!commanderDetails || commanderDetails.printings[commanderIndex].length < 2 || loadingArt) return
    const selection = (commanderDetails.selections[commanderIndex] + 1) % commanderDetails.printings[commanderIndex].length
    const selected = commanderDetails.printings[commanderIndex][selection]
    const loadingName = commanderNames(commander)[commanderIndex]
    setLoadingArt(`pending:${loadingName}`)
    const loadingTimer = setTimeout(() => setLoadingArt(loadingName), 50)
    await preloadArt([selected.image, selected.art])
    clearTimeout(loadingTimer)
    setPreferredPrintSet(selected.set)
    setCommanderDetails((current) => current && ({ ...current, images: current.images.map((image, index) => index === commanderIndex ? selected.image : image), art: current.art.map((image, index) => index === commanderIndex ? selected.art ?? image : image), selections: current.selections.map((value, index) => index === commanderIndex ? selection : value) }))
    setDeck((current) => current.map((card, index) => index === commanderIndex ? { ...card, image: selected.image, set: selected.set, collectorNumber: selected.collectorNumber, printing: selection } : card))
    setQueue((current) => current.map((card) => {
      if (!card.printings?.length) return card
      const matching = preferredPrintingIndex(card.printings, selected.set, card.printing, card.printingManuallySelected)
      const printing = card.printings[matching]
      return { ...card, image: printing.image, set: printing.set, collectorNumber: printing.collectorNumber, printing: matching }
    }))
    setLoadingArt('')
  }

  async function cyclePrinting(card: Card) {
    if (!card.printings || card.printings.length < 2 || loadingArt) return
    const index = ((card.printing ?? 0) + 1) % card.printings.length
    const selected = card.printings[index]
    setLoadingArt(`pending:${card.name}`)
    const loadingTimer = setTimeout(() => setLoadingArt(card.name), 50)
    await preloadArt([selected.image])
    clearTimeout(loadingTimer)
    setQueue((current) => current.map((item) => item.name === card.name ? { ...item, printing: index, image: selected.image, set: selected.set, collectorNumber: selected.collectorNumber, printingManuallySelected: true } : item))
    if (decisions[card.name] === 'add') setDeck((current) => current.map((item) => item.name === card.name ? { ...item, set: selected.set, collectorNumber: selected.collectorNumber, image: selected.image, printing: index, printingManuallySelected: true } : item))
    setLoadingArt('')
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
    setLoadingArt(`pending:${card.name}`)
    const loadingTimer = setTimeout(() => setLoadingArt(card.name), 50)
    await preloadArt([selected.image])
    clearTimeout(loadingTimer)
    setDeck((current) => current.map((item, index) => index === cardIndex ? { ...item, image: selected.image, set: selected.set, collectorNumber: selected.collectorNumber, printing, printingManuallySelected: true } : item))
    setLoadingArt('')
  }

  function deckList(format: ExportFormat) {
    if (format === 'plain') return deck.map((card) => `1 ${card.name}`).join('\n')
    if (format === 'csv') return ['Quantity,Name,Set,Collector Number', ...deck.map((card) => `1,"${card.name.replaceAll('"', '""')}",${card.set.toUpperCase()},${card.collectorNumber}`)].join('\n')
    return deck.map((card) => `1 ${card.name} (${card.set.toUpperCase()}) ${card.collectorNumber}`).join('\n')
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
    setCardSearchState('idle')
    requestAnimationFrame(() => cardSearchButton.current?.focus())
  }

  function selectManualCard(card: ScryfallCard) {
    setSelectedManualCard(card)
  }

  function addManualCard() {
    if (!selectedManualCard || manualCardError(selectedManualCard, deck.map((card) => card.name), commanderDetails?.colours ?? [], deck.length)) return
    setDeck((current) => [...current, toDeckCard(selectedManualCard)])
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

  function removeDeckCard(index: number) {
    const removed = deck[index]
    setPendingRemoval(null)
    setDeck((current) => current.filter((_, cardIndex) => cardIndex !== index))
    setDecisions((current) => {
      if (current[removed.name] !== 'add') return current
      const next = { ...current }
      delete next[removed.name]
      return next
    })
  }

  function startOver() {
    if (!window.confirm('Start over? This clears your current deck and recommendation history.')) return
    clearDeckState()
    setCommander('')
    setCommanderDetails(null)
    setTheme('')
    setDeck([])
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
  }

  async function nextBatch(extraSubTheme = '') {
    if (deck.length >= 100) return
    if (recommendationOptionsChanged) {
      if (await start(commander, true)) setRecommendationOptionsChanged(false)
      return
    }
    const batch = queue.slice(0, 4)
    const next = advanceRecommendationQueue({ queue, deferredCards, batchNumber, decisions, liked, preferenceScores, activeSubThemes, extraSubTheme, theme, includeCreature })
    setPreferenceScores(next.preferenceScores)
    setDeferredCards(next.deferredCards)
    setBatchNumber(next.batchNumber)
    setQueue(next.queue)
    setDecisions({})
    setLiked((current) => current.filter((name) => !batch.some((card) => card.name === name)))
    setBatchAnnouncement(next.queue.length ? `Recommendation batch ${next.batchNumber} loaded: ${next.queue.slice(0, 4).map((card) => card.name).join(', ')}.` : 'No recommendations currently eligible. Deferred cards will return after their waiting period.')
    void loadPrintings(next.queue.slice(0, 4), preferredPrintSet)
  }

  if (!commander) return (
    <main className={darkMode ? 'dark' : ''}>
      <header><a className="brand" href="/">Commander's Table</a><div className="header-actions"><label className="theme-option"><input type="checkbox" checked={commanderStyling} onChange={(event) => setCommanderStyling(event.target.checked)} /> Commander art and colours</label><button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>{darkMode ? '◐ Dark' : '☀ Light'}</button></div></header>
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
  const inferredSubTheme = activeSubThemes.length < 2 ? sharedTheme(deck.slice(commanderNames(commander).length), [theme, ...activeSubThemes, ...dismissedSubThemes]) : ''
  const rawBatch = queue.slice(0, 4)
  const synergyPair = findSynergyPair(rawBatch.filter((card) => card.reason !== 'Land or mana'))
  const pairCards = synergyPair?.cards ?? []
  const visibleBatch = pairCards.length ? [...pairCards, ...rawBatch.filter((card) => !pairCards.includes(card))] : rawBatch
  const inferredThemeOptions = [...new Set(deck.slice(commanderNames(commander).length).flatMap((card) => card.tags))].filter((name) => supportedThemes.includes(name))
  const subThemeOptions = [...new Set([...commanderSubThemes, ...inferredThemeOptions])]
  const filteredSubThemes = subThemeOptions.filter((name) => name.toLowerCase().includes(subThemeSearch.toLowerCase()) && name !== theme && !activeSubThemes.includes(name))
  const analysis = analyseDeck(deck)
  const guidance = deckGuidance(deck.length, analysis.counts, deckTargets)
  const calculatedLandTarget = deckTargets.lands
  const representativeSpellCount = deck.slice(commanderNames(commander).length).filter((card) => !card.typeLine.includes('Land')).length
  const basicLands = representativeSpellCount >= 5 ? basicLandPlan(commanderDetails?.colours ?? [], analysis.required, analysis.counts.lands, calculatedLandTarget, deck.length) : []
  const indexedDeck = deck.map((card, index) => ({ card, index }))
  const commanders = indexedDeck.slice(0, commanderNames(commander).length)
  const groupedDeck = deckSections.map((section) => ({ section, cards: indexedDeck.slice(commanderNames(commander).length).filter(({ card }) => deckSection(card.typeLine) === section && !isBasicLandName(card.name)) })).filter(({ cards }) => cards.length)
  const groupedBasics = [...new Set(indexedDeck.filter(({ card }) => isBasicLandName(card.name)).map(({ card }) => card.name))].map((name) => ({ name, cards: indexedDeck.filter(({ card }) => card.name === name) }))
  const legalBasicNames = commanderDetails?.colours.length ? commanderDetails.colours.map((colour) => basicLandNames[colour as keyof typeof basicLandNames]) : ['Wastes']
  const maxCurveCount = Math.max(1, ...analysis.curve.map((point) => point.permanents + point.nonPermanents))
  const manaColours = (['W', 'U', 'B', 'R', 'G'] as const)
  const pickedTags = new Set(deck.slice(commanderNames(commander).length).flatMap((card) => card.tags))
  const cardReason = (card: Card) => {
    const subTheme = card.tags.find((tag) => activeSubThemes.includes(tag))
    if (subTheme) return `${subTheme} sub-theme`
    if (theme && card.tags.includes(theme)) return `${theme} theme`
    const preference = card.tags.filter((tag) => pickedTags.has(tag) && (preferenceScores[tag] ?? 0) > 0).sort((a, b) => (preferenceScores[b] ?? 0) - (preferenceScores[a] ?? 0))[0]
    return preference ? `Matches your ${preference} picks` : card.reason
  }

  return (
    <main className={`${darkMode ? 'dark ' : ''}${commanderStyling ? 'commander-themed' : ''}`} style={{ '--commander-accent': primaryTheme[0], '--commander-highlight': secondaryTheme[1] } as CSSProperties}>
      {commanderStyling && commanderDetails?.art.length ? <div className="commander-backdrop" aria-hidden="true">{commanderDetails.art.map((image) => <span style={{ backgroundImage: `url(${image})` }} key={image} />)}</div> : null}
      <header>
        <button className="brand reset" onClick={startOver}>Commander's Table</button>
        <div className="progress"><span style={{ background: `linear-gradient(90deg, var(--commander-accent, #7650ae) ${deck.length}%, #dedcea ${deck.length}%)` }} />{deck.length} / 100 cards</div>
        <div className="header-actions"><label className="theme-option"><input type="checkbox" checked={commanderStyling} onChange={(event) => setCommanderStyling(event.target.checked)} /> Commander art and colours</label><button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>{darkMode ? '◐ Dark' : '☀ Light'}</button><button className="start-over" type="button" onClick={startOver}>Start over</button><button className="export" type="button" onClick={() => setShowExport(true)}>Export deck</button></div>
      </header>
      <section className="intro commander-header">
        {commanderDetails ? <figure className={`commander-card ${commanderDetails.images.length > 1 ? 'pair' : ''}`} tabIndex={0} aria-label={`View ${commander} card${commanderDetails.images.length > 1 ? 's' : ''}`}>
          {commanderDetails.images.map((image, index) => <img src={image} alt={`${commanderNames(commander)[index]} card`} key={commanderNames(commander)[index]} />)}
          {commanderDetails.printings.some((printings) => printings.length > 1) && <span className="printing-indicator" aria-hidden="true">↻ Art</span>}
          <span className="card-zoom">{commanderDetails.images.map((image, index) => <span className="commander-printing" key={commanderNames(commander)[index]}><img src={image} alt={`${commanderNames(commander)[index]} full card`} />{loadingArt === commanderNames(commander)[index] && <span className="art-loading" role="status"><i />Loading art…</span>}{commanderDetails.printings[index].length > 1 && <button type="button" disabled={Boolean(loadingArt)} onClick={() => void cycleCommanderPrinting(index)} aria-label={`Show alternate printing of ${commanderNames(commander)[index]}`}>↻ Art {commanderDetails.selections[index] + 1}/{commanderDetails.printings[index].length}</button>}</span>)}</span>
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
          {!selectedManualCard && cardSearchResults.length > 0 && <div className="card-search-results" aria-label="Card search results">{cardSearchResults.map((card) => <button type="button" key={card.name} onClick={() => selectManualCard(card)}><span><b>{card.name}</b><small>{card.type_line}</small></span><span className="search-result-mana"><OracleText text={card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? ''} /></span></button>)}</div>}
          {selectedManualCard && <div className="manual-card-preview">
            {(selectedManualCard.image_uris?.normal ?? selectedManualCard.card_faces?.[0]?.image_uris?.normal) && <img src={selectedManualCard.image_uris?.normal ?? selectedManualCard.card_faces?.[0]?.image_uris?.normal} alt={`${selectedManualCard.name} card`} />}
            <div><p className="eyebrow">{selectedManualCard.set.toUpperCase()} · {selectedManualCard.collector_number}</p><h3>{selectedManualCard.name}</h3><p>{selectedManualCard.type_line}</p><p><OracleText text={cardText(selectedManualCard)} /></p>
              {manualCardError(selectedManualCard, deck.map((card) => card.name), commanderDetails?.colours ?? [], deck.length) && <p className="form-error" role="alert">{manualCardError(selectedManualCard, deck.map((card) => card.name), commanderDetails?.colours ?? [], deck.length)}</p>}
              <div className="export-actions"><button type="button" onClick={() => setSelectedManualCard(null)}>Back</button><button className="primary" type="button" disabled={Boolean(manualCardError(selectedManualCard, deck.map((card) => card.name), commanderDetails?.colours ?? [], deck.length))} onClick={addManualCard}>Add to deck</button></div>
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
          <textarea readOnly value={deckList(exportFormat)} onFocus={(event) => event.currentTarget.select()} aria-label={`${exportFormat} deck list`} />
          <div className="export-actions"><a href="https://www.moxfield.com/decks/new" target="_blank" rel="noreferrer">Open Moxfield importer ↗</a><button className="primary" onClick={() => void copyDeck()}>{copied ? 'Copied' : 'Copy to clipboard'}</button></div>
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
              {inferredSubTheme && <span className="suggested-subtheme"><span>{inferredSubTheme}?</span><button type="button" onClick={() => { setActiveSubThemes((current) => [...current, inferredSubTheme].slice(0, 2)); void nextBatch(inferredSubTheme) }} aria-label={`Accept ${inferredSubTheme} sub-theme`}>✓</button><button type="button" onClick={() => setDismissedSubThemes((current) => [...current, inferredSubTheme])} aria-label={`Dismiss ${inferredSubTheme} sub-theme`}>×</button></span>}
              {activeSubThemes.length < 2 && <button className="add-subtheme" type="button" onClick={() => setShowSubThemePicker((current) => !current)}>+ Choose sub-theme</button>}
            </div>
            <div className="toolbar-actions">
              {deck.length < 100 && (queue.length > 0 || deferredCards.length > 0) && recommendationState === 'idle' && <div className="batch-controls"><button className="primary" onClick={() => void nextBatch()}>Next recommendations →</button></div>}
            </div>
          </div>
          {showSubThemePicker && <div className="subtheme-picker">
            <input value={subThemeSearch} onChange={(event) => setSubThemeSearch(event.target.value)} placeholder="Search sub-themes…" aria-label="Search sub-themes" />
            <div>{filteredSubThemes.slice(0, 8).map((name) => <button type="button" key={name} onClick={() => { setActiveSubThemes((current) => [...current, name].slice(0, 2)); setShowSubThemePicker(false); setSubThemeSearch('') }}>{name}</button>)}</div>
          </div>}
          {deck.length >= 100 ? <div className="completion"><p className="eyebrow">Deck complete</p><h2>Review your 100-card deck</h2><p>Recommendations are paused. Review your deck analysis, then export when ready.</p><button className="primary" type="button" onClick={() => setShowExport(true)}>Review and export deck</button></div> : recommendationState === 'loading' ? <div className="empty"><h3>Loading suggestions…</h3></div> : recommendationState === 'error' ? <div className="empty"><h3>Suggestions unavailable</h3><p>Scryfall is busy. Try this commander again shortly.</p><button className="primary" onClick={() => void start(commander)}>Retry</button></div> : queue.length ? <div className="card-grid connector-glow">
            {visibleBatch.map((card) => <article className={`card-offer ${decisions[card.name] ?? ''} ${pairCards.includes(card) ? `synergy-pair synergy-${pairCards.indexOf(card) + 1}` : ''}`} key={card.name}>
              <div className="offer-heading"><h3 className="suggestion-type">{cardReason(card)}{decisions[card.name] === 'add' ? ' · Added to deck' : decisions[card.name] === 'later' ? ' · Later' : decisions[card.name] === 'ignore' ? ' · Ignored' : ''}</h3></div>
              <div className="actions">
                <div><button className="primary" disabled={deck.length >= 100 && decisions[card.name] !== 'add'} onClick={() => decide(card, 'add')}>Add</button><span className="action-help-wrap"><button onClick={() => decide(card, 'later')} aria-describedby={`later-${card.name}`}>Later</button><span className="action-help" id={`later-${card.name}`} role="tooltip">Skip for now. This card may return in a later batch.</span></span><span className="action-help-wrap"><button className="quiet" onClick={() => decide(card, 'ignore')} aria-describedby={`ignore-${card.name}`}>Ignore</button><span className="action-help" id={`ignore-${card.name}`} role="tooltip">Remove this card from all future recommendations.</span></span></div>
                <span className="similar-wrap"><button className={`similar ${liked.includes(card.name) ? 'selected' : ''}`} type="button" disabled={decisions[card.name] === 'ignore'} aria-pressed={liked.includes(card.name)} onClick={() => setLiked((current) => current.includes(card.name) ? current.filter((name) => name !== card.name) : [...current, card.name])} aria-label={`Find more cards like ${card.name}`} aria-describedby={`similar-${card.name}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg></button><span className="similar-help" id={`similar-${card.name}`} role="tooltip">Prioritise similar cards in future recommendations.</span></span>
              </div>
              <div className="offered-image"><img src={card.image} alt={`${card.name} card`} />{pairCards.includes(card) && synergyPair && <span className="synergy-info"><button type="button" aria-describedby={`synergy-${card.name}`}>ⓘ Synergy</button><span className="synergy-popover" id={`synergy-${card.name}`} role="tooltip"><strong>{card.name} + {pairCards.find((item) => item !== card)?.name}</strong><span>{synergyPair.explanation}.</span></span></span>}{loadingArt === card.name && <span className="art-loading" role="status"><i />Loading art…</span>}{card.printings && card.printings.length > 1 && <button type="button" disabled={Boolean(loadingArt)} onClick={() => void cyclePrinting(card)} aria-label={`Show alternate printing of ${card.name}`}>↻ Art {(card.printing ?? 0) + 1}/{card.printings.length}</button>}</div>
              <div className="card-copy"><h3>{card.name}</h3><p><OracleText text={card.detail} /></p></div>
            </article>)}
          </div> : <div className="empty"><h3>{deferredCards.length ? 'Suggestions resting' : 'No more suggestions'}</h3><p>{deferredCards.length ? 'Advance recommendations to keep their waiting period, then bring them back.' : 'Review your deck or choose another commander.'}</p></div>}
        </section>
        <aside>
          <div className="deck-heading"><div><p className="eyebrow">Your deck</p><h2>{deck.length} cards</h2></div><span>{deck.length}%</span></div>
          <button className="manual-card-button" ref={cardSearchButton} type="button" disabled={deck.length >= 100} onClick={() => setShowCardSearch(true)}>+ Add card by name</button>
          <div className="meter"><span style={{ width: `${deck.length}%` }} /></div>
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
            <div className="deck-targets">{targetKeys.map((key) => <label key={key}><span>{targetLabels[key]}</span><b>{analysis.counts[key]}</b><span>/</span><input type="number" min="0" max="99" value={deckTargets[key]} onChange={(event) => setDeckTargets((current) => ({ ...current, [key]: Math.max(0, Number(event.target.value)) }))} aria-label={`${targetLabels[key]} target`} /></label>)}</div>
            {cardTypes.some((type) => analysis.typeCounts[type] > 0) && <><h4>Card types</h4><div className="type-counts">{cardTypes.filter((type) => analysis.typeCounts[type] > 0).map((type) => <span key={type}>{type}<b>{analysis.typeCounts[type]}</b></span>)}</div></>}
            {guidance.length > 0 && <div className="deck-guidance" aria-live="polite">{guidance.map((item) => <p className={item.strong ? 'strong' : ''} key={item.key}>{item.text}</p>)}</div>}
          </section>
          <ol className="deck-list">{[{ section: 'Commander', cards: commanders, count: commanders.length }, ...groupedDeck.map((group) => ({ ...group, count: group.cards.length }))].map(({ section, cards, count }) => <li className="deck-group" key={section}><h3>{section}<span>{count}</span></h3><ol>{cards.map(({ card, index }) => {
            const curveValue = curveBucket(card)
            const highlighted = highlightedManaValue === null || highlightedManaValue === curveValue
            return <li className={highlighted ? '' : 'curve-dimmed'} key={`${card.name}-${index}`} tabIndex={0}>{highlightedManaValue !== null && highlighted && <span className="sr-only">Matches active mana-value filter. </span>}<span className="deck-card-name">{(card.printing ?? 0) > 0 && <span className="alternate-printing" title="Alternate printing selected" aria-label="Alternate printing selected" />}{card.name}</span><span className="deck-card-meta"><span className="deck-mana">{card.typeLine.includes('Land') && card.producedMana.length ? <ManaSymbols symbols={card.producedMana} /> : <OracleText text={card.manaCost} />}</span>{isBasicLandName(card.name) && <button className="deck-add" type="button" disabled={deck.length >= 100} onClick={() => void addOneBasic(card.name)} aria-label={`Add another ${card.name}`}>+</button>}{index >= commanderNames(commander).length && <span className="deck-remove-wrap"><button className={`deck-remove ${pendingRemoval === index ? 'confirm' : ''}`} type="button" onClick={() => isBasicLandName(card.name) || pendingRemoval === index ? removeDeckCard(index) : setPendingRemoval(index)} aria-label={isBasicLandName(card.name) ? `Remove one ${card.name}` : pendingRemoval === index ? `Confirm removal of ${card.name}` : `Remove ${card.name}`}>{pendingRemoval === index ? '✓' : '×'}</button>{pendingRemoval === index && <span className="remove-confirm" role="tooltip">Click again to confirm removal</span>}</span>}</span>{card.image && <span className="deck-card-popover"><img className="deck-card-preview" src={card.image} alt={`${card.name} card`} />{loadingArt === card.name && <span className="art-loading" role="status"><i />Loading art…</span>}{card.printings && card.printings.length > 1 && <button type="button" disabled={Boolean(loadingArt)} onClick={() => void cycleDeckPrinting(index)} aria-label={`Show alternate printing of ${card.name}`}>↻ Art {(card.printing ?? 0) + 1}/{card.printings.length}</button>}</span>}</li>
          })}</ol></li>)}
          <li className="deck-group basics-group"><h3>Basic lands<span>{groupedBasics.reduce((sum, group) => sum + group.cards.length, 0)}</span></h3><ol>{groupedBasics.map(({ name, cards }) => { const { card, index } = cards[0]; return <li key={name}><span className="deck-card-name">{card.name}</span><span className="deck-card-meta"><span className="deck-mana"><ManaSymbols symbols={card.producedMana} /></span><b>{cards.length}</b><button className="deck-add" type="button" disabled={deck.length >= 100} onClick={() => void addOneBasic(card.name)} aria-label={`Add another ${card.name}`}>+</button><button className="deck-remove" type="button" onClick={() => removeDeckCard(index)} aria-label={`Remove one ${card.name}`}>×</button></span></li> })}{legalBasicNames.filter((name) => !groupedBasics.some((group) => group.name === name)).map((name) => <li className="basic-placeholder" key={name}><button type="button" disabled={deck.length >= 100} onClick={() => void addOneBasic(name)}><span>Add {name}</span><b>+</b></button></li>)}</ol></li></ol>
        </aside>
      </div>
    </main>
  )
}

export default App
