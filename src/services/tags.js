import db from '../db'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'

export async function getAllTags() {
  return db.tags.orderBy('name').toArray()
}

export async function getTag(id) {
  return db.tags.get(id)
}

export async function createTag(name) {
  const trimmed = name.trim()
  if (!trimmed) {
    showToast(i18n.t('common:tags.emptyName'), { type: 'error' })
    throw new Error('Tag name cannot be empty')
  }
  const existing = await db.tags.where('name').equalsIgnoreCase(trimmed).first()
  if (existing) {
    showToast(i18n.t('common:tags.duplicate', { name: trimmed }), { type: 'error' })
    throw new Error('Tag already exists')
  }
  const now = new Date()
  const id = await db.tags.add({
    name: trimmed,
    createdAt: now,
  })
  window.dispatchEvent(new CustomEvent('tags-changed'))
  return id
}

export async function updateTag(id, name) {
  const trimmed = name.trim()
  if (!trimmed) {
    showToast(i18n.t('common:tags.emptyName'), { type: 'error' })
    throw new Error('Tag name cannot be empty')
  }
  const existing = await db.tags.where('name').equalsIgnoreCase(trimmed).first()
  if (existing && existing.id !== id) {
    showToast(i18n.t('common:tags.duplicate', { name: trimmed }), { type: 'error' })
    throw new Error('Tag already exists')
  }
  await db.tags.update(id, { name: trimmed })
  window.dispatchEvent(new CustomEvent('tags-changed'))
}

export async function deleteTag(id) {
  const tag = await db.tags.get(id)
  if (!tag) return
  const charactersWithTag = await db.characters.where('tags').equals(id).toArray()
  await Promise.all(
    charactersWithTag.map((c) => {
      const updated = (c.tags || []).filter((t) => t !== id)
      return db.characters.update(c.id, { tags: updated })
    }),
  )
  await db.tags.delete(id)
  window.dispatchEvent(new CustomEvent('tags-changed'))
}

export async function getTagCharacterCounts() {
  const tags = await db.tags.toArray()
  const counts = new Map()
  for (const tag of tags) {
    const count = await db.characters.where('tags').equals(tag.id).count()
    counts.set(tag.id, count)
  }
  return counts
}
