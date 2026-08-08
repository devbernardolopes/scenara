import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import CloseButton from '../shared/CloseButton'
import { CheckCircle, AlertTriangle } from '../../lib/icons'

function RedeemCodeResultModal({ status, code, summary, error }) {
  const { t } = useTranslation('settings')
  const { closeModal } = useModal()

  const isSuccess = status === 'success'

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
        <h2 className="text-xl font-semibold text-text">{t('api.redeem.title')}</h2>
        <CloseButton onClick={closeModal} />
      </div>
      <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
        {isSuccess ? (
          <>
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle className="w-10 h-10 text-success" />
              <p className="text-text text-sm font-medium">{t('api.redeem.successTitle')}</p>
              <p className="text-secondary text-sm">{t('api.redeem.successMessage', { code })}</p>
            </div>
            {summary && (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-secondary mb-0.5">
                    {t('api.redeem.keyLabel')}
                  </p>
                  <p className="text-text">{summary.label}</p>
                </div>
                {summary.profiles?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-secondary mb-1">
                      {t('api.redeem.profilesLabel')}
                    </p>
                    <ul className="list-disc list-inside text-text space-y-0.5">
                      {summary.profiles.map((p) => (
                        <li key={p.id}>{p.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.kinds?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-secondary mb-1">
                      {t('api.redeem.kindsLabel')}
                    </p>
                    <ul className="list-disc list-inside text-text space-y-0.5">
                      {summary.kinds.map((kind) => (
                        <li key={kind}>{t(`api.profileAssignment.${kind}`)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertTriangle className="w-10 h-10 text-error" />
            <p className="text-text text-sm font-medium">{t('api.redeem.errorTitle')}</p>
            <p className="text-secondary text-sm">
              {t(`api.redeem.errors.${error || 'invalid'}`, { code })}
            </p>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 shadow-section shrink-0">
        <button
          type="button"
          onClick={closeModal}
          className="min-h-[44px] px-4 btn-primary text-sm"
        >
          {t('close', { ns: 'common' })}
        </button>
      </div>
    </div>
  )
}

export default RedeemCodeResultModal
