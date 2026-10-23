import { publicarComunicado, listarComunicados } from '../services/comunicados.service.js';
export async function publicarComunicadoHandler(req, res, next) {
  try {
    const { titulo, contenido } = req.body;
    const comunicado = await publicarComunicado({
      titulo,
      contenido,
      autorId: req.user.id,
    });
    res.status(201).json({
      message: 'Comunicado publicado exitosamente',
      comunicado,
    });
  } catch (err) {
    next(err);
  }
}

export async function listarComunicadosHandler(req, res, next) {
  try {
    const comunicados = await listarComunicados();
    res.json({ comunicados });
  } catch (err) {
    next(err);
  }
}
