// Endpoint de prueba: confirma que el servidor y las rutas funcionan.
// GET /health -> { "status": "ok" }
export function getHealth(req, res) {
  res.json({ status: 'ok' });
}
