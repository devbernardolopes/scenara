import db from '../db'
import { isEncryptedKey, encryptKey, decryptKey } from '../lib/codeCrypto'
import { getSetting, setSetting } from './settings'
import { PROVIDERS, addKey } from './apiProviders'
import { REQUEST_KINDS, createProfile } from './connectionProfiles'
import { getCodeEntry } from './codes'

const REDEEMED_CODES_KEY = 'redeemedCodes'

function codeError(type) {
  const error = new Error(type)
  error.code = type
  return error
}

export async function getRedeemedCodes() {
  const raw = await getSetting(REDEEMED_CODES_KEY)
  return Array.isArray(raw) ? raw : []
}

export async function isCodeRedeemed(code) {
  const normalized = String(code || '')
    .trim()
    .toUpperCase()
  const list = await getRedeemedCodes()
  return list.some((r) => r.code === normalized)
}

const inFlight = new Map()

export function redeemCode(input) {
  const code = String(input || '')
    .trim()
    .toUpperCase()
  const key = code || '__empty__'
  if (inFlight.has(key)) return inFlight.get(key)
  const promise = doRedeem(code).finally(() => inFlight.delete(key))
  inFlight.set(key, promise)
  return promise
}

async function doRedeem(code) {
  if (!code) throw codeError('code-invalid')
  if (await isCodeRedeemed(code)) throw codeError('code-already-used')

  const entry = getCodeEntry(code)
  if (!entry) throw codeError('code-invalid')

  const provider = PROVIDERS.find((p) => p.id === entry.providerId)
  if (!provider) throw codeError('code-invalid')

  if (!isEncryptedKey(entry.encryptedKey)) throw codeError('code-invalid')

  let plainKey
  try {
    plainKey = await decryptKey(entry.encryptedKey)
  } catch {
    throw codeError('code-invalid')
  }

  const label = entry.apiKeyLabel || entry.name || entry.code

  let summary
  await db.transaction('rw', [db.settings, db.connectionProfiles], async () => {
    const keys = await addKey(provider.id, {
      value: await encryptKey(plainKey),
      label,
      grantedViaCode: true,
    })
    const keyId = keys[keys.length - 1].id

    const profileIds = {}
    for (const profile of entry.profiles || []) {
      if (!profile || typeof profile.name !== 'string' || !profile.name.trim()) {
        throw codeError('code-invalid')
      }
      const id = await createProfile({
        name: profile.name.trim(),
        providerId: provider.id,
        keyId,
        model: profile.model || null,
        params: profile.params || {},
        baseUrl: profile.baseUrl || null,
        promptTemplate: profile.promptTemplate || null,
        promptTemplateCustom: profile.promptTemplateCustom || '',
        disabledParams: profile.disabledParams || {},
      })
      profileIds[profile.name.trim().toLowerCase()] = id
    }

    const assignedKinds = []
    const assign = entry.assign || {}
    for (const [kind, profileName] of Object.entries(assign)) {
      if (!REQUEST_KINDS.includes(kind)) throw codeError('code-invalid')
      const profileId = profileIds[String(profileName).trim().toLowerCase()]
      if (profileId == null) throw codeError('code-invalid')
      await setSetting(`requestKind.${kind}.profileId`, profileId)
      assignedKinds.push(kind)
    }

    const redeemed = await getRedeemedCodes()
    await setSetting(REDEEMED_CODES_KEY, [
      ...redeemed,
      { code, redeemedAt: new Date().toISOString() },
    ])

    summary = {
      code,
      label,
      keyId,
      providerId: provider.id,
      profiles: (entry.profiles || []).map((p) => ({
        name: p.name,
        id: profileIds[p.name.trim().toLowerCase()],
      })),
      kinds: assignedKinds,
    }
  })

  return summary
}
