export default function Label({
  required = false,
  highlight = false,
  htmlFor,
  className = '',
  children,
  ...rest
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-sm font-medium mb-1 ${highlight ? 'text-highlight' : 'text-text'} ${className}`}
      {...rest}
    >
      {children}
      {required && <span className="text-error ml-0.5">*</span>}
    </label>
  )
}
