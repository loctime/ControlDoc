import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Button
} from '@mui/material';
import { CalendarToday, Close } from '@mui/icons-material';

export default function GroupSummary({ 
  pageGroups, 
  onDeleteGroup 
}) {
  if (pageGroups.length === 0) return null;

  return (
    <Box sx={{ mt: 3, p: 2, backgroundColor: '#e3f2fd', borderRadius: 1 }}>
      <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
        📋 Resumen de grupos ({pageGroups.length} grupos creados)
      </Typography>
      <Grid container spacing={1}>
        {pageGroups.map(group => (
          <Grid item xs={12} sm={6} md={4} key={group.id}>
            <Box sx={{ 
              p: 1, 
              border: group.date ? '1px solid var(--success-main)' : '1px solid var(--primary-main)', 
              borderRadius: 1, 
              backgroundColor: group.date ? '#e8f5e8' : 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Box>
                <Typography variant="body2" color={group.date ? "success.dark" : "primary"} sx={{ fontWeight: 'bold' }}>
                  Grupo {group.id}: Páginas {group.pages.join(', ')}
                </Typography>
                {group.date && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <CalendarToday sx={{ fontSize: '0.7rem', color: '#4caf50' }} />
                    <Typography variant="caption" color="success.dark" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                      vencimiento: {group.date}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Button
                size="small"
                color="error"
                onClick={() => onDeleteGroup(group.id)}
                sx={{ minWidth: 'auto', p: 0.5 }}
              >
                <Close fontSize="small" />
              </Button>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
