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

const FILTER_STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "Aprobado", label: "Aprobados" },
  { value: "Rechazado", label: "Rechazados" }
];

const SORT_OPTIONS = [
  { value: "reviewedAtDesc", label: "Revisado (reciente)" },
  { value: "reviewedAtAsc", label: "Revisado (antiguo)" }
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

function formatReviewed(reviewedAt) {
  const date = parseFirestoreDate(reviewedAt);
  if (!date) return "—";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function expirationToDate(expirationDate) {
  const date = parseFirestoreDate(expirationDate);
  if (!date) return null;
  return date.toISOString().split("T")[0];
}

export default function HistorialPage() {
  const { selectedCompany, companies } = useCompanies();
  const { user } = useContext(AuthContext);
  const { triggerRefresh, getRefreshKey } = useRefresh();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const [dialogAccion, setDialogAccion] = useState(null);
  const [newExpirationDates, setNewExpirationDates] = useState({});
  const [adminComment, setAdminComment] = useState({});
  const [filterStatus, setFilterStatus] = useState("todos");
  const [sortOption, setSortOption] = useState("reviewedAtDesc");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshKey = getRefreshKey("historial");

  const fetchDocuments = useMemo(
    () => async () => {
      setLoading(true);
      setError("");
      try {
        const uploadedPath = getTenantCollectionPath("uploadedDocuments");
        const approvedPath = getTenantCollectionPath("approvedDocuments");
        const assignedIds = new Set((companies || []).map((c) => c.id));

        let approvedDocs = [];
        let rejectedDocs = [];

        const approvedQuery = query(
          collection(db, approvedPath),
          where("status", "==", "Aprobado"),
          where("companyId", "!=", null)
        );
        let qApproved = approvedQuery;
        if (selectedCompany?.id) {
          qApproved = query(
            qApproved,
            where("companyId", "==", selectedCompany.id)
          );
        }
        const approvedSnap = await getDocs(qApproved);
        const filteredApproved = selectedCompany?.id
          ? approvedSnap.docs
          : approvedSnap.docs.filter((d) =>
              assignedIds.has(d.data().companyId)
            );

        approvedDocs = filteredApproved.map((d) => {
          const data = d.data();
          const company = (companies || []).find((c) => c.id === data.companyId);
          const reviewedAt = parseFirestoreDate(data.reviewedAt);
          return {
            id: d.id,
            uploadedDocId: data.originalId || d.id,
            ...data,
            companyName:
              company?.name || data.companyName || "Empresa no especificada",
            status: "Aprobado",
            expirationDateFormatted: formatExpiration(data.expirationDate),
            reviewedAtFormatted: formatReviewed(data.reviewedAt),
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

        const rejectedQuery = query(
          collection(db, uploadedPath),
          where("status", "==", "Rechazado"),
          where("companyId", "!=", null)
        );
        let qRejected = rejectedQuery;
        if (selectedCompany?.id) {
          qRejected = query(
            qRejected,
            where("companyId", "==", selectedCompany.id)
          );
        }
        const rejectedSnap = await getDocs(qRejected);
        const filteredRejected = selectedCompany?.id
          ? rejectedSnap.docs
          : rejectedSnap.docs.filter((d) =>
              assignedIds.has(d.data().companyId)
            );

        rejectedDocs = filteredRejected.map((d) => {
          const data = d.data();
          const company = (companies || []).find((c) => c.id === data.companyId);
          return {
            id: d.id,
            uploadedDocId: d.id,
            ...data,
            companyName:
              company?.name || data.companyName || "Empresa no especificada",
            status: "Rechazado",
            expirationDateFormatted: formatExpiration(data.expirationDate),
            reviewedAtFormatted: formatReviewed(data.reviewedAt),
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

        setDocuments([...approvedDocs, ...rejectedDocs]);
      } catch (e) {
        console.error("Error fetching historial:", e);
        setError("Error cargando historial");
      } finally {
        setLoading(false);
      }
    },
    [selectedCompany, companies, refreshKey]
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
    return [...documents]
      .filter((d) => {
        if (filterStatus === "todos") return true;
        return d.status === filterStatus;
      })
      .sort((a, b) => {
        const aSec = a.reviewedAt?.seconds ?? 0;
        const bSec = b.reviewedAt?.seconds ?? 0;
        if (sortOption === "reviewedAtDesc") return bSec - aSec;
        if (sortOption === "reviewedAtAsc") return aSec - bSec;
        return 0;
      });
  }, [documents, filterStatus, sortOption]);

  const getDocumentForAction = (row) => ({
    ...row,
    id: row.uploadedDocId ?? row.id
  });

  const handleConfirmDialog = async (payload) => {
    const { type, expirationDate: expDate, adminComment: comment } = payload;
    const row = dialogAccion?.doc;
    if (!row) return;

    const docToUse = getDocumentForAction(row);
    if (!docToUse.id) return;

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

      setDocuments((prev) =>
        prev.filter((d) => (d.uploadedDocId ?? d.id) !== docToUse.id)
      );
      setDialogAccion(null);
      setNewExpirationDates((prev) => {
        const next = { ...prev };
        delete next[docToUse.id];
        delete next[row.id];
        return next;
      });
      setAdminComment((prev) => {
        const next = { ...prev };
        delete next[docToUse.id];
        delete next[row.id];
        return next;
      });
      triggerRefresh("historial");
    } catch (err) {
      console.error("Error en revisión:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDialog = (tipo, docRow) => {
    setDialogAccion({ tipo, doc: docRow });
    if (
      (tipo === "aprobar" || tipo === "ajustar_fecha") &&
      docRow.expirationDate &&
      !newExpirationDates[docRow.id] &&
      !newExpirationDates[docRow.uploadedDocId]
    ) {
      const iso = expirationToDate(docRow.expirationDate);
      if (iso) {
        const key = docRow.uploadedDocId ?? docRow.id;
        setNewExpirationDates((p) => ({ ...p, [key]: iso }));
      }
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
          <InputLabel>Filtrar por estado</InputLabel>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            label="Filtrar por estado"
          >
            {FILTER_STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
          No hay documentos en el historial.
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
                <TableCell>Revisado</TableCell>
                <TableCell>Versión</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSorted.map((docRow) => (
                <React.Fragment key={docRow.uploadedDocId ?? docRow.id}>
                  <TableRow>
                    <TableCell>{docRow.companyName}</TableCell>
                    <TableCell>
                      {docRow.clientId
                        ? isLoadingClientNames
                          ? "…"
                          : clientNamesMap[docRow.clientId] ?? "—"
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {docRow.name ||
                        docRow.documentName ||
                        docRow.fileName?.split(".")[0] ||
                        "Sin nombre"}
                    </TableCell>
                    <TableCell>{docRow.entityFullType}</TableCell>
                    <TableCell>
                      <Chip
                        label={docRow.status}
                        size="small"
                        color={
                          docRow.status === "Aprobado" ? "success" : "error"
                        }
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell
                      sx={{
                        color: getDeadlineColor(docRow.expirationDate)
                      }}
                    >
                      {docRow.expirationDate ? (
                        <>
                          {getStatusIconComponent(
                            getDeadlineStatus(docRow.expirationDate).icon
                          )}{" "}
                          {docRow.expirationDateFormatted}
                        </>
                      ) : (
                        "Sin fecha"
                      )}
                    </TableCell>
                    <TableCell>{docRow.reviewedAtFormatted}</TableCell>
                    <TableCell>
                      <Tooltip title={`Versión ${docRow.versionString}`}>
                        <Typography variant="body2">
                          {docRow.versionString}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setExpandedRow(
                            expandedRow === (docRow.uploadedDocId ?? docRow.id)
                              ? null
                              : docRow.uploadedDocId ?? docRow.id
                          )
                        }
                        aria-label={
                          expandedRow === (docRow.uploadedDocId ?? docRow.id)
                            ? "Cerrar detalle"
                            : "Ver detalle"
                        }
                      >
                        {expandedRow === (docRow.uploadedDocId ?? docRow.id) ? (
                          <ExpandLess />
                        ) : (
                          <ExpandMore />
                        )}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={9} sx={{ py: 0 }}>
                      <Collapse
                        in={
                          expandedRow ===
                          (docRow.uploadedDocId ?? docRow.id)
                        }
                        timeout="auto"
                        unmountOnExit
                      >
                        <Box sx={{ p: 2, bgcolor: "grey.50" }}>
                          <VistaDocumentoSubido
                            id={docRow.uploadedDocId ?? docRow.id}
                            name={docRow.name || docRow.documentName}
                            fileURL={docRow.fileURL}
                            fileName={docRow.fileName}
                            status={docRow.status}
                            companyName={docRow.companyName}
                            entityName={docRow.entityName}
                            entityType={docRow.entityType}
                            uploadedByEmail={docRow.uploadedByEmail}
                            onApprove={() => openDialog("aprobar", docRow)}
                            onReject={() => openDialog("rechazar", docRow)}
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
                              onClick={() => openDialog("aprobar", docRow)}
                              disabled={isSubmitting}
                            >
                              Re-aprobar
                            </Button>
                            <Button
                              variant="contained"
                              color="error"
                              size="small"
                              startIcon={<Cancel />}
                              onClick={() => openDialog("rechazar", docRow)}
                              disabled={isSubmitting}
                            >
                              Rechazar nuevamente
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() =>
                                openDialog("ajustar_fecha", docRow)
                              }
                              disabled={isSubmitting}
                            >
                              Cambiar fecha
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
            ? newExpirationDates[
                dialogAccion.doc.uploadedDocId ?? dialogAccion.doc.id
              ] ?? ""
            : ""
        }
        adminComment={
          dialogAccion?.doc
            ? adminComment[
                dialogAccion.doc.uploadedDocId ?? dialogAccion.doc.id
              ] ?? ""
            : ""
        }
        onClose={() => !isSubmitting && setDialogAccion(null)}
        onConfirm={handleConfirmDialog}
        loading={isSubmitting}
      />
    </Box>
  );
}
