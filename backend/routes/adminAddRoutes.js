// backend/routes/adminAddRoutes.js
import { Router } from "express"
import { db, auth } from "../firebaseconfig.js"
import { authenticateFirebaseUser } from "../middleware/authenticateFirebaseUser.js"
import { requireRole } from "../middleware/requireRole.js"
import { logAction } from "../utils/logAction.js"

const router = Router()

/**
 * Agrega un nuevo administrador al sistema.
 * Requiere autenticación y rol "max".
 * Crea usuario en Firebase Auth y en la colección "admins" del tenant.
 */
router.post(
  "/add-admin",
  authenticateFirebaseUser,
  requireRole("max"),
  async (req, res) => {
    const { displayName, realemail, adminTel, email, password, role } = req.body

    if (!displayName || !realemail || !adminTel || !email || !password) {
      return res.status(400).json({ error: "Faltan campos requeridos" })
    }

    // Roles unificados: max | admin
    const userRole = role === 'max' ? 'max' : 'admin';

    // Validación de longitud de contraseña (mínimo 6 caracteres requerido por Firebase)
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" })
    }

    // Validación de email real
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(realemail)) {
      return res.status(400).json({ error: "Email real no válido" })
    }

    // Validación simple de teléfono (mínimo 8 caracteres, solo números y + opcional)
    const telRegex = /^\+?\d{8,}$/
    if (!telRegex.test(adminTel)) {
      return res.status(400).json({ error: "Teléfono no válido (mínimo 8 dígitos)" })
    }

    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: "Tenant no resoluble en esta petición" });
      }
      // Log temporal: tenant y datos de creación
      console.log('[AdminAdd] tenantId:', tenantId, '| realemail:', realemail, '| role solicitado:', role);

      // Usar la ruta del tenant para usuarios: tenants/{tenantId}/users
      const tenantUsersPath = req.getTenantCollectionPath('users');
      
      // 1. Verifica duplicado realemail en el tenant
      const snapshot = await db.collection(tenantUsersPath)
        .where("realemail", "==", realemail).get()
      
      if (!snapshot.empty) {
        return res.status(409).json({ 
          error: "Ya existe un usuario con ese email real en este tenant" 
        })
      }

      // 2. Crear o verificar usuario en Firebase Auth
      let firebaseUser;
      let adminUid;
      
      try {
        // Intentar crear usuario en Firebase Auth
        firebaseUser = await auth.createUser({
          email: realemail,
          password: password,
          displayName: displayName
        });
        adminUid = firebaseUser.uid;
        console.log('[AdminAdd] Usuario creado en Firebase Auth | uid:', adminUid, '| realemail:', realemail);
      } catch (authError) {
        // Si el email ya existe en Firebase Auth, intentar obtener el usuario
        if (authError.code === 'auth/email-already-in-use') {
          try {
            firebaseUser = await auth.getUserByEmail(realemail);
            adminUid = firebaseUser.uid;
            console.log('[AdminAdd] Usuario ya existe en Firebase Auth:', adminUid);
            
            // Verificar que no exista ya en este tenant
            const existingUserSnap = await db.collection(tenantUsersPath).doc(adminUid).get();
            if (existingUserSnap.exists()) {
              return res.status(409).json({ 
                error: 'Este usuario ya existe en este tenant' 
              });
            }
          } catch (getUserError) {
            console.error('[AdminAdd] Error obteniendo usuario existente:', getUserError);
            return res.status(500).json({ error: 'Error al verificar usuario existente en Firebase Auth' });
          }
        } else {
          console.error('[AdminAdd] Error creando usuario en Firebase Auth:', authError);
          return res.status(500).json({ error: 'Error al crear usuario en Firebase Auth: ' + authError.message });
        }
      }

      // 3. Guarda en Firestore en tenants/{tenantId}/users/{uid} (sin password)
      console.log('[AdminAdd] Guardando en Firestore:', tenantUsersPath, '| uid:', adminUid, '| role:', userRole);
      await db.collection(tenantUsersPath).doc(adminUid).set({
        uid: adminUid,
        firebaseUid: adminUid,
        email,
        realemail,
        displayName,
        adminTel,
        role: userRole,
        tenantId: req.tenantId,
        status: "active",
        createdAt: new Date().toISOString(),
        isSuperAdmin: userRole === 'max',
        createdBy: {
          uid: req.user.uid,
          email: req.user.email,
          displayName: req.user.displayName || null
        }
      })

      // 4. Log de acción
      const roleText = userRole === 'max' ? 'superadmin' : 'admin';
      await logAction({
        tenantId: req.tenantId,
        action: `add-${roleText}`,
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        target: `${tenantUsersPath}/${adminUid}`,
        message: `${userRole === 'max' ? 'Superadministrador' : 'Administrador'} creado en tenant`,
        meta: { 
          displayName, 
          email, 
          realemail,
          role: userRole,
          tenantId: req.tenantId
        }
      })

      const successMessage = userRole === 'max' 
        ? "Superadministrador agregado exitosamente. El usuario puede hacer login con sus credenciales."
        : "Administrador agregado exitosamente. El usuario puede hacer login con sus credenciales.";

      res.json({ 
        success: true, 
        message: successMessage, 
        uid: adminUid,
        firebaseUid: adminUid,
        email: realemail,
        role: userRole
      })
    } catch (err) {
      console.error("[ERROR] Al crear administrador:", err)
      res.status(500).json({ error: err.message })
    }
  }
)

export default router