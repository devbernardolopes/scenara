import { useRef, useEffect, useCallback } from 'react'
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { isExternalImageUrl } from '../../lib/image'
import { Download, X } from '../../lib/icons'

function ImageViewerInner({ src, alt, imgRef, onZoomRef }) {
  const { centerView, resetTransform } = useControls()
  const lastTapRef = useRef(0)
  const touchStartRef = useRef(null)
  useEffect(() => {
    onZoomRef.current = (scale, animationTime, animationType) =>
      centerView(scale, animationTime, animationType)
  })

  const doReset = useCallback(() => {
    resetTransform(200, 'easeOut')
  }, [resetTransform])

  // Mobile: detect a double-tap (two quick taps without panning) and reset the
  // image to its original display size. The library's built-in touch double-tap
  // behaves inconsistently across devices, so we handle it explicitly.
  const handleTouchStart = (e) => {
    const t = e.changedTouches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchEnd = (e) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    const t = e.changedTouches[0]
    const moved = start ? Math.hypot(t.clientX - start.x, t.clientY - start.y) : 0
    if (moved > 10) {
      lastTapRef.current = 0
      return
    }
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0
      e.stopPropagation()
      doReset()
    } else {
      lastTapRef.current = now
    }
  }

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
        onDoubleClick={(e) => {
          e.stopPropagation()
          doReset()
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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
