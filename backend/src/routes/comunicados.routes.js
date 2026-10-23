import { Router } from 'express';
import { publicarComunicadoHandler } from '../controllers/comunicados.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';
const router = Router();
router.post('/', requireAuth, requireAdmin, publicarComunicadoHandler);
export default router;