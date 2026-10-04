import { fetchScryfallCardsByIdentifiers, searchScryfallCached } from '../adapters/scryfall.ts'
import { themeCommanders, randomItems } from './commander-catalog.ts'
import { commanderConstructionError } from './commander-construction.ts'
import { toDeckCard, type ScryfallCard } from './card-model.ts'

export type DiscoveryFilters = { theme: string; colours: string[]; search: string }
export type CommanderSuggestion = { card: ScryfallCard; reason: string }

// Heuristic curation from live Oracle/type review, 2026-10-04; see docs/a2-a9-first-use-investigation.md.
// These expand the old lists only where the bounded thematic-query trial failed relevance/coverage.
export const discoveryAdditions: Record<string, string[]> = {
  Tokens: [
    'Mondrak, Glory Dominus',
    'Adeline, Resplendent Cathar',
    "Trostani, Selesnya's Voice",
    'Maja, Bretagard Protector',
  ],
  '+1/+1 counters': ['Rishkar, Peema Renegade', 'Bristly Bill, Spine Sower'],
  Enchantments: ['Pearl-Ear, Imperial Advisor', 'Sram, Senior Edificer'],
  Graveyard: ['Six', 'Emry, Lurker of the Loch'],
  Dragons: ['Ganax, Astral Hunter', 'Old Gnawbone'],
  Spellslinger: ['Talrand, Sky Summoner', 'Ashling, Flame Dancer'],
  Artifacts: ['Emry, Lurker of the Loch', 'Sai, Master Thopterist'],
  Lifegain: ['Vito, Thorn of the Dusk Rose', 'Dina, Soul Steeper'],
  Sacrifice: ['Yawgmoth, Thran Physician', 'Yahenni, Undying Partisan'],
  'Group hug': ['Kami of the Crescent Moon', 'Selvala, Explorer Returned'],
  Voltron: ['Halvar, God of Battle // Sword of the Realms', 'Sram, Senior Edificer'],
  'Big mana': ['Neheb, the Eternal', 'Urza, Lord High Artificer'],
  Blink: ['Thassa, Deep-Dwelling', 'Emiel the Blessed'],
  ETB: ['Thassa, Deep-Dwelling', 'Emiel the Blessed'],
  'Death triggers': ['Syr Konrad, the Grim', 'Elenda, the Dusk Rose'],
  Wither: ['The Reaper, King No More', 'Auntie Ool, Cursewretch'],
  Political: ['Gluntch, the Bestower', 'Selvala, Explorer Returned'],
  Vampires: ['Vito, Thorn of the Dusk Rose', 'Yahenni, Undying Partisan'],
  Angels: ['Lyra Dawnbringer', 'Avacyn, Angel of Hope'],
  Demons: ['Kardur, Doomscourge', 'Valgavoth, Harrower of Souls'],
  Faeries: ['Oona, Queen of the Fae', 'Maralen, Fae Ascendant'],
  Vehicles: ['Sram, Senior Edificer', 'Cid, Freeflier Pilot'],
  Indestructible: ['Heliod, Sun-Crowned', 'Xenagos, God of Revels'],
  Mill: ['The Mindskinner', 'Syr Konrad, the Grim'],
  Zombies: ['Zul Ashur, Lich Lord', 'Ratadrabik of Urborg'],
  Elves: ['Rishkar, Peema Renegade', 'Arwen, Weaver of Hope'],
  Goblins: ['General Kreat, the Boltbringer', 'Pashalik Mons'],
  Dinosaurs: ['Etali, Primal Storm', 'Ghalta, Primal Hunger'],
  Merfolk: ['Thrasios, Triton Hero', 'Vorel of the Hull Clade'],
  Knights: [
    'Adeline, Resplendent Cathar',
    "Dion, Bahamut's Dominant // Bahamut, Warden of Light",
    'Danitha Capashen, Paragon',
  ],
  Spirits: ['Kodama of the East Tree', 'Brago, King Eternal'],
  Slivers: ['Sliver Queen'],
}

// Heuristic query relevance passed the live top-12 review for these three themes.
// Other broad queries matched removal, prevention, back faces, or unrelated recursion.
export const discoveryQueries: Record<string, string> = {
  Equipment: 'o:equipment',
  Landfall: 'o:landfall',
  Goad: 'o:goad',
}

export function discoveryNames(theme: string) {
  return [...new Set([...(themeCommanders[theme] ?? []), ...(discoveryAdditions[theme] ?? [])])]
}

export function filterCommanders(cards: ScryfallCard[], filters: DiscoveryFilters) {
  const identity = [...filters.colours].sort().join('')
  const search = filters.search.trim().toLowerCase()
  const seen = new Set<string>()
  return cards.filter((card) => {
    const key = card.oracle_id ?? card.name
    if (seen.has(key) || commanderConstructionError([toDeckCard(card)])) return false
    if (identity && [...card.color_identity].sort().join('') !== identity) return false
    if (search.length >= 2 && !card.name.toLowerCase().includes(search)) return false
    seen.add(key)
    return true
  })
}

export async function discoverCommanders(
  filters: DiscoveryFilters,
  signal?: AbortSignal,
  providers = { search: searchScryfallCached, hydrate: fetchScryfallCardsByIdentifiers },
): Promise<CommanderSuggestion[]> {
  const term = discoveryQueries[filters.theme]
  const curated = filters.theme && !term
  const identity = filters.colours.length
    ? `id=${[...filters.colours].sort().join('').toLowerCase()}`
    : ''
  const name =
    filters.search.trim().length >= 2 ? `name:${JSON.stringify(filters.search.trim())}` : ''
  const cards = curated
    ? await providers.hydrate(
        discoveryNames(filters.theme).map((name) => ({ name })),
        fetch,
        signal,
      )
    : await providers.search(
        `is:commander legal:commander date<=today ${identity} ${name} ${term ? `(${term})` : ''}`.trim(),
        fetch,
        signal,
        'edhrec',
      )
  signal?.throwIfAborted()
  const reason = curated
    ? `Curated for ${filters.theme}`
    : term
      ? `Oracle text matches ${filters.theme}`
      : 'Scryfall commander search'
  return filterCommanders(cards, filters).map((card) => ({ card, reason }))
}

export function shuffleCommanders(cards: CommanderSuggestion[]) {
  return randomItems(cards, Math.min(12, cards.length))
}
