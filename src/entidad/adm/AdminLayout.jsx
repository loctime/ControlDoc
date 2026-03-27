"use client"

import { useState } from 'react';
import { Box, CssBaseline } from "@mui/material"
import { Outlet } from "react-router-dom"
import AppBarSection from "./layout/AppBarSection"
import DrawerMenu from "./layout/DrawerMenu"
import LogoDialog from "./layout/LogoDialog"

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [logoDialogOpen, setLogoDialogOpen] = useState(false)

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      <AppBarSection
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
      />

      <DrawerMenu
        open={drawerOpen}
        setLogoDialogOpen={setLogoDialogOpen}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: "64px 8px 0 8px", // Agregado padding-top para compensar navbar fijo
          width: "100%",
          minHeight: "100vh",
          backgroundColor: "var(--page-background)",
        }}
      >
        <Outlet />
      </Box>

      <LogoDialog
        open={logoDialogOpen}
        onClose={() => setLogoDialogOpen(false)}
      />
    </Box>
  )
}