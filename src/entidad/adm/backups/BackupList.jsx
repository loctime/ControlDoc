//src/entidad/adm/backups/BackupList.jsx
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, CircularProgress, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
  TextField, MenuItem, Link, Tooltip
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { db } from '../../../config/firebaseconfig';
import {
  collection, query, orderBy, getDocs, where
} from 'firebase/firestore';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import { useAuth } from '../../../context/AuthContext';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function BackupList() {
  const { user } = useAuth();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    const fetchCompanies = async () => {
      const companiesPath = getTenantCollectionPath('companies');
      const snap = await getDocs(collection(db, companiesPath));
      const list = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().companyName || doc.id
      }));
      setCompanies(list);
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    const fetchBackups = async () => {
      if (!user?.uid && !user?.email) {
        setBackups([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const backupsPath = getTenantCollectionPath('backups');
        const ref = collection(db, backupsPath);
        const allQueries = [];
        if (user?.uid) {
          allQueries.push(query(ref, where('uploadedBy', '==', user.uid)));
        }
        if (user?.email) {
          allQueries.push(query(ref, where('uploadedByEmail', '==', user.email)));
          allQueries.push(query(ref, where('createdBy', '==', user.email)));
        }
        if (allQueries.length === 0) {
          setBackups([]);
          setLoading(false);
          return;
        }
        const snapshots = await Promise.all(
          allQueries.map(q => getDocs(q).catch(() => ({ docs: [] })))
        );
        const byId = new Map();
        for (const snap of snapshots) {
          const docs = snap.docs || [];
          for (const docSnap of docs) {
            const data = docSnap.data();
            const id = docSnap.id;
            if (!byId.has(id)) byId.set(id, { id, ...data });
          }
        }
        let results = Array.from(byId.values());
        const dateField = (b) => b.createdAt?.toDate?.() ?? b.uploadedAt?.toDate?.() ?? b.createdAt ?? b.uploadedAt;
        results.sort((a, b) => {
          const da = dateField(a) ? new Date(dateField(a)) : 0;
          const db_ = dateField(b) ? new Date(dateField(b)) : 0;
          return db_ - da;
        });
        if (selectedCompany !== 'all') {
          results = results.filter(b => b.companyId === selectedCompany);
        }
        setBackups(results);
      } catch (error) {
        console.error('Error al cargar backups:', error);
        setBackups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBackups();
  }, [selectedCompany, user?.uid, user?.email]);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Respaldos del sistema
      </Typography>

      <Box mb={2} display="flex" gap={2} flexWrap="wrap">
        <TextField
          select
          label="Empresa"
          value={selectedCompany}
          onChange={e => setSelectedCompany(e.target.value)}
          size="small"
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="all">Todas las empresas</MenuItem>
          {companies.map(company => (
            <MenuItem key={company.id} value={company.id}>
              {company.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {loading ? (
        <CircularProgress />
      ) : backups.length === 0 ? (
        <Typography variant="body2">No hay backups disponibles.</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Tamaño</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Hash</TableCell>
                <TableCell>Descargar</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {backups.map(backup => (
                <TableRow key={backup.id}>
                  <TableCell>{backup.fileName}</TableCell>
                  <TableCell>
                    {new Date(
                      backup.createdAt?.toDate
                        ? backup.createdAt.toDate()
                        : backup.createdAt
                    ).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell>{formatBytes(backup.fileSize)}</TableCell>
                  <TableCell>{backup.status || 'desconocido'}</TableCell>
                  <TableCell>
                    <Tooltip title={backup.checksum || 'sin hash'}>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ maxWidth: 140, display: 'inline-block' }}
                      >
                        {backup.checksum?.slice(0, 12) || '-'}...
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      component={Link}
                      href={backup.fileURL}
                      target="_blank"
                      rel="noopener"
                      download
                    >
                      <DownloadIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
