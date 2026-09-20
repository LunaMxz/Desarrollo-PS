import { Router } from 'express';
import { asignarResponsableHandler } from '../controllers/incidencias.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';
const router = Router();
router.patch('/:id/responsable', requireAuth, requireAdmin, asignarResponsableHandler);
export default router;