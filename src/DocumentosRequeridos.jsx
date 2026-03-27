// src/DocumentosRequeridos.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "./firebaseconfig";
import { useAuth } from "./context/AuthContext";
import SuperAdmin from "./SuperAdmin";
import { getTenantCollectionPath } from "./utils/tenantUtils";

const DocumentosRequeridos = () => {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [nuevoDocumento, setNuevoDocumento] = useState("");
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [selectedDocumento, setSelectedDocumento] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      // Usar rutas multi-tenant correctas
      const documentTypesPath = getTenantCollectionPath('documentTypes');
      const categoriesPath = getTenantCollectionPath('categories');
      
      const docsSnap = await getDocs(collection(db, documentTypesPath));
      setDocumentos(docsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const catsSnap = await getDocs(collection(db, categoriesPath));
      setCategorias(catsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  // Funciones para agregar documentos/categorías (solo super admin)
  // El super admin es el usuario con role === "max"
  const handleAddDocumento = async () => {
    if (nuevoDocumento.trim()) {
      // Usar la ruta multi-tenant correcta
      const documentTypesPath = getTenantCollectionPath('documentTypes');
      await addDoc(collection(db, documentTypesPath), { name: nuevoDocumento, createdBy: user.uid, createdAt: new Date() });
      setNuevoDocumento("");
      // Recargar
      const docsSnap = await getDocs(collection(db, documentTypesPath));
      setDocumentos(docsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  };

  const handleAddCategoria = async () => {
    if (nuevaCategoria.trim()) {
      // Usar la ruta multi-tenant correcta
      const categoriesPath = getTenantCollectionPath('categories');
      await addDoc(collection(db, categoriesPath), { name: nuevaCategoria, createdBy: user.uid, createdAt: new Date() });
      setNuevaCategoria("");
      // Recargar
      const catsSnap = await getDocs(collection(db, categoriesPath));
      setCategorias(catsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  };

  return (
    <div>
      <h2>Documentos requeridos</h2>
      <label>Nombre del documento:</label>
      <select value={selectedDocumento} onChange={e => setSelectedDocumento(e.target.value)}>
        <option value="">Seleccione un documento</option>
        {documentos.map(doc => (
          <option key={doc.id} value={doc.id}>{doc.name}</option>
        ))}
      </select>
      <br />
      <label>Categoría:</label>
      <select value={selectedCategoria} onChange={e => setSelectedCategoria(e.target.value)}>
        <option value="">Seleccione una categoría</option>
        {categorias.map(cat => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>
      <br />
      {/* Solo visible para super admin */}
      <SuperAdmin isSuperAdmin={user?.role === "max"}>
        <div style={{ marginTop: 20, padding: 10, border: "1px solid #ccc", borderRadius: 8 }}>
          <h3>Agregar nuevo documento</h3>
          <input
            type="text"
            value={nuevoDocumento}
            onChange={e => setNuevoDocumento(e.target.value)}
            placeholder="Nombre del nuevo documento"
          />
          <button onClick={handleAddDocumento}>Agregar documento</button>
          <h3>Agregar nueva categoría</h3>
          <input
            type="text"
            value={nuevaCategoria}
            onChange={e => setNuevaCategoria(e.target.value)}
            placeholder="Nombre de la nueva categoría"
          />
          <button onClick={handleAddCategoria}>Agregar categoría</button>
        </div>
      </SuperAdmin>
    </div>
  );
};

export default DocumentosRequeridos;
