const MAGIC = 'SCENARA-ENC-1:'
const SALT_LEN = 16
const IV_LEN = 12
const ITERATIONS = 100000

async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder()
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
  const enc = new TextEncoder()
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
  const b64 = btoa(String.fromCharCode(...combined))
  return MAGIC + b64
}

export async function decrypt(encoded, passphrase) {
  const raw = encoded.slice(MAGIC.length)
  const bytes = new Uint8Array(
    atob(raw)
      .split('')
      .map((c) => c.charCodeAt(0)),
  )
  const salt = bytes.slice(0, SALT_LEN)
  const iv = bytes.slice(SALT_LEN, SALT_LEN + IV_LEN)
  const ciphertext = bytes.slice(SALT_LEN + IV_LEN)
  const key = await deriveKey(passphrase, salt)
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plainBuffer)
}
