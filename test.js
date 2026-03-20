const { createStore } = require('./store.js')

async function test() {
  const results = []
  let passed = 0
  let failed = 0

  function assert(name, condition) {
    if (condition) {
      passed++
      results.push(`  ✓ ${name}`)
    } else {
      failed++
      results.push(`  ✗ ${name}`)
    }
  }

  // ── In-memory backend tests ──
  console.log('Testing in-memory backend...')
  const mem = createStore('test', { backend: 'mem' })

  assert('backend is mem', mem.backend === 'mem')

  // set + get
  await mem.set('key1', { hello: 'world' })
  const v1 = await mem.get('key1')
  assert('set/get object', v1.hello === 'world')

  // get returns clone, not reference
  v1.hello = 'mutated'
  const v1b = await mem.get('key1')
  assert('get returns clone', v1b.hello === 'world')

  // get missing key
  const missing = await mem.get('nonexistent')
  assert('get missing returns undefined', missing === undefined)

  // has
  assert('has existing key', await mem.has('key1'))
  assert('has missing key', !(await mem.has('nonexistent')))

  // set various types
  await mem.set('str', 'hello')
  assert('set/get string', (await mem.get('str')) === 'hello')

  await mem.set('num', 42)
  assert('set/get number', (await mem.get('num')) === 42)

  await mem.set('arr', [1, 2, 3])
  const arr = await mem.get('arr')
  assert('set/get array', Array.isArray(arr) && arr.length === 3)

  await mem.set('null', null)
  assert('set/get null', (await mem.get('null')) === null)

  // keys
  const keys = await mem.keys()
  assert('keys includes all', keys.length === 5 && keys.includes('key1') && keys.includes('str'))

  // delete
  await mem.delete('str')
  assert('delete removes key', (await mem.get('str')) === undefined)
  assert('delete: has returns false', !(await mem.has('str')))

  // overwrite
  await mem.set('key1', { updated: true })
  const v2 = await mem.get('key1')
  assert('overwrite works', v2.updated === true && v2.hello === undefined)

  // clear
  await mem.clear()
  const keysAfterClear = await mem.keys()
  assert('clear empties store', keysAfterClear.length === 0)

  // large data
  const big = { items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `item-${i}` })) }
  await mem.set('big', big)
  const bigBack = await mem.get('big')
  assert('large object roundtrip', bigBack.items.length === 1000 && bigBack.items[999].id === 999)

  // close
  await mem.close()
  assert('close succeeds', true)

  // ── File system backend tests ──
  console.log('\nTesting fs backend...')
  const tmpDir = '/tmp/agentic-store-test-' + Date.now()
  const fs = createStore('test', { backend: 'fs', dir: tmpDir })

  assert('fs backend type', fs.backend === 'fs')

  await fs.set('doc', { title: 'hello', tags: ['a', 'b'] })
  const doc = await fs.get('doc')
  assert('fs set/get', doc.title === 'hello' && doc.tags.length === 2)

  assert('fs has', await fs.has('doc'))
  assert('fs has missing', !(await fs.has('nope')))

  await fs.set('doc2', 'string value')
  const fsKeys = await fs.keys()
  assert('fs keys', fsKeys.length === 2 && fsKeys.includes('doc'))

  await fs.delete('doc2')
  assert('fs delete', !(await fs.has('doc2')))

  await fs.clear()
  assert('fs clear', (await fs.keys()).length === 0)

  // cleanup
  try { require('fs').rmdirSync(tmpDir) } catch {}

  // ── Custom backend tests ──
  console.log('\nTesting custom backend...')
  const customData = new Map()
  const custom = createStore('test', {
    custom: {
      async get(k) { return customData.get(k) },
      async set(k, v) { customData.set(k, v) },
      async delete(k) { customData.delete(k) },
      async keys() { return [...customData.keys()] },
      async clear() { customData.clear() },
      async has(k) { return customData.has(k) },
    }
  })

  assert('custom backend type', custom.backend === 'custom')

  await custom.set('x', 123)
  assert('custom set/get', (await custom.get('x')) === 123)
  assert('custom has', await custom.has('x'))
  assert('custom keys', (await custom.keys()).length === 1)
  await custom.delete('x')
  assert('custom delete', !(await custom.has('x')))

  // ── Results ──
  console.log(results.join('\n'))
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

test().catch(err => { console.error(err); process.exit(1) })
