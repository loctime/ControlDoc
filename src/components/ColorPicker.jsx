//components/ColorPicker.jsx
import { useEffect, useState, useRef } from 'react';
import { 
  IconButton, 
  Tooltip, 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  ListItemText,
  Divider,
  Typography,
  Box
} from "@mui/material";
import PaletteIcon from "@mui/icons-material/Palette";
import FormatColorFillIcon from "@mui/icons-material/FormatColorFill";
import DashboardIcon from "@mui/icons-material/Dashboard";
import MenuIcon from "@mui/icons-material/Menu";
import DescriptionIcon from "@mui/icons-material/Description";

// Utilidad para aclarar/oscurecer un color HEX
function shadeColor(color, percent) {
  let R = parseInt(color.substring(1,3),16);
  let G = parseInt(color.substring(3,5),16);
  let B = parseInt(color.substring(5,7),16);
  R = parseInt(R * (100 + percent) / 100);
  G = parseInt(G * (100 + percent) / 100);
  B = parseInt(B * (100 + percent) / 100);
  R = (R<255)?R:255;
  G = (G<255)?G:255;
  B = (B<255)?B:255;
  const RR = ((R.toString(16).length===1)?"0":"") + R.toString(16);
  const GG = ((G.toString(16).length===1)?"0":"") + G.toString(16);
  const BB = ((B.toString(16).length===1)?"0":"") + B.toString(16);
  return "#"+RR+GG+BB;
}

// Calcular luminancia de un color HEX (retorna valor 0-1)
function getLuminanceFromHex(hexColor) {
  const R = parseInt(hexColor.substring(1,3),16);
  const G = parseInt(hexColor.substring(3,5),16);
  const B = parseInt(hexColor.substring(5,7),16);
  
  const getLuminance = (val) => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  };
  
  return 0.2126 * getLuminance(R) + 0.7152 * getLuminance(G) + 0.0722 * getLuminance(B);
}

