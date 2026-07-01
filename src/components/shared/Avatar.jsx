const SIZES = {
  sm: 'text-xl w-7 h-7',
  md: 'text-2xl w-8 h-8',
  lg: 'text-3xl w-9 h-9',
}

function Avatar({ src, alt = '', size = 'md', className = '' }) {
  const cls = `${SIZES[size] || SIZES.md} ${className}`
  if (!src) {
    return <span data-avatar className={cls}>{'👤'}</span>
  }
  if (/^https?:\/\//.test(src) || src.startsWith('data:image/')) {
    return <img src={src} alt={alt} data-avatar className={`rounded-full object-cover ${cls}`} />
  }
  return <span data-avatar className={cls}>{src}</span>
}

export default Avatar
