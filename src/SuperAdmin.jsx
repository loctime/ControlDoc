// React import removed - using JSX runtime

// Este componente renderiza su contenido solo si el usuario es super admin.
// Recibe un prop isSuperAdmin (boolean) y children (elementos a mostrar solo para super admins).

const SuperAdmin = ({ isSuperAdmin, children }) => {
  if (!isSuperAdmin) return null;
  return <>{children}</>;
};

export default SuperAdmin;
