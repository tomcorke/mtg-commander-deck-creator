// Throwaway: traces the glass shards of the 13 FRA Shattered Mirror facet foil cards (#449-461) as
// polygons for src/shared/foil/facet-shards.ts. Each facet scan is diffed against its nonfoil twin
// (#321-333, the same art without the foil restyling), thresholded, cleaned up morphologically,
// split into connected regions, and each region's outline is simplified (Douglas-Peucker).
// Writes the polygons as JSON and an outline overlay per card for checking by eye.
// Usage: node --experimental-strip-types scripts/trace-facet-shards.ts <out-dir>
/* eslint-disable max-lines-per-function, sonarjs/cognitive-complexity, max-depth -- one-off
   image-processing script, kept for the record rather than maintained. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const outDir = process.argv[2] ?? 'facet-trace'
mkdirSync(outDir, { recursive: true })

async function imageUrl(number: number) {
  const response = await fetch(`https://api.scryfall.com/cards/fra/${number}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'mtg-commander-deck-creator/dev' },
  })
  const card = (await response.json()) as { image_uris: { normal: string } }
  return card.image_uris.normal
}

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const page = await browser.newPage()
// Hand-drawn exclusions per card, as flat x,y lists in card coordinates, found by eye on the
// overlays: background the facet scan repaints (Curse-Marred Demon's darkened backdrop,
// Omnipresence's brightened sky between shards).
const exclusions: Record<number, number[][]> = {
  459: [
    [0.92, 0.5, 1, 0.5, 1, 0.9, 0.92, 0.9],
    [0.48, 0.46, 0.6, 0.46, 0.6, 0.53, 0.48, 0.53],
    ...[
      [0.04, 0.14],
      [0.27, 0.36],
      [0.5, 0.55],
      [0.66, 0.71],
      [0.8, 0.96],
    ].map(([x0, x1]) => [x0, 0.04, x1, 0.04, x1, 0.11, x0, 0.11]),
  ],
}
// Per-card colour gates (an expression in the facet scan's r, g, b, 0-255): only pixels passing
// count. Omnipresence's sky is repainted brighter, but its shards are all bluer than the sky.
const gates: Record<number, string> = {
  456: 'r > 150 && r > g + 70 && r > b + 70',
  459: 'b > r + 15 && b > g - 25 && g + b > 170',
  457: 'g > r + 5 && b > r + 15',
}
// Cards whose gate alone finds the shards better than the diff (Omnipresence's chrome barely
// differs from its plain twin in places).
const colourOnly = new Set([456, 457, 459])
const result: Record<string, number[][][]> = {}
const overlays: string[] = []

for (let number = 449; number <= 461; number++) {
  const [facet, plain] = [await imageUrl(number), await imageUrl(number - 128)]
  const traced = await page.evaluate(
    async ([facetUrl, plainUrl, radius, threshold, suppress, cut, gate, colourOnly]) => {
      const keepPixel = new Function('r', 'g', 'b', `return ${gate}`) as (
        r: number,
        g: number,
        b: number,
      ) => boolean
      const W = 488
      const H = 680
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.crossOrigin = 'anonymous'
          image.onload = () => resolve(image)
          image.onerror = reject
          image.src = src
        })
      const pixels = (image: HTMLImageElement, dx = 0, dy = 0, s = 1) => {
        const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H })
        const context = canvas.getContext('2d')!
        context.filter = 'blur(1.5px)'
        context.drawImage(image, dx + (W * (1 - s)) / 2, dy + (H * (1 - s)) / 2, W * s, H * s)
        return context.getImageData(0, 0, W, H).data
      }
      const facetImage = await load(facetUrl)
      const plainImage = await load(plainUrl)
      const a = pixels(facetImage)
      // The scans are a few pixels out of register: shift and scale the nonfoil scan to fit best.
      let fit = { error: Infinity, dx: 0, dy: 0, s: 1 }
      for (let s = 0.98; s <= 1.0201; s += 0.005)
        for (let dy = -6; dy <= 6; dy += 1)
          for (let dx = -6; dx <= 6; dx += 1) {
            const candidate = pixels(plainImage, dx, dy, s)
            let error = 0
            for (let at = 0; at < a.length; at += 4 * 7)
              error += Math.abs(a[at + 1] - candidate[at + 1])
            if (error < fit.error) fit = { error, dx, dy, s }
          }
      const b = pixels(plainImage, fit.dx, fit.dy, fit.s)

      // A pixel differs when the summed RGB difference is large; neutral-grey differences count
      // less, since the scans differ slightly in frame and text rendering.
      // The facet scans are graded differently, so first map the nonfoil scan onto the facet scan
      // per channel with a least-squares line. Shards change a lot, so fit over the whole card,
      // then refit on the three quarters of the pixels that differ least.
      let keep = new Uint8Array(W * H).fill(1)
      let fitted = b
      for (let pass = 0; pass < 2; pass++) {
        fitted = new Uint8ClampedArray(b)
        for (let c = 0; c < 3; c++) {
          let [n, sx, sy, sxx, sxy] = [0, 0, 0, 0, 0]
          for (let i = 0; i < W * H; i++) {
            if (!keep[i]) continue
            const [x, y] = [b[i * 4 + c], a[i * 4 + c]]
            n++
            sx += x
            sy += y
            sxx += x * x
            sxy += x * y
          }
          const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
          const offset = (sy - slope * sx) / n
          for (let at = c; at < b.length; at += 4) fitted[at] = slope * b[at] + offset
        }
        const error = new Float32Array(W * H)
        for (let i = 0; i < W * H; i++)
          for (let c = 0; c < 3; c++) error[i] += Math.abs(a[i * 4 + c] - fitted[i * 4 + c])
        const cut = Float32Array.from(error).sort()[Math.floor(W * H * 0.75)]
        keep = keep.map((_, i) => (error[i] <= cut ? 1 : 0))
      }
      b.set(fitted)
      let mask = new Uint8Array(W * H)
      const heat = new ImageData(W, H)
      const energy = new Float32Array(W * H)
      for (let i = 0; i < W * H; i++) {
        const at = i * 4
        const sat = (p: Uint8ClampedArray) =>
          (Math.max(p[at], p[at + 1], p[at + 2]) - Math.min(p[at], p[at + 1], p[at + 2])) / 255
        const y = Math.floor(i / W) / H
        const inFrame = y < 0.1 || y > 0.56 ? 1 : 0
        // In the title bar and text box the twins reflow their rules text, so differences where
        // either scan shows white text count less. Dark box and shard chrome still count.
        const whiteInk = (p: Uint8ClampedArray) =>
          sat(p) < 0.2 && p[at] + p[at + 1] + p[at + 2] > 0.7 * 765
        const neutral = whiteInk(a) || whiteInk(b) ? 1 : 0
        const d =
          (Math.abs(a[at] - b[at]) +
            Math.abs(a[at + 1] - b[at + 1]) +
            Math.abs(a[at + 2] - b[at + 2])) *
          (1 - suppress * neutral * inFrame)
        energy[i] = keepPixel(a[at], a[at + 1], a[at + 2]) ? (colourOnly ? 255 : d) : 0
        heat.data[at] = heat.data[at + 1] = heat.data[at + 2] = Math.min(255, d)
        heat.data[at + 3] = 255
      }
      const heatCanvas = Object.assign(document.createElement('canvas'), { width: W, height: H })
      heatCanvas.getContext('2d')!.putImageData(heat, 0, 0)
      const morph = (source: Uint8Array, radius: number, grow: boolean) => {
        const out = new Uint8Array(W * H)
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            let hit = !grow
            for (let dy = -radius; dy <= radius && hit !== grow; dy++)
              for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy > radius * radius) continue
                const [nx, ny] = [x + dx, y + dy]
                const v = nx < 0 || ny < 0 || nx >= W || ny >= H ? 0 : source[ny * W + nx]
                if (grow ? v : !v) {
                  hit = grow
                  break
                }
              }
            out[y * W + x] = hit ? 1 : 0
          }
        return out
      }
      // Shards differ in a pattern of bright and dark bands, so threshold the local mean difference.
      const R = radius
      const T = threshold
      const local = new Float32Array(W * H)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          let [sum, n] = [0, 0]
          for (let dy = -R; dy <= R; dy++)
            for (let dx = -R; dx <= R; dx++) {
              const [nx, ny] = [x + dx, y + dy]
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
              sum += energy[ny * W + nx]
              n++
            }
          local[y * W + x] = sum / n
        }
      // The art threshold is stricter: some cards' art is subtly repainted (Craterclaw's sky gets
      // pale hexagons), while chrome over the dark text box differs less from the plain shards.
      for (let i = 0; i < W * H; i++)
        mask[i] = local[i] > (i / W / H < 0.56 ? T + 15 : T - 5) ? 1 : 0
      // Open (drop thin text and edge differences), then close (bridge gaps inside shards).
      const raw = mask.reduce((s, v) => s + v, 0)
      mask = morph(morph(mask, 5, false), 5, true)
      mask = morph(morph(mask, 5, true), 5, false)

      // Hand-drawn exclusions (art the facet scan repaints that is not shard).
      if (cut.length) {
        const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H })
        const context = canvas.getContext('2d')!
        for (const polygon of cut) {
          context.beginPath()
          for (let k = 0; k < polygon.length; k += 2)
            context.lineTo(polygon[k] * W, polygon[k + 1] * H)
          context.fill()
        }
        const alpha = context.getImageData(0, 0, W, H).data
        for (let i = 0; i < W * H; i++) if (alpha[i * 4 + 3] > 127) mask[i] = 0
      }

      // Connected regions of the mask, and of the background (holes are background regions that
      // don't touch the card edge).
      const components = (on: (i: number) => boolean) => {
        const label = new Int32Array(W * H)
        const groups: number[][] = []
        for (let start = 0; start < W * H; start++) {
          if (!on(start) || label[start]) continue
          const id = groups.length + 1
          const stack = [start]
          const members: number[] = []
          label[start] = id
          while (stack.length) {
            const i = stack.pop()!
            members.push(i)
            const x = i % W
            for (const n of [i - W, i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1])
              if (n >= 0 && n < W * H && on(n) && !label[n]) {
                label[n] = id
                stack.push(n)
              }
          }
          groups.push(members)
        }
        return { label, groups }
      }
      const shards = components((i) => mask[i] === 1)
      const background = components((i) => mask[i] === 0)

      const simplify = (points: number[][], epsilon: number): number[][] => {
        if (points.length < 3) return points
        const [first, last] = [points[0], points[points.length - 1]]
        let [index, best] = [0, 0]
        for (let i = 1; i < points.length - 1; i++) {
          const [px, py] = points[i]
          const dx = last[0] - first[0]
          const dy = last[1] - first[1]
          const length = Math.hypot(dx, dy) || 1
          const distance =
            Math.abs(dy * px - dx * py + last[0] * first[1] - last[1] * first[0]) / length
          if (distance > best) [index, best] = [i, distance]
        }
        if (best <= epsilon) return [first, last]
        return [
          ...simplify(points.slice(0, index + 1), epsilon).slice(0, -1),
          ...simplify(points.slice(index), epsilon),
        ]
      }
      // A region's outline by Moore-neighbour tracing from its first pixel, then Douglas-Peucker.
      const directions = [
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [-1, -1],
        [0, -1],
        [1, -1],
      ]
      const outline = (label: Int32Array, id: number, startIndex: number) => {
        const inside = (x: number, y: number) =>
          x >= 0 && y >= 0 && x < W && y < H && label[y * W + x] === id
        const start = [startIndex % W, Math.floor(startIndex / W)]
        const contour: number[][] = []
        let [cx, cy] = start
        let from = 4 // arrived from the west
        do {
          contour.push([cx, cy])
          let moved = false
          for (let k = 1; k <= 8; k++) {
            const dir = (from + k) % 8
            const [dx, dy] = directions[dir]
            if (inside(cx + dx, cy + dy)) {
              ;[cx, cy] = [cx + dx, cy + dy]
              from = (dir + 4) % 8
              moved = true
              break
            }
          }
          if (!moved) break
        } while ((cx !== start[0] || cy !== start[1]) && contour.length < 20000)
        const half = contour.length >> 1
        return [
          ...simplify(contour.slice(0, half + 1), 2).slice(0, -1),
          ...simplify([...contour.slice(half), contour[0]], 2).slice(0, -1),
        ].map(([x, y]) => [x / W, y / H])
      }

      // Each shard is a list of rings: its outline, then any large holes (sky enclosed where shards
      // meet across the title bar). Small holes are filled.
      const rings = new Map<number, number[][][]>()
      shards.groups.forEach((members, r) => {
        if (members.length < W * H * 0.002) return
        // Frame furniture that differs between the twins (mana cost, power/toughness box, bottom
        // credit band) is not shard: drop regions lying wholly inside it.
        let [top, bottom, left] = [1, 0, 1]
        for (const i of members) {
          const [x, y] = [(i % W) / W, Math.floor(i / W) / H]
          ;[top, bottom, left] = [Math.min(top, y), Math.max(bottom, y), Math.min(left, x)]
        }
        if (bottom < 0.11 || top > 0.9 || (left > 0.74 && top > 0.84)) return
        const ring = outline(shards.label, r + 1, members[0])
        if (ring.length >= 3) rings.set(r + 1, [ring])
      })
      background.groups.forEach((members, h) => {
        if (members.length < W * H * 0.004) return
        if (members.some((i) => i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1))) return
        const owner = shards.label[members[0] - W]
        const ring = outline(background.label, h + 1, members[0])
        if (rings.has(owner) && ring.length >= 3) rings.get(owner)!.push(ring)
      })
      const polygons = [...rings.values()]

      // Overlay for checking by eye.
      const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H })
      const context = canvas.getContext('2d')!
      context.drawImage(facetImage, 0, 0, W, H)
      context.fillStyle = 'rgba(255, 0, 255, 0.25)'
      context.strokeStyle = '#f0f'
      context.lineWidth = 2
      for (const polygon of polygons) {
        context.beginPath()
        for (const ring of polygon) {
          ring.forEach(([x, y], i) =>
            i ? context.lineTo(x * W, y * H) : context.moveTo(x * W, y * H),
          )
          context.closePath()
        }
        context.fill('evenodd')
        context.stroke()
      }
      context.strokeStyle = 'rgba(0, 255, 0, 0.6)'
      context.lineWidth = 1
      context.font = '9px sans-serif'
      context.fillStyle = '#0f0'
      for (let g = 1; g < 20; g++) {
        context.beginPath()
        context.moveTo((g / 20) * W, 0)
        context.lineTo((g / 20) * W, H)
        context.moveTo(0, (g / 20) * H)
        context.lineTo(W, (g / 20) * H)
        context.stroke()
        if (g % 2 === 0) {
          context.fillText(String(g * 5), (g / 20) * W + 1, 9)
          context.fillText(String(g * 5), 1, (g / 20) * H - 1)
        }
      }
      return {
        stats: [fit.dx, fit.dy, fit.s, raw, mask.reduce((s, v) => s + v, 0), shards.groups.length],
        polygons,
        overlay: canvas.toDataURL('image/png'),
        heat: heatCanvas.toDataURL('image/png'),
      }
    },
    [
      facet,
      plain,
      Number(process.env.R ?? 4),
      Number(process.env.T ?? 55),
      Number(process.env.S ?? 1),
      exclusions[number] ?? [],
      gates[number] ?? 'true',
      colourOnly.has(number),
    ] as const,
  )
  overlays.push(traced.overlay)
  writeFileSync(`${outDir}/${number}.png`, Buffer.from(traced.overlay.split(',')[1], 'base64'))
  writeFileSync(`${outDir}/${number}-heat.png`, Buffer.from(traced.heat.split(',')[1], 'base64'))
  result[`fra/${number}`] = traced.polygons.map((polygon) =>
    polygon.map((ring) => ring.flat().map((v) => Math.round(v * 1000) / 1000)),
  )
  console.log(
    number,
    traced.stats,
    traced.polygons.length,
    traced.polygons.map((p) => p.length).join(','),
  )
}
writeFileSync(`${outDir}/shards.json`, JSON.stringify(result))
// Contact sheet of every overlay at half size.
const sheet = await page.evaluate(async (urls) => {
  const canvas = Object.assign(document.createElement('canvas'), {
    width: 244 * 5,
    height: 340 * 3,
  })
  const context = canvas.getContext('2d')!
  for (const [i, url] of urls.entries()) {
    const image = new Image()
    image.src = url
    await image.decode()
    context.drawImage(image, (i % 5) * 244, Math.floor(i / 5) * 340, 244, 340)
  }
  return canvas.toDataURL('image/png')
}, overlays)
writeFileSync(`${outDir}/sheet.png`, Buffer.from(sheet.split(',')[1], 'base64'))
await browser.close()
