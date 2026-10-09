// CU-07: formatos del estado de cuenta.
import { describe, it, expect } from 'vitest';
import { etiquetaEstado, formatearFecha, formatearMonto, formatearPeriodo } from '../../src/utils/formatoEstadoCuenta';

describe('formatearMonto', () => {
  it('formatea números y textos numéricos (NUMERIC llega como texto desde pg)', () => {
    expect(formatearMonto(1500)).toBe('$1,500.00');
    expect(formatearMonto('1500.5')).toBe('$1,500.50');
    expect(formatearMonto(0)).toBe('$0.00');
  });

  it('muestra $0.00 si el valor no es numérico', () => {
    expect(formatearMonto(undefined)).toBe('$0.00');
    expect(formatearMonto('abc')).toBe('$0.00');
  });
});

describe('formatearPeriodo', () => {
  it("convierte 'YYYY-MM' en mes y año con mayúscula inicial", () => {
    expect(formatearPeriodo('2026-10')).toBe('Octubre 2026');
    expect(formatearPeriodo('2027-01')).toBe('Enero 2027');
  });

  it('regresa el texto original si el periodo no es válido', () => {
    expect(formatearPeriodo('2026-13')).toBe('2026-13');
    expect(formatearPeriodo('otro')).toBe('otro');
    expect(formatearPeriodo(null)).toBe('');
  });
});

describe('formatearFecha', () => {
  it('formatea una fecha ISO', () => {
    expect(formatearFecha('2026-10-05T18:00:00.000Z')).toMatch(/5 oct.* 2026/);
  });

  it('muestra un guion si la fecha falta o no es válida', () => {
    expect(formatearFecha(null)).toBe('—');
    expect(formatearFecha('no-es-fecha')).toBe('—');
  });
});

describe('etiquetaEstado', () => {
  it('traduce los estados del cargo', () => {
    expect(etiquetaEstado('pendiente')).toBe('Pendiente');
    expect(etiquetaEstado('parcial')).toBe('Parcial');
    expect(etiquetaEstado('pagado')).toBe('Pagado');
  });

  it('deja tal cual un estado desconocido', () => {
    expect(etiquetaEstado('otro')).toBe('otro');
  });
});
