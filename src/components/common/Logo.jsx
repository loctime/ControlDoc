// React import removed - using JSX runtime
import { forwardRef } from 'react'
import { Box } from '@mui/material'
import controldoclogo from "../../assets/logos/controldoclogo.png"
import controldoclogotext from "../../assets/logos/controldoc-logo.png"

/**
 * Componente Logo que muestra el logo de ControlDoc
 * @param {Object} props - Propiedades del componente
 * @param {number} props.height - Altura del logo (opcional, por defecto 120px)
 * @param {string} props.logoUrl - URL del logo personalizado desde Firestore (opcional)
 * @param {boolean} props.withText - Si es true, usa el logo con letras. Si es false, sin letras.
 * @param {object} props.sx - Estilos adicionales para aplicar al logo
 * @returns {JSX.Element}
 */
const Logo = forwardRef(({ height = 120, logoUrl, withText = true, sx = {} }, ref) => {
  // fallback según si se quiere logo con o sin texto
  const fallbackLogo = withText ? controldoclogotext : controldoclogo

  return (
    <Box
      ref={ref}
      component="img"
      src={logoUrl || fallbackLogo}
      alt="ControlDoc Logo"
      sx={{
        height,
        maxHeight: height,
        width: "auto",
        maxWidth: "100%",
        objectFit: "contain",
        display: "block",
        mx: "auto",
        transition: "all 0.3s ease",
        ...sx
      }}
      onError={(e) => {
        e.currentTarget.src = fallbackLogo
      }}
    />
  )
})

Logo.displayName = 'Logo'

export default Logo
