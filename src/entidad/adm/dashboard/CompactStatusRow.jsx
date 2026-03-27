import { useState } from 'react';
import { Card, CardContent, Box, Typography, Tooltip, Paper, Button } from "@mui/material";
import { Error as ErrorIcon, Pending as PendingIcon, Cancel as CancelIcon } from "@mui/icons-material";

const STATUS = [
  {
    id: "vencer",
    title: "Por vencer",
    count: 1,
    description: "En menos de 5 días vence la documentación. Revisar.",
    companies: ["diegocompany", "empresa2", "empresa3"],
    color: "#e53935",
    bgColor: "#fff5f5",
    icon: <ErrorIcon sx={{ color: "#e53935" }} fontSize="small" />,
  },
  {
    id: "pendientes",
    title: "Pendientes",
    count: 2,
    description: "Empresas que no han subido algún documento. Revisar.",
    companies: ["empresa1", "empresa2", "empresa3", "empresa4"],
    color: "#ffa000",
    bgColor: "#fff8e1",
    icon: <PendingIcon sx={{ color: "#ffa000" }} fontSize="small" />,
  },
  {
    id: "rechazados",
    title: "Rechazados",
    count: 0,
    description: "No hay documentos rechazados",
    companies: [],
    color: "#b71c1c",
    bgColor: "#ffebee",
    icon: <CancelIcon sx={{ color: "#b71c1c" }} fontSize="small" />,
  },
];

export default function CompactStatusRow({ data = STATUS, onSelect, onViewAll }) {
  const [selected, setSelected] = useState(null);

  const handleClick = (id) => {
    setSelected(selected === id ? null : id);
    if (onSelect) onSelect(id);
  };

  const handleViewAllClick = (e, id) => {
    e.stopPropagation(); // Evitar que active el onClick del Paper
    if (onViewAll) onViewAll(id);
  };

  return (
    <Box width="100%">
      <Box display="flex" gap={2} flexDirection={{ xs: "column", md: "row" }}>
        {data.map((status) => (
          <Box key={status.id} flex={1} position="relative">
            <Tooltip
              title={
                status.id === "vencer" && status.companies && Array.isArray(status.companies) ? (
                  (() => {
                    // Filtrar empresas con diasRestantes válido
                    const empresasValidas = status.companies.filter(
                      (empresa) => typeof empresa.diasRestantes === "number" && empresa.diasRestantes >= 0
                    );
                    console.debug("Empresas válidas por vencer:", empresasValidas); // Debug log
                    if (empresasValidas.length === 0) {
                      return <Typography variant="caption">Sin empresas</Typography>;
                    }
                    return (
                      <Box>
                        <Typography fontWeight="bold" variant="body2">{status.title}:</Typography>
                        <Box display="flex" flexDirection="column" gap={0.5}>
                          {empresasValidas.map((empresa, idx) => {
                            let badgeColor = "var(--success-main)"; // verde
                            if (empresa.diasRestantes <= 5) badgeColor = "var(--error-main)"; // rojo
                            else if (empresa.diasRestantes <= 10) badgeColor = "var(--warning-main)"; // amarillo
                            return (
                              <Box key={empresa.name + idx} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                <Box sx={{
                                  width: 10, height: 10, borderRadius: '50%', background: badgeColor, mr: 1, border: `1px solid var(--divider-color)`
                                }} />
                                <Typography variant="caption" sx={{ fontWeight: 500 }}>{empresa.name}</Typography>
                                <Typography variant="caption" sx={{ ml: 1, color: badgeColor, fontWeight: 700 }}>
                                  {empresa.diasRestantes} días
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })()
                ) :
                status.companies && Array.isArray(status.companies) && status.companies.length > 0 && typeof status.companies[0] === 'string' ? (
                  <Box>
                    <Typography fontWeight="bold" variant="body2">{status.title}:</Typography>
                    <Typography variant="caption">{status.companies.join(", ")}</Typography>
                  </Box>
                ) :
                  "Sin empresas"
              }
              arrow
              placement="top"
            >
              <Paper
                elevation={selected === status.id ? 6 : 1}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderLeft: `6px solid ${status.color}`,
                  background: status.bgColor,
                  backgroundColor: status.bgColor,
                  px: 2,
                  py: 1,
                  cursor: "pointer",
                  minHeight: 48,
                  transition: "box-shadow 0.2s",
                  boxShadow: selected === status.id ? 4 : 1,
                }}
                onClick={() => handleClick(status.id)}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  {status.icon}
                  <Typography fontWeight="bold" variant="body2" sx={{ color: "var(--paper-background-text)" }}>{status.title}</Typography>
                </Box>
                <Typography fontWeight="bold" variant="h6" sx={{ color: status.color }}>
                  {status.count}
                </Typography>
              </Paper>
            </Tooltip>
            <Typography
              variant="caption"
              align="center"
              sx={{ display: "block", mt: 0.5, color: "var(--page-background-text)", opacity: 0.8 }}
            >
              {status.description}
            </Typography>
            {status.count > 0 && onViewAll && (
              <Box display="flex" justifyContent="center" mt={1}>
                <Button 
                  size="small" 
                  variant="outlined"
                  onClick={(e) => handleViewAllClick(e, status.id)}
                  sx={{ 
                    textTransform: 'none',
                    borderColor: status.color,
                    color: status.color,
                    '&:hover': {
                      borderColor: status.color,
                      backgroundColor: status.bgColor,
                    }
                  }}
                >
                  Ver todos ({status.count})
                </Button>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}