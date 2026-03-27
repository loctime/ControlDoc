import React, { useEffect, useState } from 'react';
import {
FormControl,
InputLabel,
Select,
MenuItem,
CircularProgress,
Box,
Tooltip,
Typography
} from '@mui/material';
import { useCompanies } from '../../context/CompaniesContext';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import { getTenantCollectionPath } from '../../utils/tenantUtils';

export default function CompanySelector({
value = null,
onChange = null,
sx = {},
size = "small",
fullWidth = true,
showStatusDot = true,
allowAllOption = true
}) {
const {
companies,
selectedCompany,
selectCompany,
loading,
refresh
} = useCompanies();

const [companyStatus, setCompanyStatus] = useState({});

useEffect(() => {
const checkCompanyDocs = async (companyId) => {
  const now = new Date();
  
  try {
    // Usar la ruta multi-tenant correcta
    const uploadedDocumentsPath = 'uploadedDocuments';
    const validDocsQuery = query(
      collection(db, uploadedDocumentsPath),
      where("companyId", "==", companyId),
      where("status", "==", "Aprobado"),
      where('companyId', '!=', null) // Excluir documentos de ejemplo
    );
    
    const snapshot = await getDocs(validDocsQuery);
    
    if (snapshot.empty) return { status: 'disabled' }; // Sin documentos
    
    let nearestExpiration = null;
    let allValid = true;
    
    snapshot.forEach(doc => {
      const expirationData = doc.data().expirationDate;
      let expDate = null;
      
      // Manejar diferentes tipos de fechas como en otros componentes
      if (expirationData) {
        if (typeof expirationData === 'string' || typeof expirationData === 'number') {
          expDate = new Date(expirationData);
        } else if (expirationData.seconds) {
          expDate = new Date(expirationData.seconds * 1000);
        } else if (typeof expirationData?.toDate === 'function') {
          try {
            expDate = expirationData.toDate();
          } catch (e) {
            console.warn('[AdminCompanySelector] Error al convertir fecha:', e);
          }
        }
      }
      
      if (expDate && expDate instanceof Date && !isNaN(expDate.getTime())) {
        if (!nearestExpiration || expDate < nearestExpiration) {
          nearestExpiration = expDate;
        }
        if (expDate < now) allValid = false;
      }
    });
    
    if (!nearestExpiration) return { status: 'disabled' }; // Sin fechas
    
    const diffDays = Math.ceil((nearestExpiration - now) / (1000 * 60 * 60 * 24));

    if (nearestExpiration < now) return { status: 'expired', days: diffDays };
    if (diffDays <= 3) return { status: 'critical', days: diffDays };       // 0-3 días: Crítico (incluye hoy)
    if (diffDays <= 10) return { status: 'warning', days: diffDays };       // 4-10 días: Advertencia
    if (diffDays <= 29) return { status: 'notice', days: diffDays };        // 11-29 días: Aviso
    return { status: 'valid', days: diffDays };                             // 30+ días: Válido
    
  } catch (error) {
    console.error("Error checking docs:", error);
    return { status: 'error' };
  }
};

const loadStatuses = async () => {
  const safeCompanies = Array.isArray(companies) ? companies : [];
  const statuses = {};
  await Promise.all(safeCompanies.map(async (company) => {
    statuses[company.id] = await checkCompanyDocs(company.id);
  }));
  setCompanyStatus(statuses);
};

const safeCompanies = Array.isArray(companies) ? companies : [];
if (safeCompanies.length > 0) loadStatuses();
}, [companies]);

const handleChange = (event) => {
const companyId = event.target.value;

if (companyId === 'todas') {
  // Compatibilidad total: permite usar ambos enfoques
  const allOption = { id: 'todas', name: 'Todas las empresas' };

  // Enviás el objeto completo por `onChange`
  onChange?.(allOption);

  // Pero internamente seguís usando null si el resto del sistema lo espera así
  selectCompany(null); // <-- mantiene tu lógica actual funcionando

  return;
}

const selected = companies.find(c => String(c.id) === companyId);
selectCompany(selected);
onChange?.(selected);
};

useEffect(() => {
const handler = () => refresh();
window.addEventListener('companyListShouldRefresh', handler);
return () => window.removeEventListener('companyListShouldRefresh', handler);
}, [refresh]);

const statusPriority = {
'expired': 1,
'critical': 2,
'warning': 3,
'notice': 4,
'valid': 5,
'disabled': 6,
'error': 7
};

return (
<FormControl
  size={size}
  sx={{ minWidth: fullWidth ? undefined : 180, ...sx }}
  fullWidth={fullWidth}
  id="adm-required-docs-company-selector"
>
  <InputLabel id="company-select-label">Empresa</InputLabel>
  {loading ? (
    <CircularProgress size={24} sx={{ mt: 1 }} />
  ) : (
    <Select
      labelId="company-select-label"
      value={value ?? selectedCompany?.id ?? 'todas'}
      label="Empresa"
      onChange={handleChange}
      MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
      sx={{
        "& .MuiSelect-select": {
          color: "var(--navbar-background-text) !important"
        },
        color: "var(--navbar-background-text)"
      }}
      renderValue={(selected) => {
        if (!selected || selected === 'todas') {
          return (
            <Typography component="span" sx={{ color: "var(--navbar-background-text)" }}>
              Todas las empresas
            </Typography>
          );
        }
        const safeCompanies = Array.isArray(companies) ? companies : [];
        const company = safeCompanies.find(c => String(c.id) === selected);
        const companyName = company?.name || company?.companyName || safeCompanies.find(c => c.id === selected)?.name || 'Empresa no encontrada';
        return (
          <Typography component="span" sx={{ color: "var(--navbar-background-text)" }}>
            {companyName}
          </Typography>
        );
      }}
    >
      {allowAllOption && (
        <MenuItem value="todas">
          <em>Todas las empresas</em>
        </MenuItem>
      )}
      {(Array.isArray(companies) ? companies : [])
        .map(company => ({
          ...company,
          status: companyStatus[company.id] || { status: 'disabled' }
        }))
        .sort((a, b) => {
          const priorityDiff = statusPriority[a.status.status] - statusPriority[b.status.status];
          if (priorityDiff !== 0) return priorityDiff;
          return (a.companyName || a.name).localeCompare(b.companyName || b.name);
        })
        .map((company) => {
          const status = company.status;
          const statusMessages = {
            'expired': 'Documentos vencidos',
            'critical': `Vence en menos de 3 días (Urgente)`,
            'warning': `Vence en menos de 10 días (Próximo)`,
            'notice': `Vence en menos de 30 días`,
            'valid': 'Al día',
            'disabled': 'Sin documentos válidos',
            'error': 'Error al verificar documentos'
          };
          return (
            <MenuItem key={company.id} value={String(company.id)}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center',
                width: '100%',
                backgroundColor: 
                  status.status === 'disabled' 
                    ? 'rgba(200, 200, 200, 0.2)' // Gris suave
                    : status.status === 'expired' 
                    ? 'rgba(244, 67, 54, 0.2)' // Rojo fuerte suave
                    : status.status === 'critical' 
                    ? 'rgba(244, 100, 100, 0.2)' // Rojo suave
                    : status.status === 'warning' 
                    ? 'rgba(255, 152, 0, 0.2)' // Naranja suave
                    : status.status === 'notice' 
                    ? 'rgba(100, 181, 246, 0.2)' // Azul suave
                    : 'rgba(76, 175, 80, 0.2)', // Verde suave
                p: 0.5,
                borderRadius: 1
              }}>
                {showStatusDot && (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      mr: 1,
                      bgcolor: status.status === 'expired'
                        ? 'error.main'
                        : status.status === 'critical'
                        ? 'error.main'
                        : status.status === 'warning'
                        ? 'warning.main'
                        : 'transparent'
                    }}
                  />
                )}
                <Box sx={{ flexGrow: 1 }}>
                  {company.companyName || company.name}
                </Box>
                {status.status === 'expired' && (
                  <Tooltip title="Esta empresa tiene documentos vencidos que requieren atención inmediata">
                    <ErrorIcon sx={{ ml: 1, color: "var(--error-main)" }} fontSize="small" />
                  </Tooltip>
                )}
                {(status.status === 'critical' || status.status === 'warning') && (
                  <Tooltip title="Esta empresa tiene documentos que vencerán pronto">
                    <WarningIcon sx={{ ml: 1, color: "var(--warning-main)" }} fontSize="small" />
                  </Tooltip>
                )}
                <Tooltip 
                  title={statusMessages[status.status]}
                  arrow
                  placement="right"
                >
                  <InfoIcon 
                    color="info" 
                    fontSize="small" 
                    sx={{ 
                      ml: 1, 
                      opacity: 0.7,
                      ':hover': { opacity: 1 }
                    }} 
                  />
                </Tooltip>
              </Box>
            </MenuItem>
          );
        })}
    </Select>
  )}
</FormControl>
);
}
