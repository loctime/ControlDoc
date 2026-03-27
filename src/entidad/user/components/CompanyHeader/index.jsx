import { Paper, Typography, Box } from '@mui/material';
import { useAppConfig } from '../../../../context/AppConfigContext';
import Logo from '../../../../components/common/Logo';

export default function CompanyHeader({ company, realemail, email }) {
  const { appLogo } = useAppConfig();

  if (!company) return null;

  return (
    <Paper elevation={2} sx={{ 
      p: 3, 
      mb: 4, 
      display: 'flex', 
      alignItems: 'center',
      gap: 3,
      flexWrap: 'wrap'
    }}>
      <Logo 
        height={80} 
        logoUrl={appLogo} 
        sx={{ 
          flexShrink: 0,
          borderRadius: 1,
          boxShadow: 1
        }} 
      />
      
      <Box sx={{ flex: 1, minWidth: 200 }}>
        <Typography variant="h6" fontWeight="bold">{company.companyName || company.name}</Typography>
        <Typography variant="subtitle1" color="textSecondary">
          CUIT: {company.cuit || "No registrado"}
        </Typography>
        {realemail && (
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            Usuario: {realemail}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
