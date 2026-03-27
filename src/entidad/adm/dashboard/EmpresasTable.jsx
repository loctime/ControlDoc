//src/component/administrador/dashboard/EmpresaTable.jsx
import React, { useState, useRef } from "react";
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  Button,
  Chip,
  Box,
  Typography
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { 
  getDeadlineColor,
  getDeadlineStatus,
  getStatusIconComponent 
} from '../../../utils/getDeadlineUtils';

export default function EmpresasTable({
  companies,
  previewDocs,
  expandedRow,
  setExpandedRow,
}) {
  const navigate = useNavigate();
  const tableRef = useRef();

  // Crear lista con conteos previos para ordenarla
  const empresasConDatos = companies.map((company) => {
    const docsEmpresa = previewDocs.filter((doc) => doc.companyId === company.id);

    const vencidos = docsEmpresa.filter(
      (d) => d.diasRestantes !== null && d.diasRestantes <= 0
    ).length;

    const rechazados = docsEmpresa.filter((d) => d.status === "Rechazado").length;

    return {
      company,
      docsEmpresa,
      vencidos,
      rechazados,
      aprobados: docsEmpresa.filter((d) => d.status === "Aprobado").length,
    };
  });

  // Ordenar por documentos vencidos y rechazados
  empresasConDatos.sort((a, b) => {
    if (b.vencidos !== a.vencidos) return b.vencidos - a.vencidos;
    return b.rechazados - a.rechazados;
  });

  return (
    <Paper ref={tableRef} variant="outlined" sx={{ mt: 2, backgroundColor: "var(--paper-background)", maxWidth: '100%', overflow: 'hidden' }}>
      <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
        <Table >
        <TableHead>
          <TableRow>
            <TableCell sx={{ color: "var(--paper-background-text)" }}>Empresa</TableCell>
            <TableCell align="center" sx={{ color: "var(--paper-background-text)" }}>Aprobados</TableCell>
            <TableCell align="center" sx={{ color: "var(--paper-background-text)" }}>Vencidos</TableCell>
            <TableCell align="center" sx={{ color: "var(--paper-background-text)" }}>Rechazados</TableCell>
            <TableCell align="center" sx={{ color: "var(--paper-background-text)" }}>Estado</TableCell>
            <TableCell align="center" sx={{ color: "var(--paper-background-text)" }}>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {empresasConDatos.map(({ company, docsEmpresa, aprobados, vencidos, rechazados }) => {
            // Lógica de semáforo (regla igual que dashboard usuario)
            let estado = 'habilitada'; // verde
            let color = 'success';
            const hoy = new Date();

            // Agrupar documentos requeridos por nombre
            const requeridos = {};
            docsEmpresa.forEach(doc => {
              if (!requeridos[doc.name]) requeridos[doc.name] = [];
              requeridos[doc.name].push(doc);
            });

            // Por cada requerimiento (por nombre)
            let tieneDeshabilitante = false;
            Object.values(requeridos).forEach(docs => {
              // Obtener la fecha de vencimiento del requerimiento (puede ser la mayor de los documentos)
              let expDate = null;
              docs.forEach(doc => {
                if (doc.expirationDate) {
                  const d = (typeof doc.expirationDate.toDate === 'function') ? doc.expirationDate.toDate() : new Date(doc.expirationDate);
                  if (!expDate || d > expDate) expDate = d;
                }
              });
              // Si la fecha de vencimiento es futura, está habilitado
              if (expDate && expDate >= hoy) {
                return; // sigue habilitada
              }
              // Si la fecha de vencimiento ya pasó, debe haber un aprobado vigente
              const aprobadoVigente = docs.some(doc => doc.status === 'Aprobado' && doc.expirationDate && ((typeof doc.expirationDate.toDate === 'function') ? doc.expirationDate.toDate() : new Date(doc.expirationDate)) >= hoy);
              if (!aprobadoVigente) {
                tieneDeshabilitante = true;
              }
            });
            if (tieneDeshabilitante || docsEmpresa.length === 0) {
              estado = 'deshabilitada';
              color = 'error';
            } else if (docsEmpresa.some(d => d.diasRestantes !== null && d.diasRestantes <= 10)) {
              estado = 'en_riesgo'; // amarillo
              color = 'warning';
            }

            const isExpanded = expandedRow === company.id;

            return (
              <React.Fragment key={company.id}>
                <TableRow hover
                  sx={{
                    backgroundColor: vencidos > 0 ? 'rgba(245, 67, 54, 0.15)' : "var(--paper-background)",
                    borderLeft: rechazados > 0 ? `4px solid var(--error-main)` : undefined,
                    '&:hover': {
                      backgroundColor: vencidos > 0 ? 'rgba(245, 67, 54, 0.2)' : "var(--page-background)"
                    }
                  }}
                >
                  <TableCell sx={{ color: "var(--paper-background-text)" }}>{company.name || company.companyName || "Sin nombre"}</TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={aprobados} 
                      size="small"
                      sx={{
                        backgroundColor: aprobados > 0 ? "var(--success-main)" : "transparent",
                        color: aprobados > 0 ? "#fff" : "var(--paper-background-text)",
                        border: aprobados > 0 ? "none" : `1px solid var(--divider-color)`,
                        opacity: aprobados > 0 ? 1 : 0.7
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={vencidos} 
                      size="small"
                      sx={{
                        backgroundColor: vencidos > 0 ? "var(--error-main)" : "transparent",
                        color: vencidos > 0 ? "#fff" : "var(--paper-background-text)",
                        border: vencidos > 0 ? "none" : `1px solid var(--divider-color)`,
                        opacity: vencidos > 0 ? 1 : 0.7
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={rechazados} 
                      size="small"
                      sx={{
                        backgroundColor: rechazados > 0 ? "var(--error-main)" : "transparent",
                        color: rechazados > 0 ? "#fff" : "var(--paper-background-text)",
                        border: rechazados > 0 ? "none" : `1px solid var(--divider-color)`,
                        opacity: rechazados > 0 ? 1 : 0.7
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {/* Semáforo visual */}
                    <span title={estado.charAt(0).toUpperCase() + estado.slice(1)}>
                      <svg height="20" width="20">
                        <circle cx="10" cy="10" r="8" fill={
                          color === 'success' ? "var(--success-main)" : color === 'warning' ? "var(--warning-main)" : color === 'error' ? "var(--error-main)" : "var(--divider-color)"
                        } stroke="var(--divider-color)" strokeWidth="1" />
                      </svg>
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => setExpandedRow(isExpanded ? null : company.id)}
                      sx={{
                        bgcolor: "var(--primary-main)",
                        color: "var(--primary-text)",
                        "&:hover": {
                          bgcolor: "var(--primary-dark)"
                        }
                      }}
                    >
                      {isExpanded ? "Ocultar" : "Ver docs"}
                    </Button>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ padding: 0, backgroundColor: "var(--page-background)" }}>
                      <Box sx={{ margin: 1 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ color: "var(--paper-background-text)" }}>Documento</TableCell>
                              <TableCell sx={{ color: "var(--paper-background-text)" }}>Entidad</TableCell>
                              <TableCell sx={{ color: "var(--paper-background-text)" }}>Tipo</TableCell>
                              <TableCell sx={{ color: "var(--paper-background-text)" }}>Vencimiento</TableCell>
                              <TableCell sx={{ color: "var(--paper-background-text)" }}>Estado</TableCell>
                              <TableCell sx={{ color: "var(--paper-background-text)" }}>Días restantes</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody sx={{ backgroundColor: "var(--page-background)" }}>
                            {docsEmpresa.map((doc) => (
                              <TableRow key={doc.id}>
                                <TableCell sx={{ color: "var(--page-background-text)" }}>{doc.name || "Sin nombre"}</TableCell>
                                <TableCell sx={{ color: "var(--page-background-text)" }}>
                                  {['employee', 'vehicle', 'personal', 'vehiculo'].includes(doc.entityType) 
                                    ? doc.entityName || "" 
                                    : ""}
                                </TableCell>
                                <TableCell sx={{ color: "var(--page-background-text)" }}>
                                  {doc.entityType === 'personal' ? 'Empleado' :
                                  doc.entityType === 'employee' ? 'Empleado' :
                                  doc.entityType === 'vehiculo' ? 'Vehículo' :
                                  doc.entityType === 'vehicle' ? 'Vehículo' :
                                  doc.entityType === 'company' ? 'Empresa' :
                                  doc.entityType || 'N/A'
                                }</TableCell>
                                <TableCell>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    {getStatusIconComponent(getDeadlineStatus(doc.expirationDate).icon)}
                                    <Typography variant="body2" sx={{ color: getDeadlineColor(doc.expirationDate) }}>
                                      {doc.expirationDate?.toLocaleDateString('es-ES', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric'
                                      }) || "Sin fecha"}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>
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
                                    onClick={() => navigate(`/admin/uploaded-documents?empresa=${doc.companyId}&docId=${doc.id}&filterEmpresa=true`)}
                                  />
                                </TableCell>
                                <TableCell sx={{ color: "var(--page-background-text)" }}>
                                  {doc.diasRestantes !== null
                                    ? doc.diasRestantes <= 0
                                      ? `Vencido (${Math.abs(doc.diasRestantes)} días)`
                                      : doc.diasRestantes
                                    : "N/A"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
      </TableContainer>
    </Paper>
  );
}
