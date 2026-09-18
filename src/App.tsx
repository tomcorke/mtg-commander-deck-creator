import { useEffect, useState, type CSSProperties } from 'react'
import { advanceRecommendationQueue, batchRecommendations, buildEdhrecRecommendations, cardText, commanderThemes, findSynergyPair, freshRecommendationCycle, orderedPrintings, parseEdhrecEntries, preconFastMana, preferredPrintingIndex, supportedThemes, tagsFor, toRecommendationCard, type DeferredCard, type EdhrecThemeCount, type PowerTarget, type ScryfallCard } from './recommendations'
import './App.css'

type Printing = { image: string; art?: string; set: string; collectorNumber: string }
type Card = { name: string; typeLine: string; manaCost: string; reason: string; detail: string; image: string; set: string; collectorNumber: string; printsUri: string; tags: string[]; printings?: Printing[]; printing?: number; printingManuallySelected?: boolean }
type DeckCard = { name: string; typeLine: string; manaCost: string; set: string; collectorNumber: string; image: string; tags: string[]; printings?: Printing[]; printing?: number; printingManuallySelected?: boolean }
type CommanderDetails = { images: string[]; art: string[]; colours: string[]; printings: Printing[][]; selections: number[] }
type ExportFormat = 'moxfield' | 'plain' | 'csv'
type SynergyConnector = 'bracket' | 'bridge' | 'glow' | 'arrow' | 'container'

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
const defaultCommanders = Object.values(themeCommanders).flat()
const selectableThemes = Object.keys(themeCommanders).filter((name) => supportedThemes.includes(name))
const randomItems = <T,>(items: T[], count: number) => [...items].sort(() => Math.random() - 0.5).slice(0, count)
const randomThree = (items: string[]) => randomItems(items, 3)

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
  const [commander, setCommander] = useState('')
  const [commanderDetails, setCommanderDetails] = useState<CommanderDetails | null>(null)
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState('')
  const [visibleThemes, setVisibleThemes] = useState(() => randomItems(selectableThemes, 6))
  const [colours, setColours] = useState<string[]>([])
  const [matches, setMatches] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState(() => randomThree(defaultCommanders))
  const [suggestionPool, setSuggestionPool] = useState(defaultCommanders)
  const [commanderCosts, setCommanderCosts] = useState<Record<string, string>>({})
  const [commanderImages, setCommanderImages] = useState<Record<string, string[]>>({})
  const [queue, setQueue] = useState<Card[]>([])
  const [recommendationState, setRecommendationState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [limitedRecommendations, setLimitedRecommendations] = useState(false)
  const [includeCreature, setIncludeCreature] = useState(true)
  const [powerTarget, setPowerTarget] = useState<PowerTarget>('upgraded')
  const [excludeGameChangers, setExcludeGameChangers] = useState(true)
  const [excludeTutors, setExcludeTutors] = useState(true)
  const [excludeExtraTurns, setExcludeExtraTurns] = useState(true)
  const [decisions, setDecisions] = useState<Record<string, 'add' | 'later' | 'ignore'>>({})
  const [liked, setLiked] = useState<string[]>([])
  const [activeSubThemes, setActiveSubThemes] = useState<string[]>([])
  const [dismissedSubThemes, setDismissedSubThemes] = useState<string[]>([])
  const [showSubThemePicker, setShowSubThemePicker] = useState(false)
  const [subThemeSearch, setSubThemeSearch] = useState('')
  const [preferenceScores, setPreferenceScores] = useState<Record<string, number>>({})
  const [commanderSubThemes, setCommanderSubThemes] = useState<string[]>([])
  const [deferredCards, setDeferredCards] = useState<DeferredCard<Card>[]>([])
  const [batchNumber, setBatchNumber] = useState(1)
  const [batchAnnouncement, setBatchAnnouncement] = useState('')
  const [synergyConnector, setSynergyConnector] = useState<SynergyConnector>('glow')
  const [deck, setDeck] = useState<DeckCard[]>([])
  const [showExport, setShowExport] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('moxfield')
  const [copied, setCopied] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light')
  const [commanderStyling, setCommanderStyling] = useState(true)
  const [preferredPrintSet, setPreferredPrintSet] = useState('')
  const [loadingArt, setLoadingArt] = useState('')

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

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
      if (!preserveDeck) setDeck(commanders.map((card, index) => ({ name: card.name, typeLine: 'Legendary Creature', manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '', set: card.set, collectorNumber: card.collector_number, image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '', tags: cardTags(card), printings: commanderPrintings[index], printing: 0 })))

      let offeredCards: Card[]
      try {
        if (commanders.length !== 1) throw new Error('Partner pair has no single EDHREC page')
        offeredCards = await edhrecRecommendations(edhrecSlug(commanders[0].related_uris?.edhrec, commanders[0].name))
        if (offeredCards.length < 4) throw new Error('Too few EDHREC cards')
      } catch {
        offeredCards = await fallbackRecommendations(identityColours)
        setLimitedRecommendations(true)
      }
      setQueue(offeredCards)
      setRecommendationState('idle')
      await loadPrintings(offeredCards.slice(0, 4), preferredPrintSet)
    } catch {
      setRecommendationState('error')
    }
  }

  function decide(card: Card, action: 'add' | 'later' | 'ignore') {
    const previous = decisions[card.name]
    if (previous === 'add' && action !== 'add') setDeck((list) => list.filter((item) => item.name !== card.name))
    if (previous !== 'add' && action === 'add') setDeck((list) => [...list, { name: card.name, typeLine: card.typeLine, manaCost: card.manaCost, set: card.set, collectorNumber: card.collectorNumber, image: card.image, tags: card.tags, printings: card.printings, printing: card.printing ?? 0, printingManuallySelected: card.printingManuallySelected }])
    if (action === 'ignore') setLiked((current) => current.filter((name) => name !== card.name))
    setDecisions((current) => ({ ...current, [card.name]: action }))
  }

  async function cycleCommanderPrinting(commanderIndex: number) {
    if (!commanderDetails || commanderDetails.printings[commanderIndex].length < 2 || loadingArt) return
    const selection = (commanderDetails.selections[commanderIndex] + 1) % commanderDetails.printings[commanderIndex].length
    const selected = commanderDetails.printings[commanderIndex][selection]
    setLoadingArt(commanderNames(commander)[commanderIndex])
    await Promise.all([selected.image, selected.art].filter(Boolean).map((source) => new Promise<void>((resolve) => {
      const image = new Image()
      image.onload = image.onerror = () => resolve()
      image.src = source!
    })))
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
    setLoadingArt(card.name)
    await new Promise<void>((resolve) => {
      const image = new Image()
      image.onload = image.onerror = () => resolve()
      image.src = selected.image
    })
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
    setLoadingArt(card.name)
    await new Promise<void>((resolve) => {
      const image = new Image()
      image.onload = image.onerror = () => resolve()
      image.src = selected.image
    })
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

  function nextBatch(extraSubTheme = '') {
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
      <header><a className="brand" href="/">Commander's Table</a><button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>{darkMode ? '◐ Dark' : '☀ Light'}</button></header>
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
  const cardReason = (card: Card) => {
    const subTheme = card.tags.find((tag) => activeSubThemes.includes(tag))
    if (subTheme) return `${subTheme} sub-theme`
    if (theme && card.tags.includes(theme)) return `${theme} theme`
    const preference = card.tags.filter((tag) => (preferenceScores[tag] ?? 0) > 0).sort((a, b) => (preferenceScores[b] ?? 0) - (preferenceScores[a] ?? 0))[0]
    return preference ? `Matches your ${preference} picks` : card.reason
  }

  return (
    <main className={`${darkMode ? 'dark ' : ''}${commanderStyling ? 'commander-themed' : ''}`} style={{ '--commander-accent': primaryTheme[0], '--commander-highlight': secondaryTheme[1] } as CSSProperties}>
      {commanderStyling && commanderDetails?.art.length ? <div className="commander-backdrop" aria-hidden="true">{commanderDetails.art.map((image) => <span style={{ backgroundImage: `url(${image})` }} key={image} />)}</div> : null}
      <header>
        <button className="brand reset" onClick={() => { setCommander(''); setCommanderDetails(null); setDeck([]); setQueue([]); setDecisions({}) }}>Commander's Table</button>
        <div className="progress"><span />{deck.length} / 100 cards</div>
        <div className="header-actions"><button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>{darkMode ? '◐ Dark' : '☀ Light'}</button><button className="export" type="button" onClick={() => setShowExport(true)}>Export deck</button></div>
      </header>
      <section className="intro commander-header">
        {commanderDetails && <figure className={`commander-card ${commanderDetails.images.length > 1 ? 'pair' : ''}`} tabIndex={0} aria-label={`View ${commander} card${commanderDetails.images.length > 1 ? 's' : ''}`}>
          {commanderDetails.images.map((image, index) => <img src={image} alt={`${commanderNames(commander)[index]} card`} key={commanderNames(commander)[index]} />)}
          {commanderDetails.printings.some((printings) => printings.length > 1) && <span className="printing-indicator" aria-hidden="true">↻ Art</span>}
          <span className="card-zoom">{commanderDetails.images.map((image, index) => <span className="commander-printing" key={commanderNames(commander)[index]}><img src={image} alt={`${commanderNames(commander)[index]} full card`} />{loadingArt === commanderNames(commander)[index] && <span className="art-loading" role="status"><i />Loading art…</span>}{commanderDetails.printings[index].length > 1 && <button type="button" disabled={Boolean(loadingArt)} onClick={() => void cycleCommanderPrinting(index)} aria-label={`Show alternate printing of ${commanderNames(commander)[index]}`}>↻ Art {commanderDetails.selections[index] + 1}/{commanderDetails.printings[index].length}</button>}</span>)}</span>
        </figure>}
        <div className="commander-summary"><p className="eyebrow">Building around</p><h1>{commander}</h1>
          <div className="identity" aria-label={`Colour identity: ${commanderDetails?.colours.map((colour) => colourNames[colour]).join(', ') || 'loading'}`}>
            <span>Colour identity</span>
            {commanderDetails?.colours.length === 0 && <img className="colour" src="https://svgs.scryfall.io/card-symbols/C.svg" alt="Colourless" />}
            {commanderDetails?.colours.map((colour) => <img className="colour" src={`https://svgs.scryfall.io/card-symbols/${colour}.svg`} alt={colourNames[colour]} key={colour} />)}
          </div>
          <button className="change" onClick={() => { setCommander(''); setCommanderDetails(null); setDeck([]); setQueue([]); setDecisions({}) }}>Change commander</button>
        </div>
        <div className="recommendation-setup">
          <div className="section-title"><div><p className="eyebrow">Next pick</p><h2>Add to your deck</h2></div><span>{queue.length} suggestions left</span></div>
          <div className="recommendation-options">
            <label>Power target <select value={powerTarget} onChange={(event) => choosePowerTarget(event.target.value as PowerTarget)}><option value="precon">Precon / Core (Bracket 2)</option><option value="upgraded">Upgraded (Bracket 3)</option><option value="high">High power / Optimized (Bracket 4)</option></select></label>
            <label><input type="checkbox" checked={includeCreature} onChange={(event) => setIncludeCreature(event.target.checked)} /> Include a creature when possible</label>
            <label><input type="checkbox" checked={commanderStyling} onChange={(event) => setCommanderStyling(event.target.checked)} /> Commander art and colours</label>
            <fieldset><legend>Exclude from recommendations</legend>
              <label><input type="checkbox" checked={excludeGameChangers} onChange={(event) => setExcludeGameChangers(event.target.checked)} /> Exclude Game Changers</label>
              <label><input type="checkbox" checked={excludeTutors} onChange={(event) => setExcludeTutors(event.target.checked)} /> Exclude tutors</label>
              <label><input type="checkbox" checked={excludeExtraTurns} onChange={(event) => setExcludeExtraTurns(event.target.checked)} /> Exclude extra turns</label>
              <button type="button" onClick={() => void start(commander, true)}>Apply</button>
            </fieldset>
          </div>
        </div>
      </section>
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
              {activeSubThemes.length < 2 && <button className="add-subtheme" type="button" onClick={() => setShowSubThemePicker((current) => !current)}>+ Choose sub-theme</button>}
            </div>
            <div className="toolbar-actions">
              {synergyPair && <label className="connector-picker">Connector <select value={synergyConnector} onChange={(event) => setSynergyConnector(event.target.value as SynergyConnector)}><option value="bracket">Shared bracket</option><option value="bridge">Bridge label</option><option value="glow">Matched glow</option><option value="arrow">Directional arrow</option><option value="container">Shared container</option></select></label>}
              {(queue.length > 0 || deferredCards.length > 0) && recommendationState === 'idle' && <div className="batch-controls"><button className="primary" onClick={() => nextBatch()}>Next recommendations →</button></div>}
            </div>
          </div>
          {showSubThemePicker && <div className="subtheme-picker">
            <input value={subThemeSearch} onChange={(event) => setSubThemeSearch(event.target.value)} placeholder="Search sub-themes…" aria-label="Search sub-themes" />
            <div>{filteredSubThemes.slice(0, 8).map((name) => <button type="button" key={name} onClick={() => { setActiveSubThemes((current) => [...current, name].slice(0, 2)); setShowSubThemePicker(false); setSubThemeSearch('') }}>{name}</button>)}</div>
          </div>}
          {inferredSubTheme && <div className="subtheme-prompt"><span>Lean into <strong>{inferredSubTheme}</strong>?</span><div><button type="button" onClick={() => { setActiveSubThemes((current) => [...current, inferredSubTheme].slice(0, 2)); nextBatch(inferredSubTheme) }}>Yes, tune next picks</button><button className="quiet" type="button" onClick={() => setDismissedSubThemes((current) => [...current, inferredSubTheme])}>Not now</button></div></div>}
          {recommendationState === 'loading' ? <div className="empty"><h3>Loading suggestions…</h3></div> : recommendationState === 'error' ? <div className="empty"><h3>Suggestions unavailable</h3><p>Scryfall is busy. Try this commander again shortly.</p><button className="primary" onClick={() => void start(commander)}>Retry</button></div> : queue.length ? <div className={`card-grid connector-${synergyConnector}`}>
            {visibleBatch.map((card) => <article className={`card-offer ${decisions[card.name] ?? ''} ${pairCards.includes(card) ? `synergy-pair synergy-${pairCards.indexOf(card) + 1}` : ''}`} key={card.name}>
              <div className="offer-heading"><h3 className="suggestion-type">{cardReason(card)}{decisions[card.name] === 'add' ? ' · Added to deck' : decisions[card.name] === 'later' ? ' · Later' : decisions[card.name] === 'ignore' ? ' · Ignored' : ''}</h3>
              {pairCards.includes(card) && synergyPair && <span className="synergy-info"><button type="button" aria-describedby={`synergy-${card.name}`}>ⓘ Synergy</button><span className="synergy-popover" id={`synergy-${card.name}`} role="tooltip"><strong>{card.name} + {pairCards.find((item) => item !== card)?.name}</strong><span>{synergyPair.explanation}.</span></span></span>}</div>
              <div className="actions">
                <div><button className="primary" onClick={() => decide(card, 'add')}>Add</button><span className="action-help-wrap"><button onClick={() => decide(card, 'later')} aria-describedby={`later-${card.name}`}>Later</button><span className="action-help" id={`later-${card.name}`} role="tooltip">Skip for now. This card may return in a later batch.</span></span><span className="action-help-wrap"><button className="quiet" onClick={() => decide(card, 'ignore')} aria-describedby={`ignore-${card.name}`}>Ignore</button><span className="action-help" id={`ignore-${card.name}`} role="tooltip">Remove this card from all future recommendations.</span></span></div>
                <span className="similar-wrap"><button className={`similar ${liked.includes(card.name) ? 'selected' : ''}`} type="button" disabled={decisions[card.name] === 'ignore'} aria-pressed={liked.includes(card.name)} onClick={() => setLiked((current) => current.includes(card.name) ? current.filter((name) => name !== card.name) : [...current, card.name])} aria-label={`Find more cards like ${card.name}`} aria-describedby={`similar-${card.name}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg></button><span className="similar-help" id={`similar-${card.name}`} role="tooltip">Prioritise similar cards in future recommendations.</span></span>
              </div>
              <div className="offered-image"><img src={card.image} alt={`${card.name} card`} />{loadingArt === card.name && <span className="art-loading" role="status"><i />Loading art…</span>}{card.printings && card.printings.length > 1 && <button type="button" disabled={Boolean(loadingArt)} onClick={() => void cyclePrinting(card)} aria-label={`Show alternate printing of ${card.name}`}>↻ Art {(card.printing ?? 0) + 1}/{card.printings.length}</button>}</div>
              <div className="card-copy"><h3>{card.name}</h3><p><OracleText text={card.detail} /></p></div>
            </article>)}
          </div> : <div className="empty"><h3>{deferredCards.length ? 'Suggestions resting' : 'No more suggestions'}</h3><p>{deferredCards.length ? 'Advance recommendations to keep their waiting period, then bring them back.' : 'Review your deck or choose another commander.'}</p></div>}
        </section>
        <aside>
          <div className="deck-heading"><div><p className="eyebrow">Your deck</p><h2>{deck.length} cards</h2></div><span>{deck.length}%</span></div>
          <div className="meter"><span style={{ width: `${deck.length}%` }} /></div>
          <dl><div><dt>Commander</dt><dd>{commanderNames(commander).length}</dd></div><div><dt>Creatures</dt><dd>{deck.slice(commanderNames(commander).length).filter((card) => card.typeLine.includes('Creature')).length}</dd></div><div><dt>Enchantments</dt><dd>{deck.filter((card) => card.typeLine.includes('Enchantment')).length}</dd></div><div><dt>Lands</dt><dd>{deck.filter((card) => card.typeLine.includes('Land')).length}</dd></div></dl>
          <ol>{deck.map((card, index) => <li key={`${card.name}-${index}`} tabIndex={0}><span className="deck-card-name">{(card.printing ?? 0) > 0 && <span className="alternate-printing" title="Alternate printing selected" aria-label="Alternate printing selected" />}{card.name}</span><span className="deck-card-meta"><span className="deck-mana"><OracleText text={card.manaCost} /></span><b>{index < commanderNames(commander).length ? 'Commander' : card.typeLine.split(' — ')[0]}</b></span>{card.image && <span className="deck-card-popover"><img className="deck-card-preview" src={card.image} alt={`${card.name} card`} />{loadingArt === card.name && <span className="art-loading" role="status"><i />Loading art…</span>}{card.printings && card.printings.length > 1 && <button type="button" disabled={Boolean(loadingArt)} onClick={() => void cycleDeckPrinting(index)} aria-label={`Show alternate printing of ${card.name}`}>↻ Art {(card.printing ?? 0) + 1}/{card.printings.length}</button>}</span>}</li>)}</ol>
        </aside>
      </div>
    </main>
  )
}

export default App
