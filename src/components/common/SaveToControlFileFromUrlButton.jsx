import React from 'react';
import { IconButton } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
// import useControlFileQuery from '../../hooks/useControlFileQuery'; // SDK deshabilitado temporalmente para debug

async function fetchUrlAsFile(url, fileName = 'archivo', contentType) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar el archivo: ${res.status}`);
  const blob = await res.blob();
  const type = contentType || blob.type || 'application/octet-stream';
  return new File([blob], fileName, { type });
}

const SaveToControlFileFromUrlButton = React.forwardRef(({ 
  fileUrl, 
  fileName, 
  contentType, 
  onSaved, 
  size = 'medium',
  iconOnly = false,
  ...props 
}, ref) => {
  // SDK deshabilitado temporalmente para debug
  throw new Error("SDK deshabilitado temporalmente para debug");
  
  const { status, error, connect, saveFile, appDisplayName, user } = useControlFileQuery();

  const handleClick = async () => {
    if (!fileUrl) return;
    
    try {
      if (status === 'disconnected' && !user) {
        alert('Debe conectarse a ControlFile primero desde su perfil (/profile)');
        return;
      }
      
      const file = await fetchUrlAsFile(fileUrl, fileName, contentType);
      const result = await saveFile(file);
      onSaved && onSaved(result);
    } catch (error) {
      if (error.message.includes('conectarse a ControlFile primero')) {
        alert('Debe conectarse a ControlFile primero desde su perfil (/profile)');
      } else {
        console.error('Error guardando en ControlFile:', error);
      }
    }
  };

  const disabled = !fileUrl || status === 'checking' || status === 'connecting' || status === 'uploading' || status === 'redirecting';
  const label =
    status === 'checking' ? 'Verificando conexión...' :
    status === 'connecting' ? `Conectando ${appDisplayName}...` :
    status === 'redirecting' ? `Redirigiendo a ${appDisplayName}...` :
    status === 'uploading' ? `Guardando en ${appDisplayName}...` :
    `Guardar en ${appDisplayName}`;

  if (iconOnly) {
    const button = (
      <IconButton 
        onClick={handleClick} 
        disabled={disabled} 
        size={size}
        title={error ? String(error) : label}
      >
        <CloudUpload fontSize={size} />
      </IconButton>
    );

    return disabled ? (
      <span ref={ref} title={error ? String(error) : label} {...props}>
        {button}
      </span>
    ) : (
      <span ref={ref} {...props}>
        {button}
      </span>
    );
  }

  const button = (
    <button onClick={handleClick} disabled={disabled} title={error ? String(error) : undefined}>
      {label}
    </button>
  );

  return disabled ? (
    <span ref={ref} title={error ? String(error) : undefined} {...props}>
      {button}
    </span>
  ) : (
    <span ref={ref} {...props}>
      {button}
    </span>
  );
});

export default SaveToControlFileFromUrlButton;


