export default function Label({
  required = false,
  highlight = false,
  htmlFor,
  className = '',
  children,
  description,
  ...rest
}) {
  const labelClass = `block text-sm font-medium ${highlight ? 'text-highlight' : 'text-text'} ${className}`
  const content = (
    <>
      {children}
      {required && <span className="text-error ml-0.5">*</span>}
    </>
  )
  if (!description) {
    return (
      <label htmlFor={htmlFor} className={`${labelClass} mb-1`} {...rest}>
        {content}
      </label>
    )
  }
  return (
    <div className="mb-1">
      <label htmlFor={htmlFor} className={labelClass} {...rest}>
        {content}
      </label>
      <p className="text-xs text-secondary mt-0.5">{description}</p>
    </div>
  )
}
