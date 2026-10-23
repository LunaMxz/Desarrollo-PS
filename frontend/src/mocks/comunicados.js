// CU-11: datos temporales con el contrato de GET /comunicados.
// Más de diez elementos permiten comprobar la paginación local.
export const comunicadosPrueba = Array.from({ length: 12 }, (_, indice) => ({
  id: 12 - indice,
  titulo: `Aviso de prueba ${12 - indice}`,
  contenido: 'Información de prueba para residentes.\nConsulta aquí los avisos de la administración.',
  fecha_publicacion: `2026-10-${String(23 - indice).padStart(2, '0')}T12:00:00.000Z`,
}));
