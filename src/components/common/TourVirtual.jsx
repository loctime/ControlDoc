//src/components/common/TourVirtual.jsx
import React, { useState, useEffect, useRef } from "react";
import Button from "@mui/material/Button";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Componente reutilizable para lanzar un tour virtual con driver.js y MUI Button
 * @param {Array} steps - Pasos del tour
 * @param {string} [buttonLabel="Iniciar tour"] - Texto del botón
 * @param {object} [driverOptions={}] - Opciones personalizadas para Driver.js
 * @param {object} [buttonProps={}] - Props extra para el botón MUI
 */
export default function TourVirtual({
  steps,
  buttonLabel = "Iniciar tour",
  driverOptions = {},
  buttonProps = {},
}) {
  const [running, setRunning] = useState(false);
  const driverRef = useRef(null);

  const startTour = () => {
    if (!steps?.length || running) {
      console.warn("No hay pasos definidos o el tour ya está corriendo.");
      return;
    }
    const driverObj = driver({
      steps,
      showProgress: true,
      overlayClickNext: true,
      doneBtnText: "Listo",
      closeBtnText: "Cerrar",
      nextBtnText: "Siguiente",
      prevBtnText: "Anterior",
      ...driverOptions,
      onDestroyed: () => setRunning(false),
      onReset: () => setRunning(false),
    });
    driverRef.current = driverObj;
    driverObj.drive();
    setRunning(true);
  };

  // Soporte barra espaciadora
  useEffect(() => {
    if (!running) return;
    const handleKeyDown = (e) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        driverRef.current?.moveNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [running]);

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={startTour}
      disabled={running}
      aria-label={buttonLabel}
      sx={{ m: 1 }}
      {...buttonProps}
    >
      {running ? "Tour en progreso..." : buttonLabel}
    </Button>
  );
}