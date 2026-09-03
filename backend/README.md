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
