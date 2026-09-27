const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// PATCH /productos/:productoId
router.patch("/:productoId", requireAuth, requireRole("admin", "comercio"), async (req, res) => {
  const { productoId } = req.params;
  const campos = ["nombre", "descripcion", "precio", "disponible", "stock", "imagen_url", "categoria"];
  const body = { ...req.body, imagen_url: req.body.imagenUrl };

  const sets = [];
  const valores = [];
  campos.forEach((campo) => {
    if (body[campo] !== undefined) {
      valores.push(body[campo]);
      sets.push(`${campo} = $${valores.length}`);
    }
  });
  if (sets.length === 0) return res.status(400).json({ error: "Nada para actualizar" });

  valores.push(productoId);
  const result = await pool.query(
    `UPDATE productos SET ${sets.join(", ")} WHERE id = $${valores.length} RETURNING *`,
    valores
  );
  if (!result.rows[0]) return res.status(404).json({ error: "No encontrado" });
  res.json(result.rows[0]);
});

// DELETE /productos/:productoId (baja logica: disponible = false)
router.delete("/:productoId", requireAuth, requireRole("admin", "comercio"), async (req, res) => {
  await pool.query("UPDATE productos SET disponible = false WHERE id = $1", [req.params.productoId]);
  res.status(204).send();
});

module.exports = router;
