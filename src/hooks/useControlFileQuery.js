import { useCallback, useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { connectControlFileWithGoogle, getControlFileIdToken, getControlFileUser, handleRedirectResult, disconnectControlFile } from '../utils/ControlFileAuth';
import { APP_DISPLAY_NAME } from '../utils/ControlFileClient';

// Query keys
export const controlFileKeys = {
  all: ['controlFile'],
  user: () => [...controlFileKeys.all, 'user'],
};

// Auth check function
const checkAuthStatus = async () => {
  try {
    // Verificar si hay redirect result
    const redirectUser = await handleRedirectResult();
    if (redirectUser) {
      return { status: 'connected', user: redirectUser, error: null };
    }

    // Verificar si ya hay un usuario logueado
    const currentUser = getControlFileUser();
    if (currentUser) {
      try {
        // Verificar que el token sea válido
        await getControlFileIdToken(true);
        return { status: 'connected', user: currentUser, error: null };
      } catch (tokenError) {
        return { status: 'disconnected', user: null, error: tokenError };
      }
    }
    
    return { status: 'disconnected', user: null, error: null };
  } catch (e) {
    console.error('Error verificando autenticación:', e);
    return { status: 'disconnected', user: null, error: e };
  }
};

export function useControlFileQuery() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);

  // Auth status query
  const {
    data: authData,
    isLoading: authLoading,
    error: authError
  } = useQuery({
    queryKey: controlFileKeys.user(),
    queryFn: checkAuthStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Update local state when query data changes
  useEffect(() => {
    if (authData) {
      setStatus(authData.status);
      setError(authData.error);
    }
  }, [authData]);

  const user = useMemo(() => authData?.user || getControlFileUser(), [authData?.user]);

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      setStatus('connecting');
      const result = await connectControlFileWithGoogle();
      
      if (result) {
        // Popup exitoso
        await getControlFileIdToken(true);
        return { status: 'connected', user: result };
      } else {
        // Redirect iniciado
        setStatus('redirecting');
        return { status: 'redirecting', user: null };
      }
    },
    onSuccess: (data) => {
      if (data.status === 'connected') {
        queryClient.setQueryData(controlFileKeys.user(), data);
      }
    },
    onError: (e) => {
      setError(e);
      setStatus('disconnected');
    }
  });

  // Save file mutation usando SDK directamente con paths
  const saveFileMutation = useMutation({
    mutationFn: async ({ file, path }) => {
      setError(null);
      
      const currentUser = user || getControlFileUser();
      if (!currentUser?.uid) {
        throw new Error('Debe conectarse a ControlFile primero desde su perfil');
      }
      
      setStatus('uploading');
      
      // El SDK solo tiene upload() con parentId, no uploadFile() con path
      // Hacemos llamada directa a la API para usar paths
      const token = await getControlFileIdToken();
      const baseUrl = import.meta.env.VITE_CONTROLFILE_BACKEND_URL || import.meta.env.VITE_API_URL || 'https://controlfile.onrender.com';
      
      // Si no se proporciona path, usar path por defecto
      const defaultPath = path || ['controldoc', 'archivos', currentUser.uid];
      
      // Paso 1: Presign con path
      const presignResponse = await fetch(`${baseUrl}/api/uploads/presign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          path: defaultPath,
          userId: currentUser.uid,
        }),
      });

      if (!presignResponse.ok) {
        const errorText = await presignResponse.text();
        throw new Error(`Error en presign: ${presignResponse.status} - ${errorText}`);
      }

      const presignData = await presignResponse.json();

      // Paso 2: Upload al storage
      const uploadUrl = presignData.uploadUrl;
      const method = presignData.method || 'PUT';
      const headers = presignData.headers || {};

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            // Opcional: llamar a onProgress si se proporciona
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed due to network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload was aborted')));
        xhr.open(method, uploadUrl);
        Object.entries(headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });
        xhr.send(file);
      });

      // Paso 3: Confirmar upload
      const confirmResponse = await fetch(`${baseUrl}/api/uploads/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadSessionId: presignData.uploadSessionId,
          key: presignData.fileKey,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          name: file.name,
          path: defaultPath,
          userId: currentUser.uid,
        }),
      });

      if (!confirmResponse.ok) {
        const errorText = await confirmResponse.text();
        throw new Error(`Error en confirm: ${confirmResponse.status} - ${errorText}`);
      }

      const confirmData = await confirmResponse.json();

      if (!confirmData.fileId) {
        throw new Error('La respuesta de confirmación no incluye fileId');
      }

      const result = {
        fileId: confirmData.fileId,
        fileName: file.name,
        fileSize: file.size,
      };
      
      setStatus('connected');
      return result;
    },
    onSuccess: () => {
      setStatus(user ? 'connected' : 'disconnected');
    },
    onError: (e) => {
      setError(e);
      setStatus(user ? 'connected' : 'disconnected');
    }
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: disconnectControlFile,
    onSuccess: () => {
      setStatus('disconnected');
      setError(null);
      queryClient.setQueryData(controlFileKeys.user(), { status: 'disconnected', user: null, error: null });
    },
    onError: (e) => {
      setError(e);
    }
  });

  const connect = useCallback(async () => {
    return connectMutation.mutateAsync();
  }, [connectMutation]);

  const saveFile = useCallback(async (file, path) => {
    return saveFileMutation.mutateAsync({ file, path });
  }, [saveFileMutation]);

  const disconnect = useCallback(async () => {
    return disconnectMutation.mutateAsync();
  }, [disconnectMutation]);

  const openControlFile = useCallback(async () => {
    try {
      if (user) {
        // Si está conectado, obtener token para autenticación automática
        const token = await getControlFileIdToken();
        // Abrir con token en la URL para autenticación automática
        window.open(`https://files.controldoc.app/?token=${encodeURIComponent(token)}`, '_blank');
      } else {
        // Si no está conectado, abrir normalmente
        window.open('https://files.controldoc.app/', '_blank');
      }
    } catch (e) {
      // Si falla obtener token, abrir sin autenticación automática
      window.open('https://files.controldoc.app/', '_blank');
    }
  }, [user]);

  return {
    status,
    error,
    user,
    appDisplayName: APP_DISPLAY_NAME,
    connect,
    disconnect,
    openControlFile,
    saveFile,
    isLoading: authLoading || connectMutation.isPending || saveFileMutation.isPending,
  };
}

export default useControlFileQuery;
