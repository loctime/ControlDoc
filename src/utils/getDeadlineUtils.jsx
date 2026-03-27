// src/utils/getDeadlineColor.js

// React import removed - using JSX runtime
import {
  Cancel as CancelIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from "@mui/icons-material";

/**
 * Devuelve el color correspondiente según los días restantes para la fecha de vencimiento.
 * @param {Date|string|null} expirationDate - Fecha de vencimiento
 * @returns {string} - Color compatible con MUI (ej. "error.main")
 */
export const getDeadlineColor = (expirationDate) => {
  if (!expirationDate) return "textSecondary";
  const diff = (new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24);
  if (diff <= 0) return "error.main";
  if (diff <= 2) return "error.dark";
  if (diff <= 5) return "warning.main";
  if (diff <= 15) return "warning.light";
  if (diff <= 30) return "info.main";
  return "success.main";
};

/**
 * Devuelve el estado del vencimiento con nivel, ícono y días restantes.
 * @param {Date|string|null} expirationDate - Fecha de vencimiento
 * @returns {{ level: string, icon: string, daysRemaining?: number }}
 */
export const getDeadlineStatus = (expirationDate) => {
  if (!expirationDate) return { level: 'info', icon: 'Info' };

  const diff = (new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24);
  
  if (diff <= 0) return { level: 'error', icon: 'Error', daysRemaining: Math.floor(diff) };
  if (diff <= 2) return { level: 'error', icon: 'Error', daysRemaining: Math.ceil(diff) };
  if (diff <= 5) return { level: 'warning', icon: 'Warning', daysRemaining: Math.ceil(diff) };
  if (diff <= 15) return { level: 'warning', icon: 'Warning', daysRemaining: Math.ceil(diff) };
  if (diff <= 30) return { level: 'info', icon: 'Info', daysRemaining: Math.ceil(diff) };

  return { level: 'success', icon: 'CheckCircle', daysRemaining: Math.ceil(diff) };
};

/**
 * Devuelve el componente de ícono visual correspondiente al nombre del ícono.
 * @param {string} iconName - Nombre del ícono (ej. "Error", "CheckCircle")
 * @returns {JSX.Element|null} - Componente de MUI
 */
export const getStatusIconComponent = (iconName) => {
  switch (iconName) {
    case "Cancel": return <CancelIcon sx={{ color: 'var(--error-main)' }} />;
    case "Warning": return <WarningIcon sx={{ color: 'var(--warning-main)' }} />;
    case "CheckCircle": return <CheckCircleIcon sx={{ color: 'var(--success-main)' }} />;
    case "Error": return <ErrorIcon sx={{ color: 'var(--error-main)' }} />;
    case "Info": return <InfoIcon sx={{ color: 'var(--info-main)' }} />;
    default: return null;
  }
};
