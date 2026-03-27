"use client"

import React, { useState, useEffect } from "react"
import { AppBar, Toolbar, IconButton, Typography, Menu, MenuItem, Divider, Avatar, Tooltip, Box } from "@mui/material"
import { useTheme } from "@mui/material/styles"
import MenuIcon from "@mui/icons-material/Menu"
import PersonIcon from "@mui/icons-material/Person"
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks"
import SettingsIcon from "@mui/icons-material/Settings"
import LogoutIcon from "@mui/icons-material/Logout"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { getAuth, signOut } from "firebase/auth"
import { auth } from "../../../firebaseconfig"
import Logo from "../../../components/common/Logo"
import AdminCompanySelector from "../AdminCompanySelector"
import NotificationBell from "../dashboard/NotificationBell"

export default function AppBarSection({ drawerOpen, setDrawerOpen }) {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [anchorEl, setAnchorEl] = useState(null)

  const handleProfileMenuOpen = (e) => setAnchorEl(e.currentTarget)
  const handleProfileMenuClose = () => setAnchorEl(null)

  const handleLogout = async () => {
    try {
      await signOut(auth)
      localStorage.removeItem("userCompany")
      localStorage.removeItem("isAdminSession")
      handleProfileMenuClose()
      navigate("/login")
      window.location.reload()
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    }
  }

  useEffect(() => {
    const unsubscribe = getAuth().onAuthStateChanged((user) => {
      if (!user) navigate("/login")
      else if (location.pathname === "/admin" || location.pathname === "/admin/") {
        navigate("/admin/dashboard", { replace: true })
      }
    })
    return () => unsubscribe()
  }, [navigate, location])

  return (
    <AppBar 
      position="fixed" 
      sx={{
        transition: theme.transitions.create(["margin-left", "width"], {
          easing: drawerOpen ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
          duration: drawerOpen ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen,
        }),
        ...(drawerOpen && {
          width: `calc(100% - 180px)`,
          marginLeft: `180px`,
        }),
        backgroundColor: "var(--navbar-background)",
        color: "var(--navbar-background-text)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        willChange: "margin-left, width",
      }}
    >
      <Toolbar sx={{ color: "var(--navbar-background-text)" }}>
        <IconButton
          color="inherit"
          onClick={() => setDrawerOpen(true)}
          edge="start"
          sx={{ mr: 2, color: "var(--navbar-background-text)", ...(drawerOpen && { display: "none" }) }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" noWrap component="div" sx={{ mr: 3, display: "flex", alignItems: "center", color: "var(--navbar-background-text)" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              p: 0.75,
              borderRadius: 2,
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)",
              transition: "all 0.3s ease",
            }}
          >
            <Logo height={40} withText={false} />
          </Box>
        </Typography>

        <Box sx={{ color: "var(--navbar-background-text)", flexGrow: 1, mr: "auto", display: "flex" }}>
          <AdminCompanySelector
            sx={{ 
              width: "100%",
              "& .MuiInputLabel-root": { color: "inherit" },
              "& .MuiSelect-select": { color: "inherit" },
              "& .MuiOutlinedInput-notchedOutline": { 
                borderColor: "currentColor"
              },
              "&:hover .MuiOutlinedInput-notchedOutline": { 
                borderColor: "currentColor",
                borderWidth: "2px"
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { 
                borderColor: "var(--primary-main)",
                borderWidth: "2px"
              }
            }}
            size="small"
            allowAllOption
            showStatusDot
            fullWidth={true}
          />
        </Box>

        <NotificationBell />

        <Tooltip title="Perfil de usuario">
          <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0, color: "var(--navbar-background-text)" }}>
            <Avatar sx={{ bgcolor: "var(--primary-main)", color: "var(--primary-text)" }}>
              <PersonIcon />
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleProfileMenuClose}>
          <MenuItem component={Link} to="/admin/profile" onClick={handleProfileMenuClose}>
            <LibraryBooksIcon fontSize="small" sx={{ mr: 1 }} /> Mi Perfil
          </MenuItem>
          <MenuItem component={Link} to="/admin/logs" onClick={handleProfileMenuClose}>
            <LibraryBooksIcon fontSize="small" sx={{ mr: 1 }} /> Ver Logs
          </MenuItem>
          <MenuItem>
            <SettingsIcon fontSize="small" sx={{ mr: 1 }} /> Configuración
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Cerrar Sesión
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  )
}
