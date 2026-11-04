import { Router } from 'express';
import { listarIncidenciasHandler, asignarResponsableHandler, resolverIncidenciaHandler, crearIncidenciaHandler, misIncidenciasHandler } from '../controllers/incidencias.controller.js';
import { requireAuth, requireAdmin, requireResident } from '../middlewares/auth.middleware.js';
const router = Router();
router.post('/', requireAuth, crearIncidenciaHandler);
router.get('/', requireAuth, requireAdmin, listarIncidenciasHandler);
// CU-15: el residente ve solo las suyas; el id sale de la sesión, no de la URL
router.get('/mias', requireAuth, requireResident, misIncidenciasHandler);
router.patch('/:id/asignar', requireAuth, requireAdmin, asignarResponsableHandler);
router.patch('/:id/responsable', requireAuth, requireAdmin, asignarResponsableHandler);
router.patch('/:id/resolver', requireAuth, requireAdmin, resolverIncidenciaHandler);
export default router;