import { Router } from 'express';
import {
  listarIncidenciasHandler,
  asignarResponsableHandler,
} from '../controllers/incidencias.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, listarIncidenciasHandler);
router.patch('/:id/asignar', requireAuth, requireAdmin, asignarResponsableHandler); // CU-08, modificado por MV borralo si es necesario 

export default router;