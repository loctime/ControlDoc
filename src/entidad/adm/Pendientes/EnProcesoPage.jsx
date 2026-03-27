import React, { useEffect, useState, useContext, useMemo } from "react";
import {
  Box,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  IconButton,
  Collapse,
  Typography,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip
} from "@mui/material";
import { ExpandMore, ExpandLess, CheckCircle, Cancel } from "@mui/icons-material";
import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "../../../firebaseconfig";
import { getTenantCollectionPath } from "../../../utils/tenantUtils";
import { useCompanies } from "../../../context/CompaniesContext";
import { AuthContext } from "../../../context/AuthContext";
import { useRefresh } from "../../../context/RefreshContext";
import { useClientNamesMap } from "../../../utils/getClientName";
import { parseFirestoreDate } from "../../../utils/dateHelpers";
import {
  getDeadlineColor,
  getDeadlineStatus,
  getStatusIconComponent
} from "../../../utils/getDeadlineUtils";

import VistaDocumentoSubido from "../VistaDocumentoSubido";
import RevisionDocumentoDialog from "../RevisionDocumentoDialog";
import handleApproveOrReject from "../handleApproveOrReject";

const SORT_OPTIONS = [
  { value: "uploadedAtDesc", label: "Subido (reciente)" },
  { value: "uploadedAtAsc", label: "Subido (antiguo)" }
];

