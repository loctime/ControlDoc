// React import removed - using JSX runtime
import { Card, CardContent, Typography, Box, Tooltip } from "@mui/material";

/**
 * StatCard - Tarjeta de resumen con icono, color y valor.
 * @param {string} title - Título de la tarjeta
 * @param {React.ReactNode} icon - Icono a mostrar
 * @param {string | number} value - Valor principal
 * @param {string} color - Color principal (ej: 'success.main')
 * @param {string} warningText - Texto de advertencia opcional
 * @param {boolean} isSelected - Si está seleccionada
 * @param {function} onAction - Acción al hacer click
 */
export default function StatCard({
  title,
  icon,
  value,
  color = "primary.main",
  warningText = "",
  isSelected = false,
  onAction
}) {
  return (
    <Card
    sx={{
      borderLeft: "6px solid",
      borderColor: color,
      boxShadow: isSelected ? 6 : 1,
      backgroundColor: isSelected ? "var(--page-background)" : "var(--paper-background)",
      cursor: onAction ? "pointer" : "default",
      transition: "box-shadow 0.2s ease, background-color 0.2s ease",
      willChange: "box-shadow, background-color"
    }}
    
      onClick={onAction}
    >
      <CardContent sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" mb={1}>
          <Box mr={1} fontSize={24} color={color}>
            {icon}
          </Box>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ color: "var(--paper-background-text)" }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h5" fontWeight="bold" color={color}>
          {value}
        </Typography>
        {warningText && (
          <Tooltip title={warningText} placement="top">
            <Typography variant="body2" color="warning.main" mt={1}>
              {warningText}
            </Typography>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  );
}