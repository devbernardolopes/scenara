const MAGIC = 'SCENARA-ENC-1:'
const SALT_LEN = 16
const IV_LEN = 12
const ITERATIONS = 100000

const enc = new TextEncoder()
const dec = new TextDecoder()

function uint8ToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8(b64) {
  return new Uint8Array(
    atob(b64)
      .split('')
      .map((c) => c.charCodeAt(0)),
  )
}

async function deriveKey(passphrase, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function isEncrypted(text) {
  return typeof text === 'string' && text.startsWith(MAGIC)
}

export async function encrypt(plaintext, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const key = await deriveKey(passphrase, salt)
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  )
  const combined = new Uint8Array(SALT_LEN + IV_LEN + cipherBuffer.byteLength)
  combined.set(salt, 0)
  combined.set(iv, SALT_LEN)
  combined.set(new Uint8Array(cipherBuffer), SALT_LEN + IV_LEN)
  return MAGIC + uint8ToBase64(combined)
}

export async function decrypt(encoded, passphrase) {
  const raw = encoded.slice(MAGIC.length)
  const bytes = base64ToUint8(raw)
  const salt = bytes.slice(0, SALT_LEN)
  const iv = bytes.slice(SALT_LEN, SALT_LEN + IV_LEN)
  const ciphertext = bytes.slice(SALT_LEN + IV_LEN)
  const key = await deriveKey(passphrase, salt)
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return dec.decode(plainBuffer)
}

async function encryptValue(plaintext, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  )
  const combined = new Uint8Array(SALT_LEN + IV_LEN + cipherBuffer.byteLength)
  combined.set(salt, 0)
  combined.set(iv, SALT_LEN)
  combined.set(new Uint8Array(cipherBuffer), SALT_LEN + IV_LEN)
  return MAGIC + uint8ToBase64(combined)
}

async function decryptValue(encoded, passphrase, keyCache) {
  const raw = encoded.slice(MAGIC.length)
  const bytes = base64ToUint8(raw)
  const salt = bytes.slice(0, SALT_LEN)
  const iv = bytes.slice(SALT_LEN, SALT_LEN + IV_LEN)
  const ciphertext = bytes.slice(SALT_LEN + IV_LEN)
  const saltB64 = uint8ToBase64(salt)
  let key = keyCache.get(saltB64)
  if (!key) {
    key = await deriveKey(passphrase, salt)
    keyCache.set(saltB64, key)
  }
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return dec.decode(plainBuffer)
}

export async function encryptTree(obj, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const key = await deriveKey(passphrase, salt)
  async function walk(val) {
    if (typeof val === 'string') {
      if (val === '') return val
      return encryptValue(val, key, salt)
    }
    if (Array.isArray(val)) {
      const out = []
      for (let i = 0; i < val.length; i++) {
        out.push(await walk(val[i]))
      }
      return out
    }
    if (val && typeof val === 'object') {
      const out = {}
      for (const k of Object.keys(val)) {
        out[k] = await walk(val[k])
      }
      return out
    }
    return val
  }
  return walk(obj)
}

export async function decryptTree(obj, passphrase) {
  const keyCache = new Map()
  async function walk(val) {
    if (typeof val === 'string' && isEncrypted(val)) {
      return decryptValue(val, passphrase, keyCache)
    }
    if (Array.isArray(val)) {
      const out = []
      for (let i = 0; i < val.length; i++) {
        out.push(await walk(val[i]))
      }
      return out
    }
    if (val && typeof val === 'object') {
      const out = {}
      for (const k of Object.keys(val)) {
        out[k] = await walk(val[k])
      }
      return out
    }
    return val
  }
  return walk(obj)
}

export function hasEncryptedValues(obj) {
  if (typeof obj === 'string') return isEncrypted(obj)
  if (Array.isArray(obj)) return obj.some(hasEncryptedValues)
  if (obj && typeof obj === 'object') return Object.values(obj).some(hasEncryptedValues)
  return false
}
