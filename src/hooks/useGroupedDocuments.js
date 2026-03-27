import React from 'react';
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebaseconfig";
import { getTenantCollectionPath } from "../utils/tenantUtils";

const useGroupedDocuments = () => {
  const [groupedDocs, setGroupedDocs] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      try {
        // Usar la ruta multi-tenant correcta
        const uploadedDocumentsPath = 'uploadedDocuments';
        const q = query(collection(db, uploadedDocumentsPath), where("originalStatus", "==", "Aprobado"));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const grouped = {};

        docs.forEach(doc => {
          const { entityType = "otros", entityName = "Sin nombre", name = "Sin tipo" } = doc;

          if (!grouped[entityType]) grouped[entityType] = {};
          if (!grouped[entityType][entityName]) grouped[entityType][entityName] = {};
          if (!grouped[entityType][entityName][name]) grouped[entityType][entityName][name] = [];

          grouped[entityType][entityName][name].push(doc);
        });

        setGroupedDocs(grouped);
      } catch (error) {
        console.error("Error al agrupar documentos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  return { groupedDocs, loading };
};

export default useGroupedDocuments;
