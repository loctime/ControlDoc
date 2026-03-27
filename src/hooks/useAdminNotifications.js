// src/hooks/useAdminNotifications.js
import React, { useEffect, useState } from "react";
import { db } from "../config/firebaseconfig";
import { collection, query, where, orderBy, getDocs, updateDoc, doc } from "firebase/firestore";
import { getTenantCollectionPath } from "../utils/tenantUtils";

export function useAdminNotifications(companyId = null) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      setLoading(true);
      // Usar la ruta multi-tenant correcta
      const adminNotificationsPath = getTenantCollectionPath('adminNotifications');
      let q = collection(db, adminNotificationsPath);
      if (companyId) {
        q = query(q, where("companyId", "==", companyId));
      }
      q = query(q, orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      setNotifications(snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convertir Timestamp a Date si existe
        timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
      })));
      setLoading(false);
    }
    fetchNotifications();
  }, [companyId]);

  const markAsRead = async (id) => {
    // Usar la ruta multi-tenant correcta
    const adminNotificationsPath = getTenantCollectionPath('adminNotifications');
    await updateDoc(doc(db, adminNotificationsPath, id), { read: true });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, loading, markAsRead };
}
