"use client"

import { useState } from 'react';
import { Box, Paper, Tabs, Tab, Badge, Typography, Fab, useTheme } from "@mui/material"
import { Inbox as InboxIcon, Send as SendIcon, Edit as EditIcon } from "@mui/icons-material"
import { useMessages } from "../../../context/MessagesContext"
import MessagesList from "./MessagesList"
import ComposeDialog from "./ComposeDialog"
import MessageViewer from "./MessageViewer"

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`messages-tabpanel-${index}`}
      aria-labelledby={`messages-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 0 }}>{children}</Box>}
    </div>
  )
}

export default function MessagesLayout() {
  const theme = useTheme()
  const { messages, sentMessages, unreadCount, loading } = useMessages()

  const [tabValue, setTabValue] = useState(0)
  const [composeOpen, setComposeOpen] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue)
    setSelectedMessage(null)
  }

  const handleMessageClick = (message) => {
    setSelectedMessage(message)
    setViewerOpen(true)
  }

  const handleCloseViewer = () => {
    setViewerOpen(false)
    setSelectedMessage(null)
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <Typography>Cargando mensajes...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <Paper elevation={2} sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Box
          sx={{
            p: 3,
            borderBottom: 1,
            borderColor: "divider",
            backgroundColor: theme.palette.primary.main,
            color: "white",
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            📧 Mensajes Internos
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Sistema de comunicación entre empresas de ControlDoc
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="mensajes tabs">
            <Tab
              icon={
                <Badge badgeContent={unreadCount} color="error">
                  <InboxIcon />
                </Badge>
              }
              label="Recibidos"
              id="messages-tab-0"
              aria-controls="messages-tabpanel-0"
            />
            <Tab icon={<SendIcon />} label="Enviados" id="messages-tab-1" aria-controls="messages-tabpanel-1" />
          </Tabs>
        </Box>

        {/* Content */}
        <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
          <TabPanel value={tabValue} index={0}>
            <MessagesList messages={messages} onMessageClick={handleMessageClick} type="received" />
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <MessagesList messages={sentMessages} onMessageClick={handleMessageClick} type="sent" />
          </TabPanel>
        </Box>
      </Paper>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="redactar mensaje"
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
        onClick={() => setComposeOpen(true)}
      >
        <EditIcon />
      </Fab>

      {/* Dialogs */}
      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} />

      <MessageViewer message={selectedMessage} open={viewerOpen} onClose={handleCloseViewer} />
    </Box>
  )
}
