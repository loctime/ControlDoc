//adm/documentorequerido/CompanySelectorModal.jsx
// React import removed - using JSX runtime
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import { useCompanies } from '../../../context/CompaniesContext';

export default function CompanySelectorLocal({
  value,
  onChange,
  sx = {},
  size = "small",
  fullWidth = true,
  allowAllOption = true
}) {
  const { companies, loading } = useCompanies();
  const safeCompanies = Array.isArray(companies) ? companies : [];

  return (
    <FormControl
      size={size}
      sx={{ minWidth: 180, ...sx }}
      fullWidth={fullWidth}
    >
      <InputLabel id="company-select-label">Empresa</InputLabel>
      {loading ? (
        <CircularProgress size={24} sx={{ mt: 1 }} />
      ) : (
        <Select
          labelId="company-select-label"
          value={value}
          label="Empresa"
          onChange={(e) => {
            const companyId = e.target.value;
            const selected = safeCompanies.find(c => String(c.id) === companyId) || { id: companyId, name: "Todas" };
            onChange?.(selected);
          }}
        >
          {allowAllOption && (
            <MenuItem value="todas">
              <em>Todas las empresas</em>
            </MenuItem>
          )}
          {safeCompanies.map(company => (
            <MenuItem key={company.id} value={String(company.id)}>
              {company.companyName || company.name}
            </MenuItem>
          ))}
        </Select>
      )}
    </FormControl>
  );
}
