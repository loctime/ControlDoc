import React, { useMemo, useState } from "react";
import {
  Box,
  Tabs,
  Tab,
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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import { DashboardCustomize as DashboardCustomizeIcon } from "@mui/icons-material";
import SuperTable from "../../../components/common/superTable";
import ModalDocument from "../components/ModalDocument";
import { useClientNamesMap } from "../../../utils/getClientName";

const STANDARD_ENTITY_TYPES = new Set(["company", "employee", "personal", "vehicle", "vehiculo"]);

const STATUS_COLORS = {
  aprobado: "success",
  rechado: "error",
  rechazado: "error",
  "en proceso": "warning",
  subido: "info",
  pendiente: "default",
  "pendiente de revisión": "info",
};

const formatDate = (value, withTime = false) => {
  if (!value) return "-";
  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value.toDate === "function") {
    date = value.toDate();
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return "-";
  const options = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  };
  return date.toLocaleString("es-AR", options);
};

const normalizeStatus = (status) =>
  (status || "Pendiente")
    .toString()
    .trim()
    .toLowerCase();

const getTimestamp = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? date.getTime() : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const buildCompanyRows = (requiredDocuments = [], uploadedDocuments = [], companyName = "", activeCompanyId = null, mainCompanyId = null) => {
  const rows = [];
  const isMainCompany = activeCompanyId && mainCompanyId && activeCompanyId === mainCompanyId;
  
  const requiredDocs = requiredDocuments.filter((doc) => doc.entityType === "company" || !STANDARD_ENTITY_TYPES.has(doc.entityType));
  
  // Debug logs
  if (import.meta.env.DEV) {
    console.log('[AdvancedDashboardView] buildCompanyRows:', {
      requiredDocsCount: requiredDocs.length,
      uploadedDocumentsCount: uploadedDocuments.length,
      isMainCompany,
      activeCompanyId,
      mainCompanyId,
      requiredDocs: requiredDocs.map(d => ({ id: d.id, name: d.name, entityType: d.entityType })),
      uploadedDocs: uploadedDocuments.slice(0, 3).map(d => ({ 
        id: d.id, 
        requiredDocumentId: d.requiredDocumentId, 
        clientId: d.clientId || 'null',
        entityType: d.entityType 
      }))
    });
  }
  
  requiredDocs.forEach((doc) => {
    // Buscar todos los documentos subidos que coincidan con este requiredDocumentId
    const matchingUploaded = uploadedDocuments.filter((up) => up.requiredDocumentId === doc.id);
    
    if (isMainCompany) {
      // Si estamos en empresa principal, mostrar TODOS los documentos subidos (principal + clientes)
      // Si no hay documentos subidos, mostrar al menos uno "Pendiente"
      if (matchingUploaded.length > 0) {
        matchingUploaded.forEach((uploaded) => {
          const status = uploaded?.status || "Pendiente";
          const normalizedStatus = normalizeStatus(status);
          const expirationDate = uploaded?.expirationDate || uploaded?.deadline?.date || doc?.expirationDate || doc?.deadline?.date || null;
          const lastUpdated = uploaded?.uploadedAt || uploaded?.updatedAt || uploaded?.createdAt || null;
          
          rows.push({
            id: `${doc.id}-${uploaded.id || 'pending'}-${uploaded.clientId || 'main'}`,
            name: doc.name,
            category: doc.entityType === "company" ? "Empresa" : "Personalizado",
            originalDoc: doc,
            uploadedDoc: uploaded,
            status,
            statusKey: normalizedStatus,
            expirationDate,
            expirationTimestamp: getTimestamp(expirationDate),
            lastUpdated,
            lastUpdatedTimestamp: getTimestamp(lastUpdated),
            comment: uploaded?.comentario || doc?.comentario || "",
            exampleComment: doc?.exampleComment || "",
            companyName,
          });
        });
      } else {
        // No hay documentos subidos, mostrar como "Pendiente"
        rows.push({
          id: doc.id,
          name: doc.name,
          category: doc.entityType === "company" ? "Empresa" : "Personalizado",
          originalDoc: doc,
          uploadedDoc: null,
          status: "Pendiente",
          statusKey: normalizeStatus("Pendiente"),
          expirationDate: doc?.expirationDate || doc?.deadline?.date || null,
          expirationTimestamp: getTimestamp(doc?.expirationDate || doc?.deadline?.date || null),
          lastUpdated: null,
          lastUpdatedTimestamp: null,
          comment: doc?.comentario || "",
          exampleComment: doc?.exampleComment || "",
          companyName,
        });
      }
    } else {
      // Estamos en un cliente: buscar solo documentos de ese cliente (o sin clientId si aplica)
      const uploaded = matchingUploaded.find((up) => 
        !up.clientId || String(up.clientId) === String(activeCompanyId)
      );
      
      const status = uploaded?.status || "Pendiente";
      const normalizedStatus = normalizeStatus(status);
      const expirationDate = uploaded?.expirationDate || uploaded?.deadline?.date || doc?.expirationDate || doc?.deadline?.date || null;
      const lastUpdated = uploaded?.uploadedAt || uploaded?.updatedAt || uploaded?.createdAt || null;
      
      rows.push({
        id: doc.id,
        name: doc.name,
        category: doc.entityType === "company" ? "Empresa" : "Personalizado",
        originalDoc: doc,
        uploadedDoc: uploaded || null,
        status,
        statusKey: normalizedStatus,
        expirationDate,
        expirationTimestamp: getTimestamp(expirationDate),
        lastUpdated,
        lastUpdatedTimestamp: getTimestamp(lastUpdated),
        comment: uploaded?.comentario || doc?.comentario || "",
        exampleComment: doc?.exampleComment || "",
        companyName,
      });
    }
  });

  // Debug: Log final de rows generados
  if (import.meta.env.DEV) {
    console.log('[AdvancedDashboardView] buildCompanyRows resultado:', {
      totalRows: rows.length,
      rowsWithUploaded: rows.filter(r => r.uploadedDoc).length,
      rowsPending: rows.filter(r => !r.uploadedDoc).length
    });
  }

  return rows;
};

