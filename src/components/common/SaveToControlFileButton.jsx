import React from 'react';
// import useControlFileQuery from '../../hooks/useControlFileQuery'; // SDK deshabilitado temporalmente para debug

export default function SaveToControlFileButton({ file, onSaved }) {
  // SDK deshabilitado temporalmente para debug
  throw new Error("SDK deshabilitado temporalmente para debug");
  
  const { status, error, connect, saveFile, appDisplayName } = useControlFileQuery();

  const handleClick = async () => {
    if (!file) return;
    if (status === 'disconnected') {
      await connect();
    }
    const result = await saveFile(file);
    onSaved && onSaved(result);
  };

  const disabled = !file || status === 'checking' || status === 'connecting' || status === 'uploading' || status === 'redirecting';
  const label =
    status === 'checking' ? 'Verificando conexión...' :
    status === 'connecting' ? `Conectando ${appDisplayName}...` :
    status === 'redirecting' ? `Redirigiendo a ${appDisplayName}...` :
    status === 'uploading' ? `Guardando en ${appDisplayName}...` :
    `Guardar en ${appDisplayName}`;

  return (
    <button onClick={handleClick} disabled={disabled} title={error ? String(error) : undefined}>
      {label}
    </button>
  );
}


