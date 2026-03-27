// src/hooks/useBackupsQuery.js
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { getTenantCollectionPath } from '../utils/tenantUtils';
import { POLLING_INTERVALS, QUERY_DEFAULTS } from '../config/queryConfig';
import { useRealtimePolling } from './useRealtimePolling';
import { useAuth } from '../context/AuthContext';

// Query keys
export const backupsKeys = {
  all: ['backups'],
  byFilters: (isAdmin, selectedCompanyId, startDate, endDate, userId, userEmail) =>
    ['backups', 'byFilters', isAdmin, selectedCompanyId, startDate, endDate, userId, userEmail],
};

// Helper function para formatear backup
const formatBackup = (docSnap) => {
  const data = docSnap.data();
  const toDate = (val) => {
    if (!val) return null;
    if (typeof val === "string") return new Date(val);
    if (val?.toDate) return val.toDate();
    if (val?.seconds) return new Date(val.seconds * 1000);
    return null;
  };

  return {
    id: docSnap.id,
    name: data.name || "Backup sin nombre",
    fileName: data.fileName || "backup.zip",
    size: data.fileSize || data.size || 0,
    companyId: data.companyId,
    companyName: data.companyName || "",
    createdAt: toDate(data.uploadedAt) || new Date(),
    createdBy: data.uploadedByEmail || data.uploadedBy || data.createdBy || "Desconocido",
    fileURL: data.fileURL || "",
    description: data.comentario || data.description || "",
    fileCount: data.fileCount || 0,
    status: data.status || "Completado",
  };
};

// Fetch function: solo backups del usuario (uploadedBy, uploadedByEmail, createdBy)
const fetchBackups = async ({ isAdmin, selectedCompanyId, startDate, endDate, user }) => {
  if (!isAdmin) return [];
  if (!user?.uid && !user?.email) return [];

  const backupsCollectionPath = getTenantCollectionPath('backups');
  const ref = collection(db, backupsCollectionPath);
  const allQueries = [];
  if (user?.uid) allQueries.push(query(ref, where('uploadedBy', '==', user.uid)));
  if (user?.email) {
    allQueries.push(query(ref, where('uploadedByEmail', '==', user.email)));
    allQueries.push(query(ref, where('createdBy', '==', user.email)));
  }
  if (allQueries.length === 0) return [];

  const snapshots = await Promise.all(
    allQueries.map((q) => getDocs(q).catch(() => ({ docs: [] })))
  );
  const byId = new Map();
  for (const snap of snapshots) {
    for (const docSnap of snap.docs || []) {
      const id = docSnap.id;
      if (!byId.has(id)) byId.set(id, formatBackup(docSnap));
    }
  }
  let results = Array.from(byId.values());

  if (startDate) {
    results = results.filter((b) => {
      const d = b.createdAt ? new Date(b.createdAt) : null;
      return d && d >= new Date(startDate);
    });
  }
  if (endDate) {
    results = results.filter((b) => {
      const d = b.createdAt ? new Date(b.createdAt) : null;
      return d && d <= new Date(endDate);
    });
  }
  if (selectedCompanyId && selectedCompanyId !== "todas") {
    results = results.filter(
      (b) => b.companyId === selectedCompanyId
    );
  }
  results.sort(
    (a, b) =>
      (b.createdAt ? new Date(b.createdAt) : 0) -
      (a.createdAt ? new Date(a.createdAt) : 0)
  );
  return results;
};

// Hook principal
export function useBackupsQuery({
  isAdmin,
  selectedCompanyId,
  startDate = null,
  endDate = null,
}) {
  const { user } = useAuth();
  const queryKey = backupsKeys.byFilters(
    isAdmin,
    selectedCompanyId,
    startDate,
    endDate,
    user?.uid,
    user?.email
  );

  const queryResult = useQuery({
    queryKey,
    queryFn: () =>
      fetchBackups({
        isAdmin,
        selectedCompanyId,
        startDate,
        endDate,
        user,
      }),
    enabled: !!isAdmin && (!!user?.uid || !!user?.email),
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.BACKUPS,
  });

  useRealtimePolling(queryKey, POLLING_INTERVALS.BACKUPS, !!isAdmin && (!!user?.uid || !!user?.email));

  return {
    backups: queryResult.data || [],
    loading: queryResult.isLoading,
    error: queryResult.error?.message || null,
  };
}

