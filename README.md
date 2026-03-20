# agentic-store

Key-value persistence for agentic apps. Zero dependencies.

IndexedDB → localStorage → in-memory fallback. Auto-detects the best available backend.

## Usage

```js
import { createStore } from 'agentic-store'

const store = createStore('my-app')

await store.set('user', { name: 'kenefe', pref: 'dark' })
const user = await store.get('user')      // { name: 'kenefe', pref: 'dark' }
await store.has('user')                    // true
await store.keys()                         // ['user']
await store.delete('user')
await store.clear()
```

## API

| Method | Returns | Description |
|--------|---------|-------------|
| `createStore(name, opts?)` | Store | Create a namespaced store |
| `store.get(key)` | `Promise<any>` | Get value (undefined if missing) |
| `store.set(key, value)` | `Promise<void>` | Set value (any serializable type) |
| `store.delete(key)` | `Promise<void>` | Delete key |
| `store.has(key)` | `Promise<boolean>` | Check if key exists |
| `store.keys()` | `Promise<string[]>` | List all keys |
| `store.clear()` | `Promise<void>` | Delete all keys in namespace |
| `store.close()` | `Promise<void>` | Close connections |
| `store.backend` | `string` | Active backend: `'idb'`, `'ls'`, or `'mem'` |

## Options

```js
// Force a specific backend
createStore('my-app', { backend: 'idb' })

// File system with custom directory
createStore('my-app', { backend: 'fs', dir: '/path/to/data' })

// Custom backend — bring your own implementation
createStore('my-app', {
  custom: {
    async get(key) { /* ... */ },
    async set(key, value) { /* ... */ },
    async delete(key) { /* ... */ },
    async keys() { /* ... */ },
    async clear() { /* ... */ },
    async has(key) { /* ... */ },
    async close() { /* ... */ },   // optional
  }
})
```

## Backends

| Backend | When | Limit |
|---------|------|-------|
| `idb` (IndexedDB) | Default in browsers | ~unlimited |
| `ls` (localStorage) | Fallback if IDB unavailable | ~5-10MB |
| `fs` (file system) | Node.js (auto-detected) | disk |
| `mem` (in-memory) | No storage available | RAM only |
| `custom` | Pass `opts.custom` | you decide |

## Part of the agentic family

- [agentic-core](https://github.com/momomo-agent/agentic-core) — LLM client
- [agentic-memory](https://github.com/momomo-agent/agentic-memory) — conversation + knowledge
- [agentic-claw](https://github.com/momomo-agent/agentic-claw) — agent runtime
- **agentic-store** — persistence layer (this)
