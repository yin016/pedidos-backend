# pedidos-backend

Nucleo backend (auth, comercios, productos, pedidos) para Pedidos Soto.
Node.js + Express + PostgreSQL, corriendo en Docker.

## Levantar el proyecto

1. Copiar el archivo de variables de entorno:
   ```
   cp .env.example .env
   ```
2. Levantar todo (API + base de datos):
   ```
   docker compose up --build
   ```
3. La API queda en `http://localhost:3000`, la base en `localhost:5432`
   (conectate con DBeaver igual que ya lo haces: usuario `pedidos`,
   password `pedidos`, base `pedidos_soto`).

Las tablas se crean solas la primera vez, desde `src/db/init.sql`.

## Probar que funciona

```
curl http://localhost:3000/health
```

## Estructura

```
src/
├── index.js          <- arranca el server
├── db/
│   ├── init.sql       <- crea las tablas (solo corre una vez)
│   └── pool.js         <- conexion a Postgres
├── middleware/
│   └── auth.js         <- valida JWT y roles
└── routes/
    ├── auth.js          <- /auth/registro, /auth/login, /auth/refresh
    ├── comercios.js      <- /comercios, /comercios/:id/productos
    ├── productos.js       <- /productos/:id
    └── pedidos.js          <- /pedidos y sus sub-rutas
```

## Pendiente de confirmar con el equipo

- Transiciones validas de `estado` en un pedido (por ahora: orden natural,
  con cancelacion permitida hasta "en_camino"). Ver `TRANSICIONES_VALIDAS`
  en `src/routes/pedidos.js`.
- Si Python (pagos) necesita leer/escribir en esta misma base, avisar antes
  de cambiar el esquema de `init.sql`.
