const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// PATCH /repartidores/:repartidorId/ubicacion
router.patch("/:repartidorId/ubicacion", requireAuth, async (req, res) => {
  const { repartidorId } = req.params;
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "lat y lng son requeridos" });
  }

  // Solo el propio repartidor (o un admin) puede actualizar su ubicacion.
  if (req.usuario.rol !== "admin" && req.usuario.id !== repartidorId) {
    return res.status(403).json({ error: "No autorizado" });
  }

  // TODO: cuando se defina la estrategia de tiempo real (WebSockets vs push
  // vs polling, punto pendiente del README), esta ubicacion hay que emitirse
  // ademas de guardarse, para que el panel del comercio la vea sin recargar.
  await pool.query(
    `UPDATE usuarios SET ultima_lat = $1, ultima_lng = $2, ultima_ubicacion_en = now()
     WHERE id = $3`,
    [lat, lng, repartidorId]
  );

  res.json({ ok: true, lat, lng });
});

module.exports = router;
