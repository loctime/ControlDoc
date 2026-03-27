//adm/library/backup/useBackups.jsx
"use client"

import React, { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../../../../config/firebaseconfig"
import { getTenantCollectionPath } from '../../../../utils/tenantUtils'
import { useAuth } from "../../../../context/AuthContext"

export function useBackups({ isAdmin, selectedCompanyId, startDate = null, endDate = null, currentTab = null }) {
  const { user } = useAuth()
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const fetchBackups = async () => {
      if (!user?.uid && !user?.email) {
        setBackups([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const backupsCollectionPath = getTenantCollectionPath('backups');
        const ref = collection(db, backupsCollectionPath);
        const allQueries = [];
        if (user?.uid) allQueries.push(query(ref, where("uploadedBy", "==", user.uid)));
        if (user?.email) {
          allQueries.push(query(ref, where("uploadedByEmail", "==", user.email)));
          allQueries.push(query(ref, where("createdBy", "==", user.email)));
        }
        if (allQueries.length === 0) {
          setBackups([]);
          setLoading(false);
          return;
        }
        const snapshots = await Promise.all(
          allQueries.map(q => getDocs(q).catch(() => ({ docs: [] })))
        );
        const byId = new Map();
        for (const snap of snapshots) {
          for (const docSnap of (snap.docs || [])) {
            const id = docSnap.id;
            if (!byId.has(id)) byId.set(id, formatBackup(docSnap));
          }
        }
        let allBackups = Array.from(byId.values());

        if (startDate) {
          allBackups = allBackups.filter(b => {
            const d = b.createdAt ? new Date(b.createdAt) : null;
            return d && d >= new Date(startDate);
          });
        }
        if (endDate) {
          allBackups = allBackups.filter(b => {
            const d = b.createdAt ? new Date(b.createdAt) : null;
            return d && d <= new Date(endDate);
          });
        }
        allBackups.sort((a, b) => (b.createdAt ? new Date(b.createdAt) : 0) - (a.createdAt ? new Date(a.createdAt) : 0));

        if (selectedCompanyId && selectedCompanyId !== "todas") {
          allBackups = allBackups.filter(backup =>
            backup.companyIds?.includes(selectedCompanyId) ||
            backup.companyId === selectedCompanyId ||
            backup.companyId === 'multiple'
          );
        }

        setBackups(allBackups)
      } catch (err) {
        console.error("Error loading backups:", err && (err.message || err.code || err));
        setError("Error al cargar backups: " + (err && (err.message || err.code || err)));
        setBackups([]);
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    if (!isAdmin) return
    if (currentTab !== null && currentTab !== 2) return
    fetchBackups()
  }, [isAdmin, selectedCompanyId, startDate, endDate, currentTab, refreshTrigger, user?.uid, user?.email])

  const refreshBackups = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return { backups, loading, error, refreshBackups }
}

function formatBackup(docSnap) {
  const data = docSnap.data()
  const toDate = (val) => {
    if (!val) return null
    if (typeof val === "string") return new Date(val)
    if (val?.toDate) return val.toDate()
    if (val?.seconds) return new Date(val.seconds * 1000)
    return null
  }

  return {
    id: docSnap.id,
    name: data.name || "Backup sin nombre",
    fileName: data.fileName || "backup.zip",
    size: data.fileSize || data.size || 0,
    companyId: data.companyId,
    companyName: data.companyName || "",
    companyIds: data.companyIds || [], // Array de todos los companyIds incluidos
    companyNames: data.companyNames || [], // Array de todos los companyNames incluidos
    entityTypes: data.entityTypes || [],
    entityNames: data.entityNames || [],
    documentNames: data.documentNames || [],
    createdAt: toDate(data.uploadedAt) || new Date(), // Cambiado a uploadedAt
    createdBy: data.uploadedByEmail || data.uploadedBy || data.createdBy || "Desconocido",
    fileURL: data.fileURL || "",
    description: data.comentario || data.description || "",
    fileCount: data.fileCount || data.documentCount || 0,
    companiesCount: data.companiesCount || 0,
    entitiesCount: data.entitiesCount || 0,
    backupType: data.backupType || 'unknown',
    status: data.status || "Completado",
  }
}
