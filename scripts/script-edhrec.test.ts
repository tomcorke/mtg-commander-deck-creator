import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { liveEdhrecUserAgent } from './live-edhrec.ts'
import { scriptEdhrecFetch } from './script-edhrec.ts'

for (const [script, args] of [
  ['recommendation-audit.ts', []],
  ['evaluate-local-retrieval.ts', ['--record']],
] as const) {
  test(`${script} refuses before network or input-file access without opt-in`, () => {
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', `scripts/${script}`, ...args],
      {
        encoding: 'utf8',
        timeout: 10_000,
        windowsHide: true,
      },
    )
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Live EDHREC is off/)
    assert.match(result.stderr, /pass --live-edhrec/)
  })
}

test('opted-in script transport stops on a synthetic 403 and refuses later requests', async () => {
  let calls = 0
  const fetcher = scriptEdhrecFetch('synthetic test', true, async (_input, init) => {
    assert.equal(new Headers(init?.headers).get('User-Agent'), liveEdhrecUserAgent)
    calls++
    return new Response('', { status: 403 })
  })
  await assert.rejects(
    fetcher('https://json.edhrec.com/pages/commanders/example.json', {
      headers: { 'User-Agent': 'caller' },
    }),
    /http-403/,
  )
  await assert.rejects(fetcher('https://json.edhrec.com/pages/commanders/another.json'), /http-403/)
  assert.equal(calls, 1)
})
