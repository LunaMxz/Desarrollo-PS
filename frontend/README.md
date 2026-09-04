# Frontend - Cliente web

React + Vite.

## Estructura

```
src/
  api/         -> cliente HTTP (axios) para hablar con el backend
  context/     -> estado global (ej. sesion del usuario autenticado)
  components/  -> piezas reutilizables (botones, rutas protegidas, etc.)
  pages/       -> una vista completa por pantalla (ej. LoginPage, ResidentesPage)
```

## Como correr el proyecto

1. `npm install`
2. Crea un archivo `.env` con: `VITE_API_URL=http://localhost:3001`
3. `npm run dev` (levanta en http://localhost:5173)

## Donde poner tu codigo

Si te toca una tarjeta frontend (ej. CU-04), crea tu vista en `pages/`
(ej. `AltaResidentePage.jsx`) y agregala a las rutas en `App.jsx`.
