// CU-15: regla de la etiqueta "Actualizada" y texto del aviso del inicio.
import { describe, expect, it } from 'vitest';
import {
  contarActualizadas,
  esActualizada,
  textoAvisoActualizadas,
} from '../../src/utils/incidenciasRecientes';

const AHORA = Date.parse('2026-11-06T12:00:00.000Z');
const DIA = 24 * 60 * 60 * 1000;
const hace = (dias) => new Date(AHORA - dias * DIA).toISOString();

describe('esActualizada', () => {
  it('cambió después de reportarse y dentro de los últimos 7 días', () => {
    expect(esActualizada({ fecha_creacion: hace(10), fecha_actualizacion: hace(2) }, AHORA)).toBe(true);
  });

  it('justo 7 días cuenta; un poco más ya no', () => {
    expect(esActualizada({ fecha_creacion: hace(20), fecha_actualizacion: hace(7) }, AHORA)).toBe(true);
    expect(esActualizada({ fecha_creacion: hace(20), fecha_actualizacion: hace(7.01) }, AHORA)).toBe(false);
  });

  it('no si nunca cambió desde que se reportó (aunque sea reciente)', () => {
    expect(esActualizada({ fecha_creacion: hace(1), fecha_actualizacion: hace(1) }, AHORA)).toBe(false);
  });

  it('no si faltan fechas o no son válidas', () => {
    expect(esActualizada({ fecha_creacion: hace(1) }, AHORA)).toBe(false);
    expect(esActualizada({ fecha_creacion: 'x', fecha_actualizacion: hace(1) }, AHORA)).toBe(false);
    expect(esActualizada(undefined, AHORA)).toBe(false);
  });
});

describe('contarActualizadas', () => {
  it('cuenta solo las actualizadas recientemente', () => {
    const incidencias = [
      { fecha_creacion: hace(3), fecha_actualizacion: hace(1) },
      { fecha_creacion: hace(3), fecha_actualizacion: hace(3) },
      { fecha_creacion: hace(30), fecha_actualizacion: hace(20) },
    ];
    expect(contarActualizadas(incidencias, AHORA)).toBe(1);
    expect(contarActualizadas(undefined, AHORA)).toBe(0);
  });
});

describe('textoAvisoActualizadas', () => {
  it('usa singular y plural', () => {
    expect(textoAvisoActualizadas(1)).toBe('Tienes 1 reporte actualizado recientemente');
    expect(textoAvisoActualizadas(3)).toBe('Tienes 3 reportes actualizados recientemente');
  });
});
