const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /comercios?categoria=&q=&abierto=
router.get("/", async (req, res) => {
  const { categoria, q, abierto } = req.query;
  const condiciones = [];
  const valores = [];

  if (categoria) {
    valores.push(categoria);
    condiciones.push(`categoria = $${valores.length}`);
  }
  if (q) {
    valores.push(`%${q}%`);
    condiciones.push(`nombre ILIKE $${valores.length}`);
  }
  if (abierto !== undefined) {
    valores.push(abierto === "true");
    condiciones.push(`abierto = $${valores.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const result = await pool.query(`SELECT * FROM comercios ${where} ORDER BY nombre`, valores);
  res.json(result.rows);
});

// POST /comercios (admin o comercio)
router.post("/", requireAuth, requireRole("admin", "comercio"), async (req, res) => {
  const { nombre, categoria, direccion, lat, lng, abierto, horario, costoEnvioBase } = req.body;
  if (!nombre || !categoria || !direccion || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  const result = await pool.query(
    `INSERT INTO comercios (usuario_id, nombre, categoria, direccion, lat, lng, abierto, horario, costo_envio_base)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true), $8, $9)
     RETURNING *`,
    [req.usuario.id, nombre, categoria, direccion, lat, lng, abierto, horario, costoEnvioBase || 0]
  );

  res.status(201).json(result.rows[0]);
});

// GET /comercios/:comercioId
router.get("/:comercioId", async (req, res) => {
  const result = await pool.query("SELECT * FROM comercios WHERE id = $1", [req.params.comercioId]);
  if (!result.rows[0]) return res.status(404).json({ error: "No encontrado" });
  res.json(result.rows[0]);
});

// PATCH /comercios/:comercioId
router.patch("/:comercioId", requireAuth, requireRole("admin", "comercio"), async (req, res) => {
  const { comercioId } = req.params;
  const campos = ["nombre", "categoria", "direccion", "lat", "lng", "abierto", "horario", "costo_envio_base"];
  const body = { ...req.body, costo_envio_base: req.body.costoEnvioBase };

  const sets = [];
  const valores = [];
  campos.forEach((campo) => {
    if (body[campo] !== undefined) {
      valores.push(body[campo]);
      sets.push(`${campo} = $${valores.length}`);
    }
  });
  if (sets.length === 0) return res.status(400).json({ error: "Nada para actualizar" });

  valores.push(comercioId);
  const result = await pool.query(
    `UPDATE comercios SET ${sets.join(", ")} WHERE id = $${valores.length} RETURNING *`,
    valores
  );
  if (!result.rows[0]) return res.status(404).json({ error: "No encontrado" });
  res.json(result.rows[0]);
});

// GET /comercios/:comercioId/productos
router.get("/:comercioId/productos", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM productos WHERE comercio_id = $1 ORDER BY categoria, nombre",
    [req.params.comercioId]
  );
  res.json(result.rows);
});

// POST /comercios/:comercioId/productos
router.post("/:comercioId/productos", requireAuth, requireRole("admin", "comercio"), async (req, res) => {
  const { comercioId } = req.params;
  const { nombre, descripcion, precio, disponible, stock, imagenUrl, categoria } = req.body;
  if (!nombre || precio === undefined) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  const result = await pool.query(
    `INSERT INTO productos (comercio_id, nombre, descripcion, precio, disponible, stock, imagen_url, categoria)
     VALUES ($1, $2, $3, $4, COALESCE($5, true), $6, $7, $8)
     RETURNING *`,
    [comercioId, nombre, descripcion, precio, disponible, stock, imagenUrl, categoria]
  );

  res.status(201).json(result.rows[0]);
});

module.exports = router;
