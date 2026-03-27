// Script to run periodically (e.g., via cron job) to clean up expired deletions
// This can be run as a scheduled task every hour or daily

const fetch = require("node-fetch")

async function cleanupExpiredDeletions() {
  try {
    console.log("🧹 Iniciando limpieza de eliminaciones expiradas...")

    // You'll need to get an admin token here
    // This could be a service account token or admin user token
    const adminToken = process.env.ADMIN_CLEANUP_TOKEN

    if (!adminToken) {
      throw new Error("ADMIN_CLEANUP_TOKEN no está configurado")
    }

    const response = await fetch(`${process.env.API_URL}/api/admin/cleanup-expired-deletions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Error en la limpieza")
    }

    console.log("✅ Limpieza completada:", data.message)
    console.log(`📊 Usuarios eliminados: ${data.deletedUsers}`)
    console.log(`📊 Empresas eliminadas: ${data.deletedCompanies}`)
  } catch (error) {
    console.error("❌ Error en la limpieza:", error.message)
    process.exit(1)
  }
}

// Run the cleanup
cleanupExpiredDeletions()
