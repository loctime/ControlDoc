Claims del Sistema
allowedApps: Array de aplicaciones permitidas (['controlfile', 'controlaudit', 'controldoc'])
plans: Objeto con planes por app ({controlfile: 'pro', controlaudit: 'basic', controldoc: 'trial'})
Control de Acceso
✅ Middleware valida allowedApps contiene APP_CODE actual
✅ Reglas Firestore por userId (solo el propietario accede sus datos)
✅ Sistema de cuotas por plan de usuario
Integración ControlDoc
Listo para implementar - el sistema ya está preparado:
Configuración Requerida
Backend: Usar mismo backend con APP_CODE=controlfile
Claims: Asignar acceso usando script existente:
   npm run set-claims -- --email usuario@dominio \
     --apps controlfile,controldoc \
     --plans controlfile=pro;controldoc=trial

Flujo de Integración
Auth: Firebase Auth central compartido
SDK: Usar ControlFileClient existente
Datos: Carpeta raíz específica por app (GET /api/folders/root?name=ControlDoc)



APP_CODE=controlfile 

VITE_CONTROLFILE_BACKEND_URL=https://controlfile.onrender.com
VITE_CONTROLFILE_API_KEY=A
VITE_CONTROLFILE_AUTH_DOMAIN=c
VITE_CONTROLFILE_PROJECT_ID=con
VITE_CONTROLFILE_APP_ID=
VITE_CONTROLFILE_APP_DISPLAY_NAME=ControlDoc

Uso en frontend:

1) Conectar ControlFile y guardar archivo
```jsx
import SaveToControlFileButton from './src/components/common/SaveToControlFileButton';

<SaveToControlFileButton file={file} onSaved={(r) => console.log('Guardado en CF', r)} />
```

2) Guardar por URL (modo botón)
```jsx
import SaveToControlFileFromUrlButton from './src/components/common/SaveToControlFileFromUrlButton';

<SaveToControlFileFromUrlButton fileUrl={url} fileName="documento.pdf" />
```

3) Guardar por URL (modo icono - usado en DocumentTable)
```jsx
<SaveToControlFileFromUrlButton 
  fileUrl={doc.fileURL}
  fileName={doc.name}
  size="small"
  iconOnly
  disabled={!doc.fileURL}
/>
```

✅ Ya implementado en:
- src/entidad/adm/Library/DocumentTable.jsx (botón icono en columna de acciones)

🔧 Manejo de popup bloqueado:
- Si el navegador bloquea el popup de Google Auth, automáticamente usa redirect
- El usuario será redirigido a Google, autentica y vuelve
- La sesión se mantiene y puede continuar guardando archivos

📋 Flujo recomendado:
1. El usuario va a /profile
2. Conecta su cuenta de ControlFile en la sección "Integración con ControlFile"
3. Una vez conectado, puede usar los botones "Guardar en ControlFile" en toda la app

✅ Ya implementado en:
- src/entidad/adm/Library/DocumentTable.jsx (botón icono en columna de acciones)
- src/entidad/adm/Messages/AdminProfilePage.jsx (sección de conexión dedicada)

🔧 Solucionado:
- Error 500 en /api/folders/create arreglado usando /api/folders/root (que funciona correctamente)
- El endpoint /api/folders/root maneja automáticamente crear carpeta + pin en taskbar
- Persistencia de sesión: ahora usa browserLocalPersistence en lugar de browserSessionPersistence
- Auto-detección de sesión: verifica automáticamente si hay una sesión guardada al cargar la página

🎯 Nuevas funciones en /profile:
- Botón "Ir a ControlFile": abre https://files.controldoc.app/ con autenticación automática
- Botón "Desconectar": cierra la sesión de ControlFile sin afectar ControlDoc
- Auto-login: si está conectado, pasa el token para login automático en ControlFile
