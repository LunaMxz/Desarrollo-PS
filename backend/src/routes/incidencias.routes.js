import { Router } from 'express';
import { listarIncidenciasHandler, asignarResponsableHandler, resolverIncidenciaHandler } from '../controllers/incidencias.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';
const router = Router();
router.get('/', requireAuth, requireAdmin, listarIncidenciasHandler);
router.patch('/:id/asignar', requireAuth, requireAdmin, asignarResponsableHandler);
router.patch('/:id/responsable', requireAuth, requireAdmin, asignarResponsableHandler);
router.patch('/:id/resolver', requireAuth, requireAdmin, resolverIncidenciaHandler);
export default router;