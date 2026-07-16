import { useRef } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { Download, X } from '../../lib/icons'

function ImageViewerModal({ src, alt }) {
  const { t } = useTranslation('common')
  const { closeModal } = useModal()
  const pointerStart = useRef(null)
  const pointerDownOnImage = useRef(false)
  const imgRef = useRef(null)

  const handleDownload = (e) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = src
    a.download = alt || 'image'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handlePointerDown = (e) => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
    const rect = imgRef.current?.getBoundingClientRect()
    pointerDownOnImage.current = rect
      ? e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      : false
  }

  const handleBackdropClick = (e) => {
    e.stopPropagation()
    const start = pointerStart.current
    if (!start || pointerDownOnImage.current) return
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
    if (moved < 8) closeModal()
  }

  return (
    <div
      className="relative w-full h-full flex items-center justify-center"
      onPointerDown={handlePointerDown}
      onClick={handleBackdropClick}
    >
      <TransformWrapper
        minScale={0.5}
        maxScale={5}
        smooth={false}
        wheel={{ step: 0.12, wheelDisabled: false }}
        doubleClick={{ mode: 'reset' }}
        panning={{ disabled: false }}
        pinch={{ disabled: false }}
      >
        <TransformComponent
          wrapperClass="!w-full !h-full"
          contentClass="!w-full !h-full flex items-center justify-center"
        >
          <img
            src={src}
            alt={alt || ''}
            className="max-w-[90vw] max-h-[90vh] object-contain select-none"
            draggable={false}
            ref={imgRef}
          />
        </TransformComponent>
      </TransformWrapper>

      <div
        className="absolute top-4 right-4 flex items-center gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
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
          onClick={(e) => {
            e.stopPropagation()
            closeModal()
          }}
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
