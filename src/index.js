require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const comerciosRoutes = require("./routes/comercios");
const productosRoutes = require("./routes/productos");
const pedidosRoutes = require("./routes/pedidos");
const repartidoresRoutes = require("./routes/repartidores");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/v1/auth", authRoutes);
app.use("/v1/comercios", comerciosRoutes);
app.use("/v1/productos", productosRoutes);
app.use("/v1/pedidos", pedidosRoutes);
app.use("/v1/repartidores", repartidoresRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API corriendo en http://localhost:${PORT}`));
