// CU-12 (Parte A): reglas de archivos y montos del formulario de transparencia.
import { describe, expect, it } from 'vitest';
import {
  MAX_BYTES,
  extensionDe,
  formatearTamano,
  limpiarMonto,
  mismoArchivo,
  separarArchivos,
  validarArchivo,
} from '../../src/utils/archivosTransparencia';

function archivo(nombre, bytes = 1024, lastModified = 1) {
  const f = new File(['x'], nombre, { lastModified });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

describe('extensionDe', () => {
  it.each([
    ['foto.JPG', 'jpg'],
    ['factura.final.pdf', 'pdf'],
    ['sin-extension', ''],
  ])('%s → "%s"', (nombre, esperado) => {
    expect(extensionDe(nombre)).toBe(esperado);
  });
});

describe('validarArchivo (fotos)', () => {
  it.each(['banca.jpg', 'banca.jpeg', 'banca.PNG'])('acepta %s', (nombre) => {
    expect(validarArchivo(archivo(nombre), 'foto')).toBe('');
  });

  it('rechaza una extensión no permitida', () => {
    expect(validarArchivo(archivo('virus.exe'), 'foto')).toBe('«virus.exe» no es válido: solo se permite JPG o PNG.');
  });

  it('acepta exactamente 5 MB y rechaza un byte más', () => {
    expect(validarArchivo(archivo('ok.png', MAX_BYTES), 'foto')).toBe('');
    expect(validarArchivo(archivo('grande.png', MAX_BYTES + 1), 'foto')).toBe('«grande.png» pesa 5.0 MB y el máximo es 5 MB.');
  });
});

describe('validarArchivo (comprobantes)', () => {
  it('acepta PDF y rechaza un .exe', () => {
    expect(validarArchivo(archivo('factura.pdf'), 'comprobante')).toBe('');
    expect(validarArchivo(archivo('virus.exe'), 'comprobante')).toMatch(/no es válido/);
  });
});

describe('separarArchivos', () => {
  it('separa los válidos de los inválidos con sus mensajes', () => {
    const { validos, errores } = separarArchivos([archivo('a.png'), archivo('b.gif'), archivo('c.jpg')], 'foto');

    expect(validos.map((f) => f.name)).toEqual(['a.png', 'c.jpg']);
    expect(errores).toEqual(['«b.gif» no es válido: solo se permite JPG o PNG.']);
  });
});

describe('mismoArchivo', () => {
  it('compara nombre, tamaño y fecha de modificación', () => {
    expect(mismoArchivo(archivo('a.png', 10, 1), archivo('a.png', 10, 1))).toBe(true);
    expect(mismoArchivo(archivo('a.png', 10, 1), archivo('a.png', 10, 2))).toBe(false);
    expect(mismoArchivo(archivo('a.png', 10, 1), archivo('a.png', 11, 1))).toBe(false);
  });
});

describe('formatearTamano', () => {
  it.each([
    [100, '1 KB'],
    [2048, '2 KB'],
    [1.5 * 1024 * 1024, '1.5 MB'],
  ])('%d bytes → %s', (bytes, texto) => {
    expect(formatearTamano(bytes)).toBe(texto);
  });
});

describe('limpiarMonto', () => {
  it.each([
    ['1500', '1500'],
    ['$1,500.509', '1500.50'],
    ['12.3.4', '12.34'],
    ['abc', ''],
  ])('"%s" → "%s"', (texto, esperado) => {
    expect(limpiarMonto(texto)).toBe(esperado);
  });
});
