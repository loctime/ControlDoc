import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Box,
  Stack,
  TextField,
  InputAdornment,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Button,
  Tooltip,
  Typography,
  FormControlLabel,
  Switch
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import SuperTable from "../../../components/common/superTable";
import { useNavigate } from "react-router-dom";
import { useClientNamesMap } from "../../../utils/getClientName";

const STATUS_COLORS = {
  aprobado: "success",
  rechado: "error",
  rechazado: "error",
  "en proceso": "warning",
  subido: "info",
  pendiente: "default",
  "pendiente de revisión": "info",
  "no subido": "warning"
};

const ENTITY_LABELS = {
  company: "Empresa",
  employee: "Personal",
  personal: "Personal",
  vehicle: "Vehículo",
  vehiculo: "Vehículo",
};

const DEADLINE_FILTERS = [
  { value: "all", label: "Todos los vencimientos" },
  { value: "overdue", label: "Vencidos" },
  { value: "critical", label: "≤ 5 días" },
  { value: "soon", label: "≤ 15 días" },
  { value: "month", label: "≤ 30 días" },
  { value: "noDate", label: "Sin fecha" },
  { value: "clear", label: "Sin alertas" },
];

const normalizeStatus = (status) =>
  (status || "Pendiente").toString().trim().toLowerCase();

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  if (typeof value.toDate === "function") {
    const converted = value.toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value, withTime = false) => {
  const date = parseDate(value);
  if (!date) return "-";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  });
};

const getDeadlineBucket = (daysLeft) => {
  if (daysLeft === null || daysLeft === undefined) return "noDate";
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 5) return "critical";
  if (daysLeft <= 15) return "soon";
  if (daysLeft <= 30) return "month";
  return "clear";
};

