import { useEffect } from 'react';
import { useAuth } from "./context/AuthContext";

const ForceLogoutOnMount = () => {
  const { logout } = useAuth();
  useEffect(() => {
    if (logout) logout();
    // eslint-disable-next-line
  }, []);
  return null;
};

export default ForceLogoutOnMount;
