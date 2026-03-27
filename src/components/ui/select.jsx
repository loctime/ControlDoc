import React, { useState, useRef, useEffect } from 'react';

export function Select({ children, value, onValueChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  // Cierra el menú cuando se hace clic fuera del componente
  useEffect(() => {
    function handleClickOutside(event) {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={selectRef} className="relative">
      {React.Children.map(children, (child) => {
        if (child.type === SelectTrigger) {
          return React.cloneElement(child, {
            onClick: () => setIsOpen(!isOpen),
            isOpen,
            value
          });
        }
        if (child.type === SelectContent && isOpen) {
          return React.cloneElement(child, {
            onValueChange,
            onClose: () => setIsOpen(false)
          });
        }
        return null;
      })}
    </div>
  );
}

export function SelectTrigger({ children, onClick, isOpen }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-left focus:outline-none focus:ring-2"
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
    >
      {children}
      <span className="ml-2">
        {isOpen ? '▲' : '▼'}
      </span>
    </button>
  );
}

export function SelectValue({ children, placeholder }) {
  return <span>{children || placeholder}</span>;
}

export function SelectContent({ children, onValueChange, onClose }) {
  return (
    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
      {React.Children.map(children, (child) => {
        if (child.type === SelectItem) {
          return React.cloneElement(child, {
            onSelect: (value) => {
              onValueChange(value);
              onClose();
            }
          });
        }
        return child;
      })}
    </div>
  );
}

export function SelectItem({ children, value, onSelect }) {
  return (
    <div
      onClick={() => onSelect(value)}
      className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100"
    >
      {children}
    </div>
  );
}