function formatExpiration(expirationDate) {
  const date = parseFirestoreDate(expirationDate);
  if (!date) return "Sin fecha";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function expirationToDate(expirationDate) {
  const date = parseFirestoreDate(expirationDate);
  if (!date) return null;
  return date.toISOString().split("T")[0];
}

export default function EnProcesoPage() {
  const { selectedCompany, companies } = useCompanies();
  const { user } = useContext(AuthContext);
  const { triggerRefresh } = useRefresh();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const [dialogAccion, setDialogAccion] = useState(null);
  const [newExpirationDates, setNewExpirationDates] = useState({});
  const [adminComment, setAdminComment] = useState({});
  const [sortOption, setSortOption] = useState("uploadedAtDesc");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDocuments = useMemo(
    () => async () => {
      setLoading(true);
      setError("");
      try {
        const path = getTenantCollectionPath("uploadedDocuments");
        let q = query(
          collection(db, path),
          where("status", "==", "En proceso"),
          where("companyId", "!=", null)
        );
        if (selectedCompany?.id) {
          q = query(q, where("companyId", "==", selectedCompany.id));
        }
        const snap = await getDocs(q);

        const assignedIds = new Set((companies || []).map((c) => c.id));
        const filtered = selectedCompany?.id
          ? snap.docs
          : snap.docs.filter((d) => assignedIds.has(d.data().companyId));

        const docs = filtered.map((d) => {
          const data = d.data();
          const company = (companies || []).find((c) => c.id === data.companyId);
          const uploadedAt = parseFirestoreDate(data.uploadedAt);
          return {
            id: d.id,
            ...data,
            companyName:
              company?.name || data.companyName || "Empresa no especificada",
            expirationDateFormatted: formatExpiration(data.expirationDate),
            uploadedAtFormatted: uploadedAt
              ? uploadedAt.toLocaleString("es-ES", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })
              : "Sin fecha",
            versionString:
              data.versionString ||
              `v${data.versionNumber ?? data.version ?? 1}`,
            entityFullType:
              data.entityType === "company"
                ? "Empresa"
                : data.entityType === "employee"
                ? "Empleado"
                : data.entityType === "vehicle"
                ? "Vehículo"
                : "—"
          };
        });

        setDocuments(docs);
      } catch (e) {
        console.error("Error fetching documents:", e);
        setError("Error cargando documentos en proceso");
      } finally {
        setLoading(false);
      }
    },
    [selectedCompany, companies]
  );

  useEffect(() => {
    if (companies) fetchDocuments();
  }, [companies, fetchDocuments]);

  const clientIds = useMemo(() => {
    const ids = documents.map((d) => d.clientId).filter(Boolean);
    return [...new Set(ids)];
  }, [documents]);

  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } =
    useClientNamesMap(clientIds);

  const filteredAndSorted = useMemo(() => {
    return [...documents].sort((a, b) => {
      if (sortOption === "uploadedAtDesc") {
        return (b.uploadedAt?.seconds ?? 0) - (a.uploadedAt?.seconds ?? 0);
      }
      if (sortOption === "uploadedAtAsc") {
        return (a.uploadedAt?.seconds ?? 0) - (b.uploadedAt?.seconds ?? 0);
      }
      return 0;
    });
  }, [documents, sortOption]);

  const handleConfirmDialog = async (payload) => {
    const { type, expirationDate: expDate, adminComment: comment } = payload;
    const docToUse = dialogAccion?.doc;
    if (!docToUse?.id) return;

    setIsSubmitting(true);
    try {
      const action = type.toUpperCase().replace(/\s+/g, "_");
      await handleApproveOrReject({
        db,
        document: docToUse,
        action,
        newExpirationDate: expDate,
        adminComment: comment,
        user
      });

      setDocuments((prev) => prev.filter((d) => d.id !== docToUse.id));
      setDialogAccion(null);
      setNewExpirationDates((prev) => {
        const next = { ...prev };
        delete next[docToUse.id];
        return next;
      });
      setAdminComment((prev) => {
        const next = { ...prev };
        delete next[docToUse.id];
        return next;
      });
      triggerRefresh("historial");
    } catch (err) {
      console.error("Error en revisión:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDialog = (tipo, doc) => {
    setDialogAccion({ tipo, doc });
    if (
      (tipo === "aprobar" || tipo === "ajustar_fecha") &&
      doc.expirationDate &&
      !newExpirationDates[doc.id]
    ) {
      const iso = expirationToDate(doc.expirationDate);
      if (iso) setNewExpirationDates((p) => ({ ...p, [doc.id]: iso }));
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Ordenar por</InputLabel>
          <Select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            label="Ordenar por"
          >
            {SORT_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {filteredAndSorted.length === 0 ? (
        <Typography sx={{ p: 2 }} color="text.secondary">
          No hay documentos en proceso.
        </Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Empresa</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Documento</TableCell>
                <TableCell>Entidad</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Vencimiento</TableCell>
                <TableCell>Versión</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSorted.map((doc) => (
                <React.Fragment key={doc.id}>
                  <TableRow>
                    <TableCell>{doc.companyName}</TableCell>
                    <TableCell>
                      {doc.clientId
                        ? isLoadingClientNames
                          ? "…"
                          : clientNamesMap[doc.clientId] ?? "—"
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {doc.name ||
                        doc.documentName ||
                        doc.fileName?.split(".")[0] ||
                        "Sin nombre"}
                    </TableCell>
                    <TableCell>{doc.entityFullType}</TableCell>
                    <TableCell>
                      <Chip
                        label={doc.status}
                        size="small"
                        color="info"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell
                      sx={{
                        color: getDeadlineColor(doc.expirationDate)
                      }}
                    >
                      {doc.expirationDate ? (
                        <>
                          {getStatusIconComponent(
                            getDeadlineStatus(doc.expirationDate).icon
                          )}{" "}
                          {doc.expirationDateFormatted}
                        </>
                      ) : (
                        "Sin fecha"
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={`Versión ${doc.versionString}`}>
                        <Typography variant="body2">
                          {doc.versionString}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setExpandedRow(
                            expandedRow === doc.id ? null : doc.id
                          )
                        }
                        aria-label={
                          expandedRow === doc.id
                            ? "Cerrar detalle"
                            : "Ver detalle"
                        }
                      >
                        {expandedRow === doc.id ? (
                          <ExpandLess />
                        ) : (
                          <ExpandMore />
                        )}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 0 }}>
                      <Collapse
                        in={expandedRow === doc.id}
                        timeout="auto"
                        unmountOnExit
                      >
                        <Box sx={{ p: 2, bgcolor: "grey.50" }}>
                          <VistaDocumentoSubido
                            id={doc.id}
                            name={doc.name || doc.documentName}
                            fileURL={doc.fileURL}
                            fileName={doc.fileName}
                            status={doc.status}
                            companyName={doc.companyName}
                            entityName={doc.entityName}
                            entityType={doc.entityType}
                            uploadedByEmail={doc.uploadedByEmail}
                            onApprove={() => openDialog("aprobar", doc)}
                            onReject={() => openDialog("rechazar", doc)}
                            onSetInProcess={() => {}}
                          />
                          <Box
                            sx={{
                              display: "flex",
                              gap: 1,
                              mt: 2,
                              flexWrap: "wrap"
                            }}
                          >
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={<CheckCircle />}
                              onClick={() => openDialog("aprobar", doc)}
                              disabled={isSubmitting}
                            >
                              Confirmar aprobación
                            </Button>
                            <Button
                              variant="contained"
                              color="error"
                              size="small"
                              startIcon={<Cancel />}
                              onClick={() => openDialog("rechazar", doc)}
                              disabled={isSubmitting}
                            >
                              Rechazar
                            </Button>
                          </Box>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <RevisionDocumentoDialog
        open={!!dialogAccion}
        type={dialogAccion?.tipo}
        document={dialogAccion?.doc}
        expirationDate={
          dialogAccion?.doc
            ? newExpirationDates[dialogAccion.doc.id] ?? ""
            : ""
        }
        adminComment={
          dialogAccion?.doc
            ? adminComment[dialogAccion.doc.id] ?? ""
            : ""
        }
        onClose={() => !isSubmitting && setDialogAccion(null)}
        onConfirm={handleConfirmDialog}
        loading={isSubmitting}
      />
    </Box>
  );
}
