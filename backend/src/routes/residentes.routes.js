import { Router } from 'express';
import {
  crearResidenteHandler,
  listarResidentesHandler,
  obtenerResidenteHandler,
  desactivarResidenteHandler,
  cambiarRolHandler,
} from '../controllers/residentes.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, listarResidentesHandler);
router.get('/:id', requireAuth, requireAdmin, obtenerResidenteHandler);
router.post('/', requireAuth, requireAdmin, crearResidenteHandler);
router.patch('/:id/desactivar', requireAuth, requireAdmin, desactivarResidenteHandler);
router.patch('/:id/rol', requireAuth, requireAdmin, cambiarRolHandler);

export default router;
