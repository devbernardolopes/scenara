import { useEffect } from 'react'
import { useToast } from '../../lib/toast'
import i18n from '../../lib/i18n'

const EVENT_MAP = {
  'characters-changed': {
    create: (d) => ({
      key: 'toast.character.created',
      type: 'success',
      params: { name: d.entityName },
    }),
    update: (d) => ({
      key: 'toast.character.updated',
      type: 'success',
      params: { name: d.entityName },
    }),
    delete: (d) =>
      d.count > 1
        ? {
            key: 'toast.character.deletedMultiple',
            type: 'info',
            params: { name: d.entityName, count: d.count },
          }
        : { key: 'toast.character.deleted', type: 'info', params: { name: d.entityName } },
    duplicate: (d) => ({
      key: 'toast.character.duplicated',
      type: 'success',
      params: { name: d.entityName },
    }),
  },
  'threads-changed': {
    create: () => ({ key: 'toast.thread.created', type: 'success' }),
    delete: (d) =>
      d.count > 1
        ? { key: 'toast.thread.deletedMultiple', type: 'info', params: { count: d.count } }
        : { key: 'toast.thread.deleted', type: 'info' },
    duplicate: () => ({ key: 'toast.thread.duplicated', type: 'success' }),
  },
  'personas-changed': {
    create: (d) => ({
      key: 'toast.persona.created',
      type: 'success',
      params: { name: d.entityName },
    }),
    update: (d) => ({
      key: 'toast.persona.updated',
      type: 'success',
      params: { name: d.entityName },
    }),
    delete: (d) =>
      d.count > 1
        ? { key: 'toast.persona.deletedMultiple', type: 'info', params: { count: d.count } }
        : { key: 'toast.persona.deleted', type: 'info', params: { name: d.entityName } },
    duplicate: (d) =>
      d.count > 1
        ? { key: 'toast.persona.duplicatedMultiple', type: 'success', params: { count: d.count } }
        : { key: 'toast.persona.duplicated', type: 'success', params: { name: d.entityName } },
    import: (d) => ({ key: 'toast.persona.imported', type: 'success', params: { count: d.count } }),
  },
  'writingInstructions-changed': {
    create: (d) => ({
      key: 'toast.writingInstruction.created',
      type: 'success',
      params: { name: d.entityName },
    }),
    update: (d) => ({
      key: 'toast.writingInstruction.updated',
      type: 'success',
      params: { name: d.entityName },
    }),
    delete: (d) =>
      d.count > 1
        ? {
            key: 'toast.writingInstruction.deletedMultiple',
            type: 'info',
            params: { count: d.count },
          }
        : { key: 'toast.writingInstruction.deleted', type: 'info', params: { name: d.entityName } },
    duplicate: (d) =>
      d.count > 1
        ? {
            key: 'toast.writingInstruction.duplicatedMultiple',
            type: 'success',
            params: { count: d.count },
          }
        : {
            key: 'toast.writingInstruction.duplicated',
            type: 'success',
            params: { name: d.entityName },
          },
    import: (d) => ({
      key: 'toast.writingInstruction.imported',
      type: 'success',
      params: { count: d.count },
    }),
  },
}

function ToastObserver() {
  const { addToast } = useToast()

  useEffect(() => {
    const entries = Object.entries(EVENT_MAP)

    const handlers = entries.map(([eventType, actionMap]) => {
      const handler = (e) => {
        const detail = e.detail || {}
        const action = detail.action
        if (!action) return
        const entry = actionMap[action]
        if (!entry) return
        const config = entry(detail)
        addToast(i18n.t(config.key, config.params), { type: config.type })
      }
      window.addEventListener(eventType, handler)
      return [eventType, handler]
    })

    return () => {
      handlers.forEach(([eventType, handler]) => {
        window.removeEventListener(eventType, handler)
      })
    }
  }, [addToast])

  return null
}

export default ToastObserver
