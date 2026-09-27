-- Se ejecuta automaticamente la primera vez que se crea el contenedor de Postgres.
-- Basado en api-contract.yaml (schemas: Usuario, Comercio, Producto, Pedido, ItemPedido).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE rol_usuario AS ENUM ('cliente', 'comercio', 'repartidor', 'admin');

CREATE TYPE estado_pedido AS ENUM (
  'pendiente_pago',
  'confirmado',
  'en_preparacion',
  'listo_para_retirar',
  'en_camino',
  'entregado',
  'cancelado'
);

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT,
  rol rol_usuario NOT NULL,
  ultima_lat DOUBLE PRECISION,
  ultima_lng DOUBLE PRECISION,
  ultima_ubicacion_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE comercios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  direccion TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  abierto BOOLEAN NOT NULL DEFAULT true,
  horario TEXT,
  logo_url TEXT,
  costo_envio_base NUMERIC(10, 2) DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL REFERENCES comercios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10, 2) NOT NULL,
  disponible BOOLEAN NOT NULL DEFAULT true,
  stock INTEGER,
  imagen_url TEXT,
  categoria TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES usuarios(id),
  comercio_id UUID NOT NULL REFERENCES comercios(id),
  repartidor_id UUID REFERENCES usuarios(id),
  subtotal NUMERIC(10, 2) NOT NULL,
  costo_envio NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL,
  estado estado_pedido NOT NULL DEFAULT 'pendiente_pago',
  direccion_entrega TEXT NOT NULL,
  lat_entrega DOUBLE PRECISION,
  lng_entrega DOUBLE PRECISION,
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ItemPedido: entidad debil, no tiene sentido sin un pedido.
CREATE TABLE items_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  nombre_producto TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario NUMERIC(10, 2) NOT NULL,
  notas TEXT
);

CREATE INDEX idx_productos_comercio ON productos(comercio_id);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_comercio ON pedidos(comercio_id);
CREATE INDEX idx_items_pedido ON items_pedido(pedido_id);
