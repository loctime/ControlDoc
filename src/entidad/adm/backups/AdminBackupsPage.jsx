//src/entidad/adm/backups/AdminBackupsPage.jsx
// React import removed - using JSX runtime
import { Box, Container, Typography, Divider } from '@mui/material';
import BackupList from './BackupList';

export default function AdminBackupsPage() {
  return (
    <Container maxWidth="lg">
      <Box mt={4}>
        <Typography variant="h4" gutterBottom>
          Respaldos del sistema
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Aquí puedes ver y descargar todas las copias de seguridad generadas automáticamente.
        </Typography>
        <Divider sx={{ my: 2 }} />
        <BackupList />
      </Box>
    </Container>
  );
}
