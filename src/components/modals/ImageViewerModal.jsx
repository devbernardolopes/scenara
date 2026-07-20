import { useRef, useEffect } from 'react'
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { isExternalImageUrl } from '../../lib/image'
import { Download, X } from '../../lib/icons'

function ImageViewerInner({ src, alt, imgRef, onZoomRef }) {
  const { centerView, resetTransform } = useControls()
  useEffect(() => {
    onZoomRef.current = (scale, animationTime, animationType) =>
      centerView(scale, animationTime, animationType)
  })

  // The zoom library attaches native listeners on its wrapper and calls
  // stopPropagation, which prevents React's root-delegated synthetic events
  // (onDoubleClick/onTouchEnd) on the <img> from ever firing. So we attach our
  // own native listeners directly on the <img> element — they run during the
  // bubble phase *before* the wrapper's listener. A double-tap (or double-click)
  // resets the image to its original display size.
  useEffect(() => {
    const el = imgRef.current
    if (!el) return

    let lastTap = 0
    let touchStart = null

    const doReset = () => resetTransform(200, 'easeOut')

    const handleDblClick = (e) => {
      e.stopPropagation()
      doReset()
    }

    const handleTouchStart = (e) => {
      const t = e.changedTouches[0]
      touchStart = { x: t.clientX, y: t.clientY }
    }

    const handleTouchEnd = (e) => {
      const start = touchStart
      touchStart = null
      const t = e.changedTouches[0]
      const moved = start ? Math.hypot(t.clientX - start.x, t.clientY - start.y) : 0
      if (moved > 10) {
        lastTap = 0
        return
      }
      const now = Date.now()
      if (now - lastTap < 300) {
        lastTap = 0
        e.stopPropagation()
        doReset()
      } else {
        lastTap = now
      }
    }

    el.addEventListener('dblclick', handleDblClick)
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('dblclick', handleDblClick)
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [imgRef, resetTransform])

  return (
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
  )
}

function ImageViewerModal({ src, alt }) {
  const { t } = useTranslation('common')
  const { closeModal } = useModal()
  const online = useOnlineStatus()
  const pointerStart = useRef(null)
  const pointerDownOnImage = useRef(false)
  const imgRef = useRef(null)
  const centerViewRef = useRef(null)
  const canShowImage = !isExternalImageUrl(src) || online

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

  const handleZoom = () => {
    centerViewRef.current?.(undefined, 0)
  }

  return (
    <div
      className="relative w-full h-full flex items-center justify-center"
      onPointerDown={handlePointerDown}
      onClick={handleBackdropClick}
    >
      {canShowImage ? (
        <TransformWrapper
          minScale={0.5}
          maxScale={5}
          smooth={false}
          wheel={{ step: 0.12, wheelDisabled: false }}
          doubleClick={{ disabled: true }}
          panning={{ disabled: false }}
          pinch={{ disabled: false }}
          onZoom={handleZoom}
        >
          <ImageViewerInner src={src} alt={alt} imgRef={imgRef} onZoomRef={centerViewRef} />
        </TransformWrapper>
      ) : (
        <div className="flex items-center justify-center text-6xl text-tertiary">{'👤'}</div>
      )}

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
