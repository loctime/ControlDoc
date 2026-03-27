// React import removed - using JSX runtime
import {
  Box,
  Paper,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Button,
} from "@mui/material"
import { PictureAsPdf, Search, GridView, TableRows, CloudUpload, CreateNewFolder } from "@mui/icons-material"

export default function FileFilterBar({
  filterType,
  setFilterType,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  onMassUploadClick,
  onCreateFolderClick,
}) {
  return (
    <Paper sx={{ mb: 2, p: 1, backgroundColor: "var(--paper-background)" }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Tabs
          value={filterType}
          onChange={(e, newValue) => setFilterType(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Todos" value="todos" />
          <Tab icon={<PictureAsPdf color="error" />} label="PDF" value="pdf" />
          <Tab
            icon={<img src="https://img.icons8.com/color/24/000000/microsoft-word-2019--v2.png" alt="Word" />}
            label="Word"
            value="word"
          />
          <Tab
            icon={<img src="https://img.icons8.com/color/24/000000/microsoft-excel-2019--v2.png" alt="Excel" />}
            label="Excel"
            value="excel"
          />
          <Tab
            icon={<img src="https://img.icons8.com/color/24/000000/image.png" alt="Imágenes" />}
            label="Imágenes"
            value="imagenes"
          />
          <Tab
            icon={<img src="https://img.icons8.com/color/24/000000/zip.png" alt="ZIP" />}
            label="ZIP"
            value="zip"
          />
        </Tabs>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <TextField
          placeholder="Filtrar por nombre o persona"
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ flexGrow: 1, mr: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
        <Box>
          <Tooltip title="Nueva carpeta">
            <IconButton
              color="primary"
              onClick={onCreateFolderClick}
              sx={{ mr: 1 }}
            >
              <CreateNewFolder />
            </IconButton>
          </Tooltip>
          <Tooltip title="Vista de cuadrícula">
            <IconButton
              color={viewMode === "grid" ? "primary" : "default"}
              onClick={() => setViewMode("grid")}
            >
              <GridView />
            </IconButton>
          </Tooltip>
          <Tooltip title="Vista de lista">
            <IconButton
              color={viewMode === "list" ? "primary" : "default"}
              onClick={() => setViewMode("list")}
            >
              <TableRows />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<CloudUpload />}
            onClick={onMassUploadClick}
            sx={{ ml: 2 }}
          >
            Subida Masiva
          </Button>
        </Box>
      </Box>
    </Paper>
  )
}
