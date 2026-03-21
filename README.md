# agentic-store

SQLite-first persistence for agentic apps.

Key-value API out of the box. Raw SQL when you need it. Browser (sql.js WASM) + Node.js (better-sqlite3).

## Usage

```js
const { createStore } = require('agentic-store')

// Key-value (works on all backends)
const store = await createStore('my-app')
await store.set('user', { name: 'kenefe' })
await store.get('user')        // { name: 'kenefe' }
await store.has('user')        // true
await store.keys()             // ['user']
await store.delete('user')
await store.clear()

// Raw SQL (SQLite backends only)
store.exec('CREATE TABLE items (id TEXT PRIMARY KEY, data TEXT)')
store.run('INSERT INTO items VALUES (?, ?)', ['i1', '{"v":1}'])
store.all('SELECT * FROM items')       // [{id:'i1', data:'{"v":1}'}]
store.sql('SELECT * FROM items WHERE id = ?', ['i1'])  // single row
```

## API

| Method | Returns | Description |
|--------|---------|-------------|
| `createStore(name, opts?)` | `Promise<Store>` | Create a namespaced store (async for WASM init) |
| `store.get(key)` | `Promise<any>` | Get value (undefined if missing) |
| `store.set(key, value)` | `Promise<void>` | Set value (any JSON-serializable type) |
| `store.delete(key)` | `Promise<void>` | Delete key |
| `store.has(key)` | `Promise<boolean>` | Check if key exists |
| `store.keys()` | `Promise<string[]>` | List all keys |
| `store.clear()` | `Promise<void>` | Delete all keys |
| `store.flush()` | `Promise<void>` | Force persist (WASM debounces writes) |
| `store.close()` | `Promise<void>` | Close connections |
| `store.exec(sql, params?)` | `void` | Execute SQL (DDL, writes) |
| `store.run(sql, params?)` | `void` | Execute SQL (writes) |
| `store.all(sql, params?)` | `Row[]` | Query all rows |
| `store.sql(sql, params?)` | `Row?` | Query single row |
| `store.backend` | `string` | Active backend name |

## Backends

| Backend | When | Storage | Raw SQL |
|---------|------|---------|--------|
| `sqlite-native` | Node.js + better-sqlite3 | File (.db) | ✓ |
| `sqlite-wasm` | Browser + sql.js | IndexedDB | ✓ |
| `sqlite-memory` | Testing (SQLite) | RAM | ✓ |
| `idb` | Browser (no sql.js) | IndexedDB | ✗ |
| `fs` | Node.js (zero deps) | JSON files | ✗ |
| `ls` | No IndexedDB | localStorage | ✗ |
| `mem` | Last resort | RAM | ✗ |
| `custom` | Bring your own | You decide | Optional |

## Options

```js
// Force backend
await createStore('app', { backend: 'sqlite-native' })

// Custom file path
await createStore('app', { backend: 'sqlite-native', path: '/data/app.db' })

// Custom backend
await createStore('app', {
  custom: {
    async kvGet(key) {},
    async kvSet(key, value) {},
    async kvDelete(key) {},
    async kvKeys() {},
    async kvClear() {},
    async kvHas(key) {},
  }
})
```

## Part of the agentic family

- [agentic-core](https://github.com/momomo-agent/agentic-core) — LLM client
- [agentic-memory](https://github.com/momomo-agent/agentic-memory) — conversation + knowledge
- [agentic-claw](https://github.com/momomo-agent/agentic-claw) — agent runtime
- **agentic-store** — persistence layer (this)
