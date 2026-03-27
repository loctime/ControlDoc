import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Chip
} from '@mui/material';
import { Business as BusinessIcon } from '@mui/icons-material';
import { useAuth } from '../../../context/AuthContext';

const CompanySelector = () => {
  const { 
    activeCompanyId, 
    mainCompanyId, 
    availableCompanies, 
    setActiveCompanyId 
  } = useAuth();

  if (!availableCompanies || availableCompanies.length === 0) {
    return null;
  }

  // Si solo hay una empresa (la principal), no mostrar selector
  if (availableCompanies.length === 1) {
    return null;
  }

  const handleChange = (event) => {
    const newCompanyId = event.target.value;
    console.log('[CompanySelector] Cambiando empresa activa:', {
      newCompanyId,
      mainCompanyId,
      availableCompanies: availableCompanies.map(c => ({ id: c.id, name: c.companyName, isMain: c.isMain }))
    });
    setActiveCompanyId(newCompanyId);
  };

  const getCompanyLabel = (company) => {
    if (company.isMain) {
      return `${company.companyName} (Principal)`;
    }
    return `${company.companyName} (Cliente)`;
  };

  return (
    <Box sx={{ minWidth: 250, mr: 2 }}>
      <FormControl fullWidth size="small">
        <InputLabel id="company-selector-label">Empresa activa</InputLabel>
        <Select
          labelId="company-selector-label"
          id="company-selector"
          value={activeCompanyId || mainCompanyId || ''}
          label="Empresa activa"
          onChange={handleChange}
          startAdornment={<BusinessIcon sx={{ mr: 1, color: 'action.active' }} />}
        >
          {availableCompanies.map((company) => (
            <MenuItem key={company.id} value={company.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessIcon fontSize="small" />
                <span>{getCompanyLabel(company)}</span>
                {company.isMain && (
                  <Chip 
                    label="Principal" 
                    size="small" 
                    color="primary" 
                    sx={{ ml: 'auto', height: 20 }}
                  />
                )}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default CompanySelector;

