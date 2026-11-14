import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { edhrecBodyReason } from './edhrec-bodies.ts'

// Built at runtime so this file never contains the patterns it rejects.
const key = ['json', 'dict'].join('_')
const body = JSON.stringify({ container: { [key]: { cardlists: [] } } })

test('detects raw, escaped and replay-stored EDHREC bodies', () => {
  assert.equal(edhrecBodyReason(body), 'EDHREC page body')
  assert.equal(edhrecBodyReason(JSON.stringify({ status: 200, body })), 'EDHREC page body')
  assert.equal(
    edhrecBodyReason(
      JSON.stringify({
        version: 1,
        url: 'https://json.edhrec.com/pages/commanders/example.json',
        bytes: Buffer.from(body).toString('base64'),
      }),
    ),
    'dev-replay EDHREC entry',
  )
  assert.equal(edhrecBodyReason(`// ${'synthetic EDHREC'} fixture\n${body}`), undefined)
  assert.equal(edhrecBodyReason(`container: { ${key}: { cardlists } }`), undefined)
  assert.equal(edhrecBodyReason('See https://json.edhrec.com/pages/commanders/x.json'), undefined)
})

test('no tracked file contains an EDHREC response body', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', windowsHide: true })
    .split('\0')
    .filter(Boolean)
  const found = files.flatMap((file) => {
    let bytes: Buffer
    try {
      bytes = readFileSync(file)
    } catch {
      return [] // Deleted in the working tree.
    }
    if (bytes.includes(0)) return []
    const reason = edhrecBodyReason(bytes.toString('utf8'))
    return reason ? [`${file}: ${reason}`] : []
  })
  assert.deepEqual(
    found,
    [],
    'EDHREC response bodies stay in the machine-local cache (docs/domain/data-sources.md#live-edhrec-recordings)',
  )
})
