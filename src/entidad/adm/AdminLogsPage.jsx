// src/component/administrador/AdminLogsPage.jsx

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  MenuItem,
  InputAdornment
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../firebaseconfig";
import { format } from "date-fns";
import { getTenantCollectionPath } from '../../utils/tenantUtils';

const AdminLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("todos");
  const [companyMap, setCompanyMap] = useState({});

  useEffect(() => {
    const fetchLogs = async () => {
      // Usar la ruta multi-tenant correcta
      const logsCollectionPath = getTenantCollectionPath('logs');
      const q = query(collection(db, logsCollectionPath), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
      setFilteredLogs(data);
    };

    // Cargar empresas para mapear companyId -> companyName
    const fetchCompanies = async () => {
      try {
        // Usar la ruta multi-tenant correcta
        const companiesCollectionPath = getTenantCollectionPath('companies');
        const snap = await getDocs(collection(db, companiesCollectionPath));
        const map = {};
        snap.forEach(doc => {
          const data = doc.data();
          map[doc.id] = data.name || data.companyName || "";
        });
        setCompanyMap(map);
      } catch (err) {
        setCompanyMap({});
      }
    };

    fetchLogs();
    fetchCompanies();
  }, []);

  useEffect(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = logs.filter(log => {
      const matchesAction =
        actionFilter === "todos" || log.action === actionFilter;
      const matchesSearch =
        log.actor?.email?.toLowerCase().includes(lowerSearch) ||
        log.target?.toLowerCase().includes(lowerSearch) ||
        log.message?.toLowerCase().includes(lowerSearch);

      return matchesAction && matchesSearch;
    });

    setFilteredLogs(filtered);
  }, [logs, search, actionFilter]);

  const uniqueActions = [
    ...new Set(logs.map(log => log.action).filter(Boolean))
  ];

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>
        Historial de Actividades (Logs)
      </Typography>

      <Box display="flex" gap={2} mb={2}>
        <TextField
          select
          label="Filtrar por acción"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          size="small"
          sx={{ width: 200 }}
        >
          <MenuItem value="todos">Todas</MenuItem>
          {uniqueActions.map(action => (
            <MenuItem key={action} value={action}>
              {action}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Buscar por email, objetivo o mensaje"
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          sx={{ flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
      </Box>

      <TableContainer component={Paper} elevation={3}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell>Fecha</TableCell>
              <TableCell>Acción</TableCell>
              <TableCell>Usuario</TableCell>
              <TableCell>Objetivo</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Mensaje</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.map(log => {
              // Si el target es companies/{companyId}, extrae el nombre
              let companyName = '';
              let companyId = '';
              if (typeof log.target === 'string') {
                const match = log.target.match(/^companies\/(\w+)$/);
                if (match) {
                  companyId = match[1];
                  companyName = companyMap[companyId] || '';
                }
              }
              return (
                <TableRow key={log.id}>
                  <TableCell>
                    {log.timestamp?.toDate
                      ? format(log.timestamp.toDate(), "dd/MM/yyyy HH:mm")
                      : "-"}
                  </TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.actor?.email || "-"}</TableCell>
                  <TableCell>{log.target}</TableCell>
                  <TableCell>
                    {/* Primero mostrar el nombre guardado en el log, luego fallback a companyMap */}
                    {log.companyName || (() => {
                      if (typeof log.target === 'string') {
                        const match = log.target.match(/^companies\/(\w+)$/);
                        if (match) {
                          const companyId = match[1];
                          return companyMap[companyId] || '';
                        }
                      }
                      return '';
                    })()}
                  </TableCell>
                  <TableCell>{log.message}</TableCell>
                </TableRow>
              );
            })}
            {filteredLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No hay resultados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AdminLogsPage;
