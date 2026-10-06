import { Router } from 'express';
import { generarCargosHandler } from '../controllers/cargos.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';
const router = Router();
router.post('/generar', requireAuth, requireAdmin, generarCargosHandler); // CU-06
export default router;