const AdminAdvancedDocuments = ({
  documents = [],
  companies = [],
  selectedCompanyId = null,
  isLoading = false,
  getDeadlineColor,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all"); // Nuevo filtro de cliente
  const [statusFilter, setStatusFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState("all");
  const [onlyMissing, setOnlyMissing] = useState(false);

  // Obtener clientIds únicos de los documentos
  const clientIds = useMemo(() => {
    const ids = documents.map(doc => doc.clientId).filter(Boolean);
    return [...new Set(ids)];
  }, [documents]);

  // Obtener nombres de clientes
  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } = useClientNamesMap(clientIds);

  // Inicializar filtro de empresa cuando cambia selectedCompanyId
  useEffect(() => {
    if (selectedCompanyId) {
      setCompanyFilter(selectedCompanyId);
      setClientFilter("all"); // Resetear filtro de cliente
    } else {
      setCompanyFilter("all");
      setClientFilter("all");
    }
  }, [selectedCompanyId]);

  const rows = useMemo(() => {
    return documents.map((doc) => {
      // Obtener nombre de cliente si existe
      const clientName = doc.clientId ? (clientNamesMap[doc.clientId] || null) : null;
      const companyName =
        doc.companyName ||
        companies.find((company) => company.id === doc.companyId)?.name ||
        "Sin empresa";
      const statusKey = normalizeStatus(doc.status);
      const expirationDate = parseDate(doc.expirationDate);
      const diasRestantes =
        typeof doc.diasRestantes === "number"
          ? doc.diasRestantes
          : expirationDate
          ? Math.ceil((expirationDate - new Date()) / (1000 * 60 * 60 * 24))
          : null;
      const lastUpdated =
        doc.updatedAt || doc.uploadedAt || doc.createdAt || doc.lastUpdated || null;
      const entityType = doc.entityType || "custom";

      return {
        id:
          doc.id ||
          `${doc.companyId || "global"}-${doc.name || "document"}-${doc.entityType || "unknown"}-${
            doc.entityId || "na"
          }`,
        raw: doc,
        companyId: doc.companyId || null,
        clientId: doc.clientId || null, // IMPORTANTE: Preservar clientId
        companyName,
        clientName, // Ya calculado arriba
        documentName: doc.name || "Sin nombre",
        entityName: doc.entityName || doc.categoria || ENTITY_LABELS[entityType] || "General",
        entityType,
        status: doc.status || "Pendiente",
        statusKey,
        expirationDate,
        expirationTimestamp: expirationDate ? expirationDate.getTime() : null,
        diasRestantes,
        deadlineBucket: getDeadlineBucket(diasRestantes),
        lastUpdated,
        lastUpdatedTimestamp: lastUpdated ? parseDate(lastUpdated)?.getTime() || null : null,
        comment: doc.comment || doc.comentario || "",
        missing: 
          doc.archivoSubido === false || 
          doc.status === "No subido" || 
          (doc.isRequerido === true && doc.archivoSubido !== true),
      };
    });
  }, [documents, companies, clientNamesMap]);

  const statusOptions = useMemo(() => {
    const base = new Set(rows.map((row) => row.statusKey).filter(Boolean));
    return ["all", ...Array.from(base)];
  }, [rows]);

  const entityOptions = useMemo(() => {
    const base = new Set(rows.map((row) => row.entityType || "custom"));
    return ["all", ...Array.from(base)];
  }, [rows]);

  const companyOptions = useMemo(() => {
    const base = new Map();
    rows.forEach((row) => {
      if (!row.companyId) return;
      base.set(row.companyId, row.companyName);
    });
    return [{ value: "all", label: "Todas las empresas" }].concat(
      Array.from(base.entries()).map(([value, label]) => ({ value, label }))
    );
  }, [rows]);

  // Opciones de filtro de cliente
  const clientOptions = useMemo(() => {
    const base = new Map();
    rows.forEach((row) => {
      if (!row.clientId) return;
      const clientName = row.clientName || `Cliente ${row.clientId.substring(0, 8)}`;
      base.set(row.clientId, clientName);
    });
    const options = [{ value: "all", label: "Todos los clientes" }];
    if (selectedCompanyId) {
      // Solo agregar opción "Empresa principal" si hay empresa seleccionada
      options.push({ value: "main", label: "Empresa principal" });
    }
    return options.concat(
      Array.from(base.entries()).map(([value, label]) => ({ value, label }))
    );
  }, [rows, selectedCompanyId, clientNamesMap]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (companyFilter !== "all" && row.companyId !== companyFilter) return false;
      
      // Filtrar por cliente
      if (clientFilter !== "all") {
        if (clientFilter === "main") {
          // Mostrar solo documentos de la empresa principal (sin clientId)
          if (row.clientId !== null) return false;
        } else {
          // Mostrar solo documentos de un cliente específico
          if (row.clientId !== clientFilter) return false;
        }
      }
      
      if (statusFilter !== "all" && row.statusKey !== statusFilter) return false;
      if (entityFilter !== "all") {
        if (entityFilter === "custom") {
          if (ENTITY_LABELS[row.entityType]) return false;
        } else if (row.entityType !== entityFilter) {
          return false;
        }
      }
      if (deadlineFilter !== "all" && row.deadlineBucket !== deadlineFilter) return false;
      if (onlyMissing && !row.missing) return false;
      if (!term) return true;
      return (
        row.documentName.toLowerCase().includes(term) ||
        row.companyName.toLowerCase().includes(term) ||
        (row.clientName || "").toLowerCase().includes(term) ||
        (row.entityName || "").toLowerCase().includes(term) ||
        (row.status || "").toLowerCase().includes(term)
      );
    });
  }, [rows, companyFilter, clientFilter, statusFilter, entityFilter, deadlineFilter, onlyMissing, searchTerm]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setCompanyFilter("all");
    setClientFilter("all");
    setStatusFilter("all");
    setEntityFilter("all");
    setDeadlineFilter("all");
    setOnlyMissing(false);
  };

  const handleExportCsv = useCallback(() => {
    if (filteredRows.length === 0) return;
    const headers = [
      "Empresa",
      "Cliente",
      "Entidad",
      "Tipo entidad",
      "Documento",
      "Estado",
      "Vencimiento",
      "Días restantes",
      "Última actualización",
      "Comentario",
    ];
    const csvRows = filteredRows.map((row) => [
      row.companyName || "-",
      row.clientName || "-",
      row.entityName || "-",
      ENTITY_LABELS[row.entityType] || "Personalizado",
      row.documentName || "-",
      row.status || "-",
      formatDate(row.expirationDate),
      row.diasRestantes ?? "-",
      formatDate(row.lastUpdated, true),
      row.comment ? row.comment.replace(/[\r\n]+/g, " ") : "-",
    ]);

    const makeCsvValue = (value) =>
      `"${(value ?? "")
        .toString()
        .replace(/"/g, '""')}"`;

    const content = [headers, ...csvRows]
      .map((line) => line.map(makeCsvValue).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vista-avanzada-documentos-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredRows]);

  const columns = useMemo(
    () => [
      {
        key: "documentName",
        label: "Documento",
        sortable: true,
        render: (row) => (
          <Box>
            <Typography variant="subtitle2">{row.documentName}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
              <Chip
                size="small"
                label={ENTITY_LABELS[row.entityType] || "Personalizado"}
                variant="outlined"
                color="primary"
              />
              {row.missing && (
                <Chip
                  size="small"
                  label="No subido"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>
        ),
      },
      {
        key: "companyName",
        label: "Empresa",
        sortable: true,
      },
      {
        key: "clientName",
        label: "Cliente",
        sortable: true,
        width: 160,
        render: (row) => (
          <Typography variant="body2" color="text.secondary">
            {row.clientId ? (isLoadingClientNames ? 'Cargando...' : (row.clientName || '-')) : '-'}
          </Typography>
        ),
      },
      {
        key: "entityName",
        label: "Entidad",
        sortable: true,
        render: (row) => (
          <Typography variant="body2">
            {row.entityName || "-"}
          </Typography>
        ),
      },
      {
        key: "statusKey",
        label: "Estado",
        sortable: true,
        width: 160,
        render: (row) => (
          <Chip
            label={row.status}
            color={STATUS_COLORS[row.statusKey] || "default"}
            size="small"
            sx={{ textTransform: "capitalize" }}
          />
        ),
      },
      {
        key: "expirationTimestamp",
        label: "Vencimiento",
        sortable: true,
        width: 160,
        render: (row) => (
          <Typography
            variant="body2"
            sx={{ color: getDeadlineColor ? getDeadlineColor(row.diasRestantes) : "inherit" }}
          >
            {formatDate(row.expirationDate)}
          </Typography>
        ),
      },
      {
        key: "diasRestantes",
        label: "Días restantes",
        sortable: true,
        width: 140,
        render: (row) =>
          row.diasRestantes === null || row.diasRestantes === undefined
            ? "N/A"
            : row.diasRestantes < 0
            ? `Vencido (${Math.abs(row.diasRestantes)})`
            : row.diasRestantes,
      },
      {
        key: "lastUpdatedTimestamp",
        label: "Última actualización",
        sortable: true,
        width: 180,
        render: (row) => formatDate(row.lastUpdated, true),
      },
      {
        key: "comment",
        label: "Comentario",
        render: (row) =>
          row.comment ? (
            <Tooltip title={row.comment}>
              <Typography
                variant="body2"
                sx={{
                  maxWidth: 240,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {row.comment}
              </Typography>
            </Tooltip>
          ) : (
            "-"
          ),
      },
    ],
    [getDeadlineColor]
  );

  return (
    <Box sx={{ mt: 4 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <TextField
          size="small"
          placeholder="Buscar por empresa, entidad o documento"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: { xs: "100%", md: 280 } }}
        />

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button
            variant="outlined"
            size="small"
            startIcon={<RestartAltIcon fontSize="small" />}
            onClick={handleResetFilters}
            sx={{ whiteSpace: "nowrap" }}
          >
            Limpiar filtros
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<FileDownloadIcon fontSize="small" />}
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
            sx={{ whiteSpace: "nowrap" }}
          >
            Exportar CSV
          </Button>
        </Stack>
      </Stack>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ mb: 2 }}
      >
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="admin-advanced-company-filter-label">Empresa</InputLabel>
          <Select
            labelId="admin-advanced-company-filter-label"
            label="Empresa"
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
          >
            {companyOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedCompanyId && clientOptions.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="admin-advanced-client-filter-label">Cliente</InputLabel>
            <Select
              labelId="admin-advanced-client-filter-label"
              label="Cliente"
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
            >
              {clientOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="admin-advanced-status-filter-label">Estado</InputLabel>
          <Select
            labelId="admin-advanced-status-filter-label"
            label="Estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <MenuItem value="all">Todos los estados</MenuItem>
            {statusOptions
              .filter((option) => option !== "all")
              .map((option) => (
                <MenuItem key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="admin-advanced-entity-filter-label">Tipo de entidad</InputLabel>
          <Select
            labelId="admin-advanced-entity-filter-label"
            label="Tipo de entidad"
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
          >
            <MenuItem value="all">Todas las entidades</MenuItem>
            {entityOptions
              .filter((option) => option !== "all")
              .map((option) => (
                <MenuItem key={option} value={option}>
                  {ENTITY_LABELS[option] || "Personalizado"}
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="admin-advanced-deadline-filter-label">Vencimiento</InputLabel>
          <Select
            labelId="admin-advanced-deadline-filter-label"
            label="Vencimiento"
            value={deadlineFilter}
            onChange={(event) => setDeadlineFilter(event.target.value)}
          >
            {DEADLINE_FILTERS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={onlyMissing}
              onChange={(event) => setOnlyMissing(event.target.checked)}
            />
          }
          label="Solo pendientes de subir"
          sx={{ ml: { xs: 0, md: 1 } }}
        />
      </Stack>

      <SuperTable
        columns={columns}
        rows={filteredRows}
        isLoading={isLoading}
        emptyText="No se encontraron documentos con los filtros seleccionados."
        defaultSort={{ key: "expirationTimestamp", direction: "asc" }}
        rowActions={(row) => (
          <Button
            size="small"
            variant="outlined"
            startIcon={<FactCheckIcon fontSize="small" />}
            onClick={(event) => {
              event.stopPropagation();
              navigate(
                `/admin/uploaded-documents?empresa=${row.companyId || ""}&docId=${row.raw?.id || ""}`
              );
            }}
          >
            {row.missing ? "Subir" : "Gestionar"}
          </Button>
        )}
        onRowClick={(row) =>
          navigate(
            `/admin/uploaded-documents?empresa=${row.companyId || ""}&docId=${row.raw?.id || ""}`
          )
        }
      />
    </Box>
  );
};

export default AdminAdvancedDocuments;


