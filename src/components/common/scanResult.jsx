import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Grid, Chip, TextField, Tabs, Tab,
  Accordion, AccordionSummary, AccordionDetails,
  IconButton, Tooltip, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import PersonIcon from '@mui/icons-material/Person';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import BadgeIcon from '@mui/icons-material/Badge';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FolderIcon from '@mui/icons-material/Folder';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import NumbersIcon from '@mui/icons-material/Numbers';
import MoneyIcon from '@mui/icons-material/AttachMoney';

export default function ScanResult({ result, onResaltarDato }) {
  if (!result) return null;

  const TYPE_META = [
    { key: 'fechasDetectadas', label: 'Fechas', icon: <CalendarTodayIcon color="primary" fontSize="small" /> },
    { key: 'cuitDetectado', label: 'CUIT/CUIL', icon: <CreditCardIcon color="secondary" fontSize="small" /> },
    { key: 'dniDetectado', label: 'DNI', icon: <BadgeIcon color="secondary" fontSize="small" /> },
    { key: 'nombresDetectados', label: 'Nombres', icon: <PersonIcon color="action" fontSize="small" /> },
    { key: 'telefonosDetectados', label: 'Teléfonos', icon: <PhoneIphoneIcon color="action" fontSize="small" /> },
    { key: 'licenciasDetectadas', label: 'Licencias', icon: <FolderIcon color="primary" fontSize="small" /> },
    { key: 'patentesDetectadas', label: 'Patentes', icon: <DirectionsCarIcon color="action" fontSize="small" /> },
    { key: 'cedulasDetectadas', label: 'Cédulas', icon: <CreditCardIcon color="disabled" fontSize="small" /> },
    // Nuevos campos
    { key: 'titularDetectado', label: 'Titular de la cuenta', icon: <AccountBoxIcon color="success" fontSize="small" /> },
    { key: 'documentoDetectado', label: 'Documento', icon: <BadgeIcon color="success" fontSize="small" /> },
    { key: 'cbuDetectado', label: 'CBU', icon: <AccountBalanceIcon color="primary" fontSize="small" /> },
    { key: 'aliasDetectado', label: 'Alias', icon: <DriveFileRenameOutlineIcon color="primary" fontSize="small" /> },
    { key: 'tipoCuentaDetectado', label: 'Tipo de cuenta', icon: <MoneyIcon color="primary" fontSize="small" /> },
    { key: 'numeroCuentaDetectado', label: 'N° de cuenta', icon: <NumbersIcon color="action" fontSize="small" /> },
    { key: 'esCuentaCorriente', label: '¿Cuenta corriente?', icon: <AccountBalanceIcon color="disabled" fontSize="small" /> },
    // Campo para códigos genéricos
    { key: 'codigosDetectados', label: 'Códigos', icon: <NumbersIcon color="secondary" fontSize="small" /> },
  ];

  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [highlight, setHighlight] = useState('');

  const grouped = useMemo(() => TYPE_META.map(meta => {
    const val = result[meta.key];
    const items = Array.isArray(val)
      ? val
      : (val ? [val] : []);
    return { ...meta, items };
  }), [result]);

  const summary = grouped.filter(g => g.items.length > 0);

  const filtered = grouped.map(g => ({
    ...g,
    items: g.items.filter(i =>
      i.toLowerCase().includes(search.toLowerCase()) ||
      g.label.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(g => g.items.length > 0);

  const getHighlightedText = (text, highlight) => {
    if (!highlight) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, idx) =>
      part.toLowerCase() === highlight.toLowerCase()
        ? <mark key={idx} style={{ background: '#ffe082', padding: 0 }}>{part}</mark>
        : part
    );
  };

  return (
    <Box sx={{ mt: 2, p: { xs: 1, sm: 2 }, border: '1px solid var(--primary-main)', borderRadius: 2, background: '#f7fafd' }}>
      <Grid container spacing={1} sx={{ mb: 1 }}>
        {summary.map(({ key, label, icon, items }) => (
          <Grid item xs={6} sm={4} md={3} key={key}>
            <Chip
              icon={icon}
              label={`${label}: ${items.length}`}
              sx={{ width: '100%', justifyContent: 'flex-start', fontWeight: 500 }}
              color="primary"
              variant="outlined"
              onClick={() => {
                if (items.length > 0) {
                  setSearch(label);
                  setHighlight(items[0]);
                  if (onResaltarDato) onResaltarDato(items[0]);
                }
              }}
            />
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <SearchIcon sx={{ mr: 1 }} color="action" />
        <TextField
          size="small"
          variant="outlined"
          placeholder="Buscar dato o tipo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ flex: 1, background: '#fff', borderRadius: 1 }}
        />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Datos extraídos" />
        <Tab label="Texto original" />
      </Tabs>

      {tab === 0 && (
        <Box>
          {filtered.length === 0 && (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              {search ? 'No se encontraron coincidencias.' : 'No hay datos extraídos.'}
            </Typography>
          )}
          {filtered.map(({ key, label, icon, items }) => (
            <Accordion key={key} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {icon}
                  <Typography sx={{ ml: 1, fontWeight: 500 }}>{label}</Typography>
                  <Chip label={items.length} size="small" sx={{ ml: 2 }} />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {items.map((item, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', mr: 1 }}>{item}</Typography>
                    <Tooltip title="Resaltar en texto original">
                      <IconButton size="small" onClick={() => {
                        setHighlight(item);
                        if (onResaltarDato) onResaltarDato(item);
                      }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {tab === 1 && (
        <Box sx={{ p: 2, background: '#fff', borderRadius: 1, minHeight: 120 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Texto extraído:</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {getHighlightedText(result.text || 'No se extrajo texto.', highlight)}
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography variant="body2" color="text.secondary" align="center">
        Total: <b>{summary.reduce((acc, s) => acc + s.items.length, 0)}</b> elementos detectados
      </Typography>
      <Typography variant="subtitle2" sx={{ mt: 1 }}>
        Tipo detectado: <b>{result.type || 'Desconocido'}</b>
      </Typography>
    </Box>
  );
}
