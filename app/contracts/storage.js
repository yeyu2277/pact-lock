const memory = new Map()
// Vue refs/Pinia expose proxies; IndexedDB cannot structured-clone those proxies.
// Persisted records contain JSON values (on-chain integers are stored as strings).
const plainRecord = value => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item))
let database
let unavailable = false

function openDatabase() {
  if (unavailable || !globalThis.indexedDB) return Promise.resolve(null)
  if (!database) database = new Promise(resolve => {
    let request
    try { request = indexedDB.open('pact-lock-v1', 1) } catch { unavailable = true; resolve(null); return }
    request.onupgradeneeded = () => request.result.createObjectStore('records')
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); database = undefined }
      resolve(db)
    }
    request.onerror = request.onblocked = () => { unavailable = true; resolve(null) }
  })
  return database
}
export const storageIsVolatile = () => unavailable || !globalThis.indexedDB
export async function readRecord(key) {
  const db = await openDatabase()
  if (!db) return memory.get(key) ?? null
  return new Promise(resolve => {
    try {
      const request = db.transaction('records', 'readonly').objectStore('records').get(key)
      request.onsuccess = () => { if (request.result !== undefined) memory.set(key, structuredClone(request.result)); resolve(request.result ?? memory.get(key) ?? null) }
      request.onerror = () => { unavailable = true; resolve(memory.get(key) ?? null) }
    } catch { unavailable = true; resolve(memory.get(key) ?? null) }
  })
}
export async function writeRecord(key, value) {
  value = plainRecord(value)
  memory.set(key, structuredClone(value))
  const db = await openDatabase()
  if (!db) return
  return new Promise(resolve => {
    try {
      const transaction = db.transaction('records', 'readwrite')
      transaction.objectStore('records').put(value, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = transaction.onabort = () => { unavailable = true; resolve() }
    } catch { unavailable = true; resolve() }
  })
}
export async function deleteRecord(key) {
  memory.delete(key)
  const db = await openDatabase()
  if (!db) return
  return new Promise(resolve => {
    try {
      const transaction = db.transaction('records', 'readwrite')
      transaction.objectStore('records').delete(key)
      transaction.oncomplete = transaction.onerror = transaction.onabort = () => resolve()
    } catch { unavailable = true; resolve() }
  })
}
// Read/modify/write in one IndexedDB transaction, including across browser tabs.
export async function updateRecord(key, update) {
  const db = await openDatabase()
  if (!db) { const value = plainRecord(update(memory.get(key) ?? null)); memory.set(key, structuredClone(value)); return value }
  return new Promise(resolve => {
    let value
    try {
      const transaction = db.transaction('records', 'readwrite')
      const records = transaction.objectStore('records')
      const request = records.get(key)
      request.onsuccess = () => { value = plainRecord(update(request.result ?? memory.get(key) ?? null)); records.put(value, key) }
      transaction.oncomplete = () => { memory.set(key, structuredClone(value)); resolve(value) }
      transaction.onerror = transaction.onabort = () => { unavailable = true; value ??= plainRecord(update(memory.get(key) ?? null)); memory.set(key, structuredClone(value)); resolve(value) }
    } catch { unavailable = true; value = plainRecord(update(memory.get(key) ?? null)); memory.set(key, structuredClone(value)); resolve(value) }
  })
}
export async function deleteRecords(prefix) {
  for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key)
  const db = await openDatabase()
  if (!db) return
  return new Promise(resolve => {
    try {
      const transaction = db.transaction('records', 'readwrite')
      const request = transaction.objectStore('records').openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'))
      request.onsuccess = () => { const cursor = request.result; if (cursor) { cursor.delete(); cursor.continue() } }
      transaction.oncomplete = transaction.onerror = transaction.onabort = () => resolve()
    } catch { unavailable = true; resolve() }
  })
}
export const namespace = (network, wallet) => ['v1', network.chainId, network.pactLock.address.toLowerCase(), wallet.toLowerCase()].join(':')
