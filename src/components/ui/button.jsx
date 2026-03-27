// React import removed - using JSX runtime

export function Button({ 
  children, 
  className = '', 
  variant = 'default', 
  ...props 
}) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'destructive':
        return 'text-white';
      case 'outline':
        return 'bg-transparent border border-gray-300 hover:bg-gray-100 text-gray-700';
      case 'secondary':
        return 'bg-gray-200 hover:bg-gray-300 text-gray-800';
      default: // default variant
        return 'text-white';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'destructive':
        return {
          backgroundColor: 'var(--error-main)'
        };
      default:
        return {
          backgroundColor: 'var(--primary-main)'
        };
    }
  };

  const getHoverColor = () => {
    switch (variant) {
      case 'destructive':
        return getComputedStyle(document.documentElement).getPropertyValue('--error-dark').trim();
      default:
        return getComputedStyle(document.documentElement).getPropertyValue('--primary-dark').trim();
    }
  };

  return (
    <button
      className={`px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${getVariantClasses()} ${className}`}
      style={getVariantStyles()}
      onMouseEnter={(e) => {
        if (variant === 'default' || variant === 'destructive') {
          const hoverColor = getHoverColor();
          if (hoverColor) {
            e.currentTarget.style.backgroundColor = hoverColor;
          }
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'default' || variant === 'destructive') {
          e.currentTarget.style.backgroundColor = getVariantStyles().backgroundColor;
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}
