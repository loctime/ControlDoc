"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "../config/firebaseconfig"
import { useAuth } from "./AuthContext"
import { useCompanies } from "./CompaniesContext"
import { generateCompanyEmail, getUserCompaniesWithEmails } from "../utils/emailHelpers"
import { useSnackbar } from "notistack"
import { getTenantCollectionPath } from '../utils/tenantUtils';

const MessagesContext = createContext()

export const MessagesProvider = ({ children }) => {
  const { user } = useAuth()
  const { companies } = useCompanies()
  const { enqueueSnackbar } = useSnackbar()

  const [messages, setMessages] = useState([])
  const [sentMessages, setSentMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  // Obtener empresas del usuario con emails virtuales
  const userCompanies = getUserCompaniesWithEmails(user, companies)

  // Construir array de emails virtuales (empresas + admin si corresponde)
  let userEmails = userCompanies.map((c) => c.virtualEmail)
  if (user?.role && ["max", "dhhkvja"].includes(user.role.toLowerCase()) && user?.email) {
    userEmails.push(`${user.email}@controldoc.app`)
  }

  // Escuchar mensajes recibidos en tiempo real
  useEffect(() => {
    if (!user || userEmails.length === 0) {
      setLoading(false)
      return
    }

    // Usar la ruta multi-tenant correcta
    const messagesCollectionPath = getTenantCollectionPath('messages');
    const q = query(collection(db, messagesCollectionPath), where("recipientEmail", "in", userEmails), orderBy("timestamp", "desc"))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = []
      let newUnreadCount = 0

      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() }
        newMessages.push(data)
        if (!data.read) newUnreadCount++
      })

      setMessages(newMessages)
      setUnreadCount(newUnreadCount)
      setLoading(false)

      // Notificación de mensajes nuevos
      if (newUnreadCount > unreadCount && unreadCount >= 0) {
        const newMessagesCount = newUnreadCount - unreadCount
        if (newMessagesCount > 0) {
          enqueueSnackbar(
            `${newMessagesCount} mensaje${newMessagesCount > 1 ? "s" : ""} nuevo${newMessagesCount > 1 ? "s" : ""}`,
            { variant: "info", autoHideDuration: 4000 },
          )
        }
      }
    })

    return () => unsubscribe()
  }, [user, userCompanies, enqueueSnackbar, unreadCount])

  // Escuchar mensajes enviados
  useEffect(() => {
    if (!user || !userCompanies.length) return

    const userEmails = userCompanies.map((c) => c.virtualEmail)

    // Usar la ruta multi-tenant correcta
    const messagesCollectionPath = getTenantCollectionPath('messages');
    const q = query(collection(db, messagesCollectionPath), where("senderEmail", "in", userEmails), orderBy("timestamp", "desc"))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sent = []
      snapshot.forEach((doc) => {
        sent.push({ id: doc.id, ...doc.data() })
      })
      setSentMessages(sent)
    })

    return () => unsubscribe()
  }, [user, userCompanies])

  // Enviar mensaje
  const sendMessage = useCallback(
    async ({ fromCompanyId, fromEmail, toEmail, subject, body, attachments = [] }) => {
      if (!user) {
        throw new Error("Usuario no autenticado")
      }

      let senderEmail, senderCompanyId, senderCompanyName

      // Modo administrador (email personalizado)
      if (fromEmail) {
        senderEmail = fromEmail.includes("@") ? fromEmail : fromEmail + "@controldoc.app"
        senderCompanyId = null
        senderCompanyName = "Administrador"
      } else {
        // Modo empresa
        if (!userCompanies.length) {
          throw new Error("No tienes empresas asociadas")
        }
        const fromCompany = userCompanies.find((c) => c.id === fromCompanyId)
        if (!fromCompany) {
          throw new Error("Empresa de origen no válida")
        }
        senderEmail = fromCompany.virtualEmail
        senderCompanyId = fromCompanyId
        senderCompanyName = fromCompany.companyName || fromCompany.name
      }

      // Buscar empresa destinataria
      const toCompany = companies.find((c) => generateCompanyEmail(c.companyName || c.name) === toEmail);

      const isAdminSender = !!fromEmail;
      const messageData = {
        senderId: user.uid,
        senderName: user.displayName || user.email,
        senderEmail,
        senderCompanyId: isAdminSender ? "adm" : senderCompanyId,
        senderCompanyName: isAdminSender ? "Administrador" : senderCompanyName,
        senderRealEmail: user.realemail,
        alertaEmailReal: isAdminSender,
        recipientEmail: toEmail,
        recipientCompanyId: toCompany?.id || null,
        recipientCompanyName: toCompany?.companyName || toCompany?.name || "Empresa no encontrada",
        subject: subject.trim(),
        body: body.trim(),
        attachments,
        read: false,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      };

      try {
        // Usar la ruta multi-tenant correcta
        const messagesCollectionPath = getTenantCollectionPath('messages');
        await addDoc(collection(db, messagesCollectionPath), messageData)
        enqueueSnackbar("Mensaje enviado correctamente", { variant: "success" })
      } catch (error) {
        console.error("Error enviando mensaje:", error)
        enqueueSnackbar("Error al enviar mensaje", { variant: "error" })
        throw error
      }
    },
    [user, userCompanies, companies, enqueueSnackbar],
  )

  // Marcar mensaje como leído
  const markAsRead = useCallback(async (messageId) => {
    try {
      // Usar la ruta multi-tenant correcta
      const messagesCollectionPath = getTenantCollectionPath('messages');
      await updateDoc(doc(db, messagesCollectionPath, messageId), {
        read: true,
        readAt: serverTimestamp(),
      })
    } catch (error) {
      console.error("Error marcando mensaje como leído:", error)
    }
  }, [])

  // Buscar empresas para autocompletado
  const searchCompanies = useCallback(
    (searchTerm) => {
      if (!searchTerm || !companies) return []

      const term = searchTerm.toLowerCase()
      return companies
        .map((company) => ({
          ...company,
          virtualEmail: generateCompanyEmail(company.companyName || company.name),
        }))
        .filter(
          (company) =>
            company.virtualEmail.includes(term) ||
            (company.companyName || company.name || "").toLowerCase().includes(term),
        )
        .slice(0, 10) // Limitar resultados
    },
    [companies],
  )

  const value = {
    messages,
    sentMessages,
    loading,
    unreadCount,
    userCompanies,
    sendMessage,
    markAsRead,
    searchCompanies,
  }

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
}

export const useMessages = () => {
  const context = useContext(MessagesContext)
  if (!context) {
    throw new Error("useMessages debe usarse dentro de MessagesProvider")
  }
  return context
}
