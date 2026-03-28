// src/component/administrador/AdminDashboard.jsx
import React from "react";
const { useState, useEffect, useRef, useContext, useMemo } = React;
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@mui/material";
import { db } from "../../config/firebaseconfig";
import CompactStatusRow from "./dashboard/CompactStatusRow";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "firebase/firestore";
import { useCompanies } from "../../context/CompaniesContext";
import { parseFirestoreDate } from "../../utils/dateHelpers";
import {
  Box,
  Typography,
  Grid,
  Tooltip,
  Paper,
  Button,
  IconButton
} from "@mui/material";
import {
  Cancel as CancelIcon,
  Pending as PendingIcon,
  Error as ErrorIcon,
  Business as BusinessIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  Assessment as AssessmentIcon
} from "@mui/icons-material";
import html2canvas from 'html2canvas';

// Subcomponentes
import { lazy, Suspense } from "react";
const EmpresasTable = lazy(() => import("./dashboard/EmpresasTable"));
// Importación directa para evitar problemas de bundling con React
import AdminEmpresas from "./dashboard/AdminEmpresas";
// Si PreviewDocumentTable es pesado, también puede ir como lazy
// const PreviewDocumentTable = lazy(() => import("./dashboard/PreviewDocumentTable"));
import PreviewDocumentTable from "./dashboard/PreviewDocumentTable";
import AdminAdvancedDocuments from "./dashboard/AdminAdvancedDocuments";
import ClassificationAnalytics from "./components/ClassificationAnalytics";

import { AuthContext } from "../../context/AuthContext";
import { getTenantCollectionPath } from '../../utils/tenantUtils';

// Helper para convertir diasRestantes a color
const getDeadlineColor = (diasRestantes) => {
  if (diasRestantes === null || diasRestantes === undefined) return "text.secondary";
  if (diasRestantes <= 0) return "error.main";
  if (diasRestantes <= 2) return "error.dark";
  if (diasRestantes <= 5) return "warning.main";
  if (diasRestantes <= 15) return "warning.light";
  if (diasRestantes <= 30) return "info.main";
  return "success.main";
};

// --- FUNCIÓN PARA MAPEAR LOS DATOS DE ESTADO ---
function getStatusData(previewDocs, companies) {
  // --- POR VENCER ---
  const docsPorVencer = previewDocs.filter(
    doc => doc.diasRestantes !== null && doc.diasRestantes <= 10
  );
  // Ordenar por fecha de vencimiento ascendente
  docsPorVencer.sort((a, b) => a.diasRestantes - b.diasRestantes);
  // Agrupar por empresa, tomando el documento más próximo por empresa
  const empresasPorVencer = [];
  const empresasSet = new Set();
  for (const doc of docsPorVencer) {
    if (!empresasSet.has(doc.companyId)) {
      empresasSet.add(doc.companyId);
      empresasPorVencer.push({
        name: companies.find(c => c.id === doc.companyId)?.name || "Sin empresa",
        diasRestantes: doc.diasRestantes
      });
    }
  }
 
  const diasMin = docsPorVencer.reduce((min, doc) => {
    if (doc.diasRestantes !== null && (min === null || doc.diasRestantes < min)) {
      return doc.diasRestantes;
    }
    return min;
  }, null);
  let warningText = '';
  if (diasMin !== null && diasMin <= 10 && diasMin > 5) warningText = 'En 10 días vencen';
  if (diasMin !== null && diasMin <= 5) warningText = 'En menos de 5 días vence la documentación. Revisar.';
  const empresasNombresVencer = empresasPorVencer.map(e => e.name);
  const previewNombresVencer = empresasNombresVencer.slice(0, 3).join(", ");
  const extraVencer = empresasNombresVencer.length > 3 ? ` +${empresasNombresVencer.length - 3} más` : '';
  // --- PENDIENTES ---
  const empresasConPendientesIds = new Set(
    previewDocs
      .filter(doc =>
        doc.status === "Pendiente de revisión" ||
        doc.status === "Pendiente" ||
        doc.archivoSubido === false
      )
      .map(doc => doc.companyId)
  );
  const empresasConPendientesNombres = Array.from(
    new Set(companies.filter(c => empresasConPendientesIds.has(c.id)).map(c => c.name))
  );
  // --- RECHAZADOS ---
  const empresasConRechazadosIds = new Set(
    previewDocs.filter(doc => doc.status === "Rechazado").map(doc => doc.companyId)
  );
  const empresasConRechazadosNombres = Array.from(
    new Set(companies.filter(c => empresasConRechazadosIds.has(c.id)).map(c => c.name))
  );
  const previewNombresRechazados = empresasConRechazadosNombres.slice(0, 3).join(", ");
  const extraRechazados = empresasConRechazadosNombres.length > 3 ? ` +${empresasConRechazadosNombres.length - 3} más` : '';
  return [
    {
      id: "vencer",
      title: "Por vencer",
      count: empresasNombresVencer.length,
      description: empresasNombresVencer.length > 0
        ? `${warningText} –`
        : "No hay documentos por vencer",
      companies: empresasPorVencer,
      color: "#e53935",
      bgColor: "#fff5f5",
      icon: <ErrorIcon sx={{ color: "#e53935" }} fontSize="small" />, 
    },
    {
      id: "pendientes",
      title: "Pendientes",
      count: empresasConPendientesNombres.length,
      description: empresasConPendientesNombres.length > 0
        ? "Empresas que no han subido algún documento. Revisar.-"
        : "No hay empresas con documentos pendientes",
      companies: empresasConPendientesNombres,
      color: "#ffa000",
      bgColor: "#fff8e1",
      icon: <PendingIcon sx={{ color: "#ffa000" }} fontSize="small" />, 
    },
    {
      id: "rechazados",
      title: "Rechazados",
      count: empresasConRechazadosNombres.length,
      description: empresasConRechazadosNombres.length > 0
        ? `No actualizados: ${previewNombresRechazados}${extraRechazados}`
        : "No hay documentos rechazados.",
      companies: empresasConRechazadosNombres,
      color: "#b71c1c",
      bgColor: "#ffebee",
      icon: <CancelIcon sx={{ color: "#b71c1c" }} fontSize="small" />, 
    },
  ];
}

