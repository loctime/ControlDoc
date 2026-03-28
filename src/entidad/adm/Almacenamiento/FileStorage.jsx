"use client"

import React, { useEffect, useState } from "react"
import { Box, Typography, CircularProgress } from "@mui/material"
import { collection, doc, setDoc, getDocs, onSnapshot, deleteDoc, getDoc } from "firebase/firestore"
import { auth, db } from "../../../config/firebaseconfig"
import { useAuth } from '../../../context/AuthContext'

// Componentes reutilizables
import Sidebar from "./Sidebar"
import CreateFolderDialog from "./CreateFolderDialog"
import FileFilterBar from "./FileFilterBar"
import FileGrid from "./FileGrid"
import FileList from "./FileList"
import UploadDialog from "./UploadDialog"
import PreviewDialog from "./PreviewDialog"
import FileMenu from "./FileMenu"

// Iconos para renderizado dinámico
import {
  InsertDriveFile,
  PictureAsPdf,
  Image,
  Description,
} from "@mui/icons-material"

import { getTenantCollectionPath } from '../../../utils/tenantUtils';

// Constantes para los iconos de archivos
const fileTypeIcons = {
  "application/pdf": <PictureAsPdf color="error" />,
  "image/png": <Image color="primary" />,
  "image/jpeg": <Image color="primary" />,
  "image/jpg": <Image color="primary" />,
  "image/gif": <Image color="primary" />,
  "application/msword": <Description style={{ color: "#2b579a" }} />,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": <Description style={{ color: "#2b579a" }} />,
  "application/vnd.ms-excel": <Description style={{ color: "#217346" }} />,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": <Description style={{ color: "#217346" }} />,
  "application/vnd.ms-powerpoint": <Description style={{ color: "#d24726" }} />,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": <Description style={{ color: "#d24726" }} />,
};

const renderFileIcon = (fileType = "", size = 24) => {
  const icon = fileTypeIcons[fileType] || <InsertDriveFile color="disabled" />;
  return React.cloneElement(icon, { style: { fontSize: size } });
};

const getFileExtension = (filename) => {
  if (!filename) return "default"
  const parts = String(filename).split(".")
  return parts.length > 1 ? parts.pop().toLowerCase() : "default"
}

