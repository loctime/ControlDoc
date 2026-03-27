"use client"

import { useEffect, useState, useRef } from "react"
import {
  Box,
  Drawer,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
} from "@mui/material"
import { Link, useLocation } from "react-router-dom"
import ColorPicker from "../../../components/ColorPicker"
import Logo from "../../../components/common/Logo"
import { useAppConfig } from "../../../context/AppConfigContext"
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate"
import DashboardIcon from "@mui/icons-material/Dashboard"
import BusinessIcon from "@mui/icons-material/Business"
import DescriptionIcon from "@mui/icons-material/Description"
import UploadIcon from "@mui/icons-material/Upload"
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks"
import StorageIcon from "@mui/icons-material/Storage"
import ApprovalIcon from "@mui/icons-material/Approval"
import DomainIcon from "@mui/icons-material/Domain"
import EmpresasPendientesBell from "../dashboard/EmpresasPendientesBell"

const drawerWidth = 180

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

// Detectar si una imagen tiene transparencia (canal alpha)
async function checkImageTransparency(imageUrl) {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Verificar si hay píxeles transparentes (alpha < 255)
        // Muestrear algunos píxeles para mejor rendimiento
        const sampleSize = Math.min(1000, data.length / 4);
        const step = Math.floor(data.length / 4 / sampleSize);
        
        for (let i = 3; i < data.length; i += 4 * step) {
          if (data[i] < 255) {
            resolve(true);
            return;
          }
        }
        resolve(false);
      } catch (error) {
        console.warn('Error al verificar transparencia:', error);
        // Si es PNG, asumir que puede tener transparencia
        resolve(imageUrl.toLowerCase().includes('.png'));
      }
    };
    
    img.onerror = () => {
      // En caso de error (CORS, etc), verificar extensión
      resolve(imageUrl.toLowerCase().includes('.png'));
    };
    
    img.src = imageUrl;
  });
}

const menuItems = [
  { text: "Dashboard", icon: <DashboardIcon />, path: "/admin/dashboard" },
  { text: "Empresas", icon: <BusinessIcon />, path: "/admin/companies" },
  { text: "Requeridos", icon: <DescriptionIcon />, path: "/admin/required-documents" },
  {
    text: "Pendientes",
    icon: <UploadIcon sx={{ color: "var(--primary-text)" }} />,
    path: "/admin/uploaded-documents",
    highlight: true,
  },
  { text: "Aprobados", icon: <LibraryBooksIcon />, path: "/admin/document-library", highlight: true },
  { text: "Archivos", icon: <StorageIcon />, path: "/admin/store", highlight: true },
  { text: "Aprobar Empresas", icon: <ApprovalIcon />, path: "/admin/company-approvals" },
]