export default function AdminDashboard() {
  // Despierta el backend Render solo una vez al montar
  useEffect(() => {
    import('../../utils/wakeRenderBackend').then(({ wakeRenderBackendOnce }) =>
      wakeRenderBackendOnce()
    );
  }, []);

  // Estado para el card seleccionado
  const [selectedCard, setSelectedCard] = useState(null);
  // Estado para el filtro de documentos
  const [documentFilter, setDocumentFilter] = useState(null); // null, 'pendientes', 'rechazados', 'porVencer'
  const [activeView, setActiveView] = useState("overview"); // overview | advanced | analytics
  // Estados para controlar la carga crítica y secundaria
  const [loadState, setLoadState] = useState({ critical: false, secondary: false });

  useEffect(() => {
    // Carga crítica inmediata (empresas y userRole)
    setLoadState(prev => ({ ...prev, critical: true }));
    // Carga secundaria diferida (stats y documentos)
    const timeout = setTimeout(() => {
      setLoadState(prev => ({ ...prev, secondary: true }));
    }, 300); // 300ms para no bloquear el render inicial
    return () => clearTimeout(timeout);
  }, []);

  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const privilegedRoles = ["admin", "max", "dhhkvja"];
  const userRole = typeof user?.role === "string" ? user.role.trim().toLowerCase() : "user";
  const isPrivileged = privilegedRoles.includes(userRole);

  // Redirección solo en useEffect (nunca navigate durante el render)
  useEffect(() => {
    if (!user) return;
    if (!isPrivileged) {
      navigate("/usuario/dashboard", { replace: true });
    }
  }, [user, isPrivileged, navigate]);

  // No renderizar contenido admin si no tiene rol privilegiado (evita flash antes del redirect)
  if (user && !isPrivileged) {
    return null;
  }

  // NUEVOS ESTADOS PARA PERSONAS, VEHÍCULOS Y EMPRESAS
  const [entityStats, setEntityStats] = useState({
    personal: { habilitados: 0, deshabilitados: 0 },
    vehiculos: { habilitados: 0, deshabilitados: 0 },
    empresas: { habilitadas: 0, deshabilitadas: 0 },
  });
  const [allEntitiesSuspended, setAllEntitiesSuspended] = useState(false);
  const { selectedCompany, companies } = useCompanies();
  const selectedCompanyId = selectedCompany?.id || null;
  const [stats, setStats] = useState({
    totalDocumentos: 0,
    approvalPending: 0,
    rejected: 0
  });
  const [previewDocs, setPreviewDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [showDetails, setShowDetails] = useState(null);
  const [checkboxFilters, setCheckboxFilters] = useState({
    vencidos: true,
    sinFecha: true,
    conFecha: true
  });
  const [empresasConVencidos, setEmpresasConVencidos] = useState([]);
  const [showCompaniesTable, setShowCompaniesTable] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const empresasTableRef = useRef(null);
  const documentsExportRef = useRef(null);

  useEffect(() => {
    async function fetchEntityStats() {
      try {
        // Obtener IDs de empresas asignadas al admin (companies ya está filtrado por el contexto)
        const assignedCompanyIds = new Set(companies.map(c => c.id));
        
        if (assignedCompanyIds.size === 0) {
          setEntityStats({
            personal: { habilitados: 0, deshabilitados: 0 },
            vehiculos: { habilitados: 0, deshabilitados: 0 },
            empresas: { habilitadas: 0, deshabilitadas: 0 },
          });
          return;
        }
        
        // PERSONAS - filtrar por empresas asignadas
        const personalPath = getTenantCollectionPath('personal');
        const personalSnap = await getDocs(collection(db, personalPath));
        let habilitadosPersonal = 0, deshabilitadosPersonal = 0;
        personalSnap.docs.forEach(doc => {
          const data = doc.data();
          if (assignedCompanyIds.has(data.companyId)) {
            if (data.activo !== false) habilitadosPersonal++;
            else deshabilitadosPersonal++;
          }
        });
        
        // VEHÍCULOS - filtrar por empresas asignadas
        const vehiculosPath = getTenantCollectionPath('vehiculos');
        const vehiculosSnap = await getDocs(collection(db, vehiculosPath));
        let habilitadosVehiculos = 0, deshabilitadosVehiculos = 0;
        vehiculosSnap.docs.forEach(doc => {
          const data = doc.data();
          if (assignedCompanyIds.has(data.companyId)) {
            if (data.activo !== false) habilitadosVehiculos++;
            else deshabilitadosVehiculos++;
          }
        });
        
        // EMPRESAS - solo contar las asignadas (companies ya está filtrado)
        let habilitadasEmpresas = 0, deshabilitadasEmpresas = 0;
        companies.forEach(company => {
          if (company.activo !== false) habilitadasEmpresas++;
          else deshabilitadasEmpresas++;
        });
        
        setEntityStats({
          personal: { habilitados: habilitadosPersonal, deshabilitados: deshabilitadosPersonal },
          vehiculos: { habilitados: habilitadosVehiculos, deshabilitados: deshabilitadosVehiculos },
          empresas: { habilitadas: habilitadasEmpresas, deshabilitadas: deshabilitadasEmpresas },
        });
      } catch (err) {
        setEntityStats({
          personal: { habilitados: 0, deshabilitados: 0 },
          vehiculos: { habilitados: 0, deshabilitados: 0 },
          empresas: { habilitadas: 0, deshabilitadas: 0 },
        });
      }
    }
    fetchEntityStats();
    // --- LÓGICA EXISTENTE ---
    async function checkAllEntitiesSuspended() {
      try {
        // Obtener IDs de empresas asignadas al admin
        const assignedCompanyIds = new Set(companies.map(c => c.id));
        
        if (assignedCompanyIds.size === 0) {
          setAllEntitiesSuspended(true);
          return;
        }
        
        // Verificar personal activo - solo empresas asignadas
        const personalPath = getTenantCollectionPath('personal');
        const personalSnap = await getDocs(collection(db, personalPath));
        const anyPersonalActive = personalSnap.docs.some(doc => {
          const data = doc.data();
          return assignedCompanyIds.has(data.companyId) && data.activo !== false;
        });
        
        // Verificar vehículos activos - solo empresas asignadas
        const vehiculosPath = getTenantCollectionPath('vehiculos');
        const vehiculosSnap = await getDocs(collection(db, vehiculosPath));
        const anyVehiculoActive = vehiculosSnap.docs.some(doc => {
          const data = doc.data();
          return assignedCompanyIds.has(data.companyId) && data.activo !== false;
        });
        
        setAllEntitiesSuspended(!(anyPersonalActive || anyVehiculoActive));
      } catch (err) {
        setAllEntitiesSuspended(false);
      }
    }
    checkAllEntitiesSuspended();
    const fetchStats = async () => {
      setLoading(true);
      try {
        // Obtener IDs de empresas asignadas al admin
        const assignedCompanyIds = new Set(companies.map(c => c.id));
        
        if (assignedCompanyIds.size === 0) {
          setStats({
            totalDocumentos: 0,
            approvalPending: 0,
            rejected: 0
          });
          setLoading(false);
          return;
        }

        // 1. Contar documentos requeridos no subidos (archivoSubido === false en requiredDocuments)
        const requiredCollectionPath = getTenantCollectionPath('requiredDocuments');
        const requiredSnap = await getDocs(collection(db, requiredCollectionPath));
        let approvalPending = requiredSnap.docs.filter(doc => {
          const data = doc.data();
          return assignedCompanyIds.has(data.companyId) && data.archivoSubido === false;
        }).length;

        // 2. Contar rechazados y con vencimiento solo en uploadedDocuments - filtrar por empresas asignadas
        const uploadedCollectionPath = getTenantCollectionPath('uploadedDocuments');
        const uploadedSnap = await getDocs(collection(db, uploadedCollectionPath));
        let rejected = 0;
        let totalConVencimiento = 0;

        uploadedSnap.docs.forEach(doc => {
          const data = doc.data();
          if (assignedCompanyIds.has(data.companyId)) {
            const exp = parseFirestoreDate(data.expirationDate);
            if (data.expirationDate) totalConVencimiento++;
            if (data.status === "Rechazado") rejected++;
          }
        });

        setStats({
          totalDocumentos: totalConVencimiento,
          approvalPending,
          rejected
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [companies]);

  useEffect(() => {
    const calcularEmpresasConVencidos = async () => {
      const hoy = new Date();

      try {
        const uploadedCollectionPath = getTenantCollectionPath('requiredDocuments');
        const uploadedSnap = await getDocs(collection(db, uploadedCollectionPath));
        

        const empresasConDocumentosVencidos = new Set();

        // Obtener IDs de empresas asignadas al admin
        const assignedCompanyIds = new Set(companies.map(c => c.id));
        
        uploadedSnap.forEach(doc => {
          const data = doc.data();
          // Solo contar empresas asignadas
          if (assignedCompanyIds.has(data.companyId)) {
            const exp = parseFirestoreDate(data.expirationDate);
            const diasRestantes = exp ? Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24)) : null;

            if (diasRestantes !== null && diasRestantes < 0) {
              empresasConDocumentosVencidos.add(data.companyId);
            }
          }
        });

        const empresasNombres = companies
          .filter(c => empresasConDocumentosVencidos.has(c.id))
          .map(c => c.name);

        setEmpresasConVencidos(empresasNombres);
      } catch (err) {
        console.error("Error al calcular empresas con vencidos:", err);
      }
    };

    if (companies.length > 0) {
      calcularEmpresasConVencidos();
    }
  }, [companies]);

  useEffect(() => {
    const fetchPreview = async () => {
      const hoy = new Date();
      setLoading(true);

      try {
        // Obtener IDs de empresas asignadas al admin
        const assignedCompanyIds = new Set(companies.map(c => c.id));
        
        if (assignedCompanyIds.size === 0) {
          setPreviewDocs([]);
          setLoading(false);
          return;
        }
        
        // El dashboard trae documentos solo de empresas asignadas
        const companyQueryConstraints = [];

        // Traer personal y vehículos activos solo de empresas asignadas
        let empleadosActivos = new Set();
        let vehiculosActivos = new Set();
        try {
          const personalCollectionPath = getTenantCollectionPath('personal');
          const personalSnap = await getDocs(collection(db, personalCollectionPath));
          empleadosActivos = new Set(
            personalSnap.docs
              .filter(d => {
                const data = d.data();
                return assignedCompanyIds.has(data.companyId) && data.activo !== false;
              })
              .map(d => d.id)
          );
        } catch (e) { /* fallback: ningún empleado activo */ }
        try {
          const vehiculosCollectionPath = getTenantCollectionPath('vehiculos');
          const vehiculosSnap = await getDocs(collection(db, vehiculosCollectionPath));
          vehiculosActivos = new Set(
            vehiculosSnap.docs
              .filter(d => {
                const data = d.data();
                return assignedCompanyIds.has(data.companyId) && data.activo !== false;
              })
              .map(d => d.id)
          );
        } catch (e) { /* fallback: ningún vehículo activo */ }

        // 1. Fetch UPLOADED documents - filtrar por empresas asignadas
        const uploadedCollectionPath = getTenantCollectionPath('uploadedDocuments');
        const uploadedQuery = query(
          collection(db, uploadedCollectionPath), 
          where('companyId', '!=', null), // Excluir documentos de ejemplo
          ...companyQueryConstraints
        );
        const uploadedSnap = await getDocs(uploadedQuery);
        const docsSubidos = uploadedSnap.docs
          .filter(docSnap => assignedCompanyIds.has(docSnap.data().companyId))
          .map(docSnap => {
          const data = docSnap.data();
          const exp = parseFirestoreDate(data.expirationDate);
          const diasRestantes = exp ? Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24)) : null;
          let categoria = "Sin categoría";
          if (data.entityType === "employee") categoria = "Personal";
          else if (data.entityType === "company") categoria = "Empresa";
          else if (data.entityType === "vehicle") categoria = "Vehículo";
          else if (data.entityType === "other") categoria = "Otro";
          
          return {
            id: docSnap.id,
            ...data,
            name: data.name || "Sin nombre",
            expirationDate: exp,
            diasRestantes,
            status: data.status || "Sin estado",
            companyName: companies.find(c => c.id === data.companyId)?.name || "Sin empresa",
            categoria,
            companyId: data.companyId,
            clientId: data.clientId || null, // IMPORTANTE: Preservar clientId
            isRequerido: false,
            archivoSubido: data.archivoSubido !== undefined ? data.archivoSubido : true
          };
        });

        // 2. Fetch REQUIRED documents that are NOT YET UPLOADED (archivoSubido: false) - filtrar por empresas asignadas
        const requiredQueryFilters = [...companyQueryConstraints, where('archivoSubido', '==', false)];
        const requiredCollectionPath = getTenantCollectionPath('requiredDocuments');
        const requiredQuery = query(collection(db, requiredCollectionPath), ...requiredQueryFilters);
        const requiredSnap = await getDocs(requiredQuery);
        
        const docsRequeridosNoSubidos = requiredSnap.docs
          .filter(docSnap => assignedCompanyIds.has(docSnap.data().companyId))
          .map(docSnap => {
          const data = docSnap.data();
          const exp = parseFirestoreDate(data.expirationDate);
          const diasRestantes = exp ? Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24)) : null;
          let categoria = "Sin categoría";
          if (data.entityType === "employee") categoria = "Personal";
          else if (data.entityType === "company") categoria = "Empresa";
          else if (data.entityType === "vehicle") categoria = "Vehículo";
          else if (data.entityType === "other") categoria = "Otro";

          return {
            id: docSnap.id,
            ...data,
            name: data.name || "Sin nombre",
            expirationDate: exp,
            diasRestantes,
            status: "No subido",
            archivoSubido: false,
            companyName: companies.find(c => c.id === data.companyId)?.name || "Sin empresa",
            categoria,
            companyId: data.companyId,
            clientId: data.clientId || null, // IMPORTANTE: Preservar clientId (aunque los required docs normalmente no lo tienen)
            isRequerido: true
          };
        });

        // 3. Filter out required documents if an uploaded version already exists
        // Mejorar la lógica de coincidencia usando múltiples criterios
        const clavesSubidos = new Set(
          docsSubidos.map(d => {
            // Usar requiredDocumentId si existe (más confiable)
            if (d.requiredDocumentId) {
              const entityId = d.entityId || "";
              // Si tiene entityId, incluir en la clave para documentos específicos
              if (entityId) {
                return `reqId:${d.requiredDocumentId}__entity:${entityId}`;
              }
              return `reqId:${d.requiredDocumentId}`;
            }
            // Fallback a clave compuesta normalizada incluyendo entityId
            const name = (d.name || "").trim().toLowerCase();
            const companyId = d.companyId || "";
            const entityType = (d.entityType || "").trim().toLowerCase();
            const entityId = d.entityId || "";
            if (entityId) {
              return `key:${name}__${companyId}__${entityType}__entity:${entityId}`;
            }
            return `key:${name}__${companyId}__${entityType}`;
          })
        );

        // Debug: Log claves generadas
        console.log('[AdminDashboard] 🔍 Claves de documentos subidos:', Array.from(clavesSubidos).slice(0, 5));

        const docsRequeridosFiltrados = docsRequeridosNoSubidos.filter(reqDoc => {
          // Primero verificar por ID del documento requerido (con entityId si existe)
          const entityIdReq = reqDoc.entityId || "";
          let clavePorId = `reqId:${reqDoc.id}`;
          if (entityIdReq) {
            clavePorId = `reqId:${reqDoc.id}__entity:${entityIdReq}`;
          }
          if (clavesSubidos.has(clavePorId)) {
            console.log('[AdminDashboard] ✅ Filtrado por reqId:', reqDoc.id, 'entityId:', entityIdReq);
            return false; // Ya existe en uploadedDocuments
          }
          
          // También verificar sin entityId (para documentos globales)
          if (entityIdReq && clavesSubidos.has(`reqId:${reqDoc.id}`)) {
            console.log('[AdminDashboard] ✅ Filtrado por reqId (global):', reqDoc.id);
            return false;
          }
          
          // Luego verificar por clave compuesta normalizada
          const name = (reqDoc.name || "").trim().toLowerCase();
          const companyId = reqDoc.companyId || "";
          const entityType = (reqDoc.entityType || "").trim().toLowerCase();
          let claveReq = `key:${name}__${companyId}__${entityType}`;
          if (entityIdReq) {
            claveReq = `key:${name}__${companyId}__${entityType}__entity:${entityIdReq}`;
          }
          const shouldInclude = !clavesSubidos.has(claveReq);
          
          if (!shouldInclude) {
            console.log('[AdminDashboard] ✅ Filtrado por clave compuesta:', claveReq);
          }
          
          return shouldInclude;
        });
        
        // Unir docs subidos y requeridos filtrados
        let combinedDocs = [...docsSubidos, ...docsRequeridosFiltrados];

        // FILTRO: Solo incluir docs de empleados/vehículos activos
        // IMPORTANTE: Si el documento no tiene entityId, incluirlo (puede ser un documento global)
        combinedDocs = combinedDocs.filter(doc => {
          if (["employee", "personal"].includes(doc.entityType)) {
            // Si no tiene entityId, incluir (puede ser documento global de personal)
            if (!doc.entityId) return true;
            return empleadosActivos.has(doc.entityId);
          }
          if (["vehicle", "vehiculo"].includes(doc.entityType)) {
            // Si no tiene entityId, incluir (puede ser documento global de vehículos)
            if (!doc.entityId) return true;
            return vehiculosActivos.has(doc.entityId);
          }
          // Para categorías personalizadas y documentos de empresa, siempre mostrar
          return true;
        });

        // Debug: Log documentos cargados
        console.log('[AdminDashboard] 📊 Resumen de documentos:', {
          totalCargados: combinedDocs.length,
          requeridosNoSubidos: docsRequeridosNoSubidos.length,
          requeridosFiltrados: docsRequeridosFiltrados.length,
          subidos: docsSubidos.length,
          clavesSubidos: clavesSubidos.size
        });
        console.log('[AdminDashboard] 📋 Documentos subidos (sample):', docsSubidos.slice(0, 3).map(d => ({
          name: d.name,
          requiredDocumentId: d.requiredDocumentId,
          entityId: d.entityId,
          entityType: d.entityType,
          companyId: d.companyId
        })));
        console.log('[AdminDashboard] 📋 Documentos requeridos no subidos (sample):', docsRequeridosNoSubidos.slice(0, 3).map(d => ({
          id: d.id,
          name: d.name,
          entityId: d.entityId,
          entityType: d.entityType,
          companyId: d.companyId,
          archivoSubido: d.archivoSubido
        })));
        
        setPreviewDocs(combinedDocs.sort((a, b) => {
          if (a.diasRestantes !== null && b.diasRestantes !== null) return a.diasRestantes - b.diasRestantes;
          if (a.diasRestantes === null && b.diasRestantes !== null) return 1;
          if (a.diasRestantes !== null && b.diasRestantes === null) return -1;
          return (a.name || "").localeCompare(b.name || "");
        }));

      } catch (err) {
        console.error("Error al cargar documentos:", err);
        setPreviewDocs([]);
      } finally {
        setLoading(false);
      }
    };


    fetchPreview();
  }, [companies]);
  
  


  // Nuevo handler para seleccionar tarjeta, expandir empresa relevante y hacer scroll
  const handleStatusSelect = (cardId) => {
    setSelectedCard(cardId);
    setExpandedRow(null); // Cierra cualquier fila expandida
    setTimeout(() => {
      if (empresasTableRef.current) {
        empresasTableRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  // Resetea filtros cuando cambia la vista
  useEffect(() => {
    if (activeView !== "overview") {
      setDocumentFilter(null);
      setSelectedCard(null);
    }
  }, [activeView]);

  // Handler para ver todos los documentos de un estado específico
  const handleViewAllDocuments = (filterType) => {
    setDocumentFilter(filterType);
    // Scroll a la vista de documentos
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  // Filtrar documentos según el filtro activo
  const filteredDocs = documentFilter === null 
    ? [] 
    : previewDocs.filter(doc => {
        if (documentFilter === 'pendientes') {
          return doc.status === "Pendiente" || 
                 doc.status === "Pendiente de revisión" || 
                 doc.archivoSubido === false ||
                 doc.status === "No subido";
        }
        if (documentFilter === 'rechazados') {
          return doc.status === "Rechazado";
        }
        if (documentFilter === 'porVencer' || documentFilter === 'vencer') {
          return doc.diasRestantes !== null && doc.diasRestantes <= 10 && doc.diasRestantes >= 0;
        }
        return false;
      });

  // Separar pendientes en dos grupos
  const pendingUploadDocs = filteredDocs.filter(doc => 
    documentFilter === 'pendientes' && (doc.archivoSubido === false || doc.status === "No subido")
  );
  
  const pendingApprovalDocs = filteredDocs.filter(doc => 
    documentFilter === 'pendientes' && 
    doc.archivoSubido !== false && 
    doc.status !== "No subido" &&
    (doc.status === "Pendiente" || doc.status === "Pendiente de revisión")
  );

  // Filtrar documentos para vista avanzada según empresa seleccionada
  const filteredDocsForAdvanced = useMemo(() => {
    // Si hay empresa seleccionada, mostrar solo documentos de esa empresa (todos, con y sin clientId)
    // Si no hay empresa seleccionada, mostrar todos
    if (selectedCompanyId) {
      return previewDocs.filter(doc => doc.companyId === selectedCompanyId);
    }
    return previewDocs;
  }, [previewDocs, selectedCompanyId]);

  // Función para exportar como imagen
  const handleExportAsImage = async () => {
    if (!documentsExportRef.current) return;

    try {
      // Obtener el nombre del filtro para el nombre del archivo
      let fileName = 'documentos';
      if (documentFilter === 'pendientes') fileName = 'documentos-pendientes';
      if (documentFilter === 'rechazados') fileName = 'documentos-rechazados';
      if (documentFilter === 'porVencer' || documentFilter === 'vencer') fileName = 'documentos-por-vencer';

      // Capturar el elemento
      const canvas = await html2canvas(documentsExportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Mayor calidad
        useCORS: true,
        logging: false,
      });

      // Convertir a blob y descargar
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${fileName}-${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      });
    } catch (error) {
      console.error('Error al exportar imagen:', error);
    }
  };

  return (
    <Box sx={{ pt: 1.5, px: 2, pb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ color: "var(--page-background-text)" }}>
          Dashboard del Administrador
        </Typography>
      </Box>

      {/* Carga crítica: selector de empresa y título */}
      <AdminEmpresas
        companyId={selectedCompanyId}
        companies={companies}
        previewDocs={previewDocs}
        loading={loading}
        onShowCompaniesTable={(companies) => {
          setSelectedCompanies(companies);
          setShowCompaniesTable(true);
          setExpandedRow(companies[0]?.id);
        }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Button
          variant={activeView === "analytics" ? "contained" : "outlined"}
          size="small"
          onClick={() => setActiveView("analytics")}
          startIcon={<AssessmentIcon />}
        >
          Analítica de Clasificación
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={activeView === "overview" ? "contained" : "outlined"}
            size="small"
            onClick={() => setActiveView("overview")}
          >
            Vista por empresa
          </Button>
          <Button
            variant={activeView === "advanced" ? "contained" : "outlined"}
            size="small"
            onClick={() => setActiveView("advanced")}
          >
            Vista avanzada
          </Button>
        </Box>
      </Box>

      {activeView === "overview" ? (
        !loadState.secondary ? (
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {[...Array(3)].map((_, i) => (
              <Grid item xs={12} sm={4} key={i}>
                <Skeleton variant="rounded" height={120} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <>
            <CompactStatusRow
              data={getStatusData(previewDocs, companies)}
              onSelect={handleStatusSelect}
              onViewAll={handleViewAllDocuments}
            />

            <Suspense fallback={<Skeleton variant="rectangular" height={300} sx={{ mt: 3 }} />}>
              <Box sx={{ mt: 5, mb: 3 }} ref={empresasTableRef}>
                <EmpresasTable
                  companies={companies}
                  previewDocs={previewDocs}
                  expandedRow={expandedRow}
                  setExpandedRow={setExpandedRow}
                />
              </Box>
            </Suspense>

            {documentFilter && filteredDocs.length > 0 && (
              <Box sx={{ mt: 4 }} ref={documentsExportRef}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">
                    {documentFilter === 'pendientes' && 'Documentos Pendientes'}
                    {documentFilter === 'rechazados' && 'Documentos Rechazados'}
                    {(documentFilter === 'porVencer' || documentFilter === 'vencer') && 'Documentos Por Vencer'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={handleExportAsImage}
                      size="small"
                    >
                      Exportar Imagen
                    </Button>
                    <IconButton 
                      onClick={() => setDocumentFilter(null)}
                      color="error"
                      sx={{ bgcolor: 'rgba(211, 47, 47, 0.1)' }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Box>
                </Box>

                {documentFilter === 'pendientes' ? (
                  <>
                    {pendingUploadDocs.length > 0 && (
                      <Box sx={{ mb: 4 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'warning.main' }}>
                          Pendientes de Subida ({pendingUploadDocs.length})
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Documentos que las empresas aún no han subido
                        </Typography>
                        <PreviewDocumentTable 
                          docs={pendingUploadDocs}
                          filters={checkboxFilters}
                          onFilterChange={setCheckboxFilters}
                          getDeadlineColor={getDeadlineColor}
                        />
                      </Box>
                    )}

                    {pendingApprovalDocs.length > 0 && (
                      <Box sx={{ mb: 4 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'info.main' }}>
                          Pendientes de Aprobación ({pendingApprovalDocs.length})
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Documentos subidos esperando tu revisión
                        </Typography>
                        <PreviewDocumentTable 
                          docs={pendingApprovalDocs}
                          filters={checkboxFilters}
                          onFilterChange={setCheckboxFilters}
                          getDeadlineColor={getDeadlineColor}
                        />
                      </Box>
                    )}
                  </>
                ) : (
                  <PreviewDocumentTable 
                    docs={filteredDocs}
                    filters={checkboxFilters}
                    onFilterChange={setCheckboxFilters}
                    getDeadlineColor={getDeadlineColor}
                  />
                )}
              </Box>
            )}
          </>
        )
      ) : activeView === "analytics" ? (
        <Box sx={{ mt: 3 }}>
          <ClassificationAnalytics companyId={selectedCompanyId} />
        </Box>
      ) : (
        <AdminAdvancedDocuments
          documents={filteredDocsForAdvanced}
          companies={companies}
          selectedCompanyId={selectedCompanyId}
          isLoading={loading}
          getDeadlineColor={getDeadlineColor}
        />
      )}
    </Box>
  );
}

