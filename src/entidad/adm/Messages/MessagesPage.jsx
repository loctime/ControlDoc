import { Box } from "@mui/material"
import { MessagesProvider } from "../../../context/MessagesContext"
import MessagesLayout from "./MessagesLayout"

export default function MessagesPage() {
  return (
    <MessagesProvider>
      <Box sx={{ height: "calc(100vh - 64px)", p: 2 }}>
        <MessagesLayout />
      </Box>
    </MessagesProvider>
  )
}
