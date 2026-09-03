# **Manual del Proyecto — Sistema de Gestión de Condominios**

## **1\. Para qué es cada carpeta**

**Backend**

* `db/schema.sql` — Script que crea todas las tablas de la base de datos  
* `src/routes/` — Las URLs que expone la API  
* `src/controllers/` — Recibe la petición y responde  
* `src/services/` — Reglas de negocio de cada caso de uso  
* `src/repositories/` — Único lugar que habla con la base de datos  
* `src/middlewares/` — Validaciones antes de atender la petición (ej. sesión válida)  
* `src/utils/` — Funciones de apoyo (JWT, hash de contraseñas)  
* `src/server.js` — Arranca el servidor (el primer archivo que corre)  
* `src/app.js` — Configura Express (conecta las rutas, middlewares y manejo de errores.

**Frontend**

* `src/pages/` — Una pantalla completa por vista  
* `src/components/` — Piezas reutilizables entre pantallas  
* `src/context/` — Datos compartidos entre pantallas (ej. sesión activa)  
* `src/api/` — Cómo el frontend le habla al backend

**Otros**

* `docs/` — Contexto del proyecto

---

## **2\. Herramientas que hay que instalar**

| Herramienta | Link de descarga |
| :---- | :---- |
| Node.js (v20+) | [https://nodejs.org](https://nodejs.org) |
| PostgreSQL (v15+) | [https://www.postgresql.org/download/](https://www.postgresql.org/download/) |
| Git | [https://git-scm.com/downloads](https://git-scm.com/downloads) |
| GitHub Desktop | [https://desktop.github.com](https://desktop.github.com) |
| Editor recomendado: VS Code | [https://code.visualstudio.com](https://code.visualstudio.com) |

Las librerías del proyecto (Express, React, etc.) NO se descargan aparte — se instalan solas al correr `npm install` dentro de `backend/` y `frontend/`.

---

## **3\. Cómo crear tu rama según tu caso de uso**

**Formato del nombre:**

feature/cuXX-descripcion-area

**Ejemplos:**

- `feature/cu01-login-backend`  
- `feature/cu01-login-frontend`  
- `feature/cu04-alta-residente-backend`  
- `feature/cu05-baja-residente-frontend`

**Pasos en GitHub Desktop:**

1. Verifica que estás parado en `develop` (arriba, "Current branch").  
2. Click en "Current branch" → "New branch".  
3. Escribe el nombre exacto (con el formato de arriba).  
4. Click "Publish branch".

---

## **4\. Cómo correr el proyecto en tu computadora**

**Backend:**

1. Copia `.env.example` a `.env`, llena tus datos de PostgreSQL.  
2. Crea la base de datos y corre `db/schema.sql` contra ella.  
3. `npm install`  
4. `npm run dev` → prueba en `http://localhost:3001/health`

**Frontend:**

1. Crea `.env` con: `VITE_API_URL=http://localhost:3001`  
2. `npm install`  
3. `npm run dev` → abre `http://localhost:5173`

---

## **5\. Antes de programar cada día**

Actualiza tu rama con lo último de `develop`: Branch → "Merge into current branch" → seleccionar `develop`.

---

## **6\. Cuando termines tu tarjeta**

1. Push a tu rama (no a `main`, no a `develop` directo).  
2. Abre un Pull Request hacia `develop` en GitHub.  
3. Espera revisión antes de mergear.

---

## **7\. Sprint 1 — qué se construye**

| CU | Qué es |
| :---- | :---- |
| CU-01 | Login (residentes y administradores) |
| CU-04 | Alta de residente |
| CU-05 | Baja de residente |

