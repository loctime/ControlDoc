// components/CompanyStatusBadge.jsx
// React import removed - using JSX runtime
import { Box, Typography, Tooltip, Stack, Chip } from '@mui/material';

const STATUS_CONFIG = {
  vencidos: {
    label: 'Documentos vencidos',
    color: 'error',
    variant: 'filled'
  },
  rechazados: {
    label: 'Documentos rechazados',
    color: 'error',
    variant: 'outlined'
  },
  porVencer: {
    label: 'Documentos por vencer (5 días)',
    color: 'warning',
    variant: 'filled'
  },
  pendientes: {
    label: 'Documentos sin subir',
    color: 'info',
    variant: 'outlined'
  }
};

const STATUS_ORDER = ['vencidos', 'rechazados', 'porVencer', 'pendientes'];

const ENTITY_LABELS = {
  company: 'Empresa',
  employee: 'Personal',
  personal: 'Personal',
  vehicle: 'Vehículo',
  vehiculo: 'Vehículo'
};

const getEntityLabel = (entityType) => {
  return ENTITY_LABELS[entityType] || 'Otros';
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatTooltip = (docs, statusLabel) => {
  if (!docs.length) return '';
  // Agrupar por categoría y mostrar solo el conteo
  const groupedByCategory = docs.reduce((acc, doc) => {
    const category = getEntityLabel(doc.entityType);
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category]++;
    return acc;
  }, {});
  
  return `${statusLabel}:\n${Object.entries(groupedByCategory)
    .map(([category, count]) => `  • ${category}: ${count} documento${count > 1 ? 's' : ''}`)
    .join('\n')}`;
};

const buildStatusBadges = (requiredDocuments, uploadedDocuments) => {
  const now = new Date();
  const limitDate = new Date(now);
  limitDate.setDate(now.getDate() + 5);

  const categories = {
    vencidos: [],
    rechazados: [],
    porVencer: [],
    pendientes: []
  };

  requiredDocuments.forEach((doc) => {
    const uploads = uploadedDocuments.filter((up) => up.requiredDocumentId === doc.id);
    const approved = uploads.filter((up) => up.status === 'Aprobado');

    if (uploads.length === 0) {
      categories.pendientes.push(doc);
    }

    if (uploads.some((up) => up.status === 'Rechazado')) {
      categories.rechazados.push(doc);
    }

    const hasApproved = approved.length > 0;
    const expired = hasApproved && approved.some((up) => {
      const exp = toDate(up.expirationDate);
      return exp && exp < now;
    });

    const expiringSoon = hasApproved && !expired && approved.some((up) => {
      const exp = toDate(up.expirationDate);
      return exp && exp >= now && exp <= limitDate;
    });

    if (expired) {
      categories.vencidos.push(doc);
    } else if (expiringSoon) {
      categories.porVencer.push(doc);
    }
  });

  const highestCompanySeverity = STATUS_ORDER.find((key) =>
    categories[key].some((doc) => doc.entityType === 'company')
  );

  const companyIssues = STATUS_ORDER
    .flatMap((key) =>
      categories[key]
        .filter((doc) => doc.entityType === 'company')
        .map((doc) => ({ key, doc }))
    );

  const companyTooltip = companyIssues.length
    ? (() => {
        // Agrupar por estado y categoría, mostrar solo conteos
        const grouped = companyIssues.reduce((acc, { key, doc }) => {
          const statusLabel = STATUS_CONFIG[key]?.label || '';
          const category = getEntityLabel(doc.entityType);
          const groupKey = `${key}-${category}`;
          if (!acc[groupKey]) {
            acc[groupKey] = { statusLabel, category, count: 0 };
          }
          acc[groupKey].count++;
          return acc;
        }, {});
        
        return Object.values(grouped)
          .map(({ statusLabel, category, count }) => 
            `${statusLabel}: ${category} (${count} documento${count > 1 ? 's' : ''})`
          )
          .join('\n');
      })()
    : 'Documentación al día';

  const severityColorMap = {
    vencidos: 'error',
    rechazados: 'error',
    porVencer: 'warning',
    pendientes: 'info'
  };

  const companyStatus = highestCompanySeverity
    ? {
        label: 'Empresa en riesgo',
        color: severityColorMap[highestCompanySeverity] || 'warning',
        tooltip: companyTooltip
      }
    : {
        label: 'Empresa habilitada',
        color: 'success',
        tooltip: companyTooltip
      };

  const chips = STATUS_ORDER.map((key) => {
    const docs = categories[key];
    if (!docs.length) return null;
    const config = STATUS_CONFIG[key];

    // Agrupar documentos por categoría
    const groupedByCategory = docs.reduce((acc, doc) => {
      const category = getEntityLabel(doc.entityType);
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(doc);
      return acc;
    }, {});

    // Crear chips por categoría con el estado
    return Object.entries(groupedByCategory).map(([category, categoryDocs]) => ({
      key: `${key}-${category}`,
      label: `${category} - ${config.label} (${categoryDocs.length})`,
      color: config.color,
      variant: config.variant,
      tooltip: formatTooltip(categoryDocs, config.label)
    }));
  }).filter(Boolean).flat();

  return { companyStatus, chips };
};

export default function CompanyStatusBadge({ company, requiredDocuments = [], uploadedDocuments = [], email }) {
  if (!company) return null;

  const { companyStatus, chips } = buildStatusBadges(requiredDocuments, uploadedDocuments);

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip title={companyStatus.tooltip}>
          <Chip
            label={companyStatus.label}
            color={companyStatus.color}
            variant="filled"
            sx={{ fontWeight: 'bold' }}
          />
        </Tooltip>

        {email && (
          <Typography variant="body2" color="text.secondary">
            {email}
          </Typography>
        )}
      </Stack>

      {chips.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {chips.map((chip) => (
            <Tooltip key={chip.key} title={chip.tooltip}>
              <Chip
                label={chip.label}
                color={chip.color}
                variant={chip.variant}
                sx={{ fontWeight: chip.variant === 'filled' ? 'bold' : 'medium' }}
              />
            </Tooltip>
          ))}
        </Box>
      )}
    </Stack>
  );
}