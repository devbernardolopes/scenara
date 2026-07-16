import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { Download, X } from '../../lib/icons'

function ImageViewerModal({ src, alt }) {
  const { t } = useTranslation('common')
  const { closeModal } = useModal()

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = src
    a.download = alt || 'image'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <TransformWrapper
        minScale={0.5}
        maxScale={5}
        doubleClick={{ mode: 'reset' }}
        wheel={{ wheelDisabled: false }}
        panning={{ disabled: false }}
        pinch={{ disabled: false }}
      >
        <TransformComponent
          wrapperClass="flex items-center justify-center"
          contentClass="flex items-center justify-center"
        >
          <img
            src={src}
            alt={alt || ''}
            className="max-w-[90vw] max-h-[90vh] object-contain select-none"
            draggable={false}
          />
        </TransformComponent>
      </TransformWrapper>

      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          type="button"
          onClick={handleDownload}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md bg-black/40 text-white hover:bg-black/60"
          aria-label={t('downloadImage')}
          title={t('downloadImage')}
        >
          <Download className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={closeModal}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md bg-black/40 text-white hover:bg-black/60"
          aria-label={t('close')}
          title={t('close')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

export default ImageViewerModal
