// Utilidad para generar el email interno de administrador
export function generateAccessEmail(name) {
  if (!name) return ""
  return (
    name
      .toLowerCase()
      .replace(/á/g, "a").replace(/é/g, "e").replace(/í/g, "i").replace(/ó/g, "o").replace(/ú/g, "u")
      .replace(/[^a-z0-9]/g, "")
      + "@controldoc.app"
  )
}
