# Backend - API REST

Node.js + Express + PostgreSQL.

## Arquitectura (principios SOLID)

Cada request fluye en una sola direccion. No te saltes capas:

```
routes/        -> define la URL y que controlador la atiende
controllers/   -> recibe el request/response, valida el input, llama al service
services/      -> contiene la logica de negocio (reglas del caso de uso)
repositories/  -> unica capa que toca la base de datos (queries SQL)
```

Ejemplo de flujo para un caso de uso nuevo:
`auth.routes.js` -> `auth.controller.js` -> `auth.service.js` -> `usuarios.repository.js`

Esto existe para que, si algun dia cambian de PostgreSQL a otra base de datos,
solo se toque la carpeta `repositories/` - nada mas se entera del cambio
(Principio de Inversion de Dependencias, la "D" de SOLID).

## Como correr el proyecto

1. Copia `.env.example` a `.env` y llena tus datos de conexion a PostgreSQL.
2. Crea la base de datos y corre el script `db/schema.sql` contra ella.
3. `npm install`
4. `npm run dev` (levanta con recarga automatica en http://localhost:3001)
5. Prueba que funciona: `GET http://localhost:3001/health` debe responder `{ "status": "ok" }`.

## Donde poner tu codigo

Si te toca una tarjeta backend (ej. CU-04 Alta de residente), crea:
- `controllers/residentes.controller.js`
- `services/residentes.service.js`
- `repositories/usuarios.repository.js` (o reutiliza uno ya existente si aplica)
- `routes/residentes.routes.js`, y registrala en `routes/index.js`

No pongas queries SQL en el controller ni en el service - eso va SOLO en repositories/.

## Pruebas automatizadas

Se usan [Vitest](https://vitest.dev) + [supertest](https://github.com/ladjs/supertest). Las pruebas
**no necesitan PostgreSQL**: los `repositories/` siempre se mockean.

```
npm test               # corre todas las pruebas una vez
npm run test:watch     # modo watch mientras desarrollas
npm run test:coverage  # reporte de cobertura (se genera en coverage/)
```

Estructura de `test/`:

```
test/
  setup.js                 -> variables de entorno de prueba (JWT_SECRET) y silencia logs
  helpers/fixtures.js      -> usuarios/incidencias de ejemplo y generador de tokens
  unit/                    -> reglas de negocio (services + middleware), una por caso de uso
    cu01-login.test.js
    cu03-reportar-incidencia.test.js
    cu04-alta-residente.test.js
    cu05-baja-residente.test.js
    cu08-gestionar-incidencias.test.js
    cu09-resolver-incidencia.test.js
  integration/             -> endpoints HTTP (rutas + controllers + permisos) con supertest
    auth.api.test.js
    residentes.api.test.js
    incidencias.api.test.js
```

Al agregar un caso de uso nuevo, crea su `test/unit/cuXX-*.test.js` y agrega sus endpoints al
archivo de `integration/` que corresponda.
