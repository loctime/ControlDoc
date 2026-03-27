// React import removed - using JSX runtime

export function Input({ 
  className = '', 
  type = 'text', 
  ...props 
}) {
  return (
    <input
      type={type}
      className={`px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 ${className}`}
      style={{
        '--focus-ring': 'var(--primary-main)',
        '--focus-border': 'var(--primary-main)'
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--focus-border)';
        e.currentTarget.style.setProperty('--tw-ring-color', 'var(--focus-ring)');
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '';
        e.currentTarget.style.setProperty('--tw-ring-color', '');
      }}
      {...props}
    />
  );
}
