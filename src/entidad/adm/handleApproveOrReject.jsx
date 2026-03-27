import {
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  getDoc,
  Timestamp,
  deleteDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db, auth } from "../../firebaseconfig";
import axios from 'axios';
import { approveDocument, rejectDocument } from "../../utils/MetadataService";
import { cleanFileName } from '../../utils/cleanFileName';
import { enviarEmailDocumento } from '../../utils/EmailService';
import { getTenantCollectionPath } from '../../utils/tenantUtils';

/**
 * Aprueba o rechaza un documento subido, actualiza Firestore y copia a biblioteca si se aprueba.
 */
const handleApproveOrReject = async (
  docId,
  tipo,
  documents,
  setDocuments,
  user,
  newExpirationDates,
  adminComment,
  companyComment,
  exampleComment,
  setToastMessage,
  setToastOpen,
  setExpandedRow,
  setDialogAccion,
  forcedCompanyId,
  triggerRefresh
) => {
  const currentUser = user || auth.currentUser;

  if (typeof setToastMessage !== 'function' || typeof setToastOpen !== 'function') {
    throw new Error('setToastMessage y setToastOpen deben ser funciones');
  }

  const isAprobando = tipo === 'aprobar';
  const isAjustandoFecha = tipo === 'ajustar_fecha';
  const isPoniendoEnProceso = tipo === 'poner_en_proceso';
  const comment = adminComment[docId];
  const expirationDate = newExpirationDates[docId];
  const adminEmail = currentUser?.email || 'Administrador';

  if ((isAprobando || isAjustandoFecha) && !expirationDate) {
    setToastMessage('Debe ingresar una fecha de vencimiento.');
    setToastOpen(true);
    return;
  }

  if (!isAprobando && !isAjustandoFecha && !isPoniendoEnProceso && !comment) {
    setToastMessage('Debe ingresar un comentario para rechazar.');
    setToastOpen(true);
    return;
  }

  // Función helper para parsear fechas en formato DD/MM/YYYY
  const parseDate = (dateString) => {
    if (!dateString) return null;
    
    // Si ya es un objeto Date válido
    if (dateString instanceof Date && !isNaN(dateString.getTime())) {
      return dateString;
    }
    
    // Si es string, intentar parsear diferentes formatos
    if (typeof dateString === 'string') {
      // Formato DD/MM/YYYY
      if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // Mes es 0-indexado
          const year = parseInt(parts[2], 10);
          return new Date(year, month, day);
        }
      }
      
      // Formato YYYY-MM-DD (ISO)
      if (dateString.includes('-') && dateString.length === 10) {
        return new Date(dateString);
      }
    }
    
    // Fallback: intentar parsear directamente
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  // Función helper para crear timestamp seguro
  const createSafeTimestamp = (dateString) => {
    try {
      const date = parseDate(dateString);
      if (!date) {
        throw new Error('Fecha inválida o nula');
      }
      
      // Validar que la fecha esté en rango válido para Firebase
      const minDate = new Date('1970-01-01');
      const maxDate = new Date('2100-12-31');
      
      if (date < minDate || date > maxDate) {
        throw new Error('Fecha fuera de rango válido');
      }
      
      return Timestamp.fromDate(date);
    } catch (error) {
      console.error('Error creando timestamp:', error, 'Fecha original:', dateString);
      // Usar fecha por defecto: 1 año desde ahora
      const defaultDate = new Date();
      defaultDate.setFullYear(defaultDate.getFullYear() + 1);
      return Timestamp.fromDate(defaultDate);
    }
  };

  try {
    // Usar la ruta multi-tenant correcta
    const uploadedDocumentsPath = 'uploadedDocuments';
    const originalSnap = await getDoc(doc(db, uploadedDocumentsPath, docId));
    let version = 1, subversion = 0, versionString = "1.0";
    let data = null;

    if (originalSnap.exists()) {
      data = originalSnap.data();
      
      // Usar versionNumber del documento actual como base
      version = data.versionNumber || 1;
      subversion = data.subversion || 0;
      
      if (isPoniendoEnProceso) {
        // Cuando se pone en proceso: usar versionString si existe, sino calcular desde versionNumber
        // NO cambiar la versión principal, solo incrementar subversion
        if (data.versionString) {
          // Parsear versionString existente (ej: "1.0" -> version=1, subversion=0)
          const parts = data.versionString.split('.');
          version = parseInt(parts[0]) || 1;
          subversion = parseInt(parts[1]) || 0;
        } else {
          // Si no hay versionString, usar versionNumber y subversion por separado
          version = data.versionNumber || data.version || 1;
          subversion = data.subversion || 0;
        }
        // Incrementar solo la subversión
        subversion = subversion + 1;
        versionString = `${version}.${subversion}`;
        
        console.log(`🔄 En proceso - Versión base: ${version}, Nueva subversión: ${subversion}, Nueva versión: ${versionString}`);
      } else if (isAprobando) {
        // Cuando se aprueba: La versión se calculará buscando en approvedDocuments
        // No importa de dónde viene (pendientes, en proceso, historial)
        // Por ahora solo resetear subversion para el updateFields
        subversion = 0;
        versionString = `${version}.0`; // Temporal, se recalculará después
      } else {
        // Para rechazos: mantener la versión actual
        versionString = data.versionString || `${version}.${subversion}`;
      }
      
      console.log(`🔄 Gestión de versiones - Estado: ${data.status}, Nueva versión: ${versionString}`);
    }

    // Variables para archivo convertido (se llenarán si es imagen)
    let convertedFileURL = null;
    let convertedFileName = null;
    let convertedFileType = null;
    let convertedSize = null;

    // Para aprobaciones, la versión se calculará después buscando en approvedDocuments
    // Por ahora, preparar updateFields sin versión (se actualizará después con la versión correcta)
    const updateFields = {
      status: isAprobando ? 'Aprobado' : 
              isAjustandoFecha ? 'Aprobado' : 
              isPoniendoEnProceso ? 'En proceso' : 'Rechazado',
      reviewedAt: Timestamp.now(), // Usar Timestamp.now() en lugar de serverTimestamp()
      reviewedBy: adminEmail,
      // Solo incluir version si NO es aprobación (para aprobaciones, se calculará después)
      ...(isAprobando ? {} : {
        version,
        subversion,
        versionString,
        versionNumber: version
      }),
      ...(isAprobando || isAjustandoFecha
        ? { expirationDate: createSafeTimestamp(expirationDate) }
        : isPoniendoEnProceso 
        ? { adminComment: comment || 'Documento enviado a tercero para aprobación' }
        : { adminComment: comment }),
    };

    // Si se convirtió una imagen, agregar datos del PDF convertido
    if (convertedFileURL) {
      updateFields.fileURL = convertedFileURL;
      updateFields.fileName = convertedFileName;
      updateFields.fileType = convertedFileType;
      updateFields.fileSize = convertedSize;
      console.log('🔄 Incluyendo datos del PDF convertido en actualización');
    }

    // Si es aprobación, la versión se calculará después, así que actualizamos sin versión primero
    // Luego actualizaremos con la versión correcta después de calcularla
    if (!isAprobando) {
      console.log('🔄 Actualizando documento en uploadedDocuments:', docId, updateFields);
      console.log('🔄 Tipo de operación:', { isAprobando, isAjustandoFecha, tipo });
      console.log('🔄 Estado que se asignará:', updateFields.status);
      
      await updateDoc(doc(db, uploadedDocumentsPath, docId), updateFields);
      console.log('✅ Documento actualizado en uploadedDocuments exitosamente');
    } else {
      // Para aprobaciones, actualizamos solo el estado primero (sin versión)
      // La versión se actualizará después cuando se calcule
      console.log('🔄 Actualizando documento en uploadedDocuments (solo estado, versión se calculará después):', docId);
      await updateDoc(doc(db, uploadedDocumentsPath, docId), updateFields);
      console.log('✅ Documento actualizado en uploadedDocuments (estado)');
    }
    
    // Verificar que la actualización se aplicó
    const verifySnap = await getDoc(doc(db, uploadedDocumentsPath, docId));
    if (verifySnap.exists()) {
      const updatedData = verifySnap.data();
      console.log('✅ Verificación post-actualización:', {
        docId,
        status: updatedData.status,
        reviewedAt: updatedData.reviewedAt,
        reviewedBy: updatedData.reviewedBy
      });
    } else {
      console.error('❌ Documento no encontrado después de actualización:', docId);
    }

    // Solo actualizar la lista local si NO es aprobación (para evitar problemas con conversión)
    if (!isAprobando) {
      setDocuments(prev =>
        isAjustandoFecha
          ? prev.map(doc => doc.id === docId ? { ...doc, ...updateFields, reviewedAt: new Date() } : doc)
          : isPoniendoEnProceso
          ? prev.map(doc => doc.id === docId ? { ...doc, ...updateFields, reviewedAt: new Date() } : doc)
          : prev.filter(doc => doc.id !== docId) // Remover documentos rechazados
      );
    }

    if (isAprobando && data) {
      console.log('handleApproveOrReject: Iniciando proceso de aprobación.');
      
      // No importa de dónde viene (pendientes, en proceso, historial)
      // El sistema busca en approvedDocuments y calcula la nueva versión correctamente
      // usando campos estables (entityId + requiredDocumentId)
      
      const companyId = data.companyId || forcedCompanyId;
      if (!companyId) {
        console.warn("❌ No se puede copiar a library: companyId faltante");
        return;
      }

      let documentType = data.documentType;
      if (!documentType && data.requiredDocumentId) {
        // Usar la ruta multi-tenant correcta
        const tenantCollectionPath = 'requiredDocuments';
        const requiredSnap = await getDoc(doc(db, tenantCollectionPath, data.requiredDocumentId));
        if (requiredSnap.exists()) {
          documentType = requiredSnap.data().documentType || 'company';
        }
      }

      const entityType = data.entityType || documentType || 'company';
      const entityName = data.entityName || (
        entityType === 'vehicle' ? 'Vehículo desconocido' :
        entityType === 'employee' ? 'Empleado desconocido' :
        'Empresa'
      );
      // Calcular entityId de forma consistente (usado para búsqueda de versiones)
      const entityId = data.entityId || companyId;
      const requiredDocumentId = data.requiredDocumentId || '';

      const now = Timestamp.now();
      // Usar la ruta multi-tenant correcta
      const companiesPath = getTenantCollectionPath('companies');
      const companySnap = await getDoc(doc(db, companiesPath, companyId));
      const companyName = companySnap.exists()
        ? companySnap.data().name || companySnap.data().companyName || 'Empresa sin nombre'
        : 'Empresa sin nombre';

  let fileExtension = data.fileName?.split('.').pop() || data.fileType?.split('/').pop() || 'pdf';
  let safeFileName = cleanFileName(data.fileName || data.documentName || `documento-${Date.now()}.${fileExtension}`);
  let fileURL = data.fileURL;
  let fileType = data.fileType;
  let size = data.size || 0;

      // Conversión si es imagen - usar modo rápido para aprobaciones
      if (fileType?.startsWith('image/')) {
        console.log('handleApproveOrReject: Detectada imagen. Iniciando conversión rápida a PDF.');
        try {
          const conversionUrl = `${import.meta.env.VITE_API_URL}/api/convert-image/from-url`;
          console.log('[handleApproveOrReject] Llamando a API de conversión rápida:', conversionUrl, 'con fileURL:', fileURL);
          const response = await axios.post(conversionUrl, {
            imageUrl: fileURL,
            fastMode: true // Usar modo rápido para aprobaciones
          }, {
            responseType: 'blob'
          });

          console.log('[handleApproveOrReject] Respuesta de la API de conversión:', response);
          if (response.data.type === 'application/pdf') {
            const pdfBlob = response.data;
            console.log('[handleApproveOrReject] Blob PDF recibido:', pdfBlob);
            // Usar nombre original sin procesar (sin timestamp)
            const originalName = data.name || data.documentName || 'documento';
            const cleanOriginalName = originalName.replace(/\.[^/.]+$/, ''); // Solo quitar extensión
            const sanitizedName = `${cleanOriginalName}.pdf`;
            const pdfFile = new File([pdfBlob], sanitizedName, { type: 'application/pdf' });
            console.log('[handleApproveOrReject] File PDF construido:', pdfFile);

            // Subir PDF convertido directamente sin crear nuevo documento
            let uploadResult;
            try {
              const formData = new FormData();
              formData.append("file", pdfFile);
              formData.append("fileName", sanitizedName);
              formData.append("folder", `empresas/${companyId}`);
              
              const token = await auth.currentUser.getIdToken();
              const uploadResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/upload`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`
                },
                body: formData
              });
              
              if (!uploadResponse.ok) {
                throw new Error(`Error ${uploadResponse.status}: ${uploadResponse.statusText}`);
              }
              
              uploadResult = await uploadResponse.json();
              console.log('[handleApproveOrReject] PDF convertido subido:', uploadResult);
            } catch (uploadError) {
              console.error('❌ Error subiendo PDF convertido:', uploadError);
              setToastMessage(`Error subiendo el PDF convertido: ${uploadError.message}`);
              setToastOpen(true);
              return;
            }

            if (uploadResult?.url) {
              // Guardar datos del PDF convertido para actualizar el documento existente
              convertedFileURL = uploadResult.url;
              convertedFileName = sanitizedName;
              convertedFileType = 'application/pdf';
              convertedSize = pdfFile.size;
              
              console.log('✅ Imagen convertida a PDF, subida y URL actualizada.');
            } else {
              console.warn('⚠️ Falló la subida del PDF convertido.', uploadResult);
              setToastMessage('Falló la subida del PDF convertido. Intente nuevamente o contacte soporte.');
              setToastOpen(true);
              return;
            }
          } else {
            console.warn('⚠️ La API de conversión no devolvió un PDF.', response?.data || 'No response data');
            setToastMessage('La conversión no devolvió un PDF válido.');
            setToastOpen(true);
            return;
          }
        } catch (convertError) {
          console.error('❌ Error al convertir imagen a PDF:', convertError);
          setToastMessage(`Error al convertir imagen a PDF: ${convertError.message}`);
          setToastOpen(true);
          return;
        }
      }
      
      // Consultar versión máxima existente en approvedDocuments para evitar saltarse versiones
      // IMPORTANTE: Ignorar la versión del documento actual porque puede tener subversión
      // Solo buscar en approvedDocuments para determinar la siguiente versión
      // Usar campos estables: entityId + requiredDocumentId (no entityName + name que pueden cambiar)
      const approvedDocumentsPath = getTenantCollectionPath('approvedDocuments');
      const documentClientId = data.clientId || null;
      // entityId y requiredDocumentId ya están calculados arriba
      
      // Buscar documentos existentes usando campos estables (entityId + requiredDocumentId)
      // Esto asegura encontrar todas las versiones del mismo documento, incluso si name o entityName cambian
      const existingDocsQuery = query(
        collection(db, approvedDocumentsPath),
        where('companyId', '==', companyId),
        where('entityId', '==', entityId),
        where('requiredDocumentId', '==', requiredDocumentId)
      );
      
      const existingDocsSnapshot = await getDocs(existingDocsQuery);
      let maxVersion = 0;
      
      if (!existingDocsSnapshot.empty) {
        existingDocsSnapshot.docs.forEach(doc => {
          const docData = doc.data();
          const docClientId = docData.clientId || null;
          
          // IMPORTANTE: Solo considerar documentos con el mismo clientId
          // Esto evita que documentos de diferentes clientes afecten el versionado
          if (docClientId === documentClientId) {
            // Usar versionNumber si existe, sino version, sino 0
            const docVersion = docData.versionNumber || docData.version || 0;
            if (docVersion > maxVersion) {
              maxVersion = docVersion;
            }
          }
        });
      }
      
      // SOLUCIÓN AL DELAY DE INDEXACIÓN: Hacer búsqueda adicional más amplia para encontrar documentos recién creados
      // Algunos documentos pueden no estar indexados aún en la búsqueda por requiredDocumentId
      // SIEMPRE hacer esta búsqueda adicional para asegurar que encontramos todos los documentos
      try {
        // IMPORTANTE: Manejar el caso cuando documentClientId es null (empresa principal)
        // Para null, buscar documentos sin filtro de clientId y filtrar en memoria
        let altDocsQuery;
        if (documentClientId === null) {
          // Para empresa principal: buscar documentos sin filtro de clientId
          altDocsQuery = query(
            collection(db, approvedDocumentsPath),
            where('companyId', '==', companyId),
            where('entityId', '==', entityId)
          );
        } else {
          // Para clientes: buscar documentos con el clientId específico
          altDocsQuery = query(
            collection(db, approvedDocumentsPath),
            where('companyId', '==', companyId),
            where('entityId', '==', entityId),
            where('clientId', '==', documentClientId)
          );
        }
        const altDocsSnapshot = await getDocs(altDocsQuery);
        
        console.log(`   🔍 Búsqueda adicional (sin requiredDocumentId): ${altDocsSnapshot.docs.length} documentos encontrados`);
        
        // Filtrar en memoria: solo documentos con el mismo requiredDocumentId Y clientId
        altDocsSnapshot.docs.forEach(doc => {
          const docData = doc.data();
          const docRequiredDocumentId = docData.requiredDocumentId || '';
          const docClientId = docData.clientId || null;
          
          // Solo considerar si tiene el mismo requiredDocumentId Y clientId
          if (docRequiredDocumentId === requiredDocumentId && docClientId === documentClientId) {
            const docVersion = docData.versionNumber || docData.version || 0;
            if (docVersion > maxVersion) {
              maxVersion = docVersion;
              console.log(`   📈 Versión actualizada desde búsqueda adicional: ${docVersion} (docId: ${doc.id})`);
            }
          }
        });
      } catch (error) {
        console.warn('⚠️ Error en búsqueda adicional:', error);
      }
      
      // La nueva versión será la máxima encontrada + 1
      // Esto asegura que siempre se cree una nueva versión, nunca se reemplace
      const newVersion = maxVersion + 1;
      
      const documentName = data.name || data.documentName || 'Sin nombre';
      console.log(`🔢 Consulta de versiones para aprobación - Documento: ${documentName}`);
      console.log(`   🔑 Criterios de búsqueda: companyId=${companyId}, entityId=${entityId}, requiredDocumentId=${requiredDocumentId || 'vacío'}`);
      console.log(`   📊 Total documentos encontrados en approvedDocuments: ${existingDocsSnapshot.docs.length}`);
      console.log(`   🔍 Filtrado por clientId (${documentClientId || 'null'}):`);
      existingDocsSnapshot.docs.forEach((doc, idx) => {
        const docData = doc.data();
        const docClientId = docData.clientId || null;
        const docVersion = docData.versionNumber || docData.version || 0;
        const docName = docData.name || docData.documentName || 'Sin nombre';
        console.log(`      Doc ${idx + 1}: name="${docName}", clientId=${docClientId || 'null'}, version=${docVersion}, match=${docClientId === documentClientId ? '✅' : '❌'}`);
      });
      console.log(`   📈 Versión máxima encontrada (clientId: ${documentClientId || 'null'}): ${maxVersion}`);
      console.log(`   ✨ Nueva versión a crear: ${newVersion}`);
      console.log(`   ⚠️ Versión del documento actual (ignorada): ${data.versionNumber || data.version || 'N/A'}`);
      console.log(`   📝 Estado del documento actual: ${data.status || 'N/A'}`);
      
      // IMPORTANTE: Actualizar la versión en uploadedDocuments INMEDIATAMENTE después de calcularla
      // Esto asegura que HistorialPage muestre la versión correcta
      try {
        console.log(`🔄 [ANTES DE COPIAR] Actualizando versión en uploadedDocuments: docId=${docId}, newVersion=${newVersion}`);
        await updateDoc(doc(db, uploadedDocumentsPath, docId), {
          version: newVersion,
          versionNumber: newVersion,
          subversion: 0,
          versionString: `${newVersion}.0`
        });
        console.log(`✅ [ANTES DE COPIAR] Versión actualizada en uploadedDocuments: ${newVersion}.0`);
      } catch (error) {
        console.error(`❌ Error actualizando versión en uploadedDocuments (antes de copiar):`, error);
      }

      const versionId = crypto.randomUUID();
      const versionData = {
        versionId,
        versionNumber: newVersion,
        versionTimestamp: now,
        versionAuthor: adminEmail,
        versionAction: 'Aprobación',
        versionComment: comment || 'Aprobado sin comentario',
        previousVersionId: data.versionId || null
      };

      // Usar la ruta multi-tenant correcta
      // IMPORTANTE: Preservar entityId, requiredDocumentId y clientId explícitamente para búsquedas futuras
      const newDocRef = await addDoc(collection(db, approvedDocumentsPath), {
        ...data,
        ...versionData,
        companyId,
        clientId: documentClientId, // ✅ Preservar clientId explícitamente (puede ser null para empresa principal)
        version: newVersion,
        subversion: 0,
        versionString: `${newVersion}.0`,
        companyName,
        status: 'Aprobado',
        expirationDate: createSafeTimestamp(expirationDate),
        reviewedAt: now,
        reviewedBy: adminEmail,
        uploadedAt: data.uploadedAt || now,
        uploadedBy: data.uploadedBy || 'Desconocido',
        entityType,
        entityId: entityId, // Usar el entityId calculado (data.entityId || companyId)
        entityName,
        requiredDocumentId: requiredDocumentId || data.requiredDocumentId || '', // Preservar requiredDocumentId explícitamente
        fileName: convertedFileName || safeFileName,
        fileURL: convertedFileURL || fileURL || '',
        name: data.name || data.documentName || 'Sin nombre',
        documentName: data.documentName || data.name || 'Sin nombre',
        originalName: data.name || data.documentName || 'Sin nombre',
        fileType: convertedFileType || fileType || `application/${fileExtension}`,
        originalId: docId,
        copiedAt: now,
        size: convertedSize || size || data.size || 0,
        tags: data.tags || [],
        versionHistory: [
          ...(data.versionHistory || []),
          {
            versionId,
            timestamp: versionData.versionTimestamp,
            action: 'approved',
            by: adminEmail,
            expirationDate: createSafeTimestamp(expirationDate)
          }
        ]
      });

      console.log("✅ Documento copiado a colección global: approvedDocuments");
      console.log(`   📝 ID del nuevo documento: ${newDocRef.id}`);
      console.log(`   🔑 Campos clave: entityId=${entityId}, requiredDocumentId=${requiredDocumentId || 'vacío'}, clientId=${documentClientId || 'null'}, version=${newVersion}`);
      
      // VERIFICACIÓN CRÍTICA: Leer el documento recién creado para confirmar que se guardó correctamente
      // Esto ayuda a diagnosticar problemas de indexación
      try {
        const verifyDoc = await getDoc(newDocRef);
        if (verifyDoc.exists()) {
          const verifyData = verifyDoc.data();
          console.log(`   ✅ Verificación: Documento guardado correctamente`);
          console.log(`      - entityId: ${verifyData.entityId} ${verifyData.entityId === entityId ? '✅' : '❌'} (esperado: ${entityId})`);
          console.log(`      - requiredDocumentId: ${verifyData.requiredDocumentId || 'vacío'} ${verifyData.requiredDocumentId === requiredDocumentId ? '✅' : '❌'} (esperado: ${requiredDocumentId || 'vacío'})`);
          console.log(`      - versionNumber: ${verifyData.versionNumber} ${verifyData.versionNumber === newVersion ? '✅' : '❌'} (esperado: ${newVersion})`);
          console.log(`      - clientId: ${verifyData.clientId || 'null'} ${verifyData.clientId === documentClientId ? '✅' : '❌'} (esperado: ${documentClientId || 'null'})`);
          
          // Si los campos no coinciden, hay un problema grave
          if (verifyData.entityId !== entityId || verifyData.requiredDocumentId !== requiredDocumentId) {
            console.error(`   ❌ ERROR CRÍTICO: Campos no coinciden!`);
            console.error(`      entityId: esperado=${entityId}, encontrado=${verifyData.entityId}`);
            console.error(`      requiredDocumentId: esperado=${requiredDocumentId || 'vacío'}, encontrado=${verifyData.requiredDocumentId || 'vacío'}`);
          }
        } else {
          console.error(`   ❌ ERROR CRÍTICO: Documento no encontrado después de crearlo!`);
        }
      } catch (error) {
        console.error(`   ❌ Error verificando documento recién creado:`, error);
      }
      
      // IMPORTANTE: Actualizar también la versión en uploadedDocuments con la nueva versión calculada
      // Esto asegura que HistorialPage muestre la versión correcta
      try {
        console.log(`🔄 Actualizando versión en uploadedDocuments: docId=${docId}, newVersion=${newVersion}, uploadedDocumentsPath=${uploadedDocumentsPath}`);
        await updateDoc(doc(db, uploadedDocumentsPath, docId), {
          version: newVersion,
          versionNumber: newVersion,
          subversion: 0,
          versionString: `${newVersion}.0`
        });
        console.log(`✅ Versión actualizada en uploadedDocuments: ${newVersion}.0`);
      } catch (error) {
        console.error(`❌ Error actualizando versión en uploadedDocuments:`, error);
        // No lanzar error, solo loguear para no romper el flujo
      }
      
      // El estado ahora se preserva correctamente en el backend
      
      // Actualizar lista local DESPUÉS de que todo el proceso de aprobación termine exitosamente
      setDocuments(prev => prev.filter(doc => doc.id !== docId));
    }

    if (isAprobando && data?.requiredDocumentId) {
      console.log('🔄 Llamando a approveDocument para requiredDocumentId:', data.requiredDocumentId);
      await approveDocument({ docId: data.requiredDocumentId, expirationDate, user });
      console.log('✅ approveDocument completado');
    } else if (!isAprobando && !isPoniendoEnProceso && data?.requiredDocumentId) {
      // SOLO para rechazos, NO para "en proceso"
      // IMPORTANTE: NO eliminar documentos aprobados al rechazar
      // Los documentos aprobados deben mantenerse en approvedDocuments para el historial
      await rejectDocument({ docId: data.requiredDocumentId, user, reason: comment, expirationDate });
      console.log("✅ Documento rechazado - Las versiones aprobadas se mantienen en approvedDocuments para el historial");
    }

    // Actualización de lista local ya se maneja arriba para cada caso específico

    // Solo disparar refresh para rechazos (no para aprobaciones)
    if (!isAprobando && !isAjustandoFecha) {
      window.dispatchEvent(new Event('companyListShouldRefresh'));
    }

    setExpandedRow?.(null);
    setDialogAccion?.(null);
    setToastMessage(`Documento ${isAprobando ? 'aprobado' : isAjustandoFecha ? 'fecha actualizada' : isPoniendoEnProceso ? 'puesto en proceso' : 'rechazado'} correctamente`);
    setToastOpen(true);
    
    // Disparar refresco de todas las pestañas después de completar la operación
    if (triggerRefresh && typeof triggerRefresh === 'function') {
      triggerRefresh('historial');
      triggerRefresh('dashboard');
      triggerRefresh('library');
      triggerRefresh('approved');
      triggerRefresh('pendientes');
    }

    // Confirmación y envío de email SOLO si es rechazo
    console.log('🔍 Verificando condiciones para envío de email:', {
      isAprobando,
      isAjustandoFecha,
      hasRealEmail: !!data?.realemail,
      realEmail: data?.realemail,
      uploadedByEmail: data?.uploadedByEmail,
      userEmail: data?.userEmail,
      email: data?.email,
      dataKeys: data ? Object.keys(data) : 'data is null',
      allData: data
    });
    
    // Buscar el email en diferentes campos posibles
    const emailToNotify = data?.realemail || data?.uploadedByEmail || data?.userEmail || data?.email;
    
    // Solo mostrar confirm de email para rechazos (no para aprobar, ajustar fecha o poner en proceso)
    if (!isAprobando && !isAjustandoFecha && !isPoniendoEnProceso && emailToNotify) {
      console.log('✅ Condiciones cumplidas, mostrando confirmación de email');
      // eslint-disable-next-line no-alert
      if (window.confirm('¿Desea notificar por email al responsable del rechazo?')) {
        console.log('✅ Usuario confirmó envío de email');
        try {
          await enviarEmailDocumento({
            doc: { ...data, realemail: emailToNotify },
            tipo: 'rechazar',
            comentario: comment,
            fechaVencimiento: null,
          });
          setToastMessage('📧 Email de rechazo enviado correctamente.');
        } catch (err) {
          console.error('❌ Error al enviar email de rechazo:', err);
          setToastMessage('❌ Error al enviar email de rechazo.');
        }
        setToastOpen(true);
      } else {
        console.log('❌ Usuario canceló envío de email');
      }
    } else {
      console.log('❌ Condiciones no cumplidas para envío de email - Email encontrado:', emailToNotify);
    }

  } catch (error) {
    console.error(`Error al ${isAprobando ? 'aprobar' : isAjustandoFecha ? 'ajustar fecha' : isPoniendoEnProceso ? 'poner en proceso' : 'rechazar'} documento:`, error);
    setToastMessage(`Error al ${isAprobando ? 'aprobar' : isAjustandoFecha ? 'ajustar fecha' : isPoniendoEnProceso ? 'poner en proceso' : 'rechazar'} documento`);
    setToastOpen(true);
  }
};

export default handleApproveOrReject;
