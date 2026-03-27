// components/DocumentosTableRow.jsx
// React import removed - using JSX runtime
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip
} from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function DocumentosTableRow({ docs, companyId }) {
  const navigate = useNavigate();

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Documento</TableCell>
          <TableCell>Tipo</TableCell>
          <TableCell>Vencimiento</TableCell>
          <TableCell>Estado</TableCell>
          <TableCell>Días restantes</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {docs.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell>{doc.name || "Sin nombre"}</TableCell>
            <TableCell>
              {doc.entityType === "personal" || doc.entityType === "employee"
                ? "Empleado"
                : doc.entityType === "vehiculo" || doc.entityType === "vehicle"
                ? "Vehículo"
                : doc.entityType === "company"
                ? "Empresa"
                : doc.entityType || "N/A"}
            </TableCell>
            <TableCell>
              {doc.expirationDate?.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              }) || "Sin fecha"}
            </TableCell>
            <TableCell>
              <Chip
                label={doc.status}
                color={
                  doc.status === "Aprobado"
                    ? "success"
                    : doc.status === "Rechazado"
                    ? "error"
                    : "warning"
                }
                size="small"
                clickable
                onClick={() =>
                  navigate(`/admin/uploaded-documents?empresa=${companyId}&docId=${doc.id}`)
                }
              />
            </TableCell>
            <TableCell>
              {doc.diasRestantes !== null
                ? doc.diasRestantes <= 0
                  ? `Vencido (${Math.abs(doc.diasRestantes)} días)`
                  : doc.diasRestantes
                : "N/A"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