// Calcular el color de texto ideal basado en el contraste (negro o blanco)
function getContrastColor(backgroundColor) {
  const luminance = getLuminanceFromHex(backgroundColor);
  
  // Si la luminancia es alta (color claro), usar texto negro, sino blanco
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Configuración de colores personalizables
const colorSettings = {
  primary: {
    label: 'Color Principal',
    icon: <PaletteIcon />,
    varName: '--primary-main',
    darkVar: '--primary-dark',
    lightVar: '--primary-light',
    default: '#1976d2',
    updateTheme: true, // Requiere actualizar tema de Material-UI
  },
  background: {
    label: 'Fondo Global',
    icon: <FormatColorFillIcon />,
    varName: '--background-default',
    default: '#f5f5f5',
    updateTheme: false,
  },
  page: {
    label: 'Fondo de Páginas',
    icon: <DashboardIcon />,
    varName: '--page-background',
    default: '#f5f5f5',
    updateTheme: false,
  },
  navbar: {
    label: 'Fondo del Navbar',
    icon: <MenuIcon />,
    varName: '--navbar-background',
    default: '#ffffff',
    updateTheme: false,
  },
  paper: {
    label: 'Fondo de Componentes',
    icon: <DescriptionIcon />,
    varName: '--paper-background',
    default: '#ffffff',
    updateTheme: true,
  },
};

// Temas predefinidos con paletas armoniosas
const predefinedThemes = {
  classic: {
    name: 'Tema Clásico',
    colors: {
      primary: '#1976d2',
      background: '#f5f5f5',
      page: '#ffffff',
      navbar: '#ffffff',
      paper: '#ffffff',
    }
  },
  dark: {
    name: 'Tema Oscuro',
    colors: {
      primary: '#6366f1',
      background: '#1a1a1a',
      page: '#2d2d2d',
      navbar: '#1a1a1a',
      paper: '#2d2d2d',
    }
  },
  nature: {
    name: 'Tema Naturaleza',
    colors: {
      primary: '#10b981',
      background: '#f0fdf4',
      page: '#ffffff',
      navbar: '#ffffff',
      paper: '#ffffff',
    }
  }
};

export default function ColorPicker() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedColor, setSelectedColor] = useState('primary');
  const [currentColor, setCurrentColor] = useState(() => {
    return localStorage.getItem('primary-main') || colorSettings.primary.default;
  });
  
  const themeUpdateTimer = useRef(null);

  useEffect(() => {
    // Cargar colores guardados al montar
    Object.keys(colorSettings).forEach(key => {
      const setting = colorSettings[key];
      const savedColor = localStorage.getItem(setting.varName.replace('--', ''));
      if (savedColor) {
        // Aplicar color y calcular texto automáticamente
        applyColor(key, savedColor, false);
      } else {
        // Si no hay color guardado, calcular el texto para el color por defecto
        const textColor = getContrastColor(setting.default);
        let textColorVar;
        if (key === 'primary') {
          textColorVar = '--primary-text';
        } else if (key === 'background') {
          textColorVar = '--background-default-text';
        } else if (key === 'page') {
          textColorVar = '--page-background-text';
          // Calcular color de pestaña activa para el fondo por defecto
          const pageLuminance = getLuminanceFromHex(setting.default);
          const primaryLight = getComputedStyle(document.documentElement).getPropertyValue('--primary-light').trim() || '#4dabf5';
          let tabActiveColor;
          if (pageLuminance < 0.3) {
            const primaryLightLuminance = getLuminanceFromHex(primaryLight);
            tabActiveColor = primaryLightLuminance > 0.5 ? primaryLight : '#ffffff';
          } else {
            tabActiveColor = primaryLight;
          }
          document.documentElement.style.setProperty('--tab-active-text', tabActiveColor);
          
          // Calcular color de divider
          const dividerColor = pageLuminance < 0.3 
            ? 'rgba(255, 255, 255, 0.12)' 
            : 'rgba(0, 0, 0, 0.12)';
          document.documentElement.style.setProperty('--divider-color', dividerColor);
        } else if (key === 'navbar') {
          textColorVar = '--navbar-background-text';
        } else if (key === 'paper') {
          textColorVar = '--paper-background-text';
        }
        
        if (textColorVar) {
          document.documentElement.style.setProperty(textColorVar, textColor);
        }
      }
    });
  }, []);

  const applyColor = (colorKey, newColor, updateTheme = true) => {
    const setting = colorSettings[colorKey];
    
    // Actualizar variable CSS principal
    document.documentElement.style.setProperty(setting.varName, newColor);
    localStorage.setItem(setting.varName.replace('--', ''), newColor);
    
    // Calcular y aplicar color de texto automáticamente
    const textColor = getContrastColor(newColor);
    let textColorVar;
    if (colorKey === 'primary') {
      textColorVar = '--primary-text';
    } else if (colorKey === 'background') {
      textColorVar = '--background-default-text';
    } else if (colorKey === 'page') {
      textColorVar = '--page-background-text';
      // Calcular color para pestaña activa basado en el fondo
      // Si el fondo es oscuro, usar un color claro para la pestaña activa
      // Si el fondo es claro, usar el color primario
      const pageLuminance = getLuminanceFromHex(newColor);
      const primaryMain = getComputedStyle(document.documentElement).getPropertyValue('--primary-main').trim() || '#1976d2';
      const primaryLight = getComputedStyle(document.documentElement).getPropertyValue('--primary-light').trim() || '#4dabf5';
      
          // Si el fondo es oscuro (luminancia < 0.3), usar un color muy claro para la pestaña activa
          // Si el fondo es claro, usar el primary-light (que siempre es más claro que primary-main)
          let tabActiveColor;
          if (pageLuminance < 0.3) {
            // Fondo muy oscuro: usar un color claro garantizado
            const primaryLightLuminance = getLuminanceFromHex(primaryLight);
            // Si primary-light también es oscuro, usar blanco, sino usar primary-light
            tabActiveColor = primaryLightLuminance > 0.5 ? primaryLight : '#ffffff';
          } else {
            // Fondo claro o medio: usar primary-light que es más visible
            tabActiveColor = primaryLight;
          }
          
          document.documentElement.style.setProperty('--tab-active-text', tabActiveColor);
          localStorage.setItem('tab-active-text', tabActiveColor);
          
          // Calcular color de divider basado en el fondo
          // Si el fondo es oscuro, usar un divider claro (blanco semi-transparente)
          // Si el fondo es claro, usar un divider oscuro (negro semi-transparente)
          const dividerColor = pageLuminance < 0.3 
            ? 'rgba(255, 255, 255, 0.12)' 
            : 'rgba(0, 0, 0, 0.12)';
          document.documentElement.style.setProperty('--divider-color', dividerColor);
          localStorage.setItem('divider-color', dividerColor);
    } else if (colorKey === 'navbar') {
      textColorVar = '--navbar-background-text';
    } else if (colorKey === 'paper') {
      textColorVar = '--paper-background-text';
    }
    
    if (textColorVar) {
      document.documentElement.style.setProperty(textColorVar, textColor);
      localStorage.setItem(textColorVar.replace('--', ''), textColor);
    }
    
    // Si es el color principal, generar variantes y actualizar tema
    if (colorKey === 'primary') {
      const primaryDark = shadeColor(newColor, -20);
      const primaryLight = shadeColor(newColor, 20);
      
      document.documentElement.style.setProperty(setting.darkVar, primaryDark);
      document.documentElement.style.setProperty(setting.lightVar, primaryLight);
      
      // Calcular colores de texto para las variantes también
      document.documentElement.style.setProperty('--primary-dark-text', getContrastColor(primaryDark));
      document.documentElement.style.setProperty('--primary-light-text', getContrastColor(primaryLight));
      
      // Actualizar color de pestaña activa si ya existe
      const pageBackground = getComputedStyle(document.documentElement).getPropertyValue('--page-background').trim() || '#f5f5f5';
      const pageLuminance = getLuminanceFromHex(pageBackground);
      
      let tabActiveColor;
      if (pageLuminance < 0.3) {
        // Fondo muy oscuro: usar un color claro garantizado
        const primaryLightLuminance = getLuminanceFromHex(primaryLight);
        tabActiveColor = primaryLightLuminance > 0.5 ? primaryLight : '#ffffff';
      } else {
        // Fondo claro o medio: usar primary-light
        tabActiveColor = primaryLight;
      }
      
      document.documentElement.style.setProperty('--tab-active-text', tabActiveColor);
      localStorage.setItem('tab-active-text', tabActiveColor);
      
      // Actualizar color de divider
      const dividerColor = pageLuminance < 0.3 
        ? 'rgba(255, 255, 255, 0.12)' 
        : 'rgba(0, 0, 0, 0.12)';
      document.documentElement.style.setProperty('--divider-color', dividerColor);
      localStorage.setItem('divider-color', dividerColor);
      
      // Actualizar theme-color meta tag
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', newColor);
      }
      
      // Actualizar tema de Material-UI si es necesario
      if (updateTheme && setting.updateTheme) {
        window.dispatchEvent(new CustomEvent('colorChanged', { detail: { color: newColor } }));
      }
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleColorSelect = (colorKey) => {
    setSelectedColor(colorKey);
    const setting = colorSettings[colorKey];
    const colorValue = getCurrentColorValue(colorKey);
    setCurrentColor(colorValue);
  };

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    setCurrentColor(newColor);
    
    // Actualizar CSS inmediatamente (rápido)
    applyColor(selectedColor, newColor, false);
    
    // Si el color requiere actualizar el tema (primary o paper), actualizar después de debounce
    const setting = colorSettings[selectedColor];
    if (setting && setting.updateTheme) {
      // Limpiar timer anterior
      if (themeUpdateTimer.current) {
        clearTimeout(themeUpdateTimer.current);
      }
      
      // Actualizar tema después de 150ms sin cambios (debounce)
      themeUpdateTimer.current = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('colorChanged', { detail: { color: newColor } }));
      }, 150);
    }
  };

  const handleMouseUp = () => {
    // Cuando el usuario suelta el mouse, actualizar tema inmediatamente si el color requiere actualización
    const setting = colorSettings[selectedColor];
    if (setting && setting.updateTheme) {
      const currentColorValue = getCurrentColorValue(selectedColor);
      // Limpiar timer pendiente
      if (themeUpdateTimer.current) {
        clearTimeout(themeUpdateTimer.current);
      }
      // Actualizar inmediatamente
      window.dispatchEvent(new CustomEvent('colorChanged', { detail: { color: currentColorValue } }));
    }
  };

  const getCurrentColorValue = (colorKey) => {
    const setting = colorSettings[colorKey];
    return localStorage.getItem(setting.varName.replace('--', '')) || setting.default;
  };

  const applyTheme = (themeKey) => {
    const theme = predefinedThemes[themeKey];
    if (!theme) return;
    
    // Aplicar todos los colores del tema
    Object.keys(theme.colors).forEach(colorKey => {
      applyColor(colorKey, theme.colors[colorKey], false);
    });
    
    // Actualizar tema de Material-UI después de aplicar todos los colores
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('colorChanged', { 
        detail: { color: theme.colors.primary } 
      }));
    }, 100);
    
    handleMenuClose();
  };

  return (
    <>
      <Tooltip title="Personalizar colores">
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            p: 0.5,
            bgcolor: "background.paper",
            borderRadius: "50%",
            boxShadow: 1,
            zIndex: 1301,
          }}
        >
          <PaletteIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { minWidth: 250 }
        }}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2" fontWeight="bold">
            Personalizar Colores
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            Temas Predefinidos
          </Typography>
        </MenuItem>
        {Object.keys(predefinedThemes).map((themeKey, index) => (
          <MenuItem
            key={themeKey}
            onClick={() => applyTheme(themeKey)}
            sx={{ py: 1 }}
          >
            <ListItemIcon>
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.5,
                  alignItems: 'center',
                }}
              >
                <Typography variant="body2" sx={{ mr: 1, fontWeight: 'bold' }}>
                  {index + 1}
                </Typography>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: predefinedThemes[themeKey].colors.primary,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: predefinedThemes[themeKey].colors.background,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: predefinedThemes[themeKey].colors.page,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              </Box>
            </ListItemIcon>
            <ListItemText primary={predefinedThemes[themeKey].name} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            Personalizar Individual
          </Typography>
        </MenuItem>
        {Object.keys(colorSettings).map((colorKey) => {
          const setting = colorSettings[colorKey];
          const isSelected = selectedColor === colorKey;
          const colorValue = getCurrentColorValue(colorKey);
          
          return (
            <MenuItem
              key={colorKey}
              onClick={() => handleColorSelect(colorKey)}
              sx={{
                bgcolor: isSelected ? 'action.selected' : 'transparent'
              }}
            >
              <ListItemIcon>
                {setting.icon}
              </ListItemIcon>
              <ListItemText 
                primary={setting.label}
                secondary={isSelected ? colorValue : ''}
              />
              {isSelected && (
                <input
                  type="color"
                  value={colorValue}
                  onChange={handleColorChange}
                  onMouseUp={handleMouseUp}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 32,
                    height: 32,
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    cursor: 'pointer',
                    marginLeft: 8,
                  }}
                />
              )}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

