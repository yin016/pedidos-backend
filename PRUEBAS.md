# Pruebas del flujo completo

Corré estos comandos EN ORDEN, en una terminal nueva (dejá la de `docker compose up`
corriendo aparte). Copiá cada `id` de la respuesta anterior para usarlo en el siguiente
comando.

## 1. Registrar un cliente

```bash
curl -X POST http://localhost:3000/v1/auth/registro \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"cliente@test.com\",\"password\":\"12345678\",\"rol\":\"cliente\",\"nombre\":\"Cliente Test\"}"
```
Guardá el `accessToken` que te devuelve → lo vamos a usar como `CLIENTE_TOKEN`.

## 2. Registrar un comercio (usuario)

```bash
curl -X POST http://localhost:3000/v1/auth/registro \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"comercio@test.com\",\"password\":\"12345678\",\"rol\":\"comercio\",\"nombre\":\"Rotiseria Test\"}"
```
Guardá ese `accessToken` → `COMERCIO_TOKEN`.

## 3. Crear el comercio (el negocio en si)

Reemplazá `COMERCIO_TOKEN` por el token del paso 2:

```bash
curl -X POST http://localhost:3000/v1/comercios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer COMERCIO_TOKEN" \
  -d "{\"nombre\":\"Rotiseria Test\",\"categoria\":\"comida\",\"direccion\":\"Calle Falsa 123\",\"lat\":-30.85,\"lng\":-64.98,\"costoEnvioBase\":300}"
```
Guardá el `id` que devuelve → `COMERCIO_ID`.

## 4. Crear un producto en ese comercio

Reemplazá `COMERCIO_TOKEN` y `COMERCIO_ID`:

```bash
curl -X POST http://localhost:3000/v1/comercios/COMERCIO_ID/productos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer COMERCIO_TOKEN" \
  -d "{\"nombre\":\"Empanada de carne\",\"precio\":800,\"stock\":50}"
```
Guardá el `id` → `PRODUCTO_ID`.

## 5. Crear un pedido (como cliente)

Reemplazá `CLIENTE_TOKEN`, `COMERCIO_ID`, `PRODUCTO_ID`:

```bash
curl -X POST http://localhost:3000/v1/pedidos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer CLIENTE_TOKEN" \
  -d "{\"comercioId\":\"COMERCIO_ID\",\"items\":[{\"productoId\":\"PRODUCTO_ID\",\"cantidad\":3}],\"direccionEntrega\":\"Mi casa 456\"}"
```
Si te devuelve el pedido con `subtotal: 2400, costoEnvio: 300, total: 2700`, el flujo completo funciona: auth, stock, calculo de totales y guardado en base, todo en un solo paso.

## 6. Ver el pedido como cliente

```bash
curl http://localhost:3000/v1/pedidos \
  -H "Authorization: Bearer CLIENTE_TOKEN"
```

## 7. Cambiar el estado del pedido (como comercio)

Reemplazá `COMERCIO_TOKEN` y el `PEDIDO_ID` (del paso 5):

```bash
curl -X PATCH http://localhost:3000/v1/pedidos/PEDIDO_ID/estado \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer COMERCIO_TOKEN" \
  -d "{\"estado\":\"confirmado\"}"
```

Si todo esto responde sin errores 500, el nucleo del backend esta funcionando de punta a punta.
