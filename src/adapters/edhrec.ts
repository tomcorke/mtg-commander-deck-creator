import type { EdhrecThemeCount } from '../recommendations.ts'

export type EdhrecCardList = {
  header: string
  tag: string
  cardviews: { name: string }[]
}

export type EdhrecCommanderPage = {
  tag_counts?: EdhrecThemeCount[]
  container?: {
    json_dict?: {
      cardlists?: EdhrecCardList[]
    }
  }
}

export async function fetchEdhrecCommander(
  slug: string,
  fetcher: typeof fetch = fetch,
): Promise<EdhrecCommanderPage> {
  const response = await fetcher(`https://json.edhrec.com/pages/commanders/${slug}.json`)
  if (!response.ok) throw new Error('EDHREC unavailable')
  return (await response.json()) as EdhrecCommanderPage
}
