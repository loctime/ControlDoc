import { createTheme } from '@mui/material/styles';

// Función para obtener el color desde las variables CSS
const getCSSVariable = (varName) => {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim() || '#1976d2';
};

// Crear tema dinámico que lee las variables CSS
export const createDynamicTheme = () => {
  const primaryMain = getCSSVariable('--primary-main');
  const primaryDark = getCSSVariable('--primary-dark');
  const primaryLight = getCSSVariable('--primary-light');
  const primaryContrastText = getCSSVariable('--primary-text') || '#ffffff';
  
  // Colores de fondo y texto para componentes (Paper, Card, etc.)
  const paperBackground = getCSSVariable('--paper-background') || '#ffffff';
  const paperBackgroundText = getCSSVariable('--paper-background-text') || '#000000';
  
  // Colores de texto basados en el fondo de componentes (Paper)
  // text.primary y text.secondary deben basarse en el fondo de componentes, no en el fondo de página
  let textSecondary;
  if (paperBackgroundText === '#000000' || paperBackgroundText.toLowerCase() === '#000') {
    textSecondary = 'rgba(0, 0, 0, 0.6)';
  } else if (paperBackgroundText === '#ffffff' || paperBackgroundText.toLowerCase() === '#fff') {
    textSecondary = 'rgba(255, 255, 255, 0.7)';
  } else {
    // Extraer RGB del color
    const hex = paperBackgroundText.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calcular luminancia para determinar si es claro u oscuro
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    textSecondary = luminance > 0.5 
      ? 'rgba(0, 0, 0, 0.6)' 
      : 'rgba(255, 255, 255, 0.7)';
  }

  return createTheme({
    palette: {
      primary: {
        main: primaryMain,
        dark: primaryDark,
        light: primaryLight,
        contrastText: primaryContrastText,
      },
      text: {
        primary: paperBackgroundText,  // Usar color de texto de componentes
        secondary: textSecondary,
      },
      background: {
        default: getCSSVariable('--background-default') || '#f5f5f5',
        paper: paperBackground,  // Fondo de componentes (Paper, Card, etc.)
      },
    },
  });
};

// Tema inicial
export const theme = createDynamicTheme();

