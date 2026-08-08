import { CODE_SECRET } from './codeSecrets'

const MAGIC = 'SCENARA-CODE-1:'
const IV_LEN = 12
const ITERATIONS = 100000

const enc = new TextEncoder()
const dec = new TextDecoder()

const DOMAIN_SALT = new Uint8Array([
  0x53, 0x43, 0x45, 0x4e, 0x41, 0x52, 0x41, 0x43, 0x4f, 0x44, 0x45, 0x4b, 0x45, 0x59, 0x56, 0x31,
])

let keyPromise = null

function bytesToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(b64) {
  return new Uint8Array(
    atob(b64)
      .split('')
      .map((c) => c.charCodeAt(0)),
  )
}

function getKey() {
  if (!keyPromise) {
    keyPromise = (async () => {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(CODE_SECRET),
        'PBKDF2',
        false,
        ['deriveKey'],
      )
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: DOMAIN_SALT, iterations: ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      )
    })()
  }
  return keyPromise
}

export function isEncryptedKey(value) {
  return typeof value === 'string' && value.startsWith(MAGIC)
}

export async function encryptKey(plaintext) {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  )
  const combined = new Uint8Array(IV_LEN + cipherBuffer.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipherBuffer), IV_LEN)
  return MAGIC + bytesToBase64(combined)
}

export async function decryptKey(encoded) {
  if (!isEncryptedKey(encoded)) return encoded
  const key = await getKey()
  const bytes = base64ToBytes(encoded.slice(MAGIC.length))
  const iv = bytes.slice(0, IV_LEN)
  const ciphertext = bytes.slice(IV_LEN)
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return dec.decode(plainBuffer)
}
