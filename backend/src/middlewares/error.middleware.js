// Captura cualquier error lanzado (o pasado a next(err)) en controllers/services.
// Mantiene las respuestas de error consistentes en toda la API.
export function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
  });
}
