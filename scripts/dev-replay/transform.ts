const imageAssignments: Record<string, [string, string][]> = {
  'app/deck-actions.ts': [['image.src = source!', 'image.src = resourceUrl(source!)']],
  'shared/foil/hover-foil.ts': [['image.src = url', 'image.src = resourceUrl(url)']],
  'dev/FlipPreview.tsx': [['image.src = src', 'image.src = resourceUrl(src)']],
  'dev/FoilStage.tsx': [['loader.src = image', 'loader.src = resourceUrl(image)']],
  'dev/FoilSheet.tsx': [['loader.src = image', 'loader.src = resourceUrl(image)']],
  'features/builder/reveal-batch.ts': [
    ['image.src = backUrl', 'image.src = resourceUrl(backUrl)'],
    ['JSON.stringify(previous[index].image)', 'JSON.stringify(resourceUrl(previous[index].image))'],
  ],
  'adapters/scryfall.ts': [['fetcher(input, {', 'fetcher(resourceUrl(input), {']],
  'adapters/edhrec.ts': [
    [
      'fetcher(`https://json.edhrec.com/pages/${kind}/${slug}.json`, {',
      'fetcher(resourceUrl(`https://json.edhrec.com/pages/${kind}/${slug}.json`), {',
    ],
  ],
}

/** Known network boundaries only. Builds never install this transform. */
export function replayTransform(code: string, path: string) {
  let result = code.replace(/\bsrc=\{([^{}\n]+)\}/g, 'src={resourceUrl($1)}')
  result = result.replace(/(?<![.\w])fetch\(/g, 'replayFetch(')
  for (const [before, after] of imageAssignments[path] ?? []) {
    if (!result.includes(before)) throw new Error(`Replay boundary changed: ${path}: ${before}`)
    result = result.replaceAll(before, after)
  }
  if (path === 'features/builder/BuilderView.tsx' || path === 'features/builder/DeckDoctorView.tsx')
    result = result.replaceAll('url(${image})', 'url(${resourceUrl(image)})')
  return result === code
    ? undefined
    : `import { resourceUrl, replayFetch } from '/scripts/dev-replay/browser.ts'\n${result}`
}
