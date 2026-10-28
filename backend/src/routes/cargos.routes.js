import { Router } from 'express';
import { generarCargosHandler, reporteAdeudoHandler, totalAdeudoHandler } from '../controllers/cargos.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';
const router = Router();
router.post('/generar', requireAuth, requireAdmin, generarCargosHandler); // CU-06
router.get('/morosidad', requireAuth, requireAdmin, reporteAdeudoHandler);  // CU-14
router.get('/adeudo/total', requireAuth, requireAdmin, totalAdeudoHandler); // CU-14
export default router;
