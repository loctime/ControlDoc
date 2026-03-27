// src/hooks/useDocumentAlerts.js
import React from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { getTenantCollectionPath } from '../utils/tenantUtils';

export function useDocumentAlerts(selectedCompanyId = null, companies = []) {
  const [previewDocs, setPreviewDocs] = useState([]);
  const [stats, setStats] = useState({ totalDocumentos: 0, approvalPending: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [empresasConVencidos, setEmpresasConVencidos] = useState([]);
  const [empresasPorVencer, setEmpresasPorVencer] = useState([]);

  const parseFirestoreDate = (date) => {
    if (!date) return null;
    if (date.toDate) return date.toDate();
    if (date instanceof Date) return date;
    return new Date(date);
  };

  useEffect(() => {
    const fetchStatsAndPreview = async () => {
      setLoading(true);
      try {
        const hoy = new Date();
        const filters = selectedCompanyId ? [where('companyId', '==', selectedCompanyId)] : [];

        // 🔥 USAR RUTAS DE TENANT PARA CONSULTAR DOCUMENTOS
        const tenantUploadedDocumentsPath = getTenantCollectionPath("uploadedDocuments");
        const tenantPersonalPath = getTenantCollectionPath("personal");
        const tenantVehiculosPath = getTenantCollectionPath("vehiculos");

        let empleadosActivos = new Set();
        let vehiculosActivos = new Set();

        try {
          const personalSnap = await getDocs(query(collection(db, tenantPersonalPath), ...(selectedCompanyId ? [where('companyId', '==', selectedCompanyId)] : [])));
          empleadosActivos = new Set(personalSnap.docs.filter(d => d.data().activo !== false).map(d => d.id));
        } catch (e) { /* fallback: ningún empleado activo */ }
        try {
          const vehiculosSnap = await getDocs(query(collection(db, tenantVehiculosPath), ...(selectedCompanyId ? [where('companyId', '==', selectedCompanyId)] : [])));
          vehiculosActivos = new Set(vehiculosSnap.docs.filter(d => d.data().activo !== false).map(d => d.id));
        } catch (e) { /* fallback: ningún vehículo activo */ }

        const snap = await getDocs(query(collection(db, tenantUploadedDocumentsPath), ...filters));

        let approvalPending = 0;
        let rejected = 0;
        let totalConVencimiento = 0;

        const docs = snap.docs.map(docSnap => {
          const data = docSnap.data();
          const exp = parseFirestoreDate(data.expirationDate);
          const diasRestantes = exp ? Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24)) : null;

          if (data.expirationDate) totalConVencimiento++;
          if (data.status === 'Pendiente de revisión') approvalPending++;
          if (data.status === 'Rechazado') rejected++;

          const companyName = companies.find(c => c.id === data.companyId)?.name || 'Sin empresa';

          return {
            id: docSnap.id,
            ...data,
            name: data.name || 'Sin nombre',
            fileName: data.name || 'Sin nombre',
            expirationDate: exp,
            diasRestantes,
            status: data.status || 'Sin estado',
            companyName,
            companyId: data.companyId,
            entityType: data.entityType || 'company',
            entityName: data.entityName || 'Sin entidad',
            uploadedBy: data.uploadedByEmail || data.uploadedBy || 'Desconocido'
          };
        });

        // FILTRO: Solo incluir docs de empleados/vehículos activos
        // Para categorías personalizadas, siempre mostrar (no requieren entidad activa)
        const docsFiltrados = docs.filter(doc => {
          if (["employee", "personal"].includes(doc.entityType)) {
            return empleadosActivos.has(doc.entityId);
          }
          if (["vehicle", "vehiculo"].includes(doc.entityType)) {
            return vehiculosActivos.has(doc.entityId);
          }
          // Para categorías personalizadas (no company, employee, vehicle), siempre mostrar
          if (!["company", "employee", "vehicle", "personal", "vehiculo"].includes(doc.entityType)) {
            return true; // Siempre mostrar documentos personalizados
          }
          return true;
        });

        docsFiltrados.sort((a, b) => {
          if (a.diasRestantes !== null && b.diasRestantes !== null) return a.diasRestantes - b.diasRestantes;
          if (a.diasRestantes === null) return 1;
          return -1;
        });

        setStats({ totalDocumentos: totalConVencimiento, approvalPending, rejected });
        setPreviewDocs(docsFiltrados);
      } catch (err) {
        console.error('Error cargando estadísticas:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatsAndPreview();
  }, [selectedCompanyId, companies]);

  useEffect(() => {
    const hoy = new Date();

    const calcularEmpresas = async () => {
      try {
        // 🔥 USAR RUTA DE TENANT PARA CONSULTAR DOCUMENTOS
        const tenantUploadedDocumentsPath = getTenantCollectionPath("uploadedDocuments");
        const snap = await getDocs(collection(db, tenantUploadedDocumentsPath));

        const vencidas = new Set();
        const porVencer = new Set();

        snap.forEach(doc => {
          const data = doc.data();
          const exp = parseFirestoreDate(data.expirationDate);
          const diasRestantes = exp ? Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24)) : null;

          if (diasRestantes !== null && diasRestantes < 0) {
            vencidas.add(data.companyId);
          } else if (diasRestantes !== null && diasRestantes <= 10) {
            porVencer.add(data.companyId);
          }
        });

        setEmpresasConVencidos(companies.filter(c => vencidas.has(c.id)).map(c => c.name));
        setEmpresasPorVencer(companies.filter(c => porVencer.has(c.id)).map(c => c.name));
      } catch (err) {
        console.error('Error calculando empresas con vencimientos:', err);
      }
    };

    calcularEmpresas();
  }, [companies]);

  return {
    previewDocs,
    stats,
    loading,
    empresasConVencidos,
    empresasPorVencer
  };
}