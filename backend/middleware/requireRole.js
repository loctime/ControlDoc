// backend/middleware/requireRole.js

export function requireRole(expectedRole) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Si expectedRole es un array, verificar si el rol del usuario está incluido
    if (Array.isArray(expectedRole)) {
      if (expectedRole.includes(userRole)) {
        return next();
      }
    } else {
      // Si expectedRole es un string, verificar coincidencia exacta
      if (userRole === expectedRole) {
        return next();
      }
    }

    console.log('[ROLE] Acceso denegado:', {
      userRole,
      expectedRole,
      userEmail: req.user?.email
    });

    return res.status(403).json({ 
      error: 'Acceso denegado por rol',
      userRole,
      requiredRoles: expectedRole
    });
  };
}
