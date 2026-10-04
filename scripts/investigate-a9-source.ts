import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { searchScryfall } from '../src/adapters/scryfall.ts'
import { selectableThemes, themeSearchTerms } from '../src/domain/commander-catalog.ts'
import { toDeckCard } from '../src/domain/card-model.ts'
import { commanderConstructionError } from '../src/domain/commander-construction.ts'

// Investigation only: text/type matches are evidence to review, not relevance verdicts.
const missingTerms: Record<string, string> = {
  'Group hug': 'o:"each player"',
  Wither: '(o:wither or o:"-1/-1 counter")',
  Vehicles: '(t:vehicle or o:vehicle)',
  Indestructible: 'o:indestructible',
  Mill: 'o:mill',
  Vampires: 't:vampire',
  Angels: 't:angel',
  Demons: 't:demon',
  Faeries: 't:faerie',
  Zombies: 't:zombie',
  Elves: 't:elf',
  Goblins: 't:goblin',
  Dinosaurs: 't:dinosaur',
  Merfolk: 't:merfolk',
  Knights: 't:knight',
  Spirits: 't:spirit',
  Slivers: 't:sliver',
}
const fetcher: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    headers: { ...init?.headers, 'User-Agent': 'CommanderCreator-A9-source-investigation/1.0' },
  })
const records = []
for (const theme of selectableThemes) {
  const term = themeSearchTerms[theme] ?? missingTerms[theme]
  if (!term) throw new Error(`No investigation query for ${theme}`)
  const query = `is:commander legal:commander date<=today (${term})`
  const cards = await searchScryfall(query, fetcher, undefined, 'edhrec')
  const sample = cards.slice(0, 12).map((card) => ({
    name: card.name,
    identity: card.color_identity,
    type: card.type_line,
    oracle: card.oracle_text ?? card.card_faces?.map((face) => face.oracle_text).join('\n'),
    error: commanderConstructionError([toDeckCard(card)]),
    image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal,
  }))
  records.push({ theme, query, fetched: cards.length, sample })
  console.log(
    `${theme}: ${sample.length} sampled, ${sample.filter(({ error }) => error).length} rejected`,
  )
}
const path = process.argv[2] ?? join(tmpdir(), 'a9-source-investigation.json')
await writeFile(path, JSON.stringify({ checkedAt: new Date().toISOString(), records }, null, 2))
console.log(path)
