// React import removed - using JSX runtime
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material"
import {
  Visibility,
  Download,
  Share,
  Delete,
} from "@mui/icons-material"

export default function FileMenu({ anchorEl, onClose, file, onPreview, onDelete }) {
  const open = Boolean(anchorEl)

  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      <MenuItem onClick={() => onPreview(file)}>
        <ListItemIcon>
          <Visibility fontSize="small" />
        </ListItemIcon>
        <ListItemText>Ver</ListItemText>
      </MenuItem>
      <MenuItem>
        <ListItemIcon>
          <Download fontSize="small" />
        </ListItemIcon>
        <ListItemText>Descargar</ListItemText>
      </MenuItem>
      <MenuItem>
        <ListItemIcon>
          <Share fontSize="small" />
        </ListItemIcon>
        <ListItemText>Compartir</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => onDelete(file)}>
        <ListItemIcon>
          <Delete fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText>Eliminar</ListItemText>
      </MenuItem>
    </Menu>
  )
}