const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// TODO: confirmar con el equipo las transiciones validas antes de ir a produccion.
// Por ahora: solo se puede avanzar en el orden natural, o cancelar desde cualquier
// estado previo a "en_camino".
const TRANSICIONES_VALIDAS = {
  pendiente_pago: ["confirmado", "cancelado"],
  confirmado: ["en_preparacion", "cancelado"],
  en_preparacion: ["listo_para_retirar", "cancelado"],
  listo_para_retirar: ["en_camino", "cancelado"],
  en_camino: ["entregado"],
  entregado: [],
  cancelado: [],
};

// POST /pedidos
router.post("/", requireAuth, async (req, res) => {
  const { comercioId, items, direccionEntrega, latEntrega, lngEntrega, notas } = req.body;

  if (!comercioId || !items || items.length === 0 || !direccionEntrega) {
    return res.status(400).json({ error: "Carrito vacio o faltan datos del pedido" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let subtotal = 0;
    const itemsValidados = [];

    for (const item of items) {
      const productoRes = await client.query(
        "SELECT * FROM productos WHERE id = $1 FOR UPDATE",
        [item.productoId]
      );
      const producto = productoRes.rows[0];

      if (!producto || !producto.disponible) {
        throw new Error("PRODUCTO_NO_DISPONIBLE");
      }
      if (producto.stock !== null && producto.stock < item.cantidad) {
        throw new Error("SIN_STOCK");
      }

      subtotal += Number(producto.precio) * item.cantidad;
      itemsValidados.push({
        productoId: producto.id,
        nombreProducto: producto.nombre,
        cantidad: item.cantidad,
        precioUnitario: producto.precio,
        notas: item.notas || null,
      });

      if (producto.stock !== null) {
        await client.query("UPDATE productos SET stock = stock - $1 WHERE id = $2", [
          item.cantidad,
          producto.id,
        ]);
      }
    }

    const comercioRes = await client.query("SELECT costo_envio_base FROM comercios WHERE id = $1", [
      comercioId,
    ]);
    const costoEnvio = Number(comercioRes.rows[0]?.costo_envio_base || 0);
    const total = subtotal + costoEnvio;

    const pedidoRes = await client.query(
      `INSERT INTO pedidos (cliente_id, comercio_id, subtotal, costo_envio, total, direccion_entrega, lat_entrega, lng_entrega, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.usuario.id, comercioId, subtotal, costoEnvio, total, direccionEntrega, latEntrega, lngEntrega, notas]
    );
    const pedido = pedidoRes.rows[0];

    for (const item of itemsValidados) {
      await client.query(
        `INSERT INTO items_pedido (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, notas)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [pedido.id, item.productoId, item.nombreProducto, item.cantidad, item.precioUnitario, item.notas]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ...pedido, items: itemsValidados });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.message === "PRODUCTO_NO_DISPONIBLE" || err.message === "SIN_STOCK") {
      return res.status(400).json({ error: "Carrito vacio o producto sin stock" });
    }
    console.error(err);
    res.status(500).json({ error: "Error al crear el pedido" });
  } finally {
    client.release();
  }
});

// GET /pedidos?estado= (filtrado por rol)
router.get("/", requireAuth, async (req, res) => {
  const { estado } = req.query;
  const condiciones = [];
  const valores = [];

  if (req.usuario.rol === "cliente") {
    valores.push(req.usuario.id);
    condiciones.push(`cliente_id = $${valores.length}`);
  } else if (req.usuario.rol === "comercio") {
    valores.push(req.usuario.id);
    condiciones.push(
      `comercio_id IN (SELECT id FROM comercios WHERE usuario_id = $${valores.length})`
    );
  } else if (req.usuario.rol === "repartidor") {
    valores.push(req.usuario.id);
    condiciones.push(`repartidor_id = $${valores.length}`);
  }
  // admin: sin filtro, ve todos

  if (estado) {
    valores.push(estado);
    condiciones.push(`estado = $${valores.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT * FROM pedidos ${where} ORDER BY creado_en DESC`,
    valores
  );
  res.json(result.rows);
});

// GET /pedidos/:pedidoId
router.get("/:pedidoId", requireAuth, async (req, res) => {
  const pedidoRes = await pool.query("SELECT * FROM pedidos WHERE id = $1", [req.params.pedidoId]);
  const pedido = pedidoRes.rows[0];
  if (!pedido) return res.status(404).json({ error: "No encontrado" });

  const itemsRes = await pool.query("SELECT * FROM items_pedido WHERE pedido_id = $1", [pedido.id]);
  res.json({ ...pedido, items: itemsRes.rows });
});

// PATCH /pedidos/:pedidoId/estado
router.patch("/:pedidoId/estado", requireAuth, async (req, res) => {
  const { pedidoId } = req.params;
  const { estado: nuevoEstado } = req.body;

  const actualRes = await pool.query("SELECT estado FROM pedidos WHERE id = $1", [pedidoId]);
  const pedidoActual = actualRes.rows[0];
  if (!pedidoActual) return res.status(404).json({ error: "No encontrado" });

  const permitidas = TRANSICIONES_VALIDAS[pedidoActual.estado] || [];
  if (!permitidas.includes(nuevoEstado)) {
    return res.status(409).json({ error: "Transicion de estado invalida" });
  }

  const result = await pool.query(
    "UPDATE pedidos SET estado = $1, actualizado_en = now() WHERE id = $2 RETURNING *",
    [nuevoEstado, pedidoId]
  );
  res.json(result.rows[0]);
});

// PATCH /pedidos/:pedidoId/asignar-repartidor
router.patch("/:pedidoId/asignar-repartidor", requireAuth, async (req, res) => {
  const { pedidoId } = req.params;
  const { repartidorId } = req.body;
  if (!repartidorId) return res.status(400).json({ error: "repartidorId requerido" });

  const result = await pool.query(
    "UPDATE pedidos SET repartidor_id = $1 WHERE id = $2 RETURNING *",
    [repartidorId, pedidoId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "No encontrado" });
  res.json(result.rows[0]);
});

module.exports = router;
