/**
 * agentic-store — Key-value persistence for agentic apps
 * Zero dependencies. IndexedDB with localStorage fallback.
 *
 * Usage:
 *   import { createStore } from 'agentic-store'
 *
 *   const store = createStore('my-app')
 *   await store.set('key', { any: 'data' })
 *   const data = await store.get('key')
 *   await store.delete('key')
 *   await store.keys()
 *   await store.clear()
 *
 * Auto-detects IndexedDB availability. Falls back to localStorage.
 * All methods are async for uniform API regardless of backend.
 */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else if (typeof define === 'function' && define.amd) define(factory)
  else root.AgenticStore = factory()
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  // ── IndexedDB backend ────────────────────────────────────────────

  function idbBackend(dbName) {
    const STORE_NAME = 'kv'
    let _db = null

    function open() {
      if (_db) return Promise.resolve(_db)
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1)
        req.onupgradeneeded = () => {
          req.result.createObjectStore(STORE_NAME)
        }
        req.onsuccess = () => {
          _db = req.result
          resolve(_db)
        }
        req.onerror = () => reject(req.error)
      })
    }

    function tx(mode) {
      return open().then(db => {
        const t = db.transaction(STORE_NAME, mode)
        return t.objectStore(STORE_NAME)
      })
    }

    function wrap(req) {
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    }

    return {
      async get(key) {
        const s = await tx('readonly')
        return wrap(s.get(key))
      },
      async set(key, value) {
        const s = await tx('readwrite')
        return wrap(s.put(value, key))
      },
      async delete(key) {
        const s = await tx('readwrite')
        return wrap(s.delete(key))
      },
      async keys() {
        const s = await tx('readonly')
        return wrap(s.getAllKeys())
      },
      async clear() {
        const s = await tx('readwrite')
        return wrap(s.clear())
      },
      async has(key) {
        const s = await tx('readonly')
        const count = await wrap(s.count(key))
        return count > 0
      },
      async close() {
        if (_db) { _db.close(); _db = null }
      },
    }
  }

  // ── localStorage backend ─────────────────────────────────────────

  function lsBackend(prefix) {
    const pfx = prefix + ':'

    return {
      async get(key) {
        try {
          const raw = localStorage.getItem(pfx + key)
          return raw != null ? JSON.parse(raw) : undefined
        } catch { return undefined }
      },
      async set(key, value) {
        localStorage.setItem(pfx + key, JSON.stringify(value))
      },
      async delete(key) {
        localStorage.removeItem(pfx + key)
      },
      async keys() {
        const result = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k.startsWith(pfx)) result.push(k.slice(pfx.length))
        }
        return result
      },
      async clear() {
        const toRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k.startsWith(pfx)) toRemove.push(k)
        }
        toRemove.forEach(k => localStorage.removeItem(k))
      },
      async has(key) {
        return localStorage.getItem(pfx + key) != null
      },
      async close() {},
    }
  }

  // ── In-memory backend (Node.js / testing) ────────────────────────

  function memBackend() {
    const data = new Map()
    return {
      async get(key) { return data.has(key) ? structuredClone(data.get(key)) : undefined },
      async set(key, value) { data.set(key, structuredClone(value)) },
      async delete(key) { data.delete(key) },
      async keys() { return [...data.keys()] },
      async clear() { data.clear() },
      async has(key) { return data.has(key) },
      async close() { data.clear() },
    }
  }

  // ── File system backend (Node.js) ──────────────────────────────

  function fsBackend(dir) {
    const fs = require('fs')
    const path = require('path')
    fs.mkdirSync(dir, { recursive: true })

    function filePath(key) { return path.join(dir, encodeURIComponent(key) + '.json') }

    return {
      async get(key) {
        try {
          const raw = fs.readFileSync(filePath(key), 'utf8')
          return JSON.parse(raw)
        } catch { return undefined }
      },
      async set(key, value) {
        fs.writeFileSync(filePath(key), JSON.stringify(value))
      },
      async delete(key) {
        try { fs.unlinkSync(filePath(key)) } catch {}
      },
      async keys() {
        try {
          return fs.readdirSync(dir)
            .filter(f => f.endsWith('.json'))
            .map(f => decodeURIComponent(f.slice(0, -5)))
        } catch { return [] }
      },
      async clear() {
        try {
          for (const f of fs.readdirSync(dir)) {
            if (f.endsWith('.json')) fs.unlinkSync(path.join(dir, f))
          }
        } catch {}
      },
      async has(key) {
        return fs.existsSync(filePath(key))
      },
      async close() {},
    }
  }

  // ── Factory ──────────────────────────────────────────────────────

  function detectBackend(name) {
    // IndexedDB preferred
    if (typeof indexedDB !== 'undefined') {
      try {
        const req = indexedDB.open('__agentic_store_probe__', 1)
        req.onsuccess = () => { req.result.close(); indexedDB.deleteDatabase('__agentic_store_probe__') }
        req.onerror = () => {}
        return 'idb'
      } catch { /* fall through */ }
    }
    // localStorage fallback
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('__agentic_store_probe__', '1')
        localStorage.removeItem('__agentic_store_probe__')
        return 'ls'
      } catch { /* fall through */ }
    }
    // Node.js — use file system
    if (typeof require !== 'undefined') {
      try {
        require('fs')
        return 'fs'
      } catch { /* fall through */ }
    }
    // In-memory last resort
    return 'mem'
  }

  /**
   * Create a namespaced key-value store.
   *
   * @param {string} name - Namespace (e.g. 'visual-talk', 'my-app')
   * @param {object} [opts] - Options
   * @param {'idb'|'ls'|'fs'|'mem'} [opts.backend] - Force a specific backend
   * @param {string} [opts.dir] - Directory for fs backend (default: ~/.agentic-store/<name>)
   * @param {object} [opts.custom] - Custom backend: { get, set, delete, keys, clear, has, close }
   * @returns {object} Store with get/set/delete/keys/clear/has/close
   */
  function createStore(name, opts = {}) {
    // Custom backend — pass through directly
    if (opts.custom) {
      const c = opts.custom
      return {
        get: (key) => c.get(key),
        set: (key, value) => c.set(key, value),
        delete: (key) => c.delete(key),
        keys: () => c.keys(),
        clear: () => c.clear(),
        has: (key) => c.has(key),
        close: () => (c.close ? c.close() : Promise.resolve()),
        get backend() { return 'custom' },
      }
    }

    const backendType = opts.backend || detectBackend(name)

    let backend
    switch (backendType) {
      case 'idb': backend = idbBackend('agentic-store-' + name); break
      case 'ls':  backend = lsBackend('agentic-store-' + name); break
      case 'fs': {
        const dir = opts.dir || require('path').join(
          require('os').homedir(), '.agentic-store', name
        )
        backend = fsBackend(dir)
        break
      }
      case 'mem': backend = memBackend(); break
      default: throw new Error(`Unknown backend: ${backendType}`)
    }

    return {
      get: (key) => backend.get(key),
      set: (key, value) => backend.set(key, value),
      delete: (key) => backend.delete(key),
      keys: () => backend.keys(),
      clear: () => backend.clear(),
      has: (key) => backend.has(key),
      close: () => backend.close(),
      get backend() { return backendType },
    }
  }

  return { createStore }
})