export default function DrawerMenu({ open, setLogoDialogOpen }) {
  const location = useLocation()
  const { appLogo } = useAppConfig()
  const [isLightBackground, setIsLightBackground] = useState(true)
  const [hasTransparency, setHasTransparency] = useState(false)
  const logoImageRef = useRef(null)
  
  console.log('DrawerMenu - appLogo actual:', appLogo)

  useEffect(() => {
    // Función para detectar si el fondo es claro u oscuro
    const checkBackgroundLuminance = () => {
      const primaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary-main')
        .trim() || '#1976d2'
      
      const luminance = getLuminanceFromHex(primaryColor)
      setIsLightBackground(luminance > 0.5)
    }

    // Verificar al montar
    checkBackgroundLuminance()

    // Escuchar cambios en los colores
    const handleColorChange = () => {
      setTimeout(checkBackgroundLuminance, 100)
    }

    window.addEventListener('colorChanged', handleColorChange)
    
    // Observar cambios en CSS variables
    const observer = new MutationObserver(checkBackgroundLuminance)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style']
    })

    return () => {
      window.removeEventListener('colorChanged', handleColorChange)
      observer.disconnect()
    }
  }, [])

  // Detectar transparencia cuando cambia el logo
  useEffect(() => {
    const detectTransparency = async () => {
      if (appLogo) {
        const transparent = await checkImageTransparency(appLogo);
        setHasTransparency(transparent);
      } else {
        // Verificar logo por defecto después de que se renderice
        setTimeout(() => {
          const defaultLogo = logoImageRef.current;
          if (defaultLogo && defaultLogo.src) {
            checkImageTransparency(defaultLogo.src).then(setHasTransparency);
          } else {
            // Asumir PNG por defecto puede tener transparencia
            setHasTransparency(true);
          }
        }, 100);
      }
    };

    detectTransparency();
  }, [appLogo]);

  // Estilos para logo con transparencia (solo drop shadow profesional)
  const transparentLogoStyles = {
    filter: isLightBackground 
      ? 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
      : 'drop-shadow(0 4px 12px rgba(255, 255, 255, 0.4)) drop-shadow(0 2px 6px rgba(255, 255, 255, 0.3)) drop-shadow(0 0 10px rgba(255, 255, 255, 0.2))',
  };

  // Estilos para logo sin transparencia (contenedor sólido + filtros)
  const solidLogoContainerStyles = {
    p: open ? 2 : 1,
    borderRadius: 3,
    backgroundColor: isLightBackground 
      ? 'rgba(255, 255, 255, 0.95)' 
      : 'rgba(255, 255, 255, 0.92)',
    boxShadow: isLightBackground
      ? '0 4px 16px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.15)'
      : '0 4px 20px rgba(0, 0, 0, 0.5), 0 2px 10px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    transition: "all 0.3s ease",
    border: isLightBackground
      ? '1px solid rgba(0, 0, 0, 0.08)'
      : '1px solid rgba(255, 255, 255, 0.15)',
  };

  const solidLogoImageStyles = {
    filter: isLightBackground 
      ? 'none'
      : 'brightness(1.15) contrast(1.1)',
  };

  return (
    <Drawer
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          backgroundColor: "var(--primary-main)",
          color: "var(--primary-text)",
        },
      }}
      variant="persistent"
      anchor="left"
      open={open}
    >
      <ColorPicker />

      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: open ? 220 : 80,
          transition: "all 0.3s ease",
          borderBottom: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        {hasTransparency ? (
          // Logo con transparencia: solo drop shadow profesional
          <Logo 
            ref={logoImageRef}
            height={open ? 140 : 50} 
            logoUrl={appLogo}
            withText={true}
            sx={transparentLogoStyles}
          />
        ) : (
          // Logo sin transparencia: contenedor sólido + filtros
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              ...solidLogoContainerStyles,
            }}
          >
            <Logo 
              ref={logoImageRef}
              height={open ? 140 : 50} 
              logoUrl={appLogo}
              withText={true}
              sx={solidLogoImageStyles}
            />
          </Box>
        )}
      </Box>

      <Divider />

      <Box sx={{ p: 0.5, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddPhotoAlternateIcon />}
          onClick={() => setLogoDialogOpen(true)}
          sx={{
            width: "60%",
            borderRadius: 2,
            py: 0,
            minHeight: 24,
            fontSize: "0.8rem",
            bgcolor: "var(--primary-main)",
            color: "var(--primary-text)",
            "&:hover": { bgcolor: "var(--primary-dark)" },
          }}
        >
          Cambiar Logo
        </Button>
      </Box>

      <List>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path
          const isAprobarEmpresas = item.text === "Aprobar Empresas"
          const itemId = `menu-${item.text.toLowerCase().replace(/\s+/g, "-")}`;
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                component={Link}
                to={item.path}
                id={itemId}
                sx={{
                  backgroundColor: isActive
                    ? "rgba(255, 255, 255, 0.1)"
                    : item.highlight
                      ? "rgba(255, 255, 255, 0.05)"
                      : "transparent",
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                  },
                  ...(item.highlight && {
                    borderLeft: "4px solid",
                    borderColor: "secondary.main",
                    paddingLeft: "12px",
                  }),
                }}
              >
                <ListItemIcon sx={{ color: "var(--primary-text)" }}>{item.icon}</ListItemIcon>
                <Box sx={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
                  <ListItemText primary={item.text} sx={{ color: "var(--primary-text)" }} />
                  {isAprobarEmpresas && <EmpresasPendientesBell />}
                </Box>
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
    </Drawer>
  )
}
