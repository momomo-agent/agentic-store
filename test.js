const { createStore } = require('./store.js')

async function test() {
  const results = []
  let passed = 0
  let failed = 0

  function assert(name, condition) {
    if (condition) { passed++; results.push(`  ✓ ${name}`) }
    else { failed++; results.push(`  ✗ ${name}`) }
  }

  // ── In-memory backend ──
  console.log('Testing mem backend...')
  const mem = await createStore('test-mem', { backend: 'mem' })
  assert('mem backend type', mem.backend === 'mem')
  await mem.set('k', { a: 1 })
  assert('mem set/get', (await mem.get('k')).a === 1)
  assert('mem has', await mem.has('k'))
  assert('mem missing', (await mem.get('x')) === undefined)
  await mem.delete('k')
  assert('mem delete', !(await mem.has('k')))
  await mem.set('a', 1); await mem.set('b', 2)
  assert('mem keys', (await mem.keys()).length === 2)
  await mem.clear()
  assert('mem clear', (await mem.keys()).length === 0)
  await mem.close()

  // ── SQLite native file backend ──
  console.log('\nTesting sqlite-native backend...')
  const tmpPath = '/tmp/agentic-store-test-' + Date.now() + '.db'
  const sql = await createStore('test-sql', { backend: 'sqlite-native', path: tmpPath })
  assert('sqlite backend type', sql.backend === 'sqlite-native')

  // KV operations
  await sql.set('user', { name: 'kenefe', tags: ['dev', 'ai'] })
  const user = await sql.get('user')
  assert('sqlite set/get object', user.name === 'kenefe' && user.tags.length === 2)

  await sql.set('count', 42)
  assert('sqlite set/get number', (await sql.get('count')) === 42)

  assert('sqlite has', await sql.has('user'))
  assert('sqlite has missing', !(await sql.has('nope')))

  const keys = await sql.keys()
  assert('sqlite keys', keys.length === 2 && keys.includes('user'))

  await sql.delete('count')
  assert('sqlite delete', !(await sql.has('count')))

  // Overwrite
  await sql.set('user', { name: 'momo' })
  assert('sqlite overwrite', (await sql.get('user')).name === 'momo')

  await sql.clear()
  assert('sqlite clear', (await sql.keys()).length === 0)

  // Raw SQL
  assert('sqlite has exec', typeof sql.exec === 'function')
  assert('sqlite has all', typeof sql.all === 'function')

  sql.exec('CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, data TEXT)')
  sql.run('INSERT INTO items VALUES (?, ?)', ['i1', JSON.stringify({ v: 1 })])
  sql.run('INSERT INTO items VALUES (?, ?)', ['i2', JSON.stringify({ v: 2 })])
  const rows = sql.all('SELECT * FROM items')
  assert('raw SQL insert/select', rows.length === 2)

  const one = sql.sql('SELECT * FROM items WHERE id = ?', ['i1'])
  assert('raw SQL get one', one && one.id === 'i1')

  await sql.close()

  // Cleanup
  try { require('fs').unlinkSync(tmpPath) } catch {}

  // ── SQLite in-memory backend ──
  console.log('\nTesting sqlite-memory backend...')
  const smem = await createStore('test-smem', { backend: 'sqlite-memory' })
  assert('sqlite-memory backend type', smem.backend === 'sqlite-memory')

  await smem.set('x', [1, 2, 3])
  assert('sqlite-memory set/get', (await smem.get('x')).length === 3)

  smem.exec('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, text TEXT)')
  smem.run('INSERT INTO notes VALUES (?, ?)', [1, 'hello'])
  const notes = smem.all('SELECT * FROM notes')
  assert('sqlite-memory raw SQL', notes.length === 1 && notes[0].text === 'hello')

  await smem.close()

  // ── Custom backend ──
  console.log('\nTesting custom backend...')
  const map = new Map()
  const custom = await createStore('test-custom', {
    custom: {
      async kvGet(k) { return map.get(k) },
      async kvSet(k, v) { map.set(k, v) },
      async kvDelete(k) { map.delete(k) },
      async kvKeys() { return [...map.keys()] },
      async kvClear() { map.clear() },
      async kvHas(k) { return map.has(k) },
    }
  })
  assert('custom backend type', custom.backend === 'custom')
  await custom.set('y', 99)
  assert('custom set/get', (await custom.get('y')) === 99)
  await custom.close()

  // ── Persistence test (file survives reopen) ──
  console.log('\nTesting persistence...')
  const persistPath = '/tmp/agentic-store-persist-' + Date.now() + '.db'
  const s1 = await createStore('persist', { backend: 'sqlite-native', path: persistPath })
  await s1.set('remember', { msg: 'hello from past' })
  s1.exec('CREATE TABLE IF NOT EXISTS log (ts INTEGER, entry TEXT)')
  s1.run('INSERT INTO log VALUES (?, ?)', [Date.now(), 'first entry'])
  await s1.close()

  const s2 = await createStore('persist', { backend: 'sqlite-native', path: persistPath })
  const remembered = await s2.get('remember')
  assert('persistence: kv survives reopen', remembered && remembered.msg === 'hello from past')
  const logRows = s2.all('SELECT * FROM log')
  assert('persistence: custom table survives reopen', logRows.length === 1)
  await s2.close()

  try { require('fs').unlinkSync(persistPath) } catch {}

  // ── Results ──
  console.log('\n' + results.join('\n'))
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

test().catch(err => { console.error(err); process.exit(1) })
