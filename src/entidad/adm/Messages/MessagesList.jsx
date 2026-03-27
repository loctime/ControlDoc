"use client"

import {
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Box,
  Chip,
  Divider,
  Paper,
} from "@mui/material"
import { Business as BusinessIcon, MarkEmailRead as ReadIcon, MarkEmailUnread as UnreadIcon } from "@mui/icons-material"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

export default function MessagesList({ messages, onMessageClick, type = "received" }) {
  if (!messages || messages.length === 0) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight={300} p={4}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {type === "received" ? "📭 No hay mensajes recibidos" : "📤 No hay mensajes enviados"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {type === "received" ? "Los mensajes que recibas aparecerán aquí" : "Los mensajes que envíes aparecerán aquí"}
        </Typography>
      </Box>
    )
  }

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

    return formatDistanceToNow(date, { addSuffix: true, locale: es })
  }

  return (
    <Paper sx={{ height: "100%", overflow: "auto" }}>
      <List sx={{ p: 0 }}>
        {messages.map((message, index) => (
          <div key={message.id}>
            <ListItem
              button
              onClick={() => onMessageClick(message)}
              sx={{
                py: 2,
                px: 3,
                backgroundColor: message.read ? "transparent" : "action.hover",
                "&:hover": {
                  backgroundColor: "action.selected",
                },
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: message.read ? "grey.400" : "primary.main" }}>
                  <BusinessIcon />
                </Avatar>
              </ListItemAvatar>

              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <Typography
                      variant="subtitle1"
                      component="span"
                      sx={{
                        fontWeight: message.read ? "normal" : "bold",
                        flexGrow: 1,
                      }}
                    >
                      {type === "received"
                        ? `De: ${message.senderCompanyName || "Empresa desconocida"}`
                        : `Para: ${message.recipientCompanyName || "Empresa desconocida"}`}
                    </Typography>

                    {!message.read && type === "received" && (
                      <Chip label="Nuevo" size="small" color="primary" variant="filled" />
                    )}

                    {message.read ? (
                      <ReadIcon fontSize="small" color="action" />
                    ) : (
                      <UnreadIcon fontSize="small" color="primary" />
                    )}
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography
                      variant="body1"
                      component="div"
                      sx={{
                        fontWeight: message.read ? "normal" : "medium",
                        mb: 0.5,
                      }}
                    >
                      {message.subject || "Sin asunto"}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        mb: 0.5,
                      }}
                    >
                      {message.body || "Sin contenido"}
                    </Typography>

                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {type === "received" ? message.senderEmail : message.recipientEmail}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(message.timestamp)}
                      </Typography>
                    </Box>
                  </Box>
                }
              />
            </ListItem>
            {index < messages.length - 1 && <Divider />}
          </div>
        ))}
      </List>
    </Paper>
  )
}
