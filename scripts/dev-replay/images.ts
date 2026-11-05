import { createHash } from 'node:crypto'

type ImageInfo = { name: string; cost: string; identity: string[]; printing: string }
const colours: Record<string, string> = {
  W: '#e7d99b',
  U: '#73afd1',
  B: '#8b7d96',
  R: '#da856f',
  G: '#80ae88',
}
const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export function imageCatalog() {
  const images = new Map<string, ImageInfo>()
  function remember(value: unknown) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(remember)
      return
    }
    const card = value as Record<string, unknown>
    if (typeof card.name === 'string' && card.image_uris) {
      const identity = Array.isArray(card.color_identity) ? card.color_identity.map(String) : []
      for (const image of Object.values(card.image_uris)) {
        if (typeof image === 'string')
          images.set(image, {
            name: card.name.slice(0, 300),
            cost: String(card.mana_cost ?? ''),
            identity,
            printing: `${card.set ?? ''} ${card.collector_number ?? ''}`.trim(),
          })
      }
    }
    // Faces inherit identity/printing metadata, while keeping their own name and mana cost.
    if (Array.isArray(card.card_faces))
      card.card_faces.forEach((face) =>
        remember({
          ...card,
          card_faces: undefined,
          image_uris: undefined,
          ...face,
        }),
      )
    if (Array.isArray(card.data)) remember(card.data)
    if (Array.isArray(card.cards)) remember(card.cards)
  }
  return {
    remember,
    svg(url: URL) {
      const info = images.get(url.href)
      const name = info?.name ?? url.searchParams.get('exact') ?? 'Development card'
      const seed = createHash('sha256').update(url.href).digest('hex')
      const art = /\/(art_crop|art)\//.test(url.pathname)
      const width = art ? 626 : 488,
        height = art ? 457 : 680
      const bands = (info?.identity.length ? info.identity : ['C'])
        .map(
          (c, i, all) =>
            `<rect x="${(i * width) / all.length}" width="${width / all.length}" height="${height}" fill="${colours[c] ?? '#aaa59b'}"/>`,
        )
        .join('')
      const lines = name.match(/.{1,26}(?:\s|$)|.{1,26}/g)?.slice(0, 3) ?? [name]
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${bands}<rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="16" fill="#20262b"/>
        <path d="M35 240 L${width - 35} 100 L${width / 2} ${height - 90} Z" fill="#${seed.slice(0, 6)}"/>
        <g fill="#fff" font-family="sans-serif" font-size="25">${lines.map((line, i) => `<text x="34" y="${65 + i * 32}">${escape(line)}</text>`).join('')}
        <text x="34" y="${height - 140}">${escape((info?.cost ?? '').slice(0, 70))}</text>
        <text x="34" y="${height - 95}" font-size="20">${escape(info?.printing ?? '')} · ${url.pathname.includes('/back/') ? 'Back' : 'Front'}</text>
        <text x="34" y="${height - 48}" font-size="18">DEV PLACEHOLDER · ${seed.slice(0, 8)}</text></g></svg>`
    },
  }
}
