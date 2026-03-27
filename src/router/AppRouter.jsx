// src/router/AppRouter.jsx
import { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { CompaniesProvider } from "../context/CompaniesContext"
import ProtectedRoute from "./ProtectedRoute"
import Login from "../entidad/public/Login"
import Register from "../entidad/public/register"
import CreateSuperMaxAdmin from "../entidad/public/CreateSuperMaxAdmin"
import ForgotPassword from "../entidad/public/ForgotPassword"
import { CircularProgress } from "@mui/material"
import { useTenantReady } from "../context/TenantContext"
import { TenantError, TenantLoading } from "../components/common/TenantError"

// Code splitting para componentes grandes
const AdminLayout = lazy(() => import("../entidad/adm/AdminLayout"))
const AdminDashboard = lazy(() => import("../entidad/adm/AdminDashboard"))
const AdminCompaniesPage = lazy(() => import("../entidad/adm/AdminPanel/AdminCompaniesPage"))
const AdminRequiredDocumentsPage = lazy(() => import("../entidad/adm/DocumentoRequerido/AdmRequiereDoc"))
const AdminUploadedDocumentsPage = lazy(() => import("../entidad/adm/AdminUploadedDocumentsPage"))
const DocumentLibraryPage = lazy(() => import("../entidad/adm/Library/DocumentLibraryPage"))
const AdminAcceptCompanyPage = lazy(() => import("../entidad/adm/AceptCompany"))
const AdminStore = lazy(() => import("../entidad/adm/Almacenamiento/AdminStore"))
const UsuarioDashboard = lazy(() => import("../entidad/user/UsuarioDashboard"))
const AdminLogsPage = lazy(() => import("../entidad/adm/AdminLogsPage"))
const AdminBackupsPage = lazy(() => import("../entidad/adm/backups/AdminBackupsPage"))
const MessagesPage = lazy(() => import("../entidad/adm/Messages/MessagesPage"))
const AdminProfilePage = lazy(() => import("../entidad/adm/Messages/AdminProfilePage"))
const TenantManagement = lazy(() => import("../entidad/adm/AdminPanel/TenantManagement"))
const ControlFileSdkTest = lazy(() => import("../pages/dev/ControlFileSdkTest"))
const BulkVehiclesPage = lazy(() => import("../pages/bulk/BulkVehiclesPage"))

const AppRouter = () => {
  const { isReady, loading, error } = useTenantReady();

  return (
    <BrowserRouter>
      <CompaniesProvider>
        {/* Si está cargando el tenant, mostrar loading */}
        {loading && <TenantLoading />}
        
        {/* Si hay error en el tenant, mostrar error */}
        {(error || !isReady) && !loading && <TenantError error={error} />}
        
        {/* Si todo está listo, mostrar las rutas */}
        {isReady && !loading && !error && (
          <Suspense
            fallback={
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
                <CircularProgress />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Rutas públicas */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/createsupermaxadm" element={<CreateSuperMaxAdmin />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* Rutas de desarrollo */}
              <Route path="/dev/controlfile-sdk" element={<ControlFileSdkTest />} />

              {/* Bulk Upload V2 — Vehículos */}
              <Route
                path="/bulk-upload/vehicles"
                element={
                  <ProtectedRoute allowedRoles={["user"]}>
                    <BulkVehiclesPage />
                  </ProtectedRoute>
                }
              />

              {/* Rutas protegidas para administradores */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin", "max"]}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="companies" element={<AdminCompaniesPage />} />
                <Route path="company-approvals" element={<AdminAcceptCompanyPage />} />
                <Route path="required-documents" element={<AdminRequiredDocumentsPage />} />
                <Route path="uploaded-documents" element={<AdminUploadedDocumentsPage />} />
                <Route path="document-library" element={<DocumentLibraryPage />} />
                <Route path="store" element={<AdminStore />} />
                <Route path="logs" element={<AdminLogsPage />} />
                <Route path="backups" element={<AdminBackupsPage />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="profile" element={<AdminProfilePage />} />
              </Route>

              {/* Rutas protegidas para usuarios */}
              <Route
                path="/usuario"
                element={
                  <ProtectedRoute allowedRoles={["user"]}>
                    <UsuarioDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/usuario/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["user"]}>
                    <UsuarioDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Ruta fallback */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        )}
      </CompaniesProvider>
    </BrowserRouter>
  )
}

export default AppRouter
