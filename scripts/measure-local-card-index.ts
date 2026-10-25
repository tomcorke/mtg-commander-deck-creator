// #151: main-thread cost of the real local index on desktop and a 4x CPU-throttled mobile
// equivalent. Transfer is not measured here: the Vite server neither compresses nor caches.
// Needs `public/local-card-index.json` (pnpm build:card-index). Prints a Markdown table of medians.
import { withBrowser } from './fixtures/browser-harness.ts'

const runs = 3
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

await withBrowser('LOCAL_CARD_INDEX_MEASURE', 5246, async (browser, base) => {
  console.log(
    '| Profile | JSON parse ms | Validate ms | Longest task ms | Long-task total ms | Heap +MB |',
  )
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |')
  for (const [name, cpu] of [
    ['Desktop', 1],
    ['Mobile equivalent (4x CPU)', 4],
  ] as const) {
    const samples: number[][] = []
    for (let run = 0; run < runs; run++) {
      const context = await browser.newContext()
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      await cdp.send('Performance.enable')
      await page.goto(base)
      await page.locator('.start').waitFor()
      const heap = async () =>
        (await cdp.send('Performance.getMetrics')).metrics.find(
          (metric) => metric.name === 'JSHeapUsedSize',
        )!.value
      const text = await page.evaluateHandle(() =>
        fetch('/local-card-index.json').then((response) => response.text()),
      )
      await cdp.send('HeapProfiler.collectGarbage')
      const before = await heap()
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
      const result = await page.evaluate(async (text) => {
        const tasks: number[] = []
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) tasks.push(entry.duration)
        }).observe({ type: 'longtask' })
        const modulePath = '/src/domain/local-card-index.ts'
        const { parseLocalCardIndex } = await import(modulePath)
        // Same sequence as the adapter: response.json() then validation, in one main-thread task.
        await new Promise((resolve) => setTimeout(resolve, 0))
        const t0 = performance.now()
        const json = JSON.parse(text)
        const t1 = performance.now()
        const index = parseLocalCardIndex(json)
        const t2 = performance.now()
        await new Promise((resolve) => setTimeout(resolve, 500))
        ;(globalThis as Record<string, unknown>).keepIndex = index
        return [t1 - t0, t2 - t1, Math.max(0, ...tasks), tasks.reduce((a, b) => a + b, 0)]
      }, text)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      await text.dispose()
      await cdp.send('HeapProfiler.collectGarbage')
      samples.push([...result, ((await heap()) - before) / 1e6])
      await context.close()
    }
    const column = (index: number) => median(samples.map((sample) => sample[index])).toFixed(0)
    console.log(`| ${name} | ${[0, 1, 2, 3, 4].map(column).join(' | ')} |`)
  }
})
