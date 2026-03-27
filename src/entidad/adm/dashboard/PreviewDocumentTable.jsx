// src/component/administrador/dashboard/PreviewDocumentTable.jsx
// React import removed - using JSX runtime
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tooltip,
  Checkbox,
  FormControlLabel
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useNavigate } from "react-router-dom";
import { getDeadlineColor } from "../../../utils/getDeadlineUtils.jsx";
import { useClientNamesMap } from "../../../utils/getClientName";
import { useMemo } from "react";

export default function PreviewDocumentTable({
  docs,
  filters,
  onFilterChange,
  getDeadlineColor
}) {
  const navigate = useNavigate();

  // Extraer clientIds únicos de los documentos
  const clientIds = useMemo(() => {
    const ids = docs.map(doc => doc.clientId).filter(Boolean);
    return [...new Set(ids)];
  }, [docs]);

  // Obtener nombres de clientes
  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } = useClientNamesMap(clientIds);

  const visibleDocs = docs.filter((doc) => {
    if (doc.diasRestantes == null) return filters.sinFecha;
    if (doc.diasRestantes < 0) return filters.vencidos;
    return filters.conFecha;
  });

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={filters.vencidos}
              onChange={(e) =>
                onFilterChange({ ...filters, vencidos: e.target.checked })
              }
            />
          }
          label="Vencidos"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={filters.conFecha}
              onChange={(e) =>
                onFilterChange({ ...filters, conFecha: e.target.checked })
              }
            />
          }
          label="Con fecha"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={filters.sinFecha}
              onChange={(e) =>
                onFilterChange({ ...filters, sinFecha: e.target.checked })
              }
            />
          }
          label="Sin fecha"
        />
      </Box>

      <Paper variant="outlined" sx={{ overflowX: "auto", maxWidth: '100%' }}>
        <Box sx={{ display: "flex", fontWeight: "bold", p: 1, bgcolor: "#f5f5f5" }}>
          <Box sx={{ flex: 2 }}>Empresa</Box>
          <Box sx={{ flex: 1.5 }}>Cliente</Box>
          <Box sx={{ flex: 2 }}>Categoría</Box>
          <Box sx={{ flex: 2 }}>Documento</Box>
          <Box sx={{ flex: 1 }}>Vencimiento</Box>
        </Box>

        {visibleDocs.map((doc) => (
          <Box key={doc.id} sx={{ display: "flex", p: 1, borderTop: "1px solid #eee" }}>
            <Box sx={{ flex: 2 }}>{doc.companyName}</Box>
            <Box sx={{ flex: 1.5 }}>
              {doc.clientId 
                ? (isLoadingClientNames ? '...' : (clientNamesMap[doc.clientId] || '-'))
                : '-'}
            </Box>
            <Box sx={{ flex: 2 }}>{doc.categoria || doc.entityType || "Sin categoría"}</Box>
            <Box sx={{ flex: 2 }}>{doc.name}</Box>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ color: getDeadlineColor(doc.diasRestantes) }}>
                  {doc.expirationDate instanceof Date && !isNaN(doc.expirationDate)
                    ? doc.expirationDate.toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })
                    : "Sin fecha"}
                </Typography>
                {doc.diasRestantes < 0 && (
                  <Tooltip title="Documento vencido">
                    <WarningAmberIcon color="error" fontSize="small" />
                  </Tooltip>
                )}
              </Box>
              <Chip
                label={doc.status}
                color={
                  doc.status === "Aprobado"
                    ? "success"
                    : doc.status === "Rechazado"
                    ? "error"
                    : "warning"
                }
                size="small"
                clickable
                onClick={() =>
                  navigate(`/admin/uploaded-documents?empresa=${doc.companyId}&docId=${doc.id}`)
                }
              />
            </Box>
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
