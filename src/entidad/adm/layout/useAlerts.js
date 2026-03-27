"use client"

import { React,  useEffect, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "../../firebaseconfig"
import { getTenantCollectionPath } from "../../utils/tenantUtils"
import WarningIcon from "@mui/icons-material/Warning"
import ErrorIcon from "@mui/icons-material/Error"
import InfoIcon from "@mui/icons-material/Info"

export default function useAlerts(companies) {
  const [alerts, setAlerts] = useState([])
  
  // Asegurar que companies sea un array
  const safeCompanies = Array.isArray(companies) ? companies : []

  const buildAlert = ({ id, icon, text, relatedDocuments, level = "warning" }) => ({
    id,
    icon,
    text,
    relatedDocuments,
    level,
    timestamp: Date.now(),
    isRead: false,
  })

  const getDate = (firestoreDate) => firestoreDate?.toDate?.() ?? null

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        // Usar la ruta multi-tenant correcta
        const uploadedDocumentsPath = 'uploadedDocuments';
        const allDocsSnap = await getDocs(collection(db, uploadedDocumentsPath))
        const docs = allDocsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        const hoy = new Date()
        const cincoDias = new Date()
        cincoDias.setDate(hoy.getDate() + 5)

        const alertsList = []

        // 1. Pendientes (excluir documentos en proceso)
        const pendientes = docs.filter((d) => d.status === "Pendiente de revisión")
        if (pendientes.length > 0) {
          alertsList.push(
            buildAlert({
              id: "pendientes",
              icon: <WarningIcon sx={{ color: "var(--warning-main)" }} />,
              text: `${pendientes.length} documentos pendientes`,
              relatedDocuments: pendientes.map((d) => ({
                id: d.id,
                name: d.fileName || d.documentName || "Sin nombre",
                company: safeCompanies.find((c) => c.id === d.companyId)?.name || "Sin empresa",
                expirationDate: getDate(d.expirationDate),
                status: "Pendiente",
              })),
              level: "warning",
            }),
          )
        }

        // 2. Vencidos
        const vencidos = docs.filter((d) => d.status === "Aprobado" && getDate(d.expirationDate) < hoy)
        if (vencidos.length > 0) {
          alertsList.push(
            buildAlert({
              id: "vencidos",
              icon: <ErrorIcon sx={{ color: "var(--error-main)" }} />,
              text: `${vencidos.length} documentos vencidos`,
              relatedDocuments: vencidos.map((d) => ({
                id: d.id,
                name: d.fileName || d.documentName || "Sin nombre",
                company: safeCompanies.find((c) => c.id === d.companyId)?.name || "Sin empresa",
                expirationDate: getDate(d.expirationDate),
                status: "Vencido",
              })),
              level: "error",
            }),
          )
        }

        // 3. Por vencer en próximos 5 días
        const porVencer = docs.filter((d) => {
          const fecha = getDate(d.expirationDate)
          return d.status === "Aprobado" && fecha >= hoy && fecha <= cincoDias
        })
        if (porVencer.length > 0) {
          alertsList.push(
            buildAlert({
              id: "por-vencer",
              icon: <WarningIcon sx={{ color: "var(--warning-main)" }} />,
              text: `${porVencer.length} documentos por vencer`,
              relatedDocuments: porVencer.map((d) => ({
                id: d.id,
                name: d.fileName || d.documentName || "Sin nombre",
                company: safeCompanies.find((c) => c.id === d.companyId)?.name || "Sin empresa",
                expirationDate: getDate(d.expirationDate),
                status: "Por vencer",
              })),
              level: "warning",
            }),
          )
        }

        // 4. Sin fecha de vencimiento
        const sinFecha = docs.filter((d) => d.status === "Aprobado" && !d.expirationDate)
        if (sinFecha.length > 0) {
          alertsList.push(
            buildAlert({
              id: "sin-fecha",
              icon: <InfoIcon sx={{ color: "var(--info-main)" }} />,
              text: `${sinFecha.length} documentos sin fecha de vencimiento`,
              relatedDocuments: sinFecha.map((d) => ({
                id: d.id,
                name: d.fileName || d.documentName || "Sin nombre",
                company: safeCompanies.find((c) => c.id === d.companyId)?.name || "Sin empresa",
                expirationDate: null,
                status: "Aprobado sin fecha",
              })),
              level: "info",
            }),
          )
        }

        if (alertsList.length === 0) {
          alertsList.push(
            buildAlert({
              id: "nada",
              icon: <InfoIcon sx={{ color: "var(--info-main)" }} />,
              text: "No hay notificaciones",
              relatedDocuments: [],
              level: "info",
            }),
          )
        }

        setAlerts(alertsList)
      } catch (error) {
        console.error("Error al cargar alertas:", error)
        setAlerts([
          {
            id: "error",
            icon: <ErrorIcon color="error" />,
            text: "Error cargando notificaciones",
            relatedDocuments: [],
            level: "error",
            timestamp: Date.now(),
            isRead: false,
          },
        ])
      }
    }

    fetchAlerts()
  }, [safeCompanies])

  return alerts
}
