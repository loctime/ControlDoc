import React from 'react';
const { useState } = React;
import { 
  Box, Typography, Paper, Chip, CircularProgress, Button 
} from '@mui/material';
import { 
  Error as ErrorIcon, 
  WarningAmber as WarningIcon, 
  CheckCircle as CheckIcon 
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import useDocumentStatus from '../../../hooks/useDocumentStatus';
import { getCompanyStatusFromDocs } from '../../../utils/getCompanyStatusFromDocs';
import EmpresasTable from './EmpresasTable'; // Importar el componente EmpresasTable
import { useClientNamesMap } from '../../../utils/getClientName';
import { useMemo } from 'react';

const DocCards = ({ docs, color, label, icon, expandedDocs, setExpandedDocs, navigate, getDocumentStatus }) => {
  const maxVisibleItems = expandedDocs ? docs.length : 3;
  const visibleDocs = docs.slice(0, maxVisibleItems);

  const clientIds = useMemo(() => {
    const ids = docs.map(doc => doc.clientId).filter(Boolean);
    return [...new Set(ids)];
  }, [docs]);

  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } = useClientNamesMap(clientIds);

  const colorBackground = {
    error: "var(--paper-background)",
    warning: "var(--paper-background)",
    success: "var(--paper-background)",
  };

  const colorText = {
    error: "var(--error-main)",
    warning: "var(--warning-main)",
    success: "var(--success-main)",
  };

  return (
    <Box sx={{ border: `1px solid var(--divider-color)`, borderRadius: 2, p: 1.5, minHeight: 120, backgroundColor: "var(--paper-background)" }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        {icon}
        <Typography variant="subtitle2" sx={{ ml: 1, fontWeight: 600, color: "var(--paper-background-text)" }}>
          {label} ({docs.length})
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          maxHeight: expandedDocs ? 'none' : 'calc(3 * 32px)',
          overflow: 'hidden'
        }}
      >
        {visibleDocs.map(doc => {
          const status = getDocumentStatus(doc);
          const name = doc.name || doc.fileName || 'Sin nombre';
          const entityMap = {
            company: 'Empresa',
            employee: 'Personal',
            vehicle: 'Vehículo',
            other: 'Otro'
          };
          const entity = entityMap[doc.entityType] || 'Desconocido';
          const clientName = doc.clientId 
            ? (isLoadingClientNames ? '...' : (clientNamesMap[doc.clientId] || ''))
            : '';
          const clientSuffix = clientName ? ` (${clientName})` : '';
          const labelText = `${name.length > 10 ? name.substring(0, 10) + '...' : name} - ${entity}${clientSuffix}`;

          return (
            <Box
              key={doc.id}
              sx={{
                backgroundColor: colorBackground[color],
                color: colorText[color],
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontSize: '0.95rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                lineHeight: 1.2,
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.85,
                  backgroundColor: "var(--page-background)"
                }
              }}
              onClick={() =>
                navigate(`/admin/uploaded-documents?empresa=${doc.companyId}&docId=${doc.id}`)
              }
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colorText[color] }}>
                {labelText}
              </span>
              {status.daysRemaining != null && (
                <Typography variant="caption" sx={{ opacity: 0.7, ml: 1, fontSize: '0.75rem', color: colorText[color] }}>
                  {status.daysRemaining}d
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>

      {docs.length > 3 && (
        <Box mt={0.5} textAlign="center">
          <Button 
            size="small" 
            onClick={() => setExpandedDocs(!expandedDocs)}
            sx={{ fontSize: '0.7rem', textTransform: 'none', py: 0.25 }}
          >
            {expandedDocs ? 'Contraer' : `Mostrar ${docs.length - 3} más`}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default function AdminEmpresas({ companyId, companies, onShowCompaniesTable, previewDocs = [], loading = false }) {
  const { getDocumentStatus } = useDocumentStatus();
  const navigate = useNavigate();

  const [expandedDocs, setExpandedDocs] = useState(false);
  const [showAll, setShowAll] = useState({});
  
  // Validar que companies y previewDocs sean arrays
  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safePreviewDocs = Array.isArray(previewDocs) ? previewDocs : [];

  const renderCompanyChips = (filteredCompanies, color, label, icon, type) => {
    const isExpanded = showAll[type];
    const visibleCompanies = isExpanded ? filteredCompanies : filteredCompanies.slice(0, 6);

    return (
      <Box sx={{ border: '1px solid #ccc', borderRadius: 2, p: 2, minHeight: 160 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {icon}
          <Typography variant="subtitle1" sx={{ ml: 1 }}>
            {label} ({filteredCompanies.length})
          </Typography>
        </Box>
        <Box
  sx={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: 1,
    overflow: 'hidden',
    maxHeight: isExpanded ? '500px' : '72px', // un valor suficientemente alto
    transition: 'max-height 0.3s ease',
    willChange: 'max-height'
  }}
>

          {visibleCompanies.map(company => (
            <Chip
              key={company.id}
              label={company.name}
              color={color}
              variant="filled"
              sx={{ 
                fontWeight: 'bold',
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8
                }
              }}
              onClick={() => {
                if (typeof onShowCompaniesTable === 'function') {
                  onShowCompaniesTable([company]);
                }
              }}
            />
          ))}
        </Box>

        {filteredCompanies.length > 6 && (
          <Button
            size="small"
            onClick={() => setShowAll(prev => ({ ...prev, [type]: !prev[type] }))}
            sx={{ textTransform: 'none', mt: 1 }}
          >
            {isExpanded ? 'Mostrar menos' : `Mostrar ${filteredCompanies.length - 6} más`}
          </Button>
        )}
      </Box>
    );
  };

  // Si no hay previewDocs y está cargando, mostrar loading
  if (loading && previewDocs.length === 0) return <CircularProgress />;

  if (companyId) {
    const expiredDocs = previewDocs.filter(doc => getDocumentStatus(doc).level === 'error');
    const warningDocs = previewDocs.filter(doc => getDocumentStatus(doc).level === 'warning');
    const okDocs = previewDocs.filter(doc => getDocumentStatus(doc).level === 'success' || getDocumentStatus(doc).level === 'info');

    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <DocCards
              docs={expiredDocs}
              color="error"
              label="Vencidos"
              icon={<ErrorIcon sx={{ color: "var(--error-main)" }} />}
              expandedDocs={expandedDocs}
              setExpandedDocs={setExpandedDocs}
              navigate={navigate}
              getDocumentStatus={getDocumentStatus}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <DocCards
              docs={warningDocs}
              color="warning"
              label="Por vencer"
              icon={<WarningIcon sx={{ color: "var(--warning-main)" }} />}
              expandedDocs={expandedDocs}
              setExpandedDocs={setExpandedDocs}
              navigate={navigate}
              getDocumentStatus={getDocumentStatus}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <DocCards
              docs={okDocs}
              color="success"
              label="En regla"
              icon={<CheckIcon sx={{ color: "var(--success-main)" }} />}
              expandedDocs={expandedDocs}
              setExpandedDocs={setExpandedDocs}
              navigate={navigate}
              getDocumentStatus={getDocumentStatus}
            />
          </Box>
        </Box>
      </Paper>
    );
  }

  const criticalCompanies = safeCompanies.filter(company => {
    const docs = safePreviewDocs.filter(doc => doc.companyId === company.id);
    if (docs.length === 0) return false; // Excluir empresas sin documentos
    const status = getCompanyStatusFromDocs(docs);
    console.debug('Empresa evaluada:', company.name, 'Docs:', docs.length, 'Status:', status);
    return status.vencido;
  });

  const soonToExpireCompanies = safeCompanies.filter(company => {
    const docs = safePreviewDocs.filter(doc => doc.companyId === company.id);
    const status = getCompanyStatusFromDocs(docs);
    return status.porVencer;
  });

  const okCompanies = safeCompanies.filter(company => {
    const docs = safePreviewDocs.filter(doc => doc.companyId === company.id);
    const status = getCompanyStatusFromDocs(docs);
    return !status.vencido;
  });

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            {renderCompanyChips(criticalCompanies, 'error', 'Empresas con vencidos', <ErrorIcon sx={{ color: "var(--error-main)" }} />, 'criticas')}
          </Box>
          <Box sx={{ flex: 1 }}>
            {renderCompanyChips(soonToExpireCompanies, 'warning', 'Con vencimientos pronto', <WarningIcon sx={{ color: "var(--warning-main)" }} />, 'porVencer')}
          </Box>
          <Box sx={{ flex: 1 }}>
            {renderCompanyChips(okCompanies, 'success', 'Empresas en regla', <CheckIcon sx={{ color: "var(--success-main)" }} />, 'enRegla')}
          </Box>
        </Box>
      </Paper>

      {/*
        <Paper sx={{ p: 2, mb: 2, mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Documentos de {selectedCompanies?.[0]?.name || 'empresas seleccionadas'}
            </Typography>
            <Button 
              size="small" 
              onClick={() => setShowCompaniesTable(false)} 
              variant="outlined"
              sx={{ ml: 2 }}
            >
              Ocultar detalles
            </Button>
          </Box>
          <EmpresasTable
            companies={selectedCompanies}
            previewDocs={previewDocs}
            expandedRow={selectedCompanies?.[0]?.id}
            setExpandedRow={() => {}}
          />
        </Paper>
      */}
    </Box>
  );
}
