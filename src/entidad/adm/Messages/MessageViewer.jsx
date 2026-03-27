"use client"

// React import removed - using JSX runtime
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  Paper,
  Avatar,
} from "@mui/material"
import { Close as CloseIcon, Reply as ReplyIcon, Business as BusinessIcon } from "@mui/icons-material"
import { formatDistanceToNow, format } from "date-fns"
import { es } from "date-fns/locale"
import { useMessages } from "../../../context/MessagesContext"
import { useEffect } from "react"

export default function MessageViewer({ message, open, onClose }) {
  const { markAsRead } = useMessages()

  // Marcar como leído cuando se abre
  useEffect(() => {
    if (message && !message.read && open) {
      markAsRead(message.id)
    }
  }, [message, open, markAsRead])

  if (!message) return null

  const formatDate = (timestamp) => {
    if (!timestamp) return "Fecha desconocida"

    let date
    if (timestamp.toDate) {
      date = timestamp.toDate()
    } else if (timestamp instanceof Date) {
      date = timestamp
    } else {
      date = new Date(timestamp)
    }

    return {
      relative: formatDistanceToNow(date, { addSuffix: true, locale: es }),
      absolute: format(date, "dd/MM/yyyy 'a las' HH:mm", { locale: es }),
    }
  }

  const dateInfo = formatDate(message.timestamp)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: "70vh" },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          bgcolor: "primary.main",
          color: "white",
          pb: 2,
        }}
      >
        <Avatar sx={{ bgcolor: "primary.dark" }}>
          <BusinessIcon />
        </Avatar>
        <Box flexGrow={1}>
          <Typography variant="h6" component="div">
            {message.subject || "Sin asunto"}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {dateInfo.relative} • {dateInfo.absolute}
          </Typography>
        </Box>
        {!message.read && (
          <Chip
            label="Nuevo"
            size="small"
            sx={{
              bgcolor: "secondary.main",
              color: "white",
            }}
          />
        )}
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Header del mensaje */}
        <Paper elevation={0} sx={{ p: 3, bgcolor: "grey.50" }}>
          <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                De: {message.senderCompanyName || "Empresa desconocida"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {message.senderEmail}
              </Typography>
            </Box>
            <Box textAlign="right">
              <Typography variant="subtitle1" fontWeight="bold">
                Para: {message.recipientCompanyName || "Empresa desconocida"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {message.recipientEmail}
              </Typography>
            </Box>
          </Box>

          {message.senderName && (
            <Typography variant="body2" color="text.secondary">
              Enviado por: {message.senderName}
            </Typography>
          )}
        </Paper>

        <Divider />

        {/* Contenido del mensaje */}
        <Box sx={{ p: 3 }}>
          <Typography
            variant="body1"
            component="div"
            sx={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
              minHeight: 200,
            }}
          >
            {message.body || "Sin contenido"}
          </Typography>
        </Box>

        {/* Adjuntos (para futuro) */}
        {message.attachments && message.attachments.length > 0 && (
          <>
            <Divider />
            <Box sx={{ p: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Adjuntos ({message.attachments.length})
              </Typography>
              {/* Aquí irían los adjuntos */}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={onClose} startIcon={<CloseIcon />}>
          Cerrar
        </Button>
        <Button
          variant="outlined"
          startIcon={<ReplyIcon />}
          onClick={() => {
            // TODO: Implementar respuesta
            console.log("Responder mensaje:", message.id)
          }}
        >
          Responder
        </Button>
      </DialogActions>
    </Dialog>
  )
}
