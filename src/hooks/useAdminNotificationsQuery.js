// src/hooks/useAdminNotificationsQuery.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { getTenantCollectionPath } from '../utils/tenantUtils';
import { POLLING_INTERVALS, QUERY_DEFAULTS, MUTATION_DEFAULTS } from '../config/queryConfig';
import { useRealtimePolling } from './useRealtimePolling';

// Query keys
export const adminNotificationsKeys = {
  all: ['adminNotifications'],
  byCompany: (companyId) => ['adminNotifications', 'byCompany', companyId],
};

// Fetch function para notificaciones admin
const fetchAdminNotifications = async (companyId) => {
  const adminNotificationsPath = getTenantCollectionPath('adminNotifications');
  let q = collection(db, adminNotificationsPath);
  
  if (companyId) {
    q = query(q, where("companyId", "==", companyId));
  }
  q = query(q, orderBy("timestamp", "desc"));
  
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    // Convertir Timestamp a Date si existe
    timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
  }));
};

// Mutation para marcar como leído
const markNotificationAsRead = async ({ notificationId }) => {
  const adminNotificationsPath = getTenantCollectionPath('adminNotifications');
  await updateDoc(doc(db, adminNotificationsPath, notificationId), { read: true });
  return notificationId;
};

// Hook principal para notificaciones admin
export function useAdminNotificationsQuery(companyId = null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: adminNotificationsKeys.byCompany(companyId),
    queryFn: () => fetchAdminNotifications(companyId),
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.NOTIFICATIONS,
  });

  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: (notificationId) => {
      // Actualizar cache optimísticamente
      queryClient.setQueryData(
        adminNotificationsKeys.byCompany(companyId),
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: true }
              : notification
          );
        }
      );
    },
    ...MUTATION_DEFAULTS,
  });

  // Polling inteligente
  useRealtimePolling(
    adminNotificationsKeys.byCompany(companyId),
    POLLING_INTERVALS.NOTIFICATIONS,
    true
  );

  const notifications = query.data || [];
  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    loading: query.isLoading,
    error: query.error?.message || null,
    markAsRead: markAsReadMutation.mutate,
    isMarkingAsRead: markAsReadMutation.isPending,
  };
}

