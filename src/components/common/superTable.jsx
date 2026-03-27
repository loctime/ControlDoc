import React, { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Collapse,
  Box,
  Typography,
  CircularProgress,
  Tooltip,
  TableSortLabel,
} from "@mui/material"
import { ExpandMore, ExpandLess } from "@mui/icons-material"

/**
 * SuperTable: tabla de administración reutilizable y expandible
 * @param {Array} columns [{ key, label, render?, align?, width?, ... }]
 * @param {Array} rows array de objetos (datos)
 * @param {boolean} isLoading
 * @param {function} rowActions? (row) => ReactNode | array
 * @param {function} expandableRender? (row) => ReactNode
 * @param {string} emptyText? texto cuando no hay datos
 * @param {function} onRowClick? (row) => void
 * @param {function} onRowExpand? (row) => void - callback cuando se expande una fila
 */
const SuperTable = ({
  columns = [],
  rows = [],
  isLoading = false,
  rowActions,
  expandableRender,
  emptyText = "No hay datos para mostrar.",
  onRowClick,
  defaultSort,
  onRowExpand,
}) => {
  const [expandedRow, setExpandedRow] = useState(null)
  const [sortConfig, setSortConfig] = useState(() => defaultSort || null)

  const handleExpandClick = (rowId, row) => {
    const isExpanding = expandedRow !== rowId;
    setExpandedRow(expandedRow === rowId ? null : rowId);
    // Llamar callback cuando se expande (no cuando se colapsa)
    if (isExpanding && onRowExpand && row) {
      onRowExpand(row);
    }
  }

  const handleSort = (col) => {
    if (!col.sortable) return
    setSortConfig(prev => {
      if (!prev || prev.key !== col.key) {
        return { key: col.key, direction: col.defaultDirection || 'asc', comparator: col.sortComparator }
      }
      const nextDirection = prev.direction === 'asc' ? 'desc' : 'asc'
      return { ...prev, direction: nextDirection }
    })
  }

  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows
    const { key, direction, comparator } = sortConfig
    const sorted = [...rows].sort((a, b) => {
      if (typeof comparator === 'function') {
        return comparator(a, b, direction)
      }
      const aValue = a[key]
      const bValue = b[key]
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return direction === 'asc' ? -1 : 1
      if (bValue == null) return direction === 'asc' ? 1 : -1
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue
      }
      const aStr = aValue.toString().toLowerCase()
      const bStr = bValue.toString().toLowerCase()
      if (aStr < bStr) return direction === 'asc' ? -1 : 1
      if (aStr > bStr) return direction === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [rows, sortConfig])

  return (
    <TableContainer component={Paper} elevation={3} sx={{ width: "100%", maxWidth: "100%", overflowX: "auto", overflowY: "auto", backgroundColor: "var(--paper-background)" }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow sx={{ backgroundColor: "var(--paper-background)" }}>
            {expandableRender && <TableCell />}
            {columns.map((col) => (
              <TableCell
                key={col.key}
                align={col.align || "left"}
                sx={{ fontWeight: "bold", color: "var(--paper-background-text)", cursor: col.sortable ? "pointer" : "default", ...(col.width ? { width: col.width } : {}) }}
                onClick={() => handleSort(col)}
              >
                {col.sortable ? (
                  <TableSortLabel
                    active={sortConfig?.key === col.key}
                    direction={sortConfig?.key === col.key ? sortConfig.direction : (col.defaultDirection || 'asc')}
                    IconComponent={col.sortIconComponent}
                  >
                    {col.label}
                  </TableSortLabel>
                ) : (
                  col.label
                )}
              </TableCell>
            ))}
            {rowActions && <TableCell align="right" sx={{ fontWeight: "bold", color: "var(--paper-background-text)" }}>Acciones</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length + (expandableRender ? 2 : 1)} align="center">
                <CircularProgress size={28} sx={{ color: "var(--primary-main)" }} />
                <Typography variant="body2" sx={{ mt: 1, color: "var(--paper-background-text)" }}>
                  Cargando datos...
                </Typography>
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + (expandableRender ? 2 : 1)} align="center">
                <Typography variant="body2" sx={{ color: "var(--paper-background-text)", opacity: 0.7 }}>
                  {emptyText}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            sortedRows.map((row) => (
              <React.Fragment key={row.id || row.key || JSON.stringify(row)}>
                <TableRow
                  hover
                  sx={{ 
                    cursor: onRowClick ? "pointer" : "default",
                    backgroundColor: "var(--paper-background)",
                    "&:hover": {
                      backgroundColor: "var(--page-background)"
                    }
                  }}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {expandableRender && (
                    <TableCell padding="checkbox">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleExpandClick(row.id || row.key || JSON.stringify(row), row) }}
                        aria-label={expandedRow === (row.id || row.key || JSON.stringify(row)) ? "Colapsar" : "Expandir"}
                        sx={{ color: "var(--icon-color)" }}
                      >
                        {expandedRow === (row.id || row.key || JSON.stringify(row)) ? <ExpandLess sx={{ color: "inherit" }} /> : <ExpandMore sx={{ color: "inherit" }} />}
                      </IconButton>
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.key} align={col.align || "left"} sx={{ color: "var(--paper-background-text)" }}>
                      {col.render ? col.render(row) : (
                        typeof row[col.key] === 'string' || typeof row[col.key] === 'number' 
                          ? <Typography component="span" sx={{ color: "var(--paper-background-text)" }}>{row[col.key]}</Typography>
                          : row[col.key]
                      )}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell align="right" sx={{ color: "var(--paper-background-text)" }}>
                      {typeof rowActions === "function" ? rowActions(row) : rowActions}
                    </TableCell>
                  )}
                </TableRow>
                {expandableRender && (
                  <TableRow>
                    <TableCell colSpan={columns.length + (rowActions ? 2 : 1)} sx={{ p: 0, border: 0 }}>
                      <Collapse in={expandedRow === (row.id || row.key || JSON.stringify(row))} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, backgroundColor: "var(--page-background)", borderRadius: 1 }}>
                          {expandableRender(row)}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default SuperTable