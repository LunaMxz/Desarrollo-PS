Aqui va un archivo por recurso: `auth.controller.js`, `residentes.controller.js`, etc.

Un controller SOLO debe:
- leer el request (req.body, req.params, etc.)
- llamar al service correspondiente
- responder (res.json / res.status)

No debe tener logica de negocio ni queries SQL directas - eso va en services/ y repositories/.
