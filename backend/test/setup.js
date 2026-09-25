import { beforeEach, vi } from 'vitest';

// Variables de entorno fijas para que las pruebas no dependan del .env local.
// Ninguna prueba toca la BD real: los repositories siempre se mockean.
process.env.JWT_SECRET = 'secreto-de-pruebas';
process.env.JWT_EXPIRES_IN = '1h';

// Silencia los console.error del errorHandler y los console.log de
// "notificaciones" para que la salida de las pruebas quede limpia.
// Las pruebas que necesitan revisar estos logs vuelven a espiarlos.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
