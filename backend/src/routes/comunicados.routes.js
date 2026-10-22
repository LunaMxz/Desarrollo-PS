import { Router } from 'express';
import { publicarComunicadoHandler, listarComunicadosHandler } from '../controllers/comunicados.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';
const router = Router();
router.post('/', requireAuth, requireAdmin, publicarComunicadoHandler); // CU-10
router.get('/', requireAuth, listarComunicadosHandler);                // CU-11 (residente y admin)
export default router;
