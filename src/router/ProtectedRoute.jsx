// src/router/ProtectedRoute.jsx
import { useContext } from 'react';
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { Box, CircularProgress, Typography } from "@mui/material";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin/superadmin: "admin", "max" y legacy "dhhkvja"
  const privilegedRoles = ["admin", "max", "dhhkvja"];
  const roleValue = typeof user.role === "string" ? user.role.trim().toLowerCase() : "user";
  const isPrivileged = privilegedRoles.includes(roleValue);
  const isAllowed = isPrivileged ? allowedRoles.some((r) => privilegedRoles.includes(r)) : allowedRoles.includes(roleValue);

  if (!isAllowed) {
    // Si es admin/max pero esta ruta es solo para usuarios, redirigir al dashboard admin
    if (isPrivileged) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h4" gutterBottom>Acceso denegado</Typography>
        <Typography>No tenés permisos para acceder a esta sección.</Typography>
      </Box>
    );
  }

  return children;
};

export default ProtectedRoute;