const formatDate = (dateString) => {
  if (!dateString) return "-"
  const date = new Date(dateString)
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export default function FileStorage() {
  const { user, loading: authLoading } = useAuth();
  const normalizedEmail = (user?.realemail || user?.email || '').trim().toLowerCase();

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const openCreateFolder = () => setCreateFolderOpen(true);
  const closeCreateFolder = () => setCreateFolderOpen(false);

  // Handler para el botón Nueva carpeta
  const onCreateFolderClick = openCreateFolder;

  // Nuevo handler para crear carpeta con nombre y visibilidad
  const handleCreateFolder = async (nombre, visibilidad) => {
    try {
      const rawName = nombre.trim();
      const name = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      if (!name) return alert("Nombre vacío");
      
      const user = auth.currentUser;
      const folderId = `${user.email}_${name}`;
      
      // Usar la ruta multi-tenant correcta
      const adminFoldersPath = getTenantCollectionPath('adminFolders');
      console.log("📁 [CreateFolder] Creando carpeta en ruta:", adminFoldersPath, "ID:", folderId);
      
      const folderRef = doc(db, adminFoldersPath, folderId);
      const snapshot = await getDoc(folderRef);
      if (snapshot.exists()) return alert("Ya existe esa carpeta");
      
      // Usar siempre el realemail en minúsculas y sin espacios
      const realEmail = (user.realemail || user.email || '').trim().toLowerCase();
      
      const folderData = {
        folderTitle: rawName,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        createdByEmail: user.email,
        createdByName: user.displayName,
        visibility: visibilidad,
        permissions: ["max"],
        folderId: folderId,
        folderName: name,
        ownerEmail: realEmail,
      };
      
      console.log("📁 [CreateFolder] Datos de la carpeta:", folderData);
      await setDoc(folderRef, folderData);
      console.log("✅ [CreateFolder] Carpeta creada exitosamente");
      
      setCurrentFolder(folderId);
      setNewFolderName("");
    } catch (error) {
      console.error("❌ [CreateFolder] Error creando carpeta:", error);
      alert("Error al crear la carpeta: " + error.message);
    }
  };

  const [folders, setFolders] = useState([])
  const [currentFolder, setCurrentFolder] = useState("general")
  const [newFolderName, setNewFolderName] = useState("")
  const [filesByFolder, setFilesByFolder] = useState({})
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [massUploadDialogOpen, setMassUploadDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid")
  const [filterType, setFilterType] = useState("todos")
  const [searchQuery, setSearchQuery] = useState("")
  const [anchorEl, setAnchorEl] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Asegura que la carpeta 'logos' exista en Firestore
  useEffect(() => {
    const crearCarpetaLogos = async () => {
      // Usar la ruta multi-tenant correcta
      const adminFoldersPath = getTenantCollectionPath('adminFolders');
      const folderRef = doc(db, adminFoldersPath, `logos`);
      const snapshot = await getDoc(folderRef);
      if (!snapshot.exists()) {
        await setDoc(folderRef, {
          folderTitle: "Logos",
          visibility: "public",
          createdBy: "system",
          createdByEmail: "system@controldoc.app",
          createdAt: new Date().toISOString(),
          permissions: ["admin", "user"],
        });
        console.log("✅ Carpeta 'logos' creada");
      }
    };
    crearCarpetaLogos();
  }, []);

  // Carga inicial: solo carpetas del usuario actual (ownerEmail/createdBy), logos (sistema) o públicas
  useEffect(() => {
    if (!normalizedEmail && !user?.uid) return;
    const adminFoldersPath = getTenantCollectionPath('adminFolders');
    const foldersRef = collection(db, adminFoldersPath);
    const unsubscribe = onSnapshot(foldersRef, (snapshot) => {
      const allFolders = [];
      snapshot.forEach((doc) => {
        allFolders.push({ id: doc.id, ...doc.data() });
      });
      const isMine = (folder) => {
        if (folder.id === 'logos') return true;
        if (folder.visibility === 'public') return true;
        if (folder.createdBy === user?.uid) return true;
        if (folder.ownerEmail && normalizedEmail && folder.ownerEmail === normalizedEmail) return true;
        return false;
      };
      const foldersData = allFolders.filter(isMine);
      const filesData = { general: [] };
      foldersData.forEach((f) => { filesData[f.id] = []; });

      setFolders(foldersData);
      setFilesByFolder(filesData);

      foldersData.forEach((folder) => {
        const filesRef = collection(db, `${adminFoldersPath}/${folder.id}/files`);
        getDocs(filesRef).then((snap) => {
          const folderFiles = [];
          snap.forEach((doc) => folderFiles.push(doc.data()));
          setFilesByFolder((prev) => ({ ...prev, [folder.id]: folderFiles }));
        });
      });
      setLoading(false);
    }, (error) => {
      console.error("❌ [FileStorage] Error en snapshot de carpetas:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid, normalizedEmail]);

  const handleUploadComplete = async (result, index = 0, total = 1, baseNameMap = {}) => {
    const resultsArray = Array.isArray(result) ? result : [result];
  
    for (let i = 0; i < resultsArray.length; i++) {
      const item = resultsArray[i];
      if (!item?.fileURL) continue;
  
      const folderToUse = item.folder || currentFolder;
      const user = auth.currentUser;
  
      // --- Lógica para nombre único tipo "nombre 1", "nombre 2", ... ---
      let baseName = item.fileName ? item.fileName.replace(/(\.[^.]*)$/, '') : 'archivo';
      let ext = item.fileName ? item.fileName.match(/\.[^.]+$/) : null;
      ext = ext ? ext[0] : '';
      if (!baseNameMap[folderToUse]) baseNameMap[folderToUse] = {};
      if (!baseNameMap[folderToUse][baseName]) baseNameMap[folderToUse][baseName] = 1;
      else baseNameMap[folderToUse][baseName]++;
      const numero = baseNameMap[folderToUse][baseName];
      const nombreFinal = `${baseName} ${numero}${ext}`;
      console.log(`[FileStorage] Asignando nombre único: ${nombreFinal}`);
  
      const fileData = {
        fileId: item.fileId || Date.now().toString() + '_' + Math.random().toString(36).slice(2),
        fileName: nombreFinal,
        fileDescription: item.fileDescription || "",
        fileURL: item.fileURL,
        fileType: item.fileType || "application/octet-stream",
        size: item.size || 0,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user?.uid || "unknown",
        uploadedByEmail: user?.email || "",
        uploadedByName: user?.displayName || "",
        folderPath: folderToUse,
        documentCategory: item.documentCategory || "",
        entityType: item.entityType || "",
        entityId: item.entityId || "",
        entityName: item.entityName || "",
        visibility: item.visibility || "private",
        permissions: item.permissions || ["max"],
        versionNumber: item.versionNumber || 1,
        versionHistory: item.versionHistory || [],
        analyzed: item.analyzed || false,
        analysisData: item.analysisData || {},
      };
  
      try {
        // Usar la ruta multi-tenant correcta
        const adminFoldersPath = getTenantCollectionPath('adminFolders');
        await setDoc(doc(db, `${adminFoldersPath}/${folderToUse}/files`, fileData.fileId), fileData);
        setFilesByFolder((prev) => ({
          ...prev,
          [folderToUse]: [...(prev[folderToUse] || []), fileData],
        }));
      } catch (e) {
        console.error("Error subiendo a Firestore:", e);
      }
    }
    setUploadDialogOpen(false);
  };

  const handleMassUploadComplete = async (results) => {
    // --- Lógica para numerar todos los archivos subidos masivamente ---
    const baseNameMap = {};
    try {
      for (let i = 0; i < results.length; i++) {
        await handleUploadComplete(results[i], i, results.length, baseNameMap);
      }
    } catch (error) {
      console.error('Error en subida masiva:', error);
    }
  };

  const handleDeleteFile = async (file) => {
    if (!file?.fileId) return
    // Usar la ruta multi-tenant correcta
    const adminFoldersPath = getTenantCollectionPath('adminFolders');
    await deleteDoc(doc(db, `${adminFoldersPath}/${file.folder}/files`, file.fileId))
    setFilesByFolder((prev) => ({
      ...prev,
      [file.folder]: prev[file.folder].filter((f) => f.fileId !== file.fileId),
    }))
    handleCloseMenu()
  }


  const handlePreview = (file) => {
    setPreviewFile(file)
    setPreviewOpen(true)
    handleCloseMenu()
  }

  const handleOpenMenu = (e, file) => {
    setAnchorEl(e.currentTarget)
    setSelectedFile(file)
  }

  const handleCloseMenu = () => {
    setAnchorEl(null)
    setSelectedFile(null)
  }

  const filterFilesByType = (file) => {
    if (filterType === "todos") return true
    
    // Mapeo de tipos de filtro a tipos MIME
    const mimeTypeMap = {
      word: [
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ],
      excel: [
        "application/vnd.ms-excel", 
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ],
      pdf: ["application/pdf"],
      imagenes: [
        "image/jpeg",
        "image/jpg", 
        "image/png",
        "image/gif",
        "image/webp",
        "image/bmp",
        "image/tiff"
      ],
      zip: [
        "application/zip",
        "application/x-zip-compressed",
        "application/x-rar-compressed",
        "application/x-7z-compressed"
      ]
    }
    
    // Si no hay tipos MIME definidos para el filtro, usar extensiones como fallback
    const extMap = {
      word: ["doc", "docx"],
      excel: ["xls", "xlsx"],
      pdf: ["pdf"],
      imagenes: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff"],
      zip: ["zip", "rar", "7z"]
    }
    
    // Priorizar filtrado por tipo MIME si está disponible
    if (file.fileType && mimeTypeMap[filterType]) {
      return mimeTypeMap[filterType].includes(file.fileType);
    }
    
    // Fallback a extensión de archivo
    if (extMap[filterType]) {
      const ext = getFileExtension(file.fileName);
      return extMap[filterType].includes(ext);
    }
    return false
  }

  const filterFilesBySearch = (file) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return file.fileName?.toLowerCase().includes(q) || file.description?.toLowerCase().includes(q)
  }

  const visibleFiles = (currentFolder === "*"
    ? Object.entries(filesByFolder).flatMap(([folder, files]) => files.map((f) => ({ ...f, folder })))
    : (filesByFolder[currentFolder] || []).map((f) => ({ ...f, folder: currentFolder }))
  )
    .filter(Boolean)
    .filter(filterFilesByType)
    .filter(filterFilesBySearch)

  // Las carpetas ya vienen filtradas por usuario en el useEffect; no mostrar más que las cargadas
  const filteredFolders = folders;

  // Handler para eliminar carpeta privada
  const handleDeleteFolder = async (folder) => {
    if (!window.confirm(`¿Eliminar carpeta "${folder.folderTitle || folder.folderName || folder.id}" y todos sus archivos? Esta acción no se puede deshacer.`)) return;
    try {
      // 1. Eliminar todos los archivos de la carpeta en Firestore y Backblaze
      const adminFoldersPath = getTenantCollectionPath('adminFolders');
      const filesRef = collection(db, `${adminFoldersPath}/${folder.id}/files`);
      const filesSnap = await getDocs(filesRef);
      const { deleteFile } = await import("../../../utils/FileUploadService");
      const deletePromises = [];
      filesSnap.forEach(docSnap => {
        const file = docSnap.data();
        if (file.fileId || file.fileURL) deletePromises.push(deleteFile({ fileId: file.fileId, fileURL: file.fileURL }));
        deletePromises.push(deleteDoc(doc(db, `${adminFoldersPath}/${folder.id}/files`, docSnap.id)));
      });
              // 2. Eliminar la carpeta en Firestore
        deletePromises.push(deleteDoc(doc(db, adminFoldersPath, folder.id)));
      await Promise.all(deletePromises);
      // 3. Actualizar estado local si es necesario (opcional, ya que onSnapshot lo hará)
    } catch (err) {
      alert("Error al eliminar carpeta: " + (err?.message || err));
      console.error("Error eliminando carpeta:", err);
    }
  };

  if (authLoading || !user) {
    return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Cargando usuario...</Box>;
  }

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <Sidebar
        currentFolder={currentFolder}
        setCurrentFolder={setCurrentFolder}
        folders={filteredFolders}
        onUploadClick={() => setUploadDialogOpen(true)}
        onCreateFolderClick={onCreateFolderClick}
        onDeleteFolder={handleDeleteFolder}
        normalizedEmail={normalizedEmail}
        userRole={user?.role}
      />

      <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: "auto" }}>
        <FileFilterBar
          filterType={filterType}
          setFilterType={setFilterType}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onMassUploadClick={() => setMassUploadDialogOpen(true)}
          onCreateFolderClick={onCreateFolderClick}
        />

        <Typography variant="h5" sx={{ mb: 2, color: "var(--page-background-text)" }}>
          {currentFolder === "*" ? "Todos los archivos" : `Archivos en ${currentFolder}`}
        </Typography>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
            <CircularProgress />
          </Box>
        ) : visibleFiles.length === 0 ? (
          <Typography align="center" sx={{ mt: 4, color: "var(--page-background-text)", opacity: 0.7 }}>
            No hay archivos
          </Typography>
        ) : viewMode === "grid" ? (
          <FileGrid
            visibleFiles={visibleFiles}
            handleOpenMenu={handleOpenMenu}
            onDeleteFiles={(files) => {
              // Manejar array de archivos a eliminar
              Promise.all(files.map(file => handleDeleteFile(file)))
                .catch(error => console.error('Error eliminando archivos:', error));
            }}
            onDeleteFile={handleDeleteFile}
            renderFileIcon={(file) => renderFileIcon(file.fileType, 64)}
            renderThumbnail={(file) => {
              const ext = getFileExtension(file.fileName)
              if (["jpg", "jpeg", "png", "gif"].includes(ext)) {
                return (
                  <Box sx={{ 
                    height: 140, 
                    position: 'relative',
                    backgroundColor: '#f5f5f5'
                  }}>
                    <img
                      src={file.fileURL}
                      alt={file.fileName}
                      style={{ 
                        objectFit: "cover", 
                        width: '100%',
                        height: '100%',
                        position: 'absolute'
                      }}
                      onError={(e) => {
                        console.error('Error cargando imagen:', file.fileURL)
                        e.target.style.display = 'none'
                      }}
                    />
                    <Box sx={{
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {renderFileIcon(file.fileType, 64)}
                    </Box>
                  </Box>
                )
              }
              return (
                <Box sx={{ 
                  height: 140, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  backgroundColor: "#f5f5f5" 
                }}>
                  {renderFileIcon(file.fileType, 64)}
                </Box>
              )
            }}
            formatDate={formatDate}
          />
        ) : (
          <FileList
            visibleFiles={visibleFiles}
            handleOpenMenu={handleOpenMenu}
            renderFileIcon={(file) => renderFileIcon(file.fileType)}
            formatDate={formatDate}
          />
        )}
      </Box>

      <FileMenu
        anchorEl={anchorEl}
        onClose={handleCloseMenu}
        file={selectedFile}
        onPreview={handlePreview}
        onDelete={handleDeleteFile}
      />

      <UploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        folders={folders}
        currentFolder={currentFolder}
        onFolderChange={setCurrentFolder}
        onCreateFolder={onCreateFolderClick}
        onUploadComplete={handleUploadComplete}
      />

      <UploadDialog
        open={massUploadDialogOpen}
        onClose={() => setMassUploadDialogOpen(false)}
        folders={folders}
        currentFolder={currentFolder}
        onFolderChange={setCurrentFolder}
        onCreateFolder={onCreateFolderClick}
        onUploadComplete={handleMassUploadComplete}
        multiple={true}
      />

      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        previewFile={previewFile}
      />

      <CreateFolderDialog
        open={createFolderOpen}
        onClose={closeCreateFolder}
        onCreate={handleCreateFolder}
      />
    </Box>
  )
}
