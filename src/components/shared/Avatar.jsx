const SIZES = {
  sm: 'text-xl w-7 h-7',
  md: 'text-2xl w-8 h-8',
  lg: 'text-3xl w-9 h-9',
  xl: 'text-4xl w-10 h-10',
  '2xl': 'text-5xl w-12 h-12',
}

function Avatar({ src, alt = '', size = 'md', className = '', onClick }) {
  const cls = `${SIZES[size] || SIZES.md} ${className}`
  if (!src) {
    return (
      <span data-avatar className={cls}>
        {'👤'}
      </span>
    )
  }
  if (/^https?:\/\//.test(src) || src.startsWith('data:image/')) {
    return (
      <img
        src={src}
        alt={alt}
        data-avatar
        className={`rounded-full object-cover ${cls} ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      />
    )
  }
  return (
    <span data-avatar className={cls}>
      {src}
    </span>
  )
}

export default Avatar
