const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

const router = express.Router();

function generarTokens(usuario) {
  const payload = { id: usuario.id, rol: usuario.rol };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  });
  return { accessToken, refreshToken };
}

// POST /auth/registro
router.post("/registro", async (req, res) => {
  const { email, password, rol, nombre, telefono } = req.body;

  if (!email || !password || !rol || !nombre) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "La contrasena debe tener al menos 8 caracteres" });
  }

  const existente = await pool.query("SELECT id FROM usuarios WHERE email = $1", [email]);
  if (existente.rows.length > 0) {
    return res.status(409).json({ error: "Email ya registrado" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO usuarios (email, password_hash, nombre, telefono, rol)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, nombre, telefono, rol`,
    [email, passwordHash, nombre, telefono || null, rol]
  );

  const usuario = result.rows[0];
  const { accessToken, refreshToken } = generarTokens(usuario);

  res.status(201).json({ accessToken, refreshToken, usuario });
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Faltan credenciales" });
  }

  const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
  const usuarioDb = result.rows[0];

  if (!usuarioDb || !(await bcrypt.compare(password, usuarioDb.password_hash))) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  const { accessToken, refreshToken } = generarTokens(usuarioDb);
  const { password_hash, ...usuario } = usuarioDb;

  res.json({ accessToken, refreshToken, usuario });
});

// POST /auth/refresh
router.post("/refresh", (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "refreshToken requerido" });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const accessToken = jwt.sign(
      { id: payload.id, rol: payload.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
    );
    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ error: "Refresh token invalido o expirado" });
  }
});

module.exports = router;
