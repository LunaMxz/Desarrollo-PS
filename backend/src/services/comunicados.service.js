import { insertarComunicado } from '../repositories/comunicados.repository.js';
const MAX_TITULO = 150;
export async function publicarComunicado({ titulo, contenido, autorId } = {}) {
  if (typeof titulo !== 'string' || !titulo.trim()) {
    const error = new Error('El campo "titulo" es obligatorio');
    error.status = 400;
    throw error;
  }
  if (typeof contenido !== 'string' || !contenido.trim()) {
    const error = new Error('El campo "contenido" es obligatorio');
    error.status = 400;
    throw error;
  }
  if (titulo.trim().length > MAX_TITULO) {
    const error = new Error(`El título no puede exceder ${MAX_TITULO} caracteres`);
    error.status = 400;
    throw error;
  }
  return insertarComunicado({
    titulo: titulo.trim(),
    contenido: contenido.trim(),
    autorId,
  });
}