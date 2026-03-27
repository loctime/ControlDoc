import React, { useState, useEffect, useMemo } from "react";
import {
  Paper, Typography, Grid, CircularProgress, Alert
} from "@mui/material";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import DocumentCard from "../components/DocumentCard";
import ModalDocument from '../components/ModalDocument';
import useDashboardDataQuery from '../components/hooks/useDashboardDataQuery';
import { useAuth } from '../../../context/AuthContext';

export default function DocumentosVehiculoForm({ vehiculo, selectedDocumentId = null, onDocumentUploaded = null }) {
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const { activeCompanyId, mainCompanyId } = useAuth();
  
  // Obtener companyId del contexto si vehiculo no lo tiene
  const finalCompanyId = vehiculo?.companyId || activeCompanyId || mainCompanyId;
  
  // Usar hook Query con refresh function - pasar todos los parámetros necesarios
  // Importante: activeCompanyId y mainCompanyId son requeridos para habilitar la query de documentos requeridos
  const { 
    requiredDocuments, 
    uploadedDocuments, 
    loading: queryLoading,
    refreshUploadedDocuments 
  } = useDashboardDataQuery(finalCompanyId, 0, 0, activeCompanyId, mainCompanyId);

  // Autenticación
  useEffect(() => {
    const auth = getAuth();
    if (auth.currentUser) setCurrentUser(auth.currentUser);
    const unsubscribe = onAuthStateChanged(auth, user => setCurrentUser(user || null));
    return () => unsubscribe();
  }, []);

  // Seleccionar documento si viene por prop
  useEffect(() => {
    if (selectedDocumentId && requiredDocuments.length > 0) {
      const doc = requiredDocuments.find(d => d.id === selectedDocumentId);
      if (doc) {
        const uploaded = uploadedDocuments.find(
          up => {
            // Buscar por requiredDocumentId o documentType (fallback)
            const matchesRequiredDocId = up.requiredDocumentId === doc.id || up.documentType === doc.id;
            if (!matchesRequiredDocId) return false;
            // Si tiene entityId, debe coincidir con el vehículo
            return !up.entityId || up.entityId === vehiculo.id;
          }
        );
        setSelectedDocument({ doc, uploaded });
      }
    }
  }, [selectedDocumentId, requiredDocuments, uploadedDocuments, vehiculo?.id]);

  // Filtrar documentos de vehículos (memoizado para mejor rendimiento)
  const vehicleDocuments = useMemo(() => {
    return requiredDocuments.filter(
      doc => doc.entityType === "vehicle" || doc.entityType === "vehiculo"
    );
  }, [requiredDocuments]);

  // Calcular días hasta vencimiento
  const getDaysToExpire = (doc, uploaded) => {
    // Priorizar expirationDate del documento subido
    if (uploaded?.expirationDate) {
      const expirationDate = uploaded.expirationDate?.toDate 
        ? uploaded.expirationDate.toDate() 
        : new Date(uploaded.expirationDate);
      const diff = (expirationDate - new Date()) / (1000 * 60 * 60 * 24);
      return Math.floor(diff);
    }
    // Fallback a deadline del documento requerido
    if (doc.deadline?.date) {
      const diff = (new Date(doc.deadline.date) - new Date()) / (1000 * 60 * 60 * 24);
      return Math.floor(diff);
    }
    return null;
  };

  if (!vehiculo) return null;

  const entityName = `${vehiculo.marca || ""} ${vehiculo.modelo || ""} (${vehiculo.patente || "Sin patente"})`.trim() || vehiculo?.alias || vehiculo?.companyName || vehiculo?.name || "Vehículo";

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" mb={2}>
        Documentos de {entityName}
      </Typography>

      {queryLoading && <CircularProgress />}
      {!currentUser && <Alert severity="error">Sesión no iniciada.</Alert>}

      <Grid container spacing={2}>
        {vehicleDocuments.map(doc => {
          const uploaded = uploadedDocuments.find(
            up => {
              // Buscar por requiredDocumentId o documentType (fallback)
              const matchesRequiredDocId = up.requiredDocumentId === doc.id || up.documentType === doc.id;
              if (!matchesRequiredDocId) return false;
              // Si tiene entityId, debe coincidir con el vehículo
              return !up.entityId || up.entityId === vehiculo.id;
            }
          );
          const days = getDaysToExpire(doc, uploaded);
          
          return (
            <Grid item xs={12} sm={6} md={4} key={doc.id}>
              <DocumentCard
                doc={doc}
                uploaded={uploaded}
                days={days}
                onUploadClick={() => setSelectedDocument({ doc, uploaded })}
              />
            </Grid>
          );
        })}
      </Grid>

      <ModalDocument
        open={!!selectedDocument}
        onClose={() => setSelectedDocument(null)}
        selectedDocument={selectedDocument ? { ...selectedDocument.doc, entityId: vehiculo.id, entityClientId: vehiculo.clientId || null } : null}
        currentUser={currentUser}
        entityType="vehicle"
        entityName={entityName}
        latestUploadedDoc={selectedDocument?.uploaded || null}
        onUploadSuccess={async () => {
          setSelectedDocument(null);
          
          // Esperar un poco para que el backend complete la escritura antes de refresh
          await new Promise(resolve => setTimeout(resolve, 1000));
          await refreshUploadedDocuments();
          
          if (onDocumentUploaded) {
            onDocumentUploaded();
          }
        }}
      />
    </Paper>
  );
}
