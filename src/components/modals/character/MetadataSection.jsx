import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../../shared/CollapsibleSection'
import Label from '../../shared/Label'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

function MetadataSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')

  return (
    <div className="space-y-4">
      <div>
        <Label className={form.creator?.trim() ? 'text-highlight' : 'text-text'}>
          {t('creatorLabel')}
        </Label>
        <input
          className={inputClass}
          value={form.creator || ''}
          onChange={(e) => onChange('creator', e.target.value)}
          placeholder={t('creatorPlaceholder')}
        />
      </div>

      <div>
        <Label className={form.characterVersion?.trim() ? 'text-highlight' : 'text-text'}>
          {t('characterVersionLabel')}
        </Label>
        <input
          className={inputClass}
          value={form.characterVersion || ''}
          onChange={(e) => onChange('characterVersion', e.target.value)}
          placeholder={t('characterVersionPlaceholder')}
        />
      </div>

      <CollapsibleSection
        label={t('creatorNotesLabel')}
        hasContent={!!form.creatorNotes?.trim()}
        storageKey={characterId ? `charSection.creatorNotes.${characterId}` : undefined}
        defaultExpanded={false}
      >
        <AutoResizeTextarea
          className={`${inputClass} resize-none mt-2`}
          value={form.creatorNotes || ''}
          onChange={(e) => onChange('creatorNotes', e.target.value)}
          placeholder={t('creatorNotesPlaceholder')}
          extraHeight={8}
        />
      </CollapsibleSection>
    </div>
  )
}

export default MetadataSection
