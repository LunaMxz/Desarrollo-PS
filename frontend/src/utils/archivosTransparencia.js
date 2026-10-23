// Reglas de archivos y catálogos del formulario de transparencia (CU-12).

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB por archivo

export const TIPOS_ARCHIVO = {
  foto: { extensiones: ['jpg', 'jpeg', 'png'], etiqueta: 'JPG o PNG' },
  comprobante: { extensiones: ['pdf', 'xml'], etiqueta: 'PDF o XML' },
};

// Mismos valores que el ENUM categoria_gasto de la BD
export const CATEGORIAS = [
  { valor: 'mantenimiento', etiqueta: 'Mantenimiento' },
  { valor: 'limpieza', etiqueta: 'Limpieza' },
  { valor: 'seguridad', etiqueta: 'Seguridad' },
  { valor: 'servicios', etiqueta: 'Servicios' },
  { valor: 'mejoras', etiqueta: 'Mejoras' },
  { valor: 'otros', etiqueta: 'Otros' },
];

export const MONTO_MAXIMO = 99999999.99; // NUMERIC(10,2)

export const formatoMoneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function extensionDe(nombre = '') {
  const i = nombre.lastIndexOf('.');
  return i === -1 ? '' : nombre.slice(i + 1).toLowerCase();
}

// Devuelve '' si el archivo es válido, o el mensaje de error
export function validarArchivo(archivo, tipo) {
  const { extensiones, etiqueta } = TIPOS_ARCHIVO[tipo];
  if (!extensiones.includes(extensionDe(archivo.name))) {
    return `«${archivo.name}» no es válido: solo se permite ${etiqueta}.`;
  }
  if (archivo.size > MAX_BYTES) {
    return `«${archivo.name}» pesa ${formatearTamano(archivo.size)} y el máximo es 5 MB.`;
  }
  return '';
}

export function separarArchivos(archivos, tipo) {
  const validos = [];
  const errores = [];
  archivos.forEach((archivo) => {
    const error = validarArchivo(archivo, tipo);
    if (error) errores.push(error);
    else validos.push(archivo);
  });
  return { validos, errores };
}

export function mismoArchivo(a, b) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

export function formatearTamano(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Deja solo dígitos y un punto decimal con máximo 2 decimales
export function limpiarMonto(texto) {
  const soloNumeros = texto.replace(/[^\d.]/g, '');
  const [entero, ...resto] = soloNumeros.split('.');
  if (resto.length === 0) return entero;
  return `${entero}.${resto.join('').slice(0, 2)}`;
}