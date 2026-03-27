//src/entidad/adm/dashboardNoti1.jsx
// React import removed - using JSX runtime
import { Grid, Tooltip, Typography } from "@mui/material";
import { Cancel as CancelIcon, Pending as PendingIcon, Error as ErrorIcon } from "@mui/icons-material";
import StatCard from "../../components/common/StatCard"; // Asegurate de tener este componente

export default function TarjetasEstadoResumen({
  previewDocs,
  companies,
  stats,
  selectedCard,
  setSelectedCard,
  setShowDetails
}) {
  return (
    <Grid container spacing={2} sx={{
      mt: 2,
      flexWrap: 'nowrap',
      overflowX: 'auto',
      pb: 1,
      '&::-webkit-scrollbar': { height: 8 },
      '&::-webkit-scrollbar-thumb': { backgroundColor: '#ccc', borderRadius: 4 }
    }}>
     {/* Por vencer: muestra empresas con tooltip si hay más de 3 */}
     <Grid item sx={{ minWidth: 180 }}>
  {(() => {
    // Filtrar documentos por vencer en 10 días o menos
    const docsPorVencer = previewDocs.filter(
      doc => doc.diasRestantes !== null && doc.diasRestantes <= 10
    );

    const diasMin = docsPorVencer.reduce((min, doc) => {
      if (doc.diasRestantes !== null && (min === null || doc.diasRestantes < min)) {
        return doc.diasRestantes;
      }
      return min;
    }, null);

    let color = 'success.main';
    let icon = <ErrorIcon sx={{ color: "var(--success-main)" }} />;
    let warningText = '';

    if (diasMin !== null && diasMin <= 10 && diasMin > 5) {
      color = 'warning.main';
      icon = <ErrorIcon sx={{ color: "var(--warning-main)" }} />;
      warningText = 'En 10 días vencen';
    }
    if (diasMin !== null && diasMin <= 5) {
      color = 'error.main';
      icon = <ErrorIcon sx={{ color: "var(--error-main)" }} />;
      warningText = 'En 5 días vencen';
    }

    const empresasIds = new Set(docsPorVencer.map(doc => doc.companyId));
    const empresasNombres = Array.from(
      new Set(
        companies
          .filter(c => empresasIds.has(c.id))
          .map(c => c.name)
      )
    );

    const previewNombres = empresasNombres.slice(0, 3).join(", ");
    const tooltipCompleto = empresasNombres.join(", ");
    const extra = empresasNombres.length > 3 ? ` +${empresasNombres.length - 3} más` : '';

    return (
      <div>
          <Tooltip 
            title={
              empresasNombres.length > 0
                ? `Por vencer: ${tooltipCompleto}`
                : 'No hay documentos por vencer'
            }
            arrow
          >
            <div>
              <StatCard
                title="Por vencer"
                value={empresasNombres.length}
                icon={icon}
                color={color}
                onAction={() => {
                  setShowDetails("TodosDocumentos");
                  setSelectedCard('vencer');
                }}
                isSelected={selectedCard === 'vencer'}
              />
            </div>
          </Tooltip>
          {empresasNombres.length > 0 && (
            <Typography variant="body2" sx={{ mt: 1, textAlign: 'center', color: "var(--page-background-text)", opacity: 0.8 }}>
              {warningText} – Ej: {previewNombres}{extra}
            </Typography>
          )}
        </div>
    );
  })()}
</Grid>



      {/* PENDIENTES */}
      <Grid item sx={{ minWidth: 180 }}>
        {(() => {
          // Empresas con documentos pendientes (subidos pero no revisados o faltantes)
          const empresasConPendientesIds = new Set(
            previewDocs
              .filter(doc => 
                doc.status === "Pendiente de revisión" || 
                doc.status === "Pendiente" ||
                doc.archivoSubido === false
              )
              .map(doc => doc.companyId)
          );

          const empresasConPendientesNombres = Array.from(
            new Set(
              companies
                .filter(c => empresasConPendientesIds.has(c.id))
                .map(c => c.name)
            )
          );

          const previewNombres = empresasConPendientesNombres.slice(0, 3).join(", ");
          const tooltipCompleto = empresasConPendientesNombres.join(", ");
          const extra = empresasConPendientesNombres.length > 3 ? ` +${empresasConPendientesNombres.length - 3} más` : '';

          return (
            <div>
                <Tooltip 
                  title={
                    empresasConPendientesNombres.length > 0
                      ? `En falta: ${tooltipCompleto}`
                      : 'No hay empresas con documentos pendientes'
                  }
                  arrow
                >
                  <div>
                                      <StatCard
                    title="Pendientes"
                    value={empresasConPendientesNombres.length}
                    icon={<PendingIcon />}
                    color="warning.main"
                    
                    onAction={() => {
                      setShowDetails("Pendiente de subir");
                      setSelectedCard('pendientes');
                    }}
                    isSelected={selectedCard === 'pendientes'}
                  />
                  {empresasConPendientesNombres.length > 0 && (
                    <Typography variant="body2" sx={{ mt: 1, textAlign: 'center', color: "var(--page-background-text)", opacity: 0.8 }}>
                      Empresas que no han subido algún documento. Revisar.
                    </Typography>
                  )}
                  </div>
                </Tooltip>
              </div>
          );
        })()}
      </Grid>

      {/* RECHAZADOS */}
      <Grid item sx={{ minWidth: 180 }}>
        {(() => {
          // Empresas con documentos rechazados
          const empresasConRechazadosIds = new Set(
            previewDocs
              .filter(doc => doc.status === "Rechazado")
              .map(doc => doc.companyId)
          );

          const empresasConRechazadosNombres = Array.from(
            new Set(
              companies
                .filter(c => empresasConRechazadosIds.has(c.id))
                .map(c => c.name)
            )
          );

          const previewNombres = empresasConRechazadosNombres.slice(0, 3).join(", ");
          const tooltipCompleto = empresasConRechazadosNombres.join(", ");
          const extra = empresasConRechazadosNombres.length > 3 ? ` +${empresasConRechazadosNombres.length - 3} más` : '';

          return (
            <div>
                <Tooltip 
                  title={
                    empresasConRechazadosNombres.length > 0
                      ? `Rechazados: ${tooltipCompleto}`
                      : 'No hay documentos rechazados'
                  }
                  arrow
                >
                  <div>
                    <StatCard
                      title="Rechazados"
                      value={empresasConRechazadosNombres.length}
                      icon={<CancelIcon />}
                      color="error.main"
                      onAction={() => {
                        setShowDetails("Rechazado");
                        setSelectedCard('rechazados');
                      }}
                      isSelected={selectedCard === 'rechazados'}
                    />
                  </div>
                </Tooltip>
                {empresasConRechazadosNombres.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 1, textAlign: 'center', color: "var(--page-background-text)", opacity: 0.8 }}>
                    No actualizados: {previewNombres}{extra}
                  </Typography>
                )}
              </div>
          );
        })()}
      </Grid>
    </Grid>
  );
}