const buildEntityRows = (requiredDocuments = [], uploadedDocuments = [], personal = [], vehiculos = [], activeCompanyId = null, mainCompanyId = null) => {
  const employeeDocs = requiredDocuments.filter(
    (doc) => doc.entityType === "employee" || doc.entityType === "personal"
  );
  const vehicleDocs = requiredDocuments.filter(
    (doc) => doc.entityType === "vehicle" || doc.entityType === "vehiculo"
  );

  // Debug logs
  if (import.meta.env.DEV) {
    const allEntityTypes = [...new Set(requiredDocuments.map(d => d.entityType))];
    console.log('[AdvancedDashboardView] buildEntityRows - INFORMACIÓN DETALLADA:', {
      requiredDocumentsCount: requiredDocuments.length,
      employeeDocsCount: employeeDocs.length,
      vehicleDocsCount: vehicleDocs.length,
      personalCount: personal.length,
      vehiculosCount: vehiculos.length,
      uploadedDocumentsCount: uploadedDocuments.length,
      activeCompanyId,
      mainCompanyId,
      allEntityTypes,
      problema: employeeDocs.length === 0 && vehicleDocs.length === 0 && (personal.length > 0 || vehiculos.length > 0) 
        ? '⚠️ NO HAY documentos requeridos de tipo employee/vehicle. Por eso no aparecen filas.' 
        : 'OK',
      allRequiredDocs: requiredDocuments.map(d => ({ id: d.id, name: d.name, entityType: d.entityType, appliesTo: d.appliesTo })),
      employeeDocs: employeeDocs.map(d => ({ id: d.id, name: d.name, entityType: d.entityType })),
      vehicleDocs: vehicleDocs.map(d => ({ id: d.id, name: d.name, entityType: d.entityType })),
      samplePersonal: personal.slice(0, 2).map(p => ({ id: p.id, nombre: p.nombre, clientId: p.clientId })),
      sampleVehiculos: vehiculos.slice(0, 2).map(v => ({ id: v.id, marca: v.marca, patente: v.patente, clientId: v.clientId }))
    });
  }

  const rows = [];
  const isMainCompany = activeCompanyId && mainCompanyId && activeCompanyId === mainCompanyId;

  personal.forEach((persona) => {
    const personaClientId = persona.clientId || null;
    
    employeeDocs.forEach((doc) => {
      // Buscar documento subido que coincida con la entidad
      // Si estamos en empresa principal, mostrar todos los documentos (sin filtrar por clientId)
      // Si estamos en cliente, solo mostrar documentos de ese cliente
      let uploaded;
      
      if (isMainCompany) {
        // Empresa principal: buscar cualquier documento de esta persona (puede ser de cualquier cliente o sin cliente)
        uploaded = uploadedDocuments.find(
          (up) => up.entityId === persona.id && up.requiredDocumentId === doc.id
        );
      } else {
        // Cliente: buscar solo documentos de este cliente (clientId debe coincidir o ser null si aplica)
        uploaded = uploadedDocuments.find(
          (up) => up.entityId === persona.id && 
                  up.requiredDocumentId === doc.id &&
                  (String(up.clientId || 'null') === String(activeCompanyId) || (!up.clientId && personaClientId === null))
        );
      }
      
      const status = uploaded?.status || "Pendiente";
      rows.push({
        id: `${persona.id}-${doc.id}-${uploaded?.id || 'pending'}`,
        entityId: persona.id,
        entityName: `${persona.nombre || ""} ${persona.apellido || ""}`.trim() || persona.alias || "Empleado",
        entityEmail: persona.email || "",
        entityType: "employee",
        documentName: doc.name || "",
        originalDoc: doc,
        uploadedDoc: uploaded || null,
        status,
        statusKey: normalizeStatus(status),
        expirationDate:
          uploaded?.expirationDate || uploaded?.deadline?.date || doc?.expirationDate || doc?.deadline?.date || null,
        expirationTimestamp: getTimestamp(
          uploaded?.expirationDate || uploaded?.deadline?.date || doc?.expirationDate || doc?.deadline?.date || null
        ),
        lastUpdated: uploaded?.uploadedAt || uploaded?.updatedAt || uploaded?.createdAt || null,
        lastUpdatedTimestamp: getTimestamp(uploaded?.uploadedAt || uploaded?.updatedAt || uploaded?.createdAt || null),
        comment: uploaded?.comentario || doc?.comentario || "",
      });
    });
  });

  vehiculos.forEach((vehiculo) => {
    const vehiculoClientId = vehiculo.clientId || null;
    
    vehicleDocs.forEach((doc) => {
      // Buscar documento subido que coincida con la entidad
      let uploaded;
      
      if (isMainCompany) {
        // Empresa principal: buscar cualquier documento de este vehículo
        uploaded = uploadedDocuments.find(
          (up) => up.entityId === vehiculo.id && up.requiredDocumentId === doc.id
        );
      } else {
        // Cliente: buscar solo documentos de este cliente
        uploaded = uploadedDocuments.find(
          (up) => up.entityId === vehiculo.id && 
                  up.requiredDocumentId === doc.id &&
                  (String(up.clientId || 'null') === String(activeCompanyId) || (!up.clientId && vehiculoClientId === null))
        );
      }
      
      const status = uploaded?.status || "Pendiente";
      rows.push({
        id: `${vehiculo.id}-${doc.id}-${uploaded?.id || 'pending'}`,
        entityId: vehiculo.id,
        entityName: `${vehiculo.marca || ""} ${vehiculo.modelo || ""} ${vehiculo.patente ? `(${vehiculo.patente})` : ""}`.trim() || "Vehículo",
        entityType: "vehicle",
        documentName: doc.name || "",
        originalDoc: doc,
        uploadedDoc: uploaded || null,
        status,
        statusKey: normalizeStatus(status),
        expirationDate:
          uploaded?.expirationDate || uploaded?.deadline?.date || doc?.expirationDate || doc?.deadline?.date || null,
        expirationTimestamp: getTimestamp(
          uploaded?.expirationDate || uploaded?.deadline?.date || doc?.expirationDate || doc?.deadline?.date || null
        ),
        lastUpdated: uploaded?.uploadedAt || uploaded?.updatedAt || uploaded?.createdAt || null,
        lastUpdatedTimestamp: getTimestamp(uploaded?.uploadedAt || uploaded?.updatedAt || uploaded?.createdAt || null),
        comment: uploaded?.comentario || doc?.comentario || "",
      });
    });
  });

  // Debug: Log final de rows generados
  if (import.meta.env.DEV) {
    console.log('[AdvancedDashboardView] buildEntityRows resultado:', {
      totalRows: rows.length,
      employeeRows: rows.filter(r => r.entityType === 'employee').length,
      vehicleRows: rows.filter(r => r.entityType === 'vehicle').length
    });
  }

  return rows;
};

