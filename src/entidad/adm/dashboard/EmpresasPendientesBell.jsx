import React, { useEffect, useState } from "react";
import { Badge, IconButton, Tooltip, Popover, List, ListItem, ListItemText, Typography, Button, Box } from "@mui/material";
import CircleIcon from "@mui/icons-material/Circle";
import { db } from "../../../config/firebaseconfig";
import { collection, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { getTenantCollectionPath } from '../../../utils/tenantUtils';

export default function EmpresasPendientesBell() {
  const [pendingCompanies, setPendingCompanies] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    // Listener reactivo para empresas no aprobadas
    // Usar la ruta multi-tenant correcta
    const companiesCollectionPath = getTenantCollectionPath('companies');
    const q = query(
      collection(db, companiesCollectionPath),
      where("aprobada", "==", false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const companies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingCompanies(companies);
    });
    return () => unsubscribe();
  }, []);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const handleAprobar = async (companyId) => {
    // Usar la ruta multi-tenant correcta
    const companiesCollectionPath = getTenantCollectionPath('companies');
    await updateDoc(doc(db, companiesCollectionPath, companyId), { aprobada: true });
    handleClose();
  };
  const open = Boolean(anchorEl);

  return (
  <Tooltip title={pendingCompanies.length > 0 ? "Empresas pendientes de aprobación" : "Sin empresas pendientes de aprobación"}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircleIcon sx={{ 
        color: pendingCompanies.length > 0 ? 'error.main' : 'success.main', 
        fontSize: 28
      }} />
    </Box>
  </Tooltip>
  );
}
