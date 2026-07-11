export default function Label({ required = false, htmlFor, className = '', children, ...rest }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-sm font-medium text-text mb-1 ${className}`}
      {...rest}
    >
      {children}
      {required && <span className="text-error ml-0.5">*</span>}
    </label>
  )
}