const statusOptions = [
  { value: "todos", label: "Todos" },
  { value: "aprobado", label: "Aprobado" },
  { value: "en proceso", label: "En proceso" },
  { value: "pendiente de revisión", label: "Pendiente de revisión" },
  { value: "rechazado", label: "Rechazado" },
  { value: "subido", label: "Subido" },
];

const entityTypeOptions = [
  { value: "all", label: "Todas las entidades" },
  { value: "employee", label: "Personal" },
  { value: "vehicle", label: "Vehículos" },
];

const categoryOptions = [
  { value: "all", label: "Todas las categorías" },
  { value: "Empresa", label: "Empresa" },
  { value: "Personalizado", label: "Personalizados" },
];

const AdvancedDashboardView = ({
  company,
  companyId,
  activeCompanyId,
  mainCompanyId,
  requiredDocuments,
  uploadedDocuments,
  personal,
  vehiculos,
  refreshUploadedDocuments,
  currentUser,
}) => {
  const [subTab, setSubTab] = useState(0);

  // Company filters
  const [companySearch, setCompanySearch] = useState("");
  const [companyStatusFilter, setCompanyStatusFilter] = useState("todos");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Entity filters
  const [entitySearch, setEntitySearch] = useState("");
  const [entityStatusFilter, setEntityStatusFilter] = useState("todos");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [entitySelector, setEntitySelector] = useState("all");
  const [documentSelector, setDocumentSelector] = useState("all");

  const [modalState, setModalState] = useState({
    open: false,
    selectedDocument: null,
    entityType: "",
    entityName: "",
    entityId: "",
    uploadedDoc: null,
  });

  const companyRows = useMemo(
    () => buildCompanyRows(
      requiredDocuments,
      uploadedDocuments,
      company?.companyName || company?.legalName || company?.nombre || company?.name || "Empresa",
      activeCompanyId,
      mainCompanyId
    ),
    [requiredDocuments, uploadedDocuments, company, activeCompanyId, mainCompanyId]
  );

  const entityRows = useMemo(
    () => buildEntityRows(requiredDocuments, uploadedDocuments, personal, vehiculos, activeCompanyId, mainCompanyId),
    [requiredDocuments, uploadedDocuments, personal, vehiculos, activeCompanyId, mainCompanyId]
  );

  // Extraer clientIds únicos de los rows
  const clientIds = useMemo(() => {
    const ids = new Set();
    companyRows.forEach(row => {
      if (row.uploadedDoc?.clientId) ids.add(row.uploadedDoc.clientId);
    });
    entityRows.forEach(row => {
      if (row.uploadedDoc?.clientId) ids.add(row.uploadedDoc.clientId);
    });
    return [...ids];
  }, [companyRows, entityRows]);

  // Obtener nombres de clientes
  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } = useClientNamesMap(clientIds);

  const filteredCompanyRows = useMemo(() => {
    const searchLower = companySearch.trim().toLowerCase();
    return companyRows.filter((row) => {
      const matchesStatus = companyStatusFilter === "todos" || row.statusKey === companyStatusFilter;
      const matchesCategory = categoryFilter === "all" || row.category === categoryFilter;
      const matchesSearch =
        !searchLower ||
        row.name?.toLowerCase().includes(searchLower) ||
        row.comment?.toLowerCase().includes(searchLower) ||
        (row.companyName || (company?.companyName || company?.name || "Empresa")).toLowerCase().includes(searchLower);
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [companyRows, companyStatusFilter, companySearch, categoryFilter]);

  const availableEntities = useMemo(() => {
    const names = new Set();
    entityRows.forEach((row) => {
      if (entityTypeFilter === "all" || row.entityType === entityTypeFilter) {
        names.add(row.entityName);
      }
    });
    return Array.from(names).sort();
  }, [entityRows, entityTypeFilter]);

  const availableDocuments = useMemo(() => {
    const docs = new Set();
    entityRows.forEach((row) => {
      if (entityTypeFilter === "all" || row.entityType === entityTypeFilter) {
        docs.add(row.originalDoc?.name || "-");
      }
    });
    return Array.from(docs).sort();
  }, [entityRows, entityTypeFilter]);

  const filteredEntityRows = useMemo(() => {
    const searchLower = entitySearch.trim().toLowerCase();
    return entityRows.filter((row) => {
      const matchesType = entityTypeFilter === "all" || row.entityType === entityTypeFilter;
      const matchesStatus = entityStatusFilter === "todos" || row.statusKey === entityStatusFilter;
      const matchesEntity =
        entitySelector === "all" || row.entityName.toLowerCase() === entitySelector.toLowerCase();
      const matchesDocument =
        documentSelector === "all" ||
        (row.originalDoc?.name || "").toLowerCase() === documentSelector.toLowerCase();
      const matchesSearch =
        !searchLower ||
        row.entityName?.toLowerCase().includes(searchLower) ||
        (row.originalDoc?.name || "").toLowerCase().includes(searchLower);

      return matchesType && matchesStatus && matchesEntity && matchesDocument && matchesSearch;
    });
  }, [
    entityRows,
    entityTypeFilter,
    entityStatusFilter,
    entitySelector,
    documentSelector,
    entitySearch,
  ]);

  const handleOpenModal = ({ doc, entityType, entityName, entityId, uploadedDoc }) => {
    if (!doc) return;
    setModalState({
      open: true,
      selectedDocument: { ...doc, entityId },
      entityType,
      entityName,
      entityId,
      uploadedDoc,
    });
  };

  const handleCloseModal = () => {
    setModalState({
      open: false,
      selectedDocument: null,
      entityType: "",
      entityName: "",
      entityId: "",
      uploadedDoc: null,
    });
  };

  const companyColumns = useMemo(
    () => [
      {
        key: "name",
        label: "Documento",
        sortable: true,
        render: (row) => (
          <Box>
            <Typography variant="subtitle2">{row.name}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
              <Chip size="small" label={row.category} color="primary" variant="outlined" />
              {row.exampleComment && (
                <Tooltip title={row.exampleComment}>
                  <Chip size="small" label="Ejemplo" variant="outlined" />
                </Tooltip>
              )}
            </Stack>
          </Box>
        ),
      },
      {
        key: "clientName",
        label: "Cliente",
        width: 150,
        sortable: false,
        render: (row) => {
          const clientId = row.uploadedDoc?.clientId;
          if (!clientId) return "-";
          return isLoadingClientNames ? "..." : (clientNamesMap[clientId] || "-");
        },
      },
      {
        key: "statusKey",
        label: "Estado",
        width: 160,
        sortable: true,
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
        width: 160,
        sortable: true,
        render: (row) => formatDate(row.expirationDate),
      },
      {
        key: "lastUpdatedTimestamp",
        label: "Última actualización",
        width: 180,
        sortable: true,
        render: (row) => formatDate(row.lastUpdated, true),
      },
      {
        key: "comment",
        label: "Comentario",
        render: (row) =>
          row.comment ? (
            <Tooltip title={row.comment}>
              <Typography variant="body2" sx={{ maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {row.comment}
              </Typography>
            </Tooltip>
          ) : (
            "-"
          ),
      },
    ],
    [clientNamesMap, isLoadingClientNames]
  );

  const entityColumns = useMemo(
    () => [
      {
        key: "entityName",
        label: "Entidad",
        sortable: true,
        render: (row) => (
          <Box>
            <Typography variant="subtitle2">{row.entityName}</Typography>
            <Chip
              label={row.entityType === "employee" ? "Personal" : "Vehículo"}
              size="small"
              color="secondary"
              variant="outlined"
              sx={{ mt: 0.5 }}
            />
          </Box>
        ),
      },
      {
        key: "clientName",
        label: "Cliente",
        width: 150,
        sortable: false,
        render: (row) => {
          const clientId = row.uploadedDoc?.clientId;
          if (!clientId) return "-";
          return isLoadingClientNames ? "..." : (clientNamesMap[clientId] || "-");
        },
      },
      {
        key: "documentName",
        label: "Documento requerido",
        sortable: true,
        render: (row) => (
          <Typography variant="subtitle2">{row.originalDoc?.name || "-"}</Typography>
        ),
      },
      {
        key: "statusKey",
        label: "Estado",
        width: 150,
        sortable: true,
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
        width: 160,
        sortable: true,
        render: (row) => formatDate(row.expirationDate),
      },
      {
        key: "lastUpdatedTimestamp",
        label: "Última actualización",
        width: 180,
        sortable: true,
        render: (row) => formatDate(row.lastUpdated, true),
      },
      {
        key: "comment",
        label: "Comentario",
        render: (row) =>
          row.comment ? (
            <Tooltip title={row.comment}>
              <Typography variant="body2" sx={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {row.comment}
              </Typography>
            </Tooltip>
          ) : (
            "-"
          ),
      },
    ],
    [clientNamesMap, isLoadingClientNames]
  );

  return (
    <Box sx={{ mt: 2 }} id="user-dashboard-advanced-view">
      

      <Box sx={{ width: '100%', mb: 2 }} id="user-dashboard-advanced-tabs">
        <Tabs
          value={subTab}
          onChange={(_, value) => setSubTab(value)}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
          sx={{ minHeight: 40 }}
        >
          <Tab
            label="DOCUMENTOS DE EMPRESA"
            sx={{ minHeight: 40, py: 0.5 }}
            id="user-dashboard-advanced-tab-company"
          />
          <Tab
            label="DOCUMENTOS POR ENTIDAD"
            sx={{ minHeight: 40, py: 0.5 }}
            id="user-dashboard-advanced-tab-entity"
          />
        </Tabs>
      </Box>

      {subTab === 0 && (
        <Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={2} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField
              size="small"
              placeholder="Buscar por documento o comentario"
              value={companySearch}
              onChange={(event) => setCompanySearch(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: { xs: "100%", md: 280 } }}
            />

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="company-status-filter-label">Estado</InputLabel>
              <Select
                labelId="company-status-filter-label"
                label="Estado"
                value={companyStatusFilter}
                onChange={(event) => setCompanyStatusFilter(event.target.value)}
              >
                {statusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="category-filter-label">Categoría</InputLabel>
              <Select
                labelId="category-filter-label"
                label="Categoría"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                {categoryOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <SuperTable
            columns={companyColumns}
            rows={filteredCompanyRows}
            isLoading={false}
            emptyText="No se encontraron documentos con los filtros seleccionados."
            rowActions={(row) => (
              <Button
                variant="outlined"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenModal({
                    doc: row.originalDoc,
                    entityType: row.originalDoc?.entityType === "company" ? "company" : row.originalDoc?.entityType,
                    entityId: companyId,
                    entityName: row.companyName || company?.companyName || company?.name || "Empresa",
                    uploadedDoc: row.uploadedDoc,
                  });
                }}
              >
                {row.uploadedDoc ? "Gestionar" : "Subir"}
              </Button>
            )}
          />
        </Box>
      )}

      {subTab === 1 && (
        <Box>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            mb={2}
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <TextField
              size="small"
              placeholder="Buscar por entidad o documento"
              value={entitySearch}
              onChange={(event) => setEntitySearch(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: { xs: "100%", md: 280 } }}
            />

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="entity-type-filter-label">Tipo de entidad</InputLabel>
              <Select
                labelId="entity-type-filter-label"
                label="Tipo de entidad"
                value={entityTypeFilter}
                onChange={(event) => {
                  setEntityTypeFilter(event.target.value);
                  setEntitySelector("all");
                  setDocumentSelector("all");
                }}
              >
                {entityTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="entity-selector-label">Entidad</InputLabel>
              <Select
                labelId="entity-selector-label"
                label="Entidad"
                value={entitySelector}
                onChange={(event) => setEntitySelector(event.target.value)}
              >
                <MenuItem value="all">Todas</MenuItem>
                {availableEntities.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="document-selector-label">Documento requerido</InputLabel>
              <Select
                labelId="document-selector-label"
                label="Documento requerido"
                value={documentSelector}
                onChange={(event) => setDocumentSelector(event.target.value)}
              >
                <MenuItem value="all">Todos</MenuItem>
                {availableDocuments.map((docName) => (
                  <MenuItem key={docName} value={docName}>
                    {docName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="entity-status-filter-label">Estado</InputLabel>
              <Select
                labelId="entity-status-filter-label"
                label="Estado"
                value={entityStatusFilter}
                onChange={(event) => setEntityStatusFilter(event.target.value)}
              >
                {statusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <SuperTable
            columns={entityColumns}
            rows={filteredEntityRows}
            isLoading={false}
            emptyText="No se encontraron documentos con los filtros seleccionados."
            rowActions={(row) => (
              <Button
                variant="outlined"
                size="small"
                startIcon={<FilterAltIcon fontSize="small" />}
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenModal({
                    doc: row.originalDoc,
                    entityType: row.originalDoc?.entityType === "personal" ? "employee" : row.originalDoc?.entityType,
                    entityId: row.entityId,
                    entityName: row.entityName,
                    uploadedDoc: row.uploadedDoc,
                  });
                }}
              >
                {row.uploadedDoc ? "Gestionar" : "Subir"}
              </Button>
            )}
          />
        </Box>
      )}

  <ModalDocument
    open={modalState.open}
    onClose={handleCloseModal}
    selectedDocument={modalState.selectedDocument}
    currentUser={currentUser}
    entityType={modalState.entityType || "company"}
    entityName={modalState.entityName || ""}
    latestUploadedDoc={modalState.uploadedDoc}
    onUploadSuccess={async () => {
      handleCloseModal();
      if (typeof refreshUploadedDocuments === "function") {
        await refreshUploadedDocuments();
      }
    }}
  />
    </Box>
  );
};

export default AdvancedDashboardView;

