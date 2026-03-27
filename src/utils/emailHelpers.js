/**
 * Genera un email virtual para una empresa basado en su nombre
 * @param {string} companyName - Nombre de la empresa
 * @returns {string} Email virtual formato empresa@controldoc.app
 */
export const generateCompanyEmail = (companyName) => {
  if (!companyName) return "sin-nombre@controldoc.app"

  return (
    companyName
      .toLowerCase()
      .replace(/\s+/g, "-") // Espacios por guiones
      .replace(/[^a-z0-9-]/g, "") // Solo letras, números y guiones
      .replace(/-+/g, "-") // Múltiples guiones por uno solo
      .replace(/^-|-$/g, "") + // Quitar guiones al inicio/final
    "@controldoc.app"
  )
}

/**
 * Obtiene todas las empresas del usuario con sus emails virtuales
 * @param {Object} user - Usuario actual
 * @param {Array} companies - Lista de todas las empresas
 * @returns {Array} Empresas del usuario con emails virtuales
 */
export const getUserCompaniesWithEmails = (user, companies) => {
  if (!user || !companies) return []

  // Si es admin, puede ver todas las empresas
  if (user.role === "admin") {
    return companies.map((company) => ({
      ...company,
      virtualEmail: generateCompanyEmail(company.companyName || company.name),
    }))
  }

  // Si es usuario, solo sus empresas (por ownerId o si está asociado)
  return companies
    .filter((company) => company.ownerId === user.uid)
    .map((company) => ({
      ...company,
      virtualEmail: generateCompanyEmail(company.companyName || company.name),
    }))
}

/**
 * Busca usuarios por email virtual o nombre de empresa
 * @param {string} searchTerm - Término de búsqueda
 * @param {Array} companies - Lista de empresas
 * @returns {Array} Empresas que coinciden con la búsqueda
 */
export const searchCompaniesByEmail = (searchTerm, companies) => {
  if (!searchTerm || !companies) return []

  const term = searchTerm.toLowerCase()

  return companies
    .map((company) => ({
      ...company,
      virtualEmail: generateCompanyEmail(company.companyName || company.name),
    }))
    .filter(
      (company) =>
        company.virtualEmail.includes(term) || (company.companyName || company.name || "").toLowerCase().includes(term),
    )
}
