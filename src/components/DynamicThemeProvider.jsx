import { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { createDynamicTheme } from '../config/theme';

export default function DynamicThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Cargar color guardado antes de crear el tema
    if (typeof document !== 'undefined') {
      const savedPrimary = localStorage.getItem('primary-main');
      if (savedPrimary) {
        // Aplicar el color guardado a las variables CSS primero
        document.documentElement.style.setProperty('--primary-main', savedPrimary);
      }
      return createDynamicTheme();
    }
    return createDynamicTheme();
  });

  const debounceTimer = useRef(null);

  useEffect(() => {
    // Función para calcular variantes de color
    const shadeColor = (color, percent) => {
      const R = parseInt(color.substring(1,3),16);
      const G = parseInt(color.substring(3,5),16);
      const B = parseInt(color.substring(5,7),16);
      const newR = Math.min(255, parseInt(R * (100 + percent) / 100));
      const newG = Math.min(255, parseInt(G * (100 + percent) / 100));
      const newB = Math.min(255, parseInt(B * (100 + percent) / 100));
      const RR = ((newR.toString(16).length===1)?"0":"") + newR.toString(16);
      const GG = ((newG.toString(16).length===1)?"0":"") + newG.toString(16);
      const BB = ((newB.toString(16).length===1)?"0":"") + newB.toString(16);
      return "#"+RR+GG+BB;
    };
    
    // Calcular luminancia de un color HEX
    const getLuminanceFromHex = (hexColor) => {
      const R = parseInt(hexColor.substring(1,3),16);
      const G = parseInt(hexColor.substring(3,5),16);
      const B = parseInt(hexColor.substring(5,7),16);
      const getLuminance = (val) => {
        val = val / 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * getLuminance(R) + 0.7152 * getLuminance(G) + 0.0722 * getLuminance(B);
    };
    
    // Calcular color de texto basado en contraste
    const getContrastColor = (backgroundColor) => {
      const luminance = getLuminanceFromHex(backgroundColor);
      return luminance > 0.5 ? '#000000' : '#ffffff';
    };
    
    // Cargar todos los colores guardados al montar
    const loadSavedColors = () => {
      if (typeof document === 'undefined') return false;
      
      let colorsLoaded = false;
      
      // Cargar color principal y sus variantes
      const savedPrimary = localStorage.getItem('primary-main');
      if (savedPrimary) {
        document.documentElement.style.setProperty('--primary-main', savedPrimary);
        const primaryDark = shadeColor(savedPrimary, -20);
        const primaryLight = shadeColor(savedPrimary, 20);
        document.documentElement.style.setProperty('--primary-dark', primaryDark);
        document.documentElement.style.setProperty('--primary-light', primaryLight);
        
        // Calcular colores de texto para las variantes
        document.documentElement.style.setProperty('--primary-text', getContrastColor(savedPrimary));
        document.documentElement.style.setProperty('--primary-dark-text', getContrastColor(primaryDark));
        document.documentElement.style.setProperty('--primary-light-text', getContrastColor(primaryLight));
        
        colorsLoaded = true;
      }
      
      // Cargar otros colores y calcular sus colores de texto
      const colorMap = {
        'background-default': '--background-default-text',
        'page-background': '--page-background-text',
        'navbar-background': '--navbar-background-text',
        'paper-background': '--paper-background-text'
      };
      
      Object.keys(colorMap).forEach(varName => {
        const saved = localStorage.getItem(varName);
        if (saved) {
          document.documentElement.style.setProperty(`--${varName}`, saved);
          document.documentElement.style.setProperty(colorMap[varName], getContrastColor(saved));
          
          // Si es page-background, calcular color de pestaña activa y divider
          if (varName === 'page-background') {
            const pageLuminance = getLuminanceFromHex(saved);
            const primaryLight = document.documentElement.style.getPropertyValue('--primary-light') || 
                                 getComputedStyle(document.documentElement).getPropertyValue('--primary-light').trim() || 
                                 '#4dabf5';
            let tabActiveColor;
            if (pageLuminance < 0.3) {
              const primaryLightLuminance = getLuminanceFromHex(primaryLight);
              tabActiveColor = primaryLightLuminance > 0.5 ? primaryLight : '#ffffff';
            } else {
              tabActiveColor = primaryLight;
            }
            document.documentElement.style.setProperty('--tab-active-text', tabActiveColor);
            localStorage.setItem('tab-active-text', tabActiveColor);
            
            // Calcular color de divider
            const dividerColor = pageLuminance < 0.3 
              ? 'rgba(255, 255, 255, 0.12)' 
              : 'rgba(0, 0, 0, 0.12)';
            document.documentElement.style.setProperty('--divider-color', dividerColor);
            localStorage.setItem('divider-color', dividerColor);
          }
        }
      });
      
      if (colorsLoaded) {
        // Actualizar tema con los colores cargados
        setTheme(createDynamicTheme());
      }
      
      return colorsLoaded;
    };

    // Intentar cargar colores guardados
    const colorsLoaded = loadSavedColors();

    // Actualizar tema cuando el DOM esté listo
    const updateTheme = () => {
      setTheme(createDynamicTheme());
    };

    // Actualizar tema inmediatamente si el DOM está listo
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      // Si no se cargaron colores guardados, actualizar con el tema por defecto
      if (!colorsLoaded) {
        updateTheme();
      }
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        loadSavedColors() || updateTheme();
      });
    }

    const handleColorChange = () => {
      // Limpiar el timer anterior
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      // Actualizar el tema después de 100ms de inactividad (debounce)
      debounceTimer.current = setTimeout(() => {
        setTheme(createDynamicTheme());
      }, 100);
    };

    // Escuchar el evento personalizado de cambio de color
    window.addEventListener('colorChanged', handleColorChange);

    return () => {
      window.removeEventListener('DOMContentLoaded', updateTheme);
      window.removeEventListener('colorChanged', handleColorChange);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
}

