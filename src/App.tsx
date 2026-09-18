import { useEffect, useState } from 'react'
import './App.css'

type Printing = { image: string; set: string; collectorNumber: string }
type Card = { name: string; typeLine: string; manaCost: string; reason: string; detail: string; image: string; set: string; collectorNumber: string; printsUri: string; printings?: Printing[]; printing?: number }
type DeckCard = { name: string; typeLine: string; manaCost: string; set: string; collectorNumber: string }
type CommanderDetails = { images: string[]; colours: string[] }
type ExportFormat = 'moxfield' | 'plain' | 'csv'

const colourNames: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }

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
const randomItems = <T,>(items: T[], count: number) => [...items].sort(() => Math.random() - 0.5).slice(0, count)
const randomThree = (items: string[]) => randomItems(items, 3)

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
  const [visibleThemes, setVisibleThemes] = useState(() => randomItems(Object.keys(themeCommanders), 6))
  const [colours, setColours] = useState<string[]>([])
  const [matches, setMatches] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState(() => randomThree(defaultCommanders))
  const [suggestionPool, setSuggestionPool] = useState(defaultCommanders)
  const [commanderCosts, setCommanderCosts] = useState<Record<string, string>>({})
  const [commanderImages, setCommanderImages] = useState<Record<string, string[]>>({})
  const [queue, setQueue] = useState<Card[]>([])
  const [recommendationState, setRecommendationState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [includeCreature, setIncludeCreature] = useState(true)
  const [excludeGameChangers, setExcludeGameChangers] = useState(true)
  const [excludeTutors, setExcludeTutors] = useState(true)
  const [excludeExtraTurns, setExcludeExtraTurns] = useState(true)
  const [decisions, setDecisions] = useState<Record<string, 'add' | 'later' | 'ignore'>>({})
  const [liked, setLiked] = useState<string[]>([])
  const [deck, setDeck] = useState<DeckCard[]>([])
  const [showExport, setShowExport] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('moxfield')
  const [copied, setCopied] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light')

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

  async function start(name: string, preserveDeck = false) {
    const chosen = name.trim()
    if (!chosen) return
    setCommander(chosen)
    if (!preserveDeck) setDeck([])
    setCommanderDetails(null)
    setQueue([])
    setRecommendationState('loading')

    const responses = await Promise.all(commanderNames(chosen).map((name) => fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`)))
    if (responses.some((response) => !response.ok)) { setRecommendationState('error'); return }
    type CommanderCard = { name: string; color_identity: string[]; mana_cost?: string; set: string; collector_number: string; image_uris?: { normal: string }; card_faces?: { mana_cost?: string; image_uris?: { normal: string } }[] }
    const commanders = await Promise.all(responses.map((response) => response.json() as Promise<CommanderCard>))
    const images = commanders.flatMap((card) => card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? [])
    const identityColours = [...new Set(commanders.flatMap((card) => card.color_identity))]
    if (images.length) setCommanderDetails({ images, colours: identityColours })
    if (!preserveDeck) setDeck(commanders.map((card) => ({ name: card.name, typeLine: 'Legendary Creature', manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '', set: card.set, collectorNumber: card.collector_number })))

    const identity = identityColours.join('').toLowerCase() || 'c'
    const bracketFilters = [excludeGameChangers && '-is:gamechanger', excludeTutors && '-otag:tutor', excludeExtraTurns && '-otag:extra-turn'].filter(Boolean).join(' ')
    const baseQuery = `id<=${identity} legal:commander -is:commander ${bracketFilters}`
    const mainResponse = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${baseQuery} -t:land -o:"add {"`)}&order=edhrec`)
    const manaResponse = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${baseQuery} (t:land or o:"add {")`)}&order=edhrec`)
    if (!mainResponse.ok || !manaResponse.ok) { setRecommendationState('error'); return }
    type ScryfallCard = { name: string; type_line: string; mana_cost?: string; oracle_text?: string; color_identity: string[]; set: string; collector_number: string; prints_search_uri: string; image_uris?: { normal: string }; card_faces?: { mana_cost?: string; image_uris?: { normal: string } }[] }
    const main = await mainResponse.json() as { data: ScryfallCard[] }
    const mana = await manaResponse.json() as { data: ScryfallCard[] }
    const mainCards = main.data.sort(() => Math.random() - 0.5)
    const manaCards = mana.data.sort(() => Math.random() - 0.5)
    const creatures = mainCards.filter((item) => item.type_line.includes('Creature'))
    const others = mainCards.filter((item) => !item.type_line.includes('Creature'))
    const batchCount = Math.min(Math.ceil(mainCards.length / 3), manaCards.length)
    const picks = Array.from({ length: batchCount }, (_, index) => {
      const creature = creatures[index]
      const pool = includeCreature && creature ? others : mainCards
      const mainPicks = includeCreature && creature ? [creature, ...pool.slice(index * 2, index * 2 + 2)] : pool.slice(index * 3, index * 3 + 3)
      return [...mainPicks, manaCards[index]]
    }).flat()
    const offeredCards = picks.map((item, index) => ({
      name: item.name,
      typeLine: item.type_line,
      manaCost: item.mana_cost ?? item.card_faces?.[0]?.mana_cost ?? '',
      reason: index % 4 === 3 ? 'Land or mana' : item.color_identity.length === identityColours.length ? 'Strong colour fit' : item.color_identity.length === 0 ? 'Colourless utility' : 'Popular inclusion',
      detail: item.oracle_text || item.type_line,
      image: item.image_uris?.normal ?? item.card_faces?.[0]?.image_uris?.normal ?? '',
      set: item.set,
      collectorNumber: item.collector_number,
      printsUri: item.prints_search_uri,
    }))
    setQueue(offeredCards)
    setRecommendationState('idle')
    for (const offered of offeredCards.slice(0, 4)) {
      await new Promise((resolve) => setTimeout(resolve, 150))
      const printResponse = await fetch(offered.printsUri)
      if (!printResponse.ok) continue
      const printResult = await printResponse.json() as { data: ScryfallCard[] }
      const printings = printResult.data.flatMap((printing) => {
        const image = printing.image_uris?.normal ?? printing.card_faces?.[0]?.image_uris?.normal
        return image ? [{ image, set: printing.set, collectorNumber: printing.collector_number }] : []
      }).filter((printing, index, all) => all.findIndex((item) => item.image === printing.image) === index)
      setQueue((current) => current.map((item) => item.name === offered.name ? { ...item, printings } : item))
    }
  }

  function decide(card: Card, action: 'add' | 'later' | 'ignore') {
    const previous = decisions[card.name]
    if (previous === 'add' && action !== 'add') setDeck((list) => list.filter((item) => item.name !== card.name))
    if (previous !== 'add' && action === 'add') setDeck((list) => [...list, { name: card.name, typeLine: card.typeLine, manaCost: card.manaCost, set: card.set, collectorNumber: card.collectorNumber }])
    setDecisions((current) => ({ ...current, [card.name]: action }))
  }

  function cyclePrinting(card: Card) {
    if (!card.printings || card.printings.length < 2) return
    const index = ((card.printing ?? 0) + 1) % card.printings.length
    const selected = card.printings[index]
    setQueue((current) => current.map((item) => item.name === card.name ? { ...item, printing: index, image: selected.image, set: selected.set, collectorNumber: selected.collectorNumber } : item))
    if (decisions[card.name] === 'add') setDeck((current) => current.map((item) => item.name === card.name ? { ...item, set: selected.set, collectorNumber: selected.collectorNumber } : item))
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

  function nextBatch() {
    const batch = queue.slice(0, 4)
    const deferred = batch.filter((card) => decisions[card.name] !== 'add' && decisions[card.name] !== 'ignore')
    const remaining = queue.slice(4)
    const mana = remaining.filter((card) => card.reason === 'Land or mana')
    const main = remaining.filter((card) => card.reason !== 'Land or mana')
    const creatures = main.filter((card) => card.typeLine.includes('Creature'))
    const others = main.filter((card) => !card.typeLine.includes('Creature'))
    const batches = mana.flatMap((manaCard, index) => {
      const creature = creatures[index]
      const pool = includeCreature && creature ? others.slice(index * 2, index * 2 + 2) : main.slice(index * 3, index * 3 + 3)
      return [...(includeCreature && creature ? [creature, ...pool] : pool), manaCard]
    })
    setQueue([...batches, ...deferred])
    setDecisions({})
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
            <button className="reroll" type="button" onClick={() => { setTheme(''); setVisibleThemes(randomItems(Object.keys(themeCommanders), 6)) }}>↻ Show different themes</button>
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

  return (
    <main className={darkMode ? 'dark' : ''}>
      <header>
        <button className="brand reset" onClick={() => { setCommander(''); setCommanderDetails(null); setDeck([]); setQueue([]); setDecisions({}) }}>Commander's Table</button>
        <div className="progress"><span />{deck.length} / 100 cards</div>
        <div className="header-actions"><button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>{darkMode ? '◐ Dark' : '☀ Light'}</button><button className="export" type="button" onClick={() => setShowExport(true)}>Export deck</button></div>
      </header>
      <section className="intro commander-header">
        {commanderDetails && <figure className={`commander-card ${commanderDetails.images.length > 1 ? 'pair' : ''}`} tabIndex={0} aria-label={`View ${commander} card${commanderDetails.images.length > 1 ? 's' : ''}`}>
          {commanderDetails.images.map((image, index) => <img src={image} alt={`${commanderNames(commander)[index]} card`} key={image} />)}
          <span className="card-zoom">{commanderDetails.images.map((image, index) => <img src={image} alt={`${commanderNames(commander)[index]} full card`} key={image} />)}</span>
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
            <label><input type="checkbox" checked={includeCreature} onChange={(event) => setIncludeCreature(event.target.checked)} /> Include a creature when possible</label>
            <fieldset><legend>Bracket safety</legend>
              <label><input type="checkbox" checked={excludeGameChangers} onChange={(event) => setExcludeGameChangers(event.target.checked)} /> Game Changers</label>
              <label><input type="checkbox" checked={excludeTutors} onChange={(event) => setExcludeTutors(event.target.checked)} /> Tutors</label>
              <label><input type="checkbox" checked={excludeExtraTurns} onChange={(event) => setExcludeExtraTurns(event.target.checked)} /> Extra turns</label>
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
          {queue.length > 0 && recommendationState === 'idle' && <div className="batch-controls"><button className="primary" onClick={nextBatch}>Next recommendations →</button></div>}
          {recommendationState === 'loading' ? <div className="empty"><h3>Loading suggestions…</h3></div> : recommendationState === 'error' ? <div className="empty"><h3>Suggestions unavailable</h3><p>Scryfall is busy. Try this commander again shortly.</p><button className="primary" onClick={() => void start(commander)}>Retry</button></div> : queue.length ? <div className="card-grid">
            {queue.slice(0, 4).map((card) => <article className={`card-offer ${decisions[card.name] ?? ''}`} key={card.name}>
              <h3 className="suggestion-type">{card.reason}{decisions[card.name] === 'add' ? ' · Accepted' : decisions[card.name] === 'later' ? ' · Later' : decisions[card.name] === 'ignore' ? ' · Ignored' : ''}</h3>
              <div className="actions">
                <div><button className="primary" onClick={() => decide(card, 'add')}>Add</button><span className="action-help-wrap"><button onClick={() => decide(card, 'later')} aria-describedby={`later-${card.name}`}>Later</button><span className="action-help" id={`later-${card.name}`} role="tooltip">Skip for now. This card may return in a later batch.</span></span><span className="action-help-wrap"><button className="quiet" onClick={() => decide(card, 'ignore')} aria-describedby={`ignore-${card.name}`}>Ignore</button><span className="action-help" id={`ignore-${card.name}`} role="tooltip">Remove this card from all future recommendations.</span></span></div>
                <span className="similar-wrap"><button className={`similar ${liked.includes(card.name) ? 'selected' : ''}`} type="button" aria-pressed={liked.includes(card.name)} onClick={() => setLiked((current) => current.includes(card.name) ? current.filter((name) => name !== card.name) : [...current, card.name])} aria-label={`Find more cards like ${card.name}`} aria-describedby={`similar-${card.name}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg></button><span className="similar-help" id={`similar-${card.name}`} role="tooltip">Prioritise similar cards in future recommendations.</span></span>
              </div>
              <div className="offered-image"><img src={card.image} alt={`${card.name} card`} />{card.printings && card.printings.length > 1 && <button type="button" onClick={() => cyclePrinting(card)} aria-label={`Show alternate printing of ${card.name}`}>↻ Art {(card.printing ?? 0) + 1}/{card.printings.length}</button>}</div>
              <div className="card-copy"><h3>{card.name}</h3><p><OracleText text={card.detail} /></p></div>
            </article>)}
          </div> : <div className="empty"><h3>No more suggestions</h3><p>Review your deck or choose another commander.</p></div>}
        </section>
        <aside>
          <div className="deck-heading"><div><p className="eyebrow">Your deck</p><h2>{deck.length} cards</h2></div><span>{deck.length}%</span></div>
          <div className="meter"><span style={{ width: `${deck.length}%` }} /></div>
          <dl><div><dt>Commander</dt><dd>{commanderNames(commander).length}</dd></div><div><dt>Creatures</dt><dd>{deck.slice(commanderNames(commander).length).filter((card) => card.typeLine.includes('Creature')).length}</dd></div><div><dt>Enchantments</dt><dd>{deck.filter((card) => card.typeLine.includes('Enchantment')).length}</dd></div><div><dt>Lands</dt><dd>{deck.filter((card) => card.typeLine.includes('Land')).length}</dd></div></dl>
          <ol>{deck.map((card, index) => <li key={`${card.name}-${index}`}><span>{card.name}</span><span className="deck-card-meta"><span className="deck-mana"><OracleText text={card.manaCost} /></span><b>{index === 0 ? 'Commander' : card.typeLine.split(' — ')[0]}</b></span></li>)}</ol>
        </aside>
      </div>
    </main>
  )
}

export default App
