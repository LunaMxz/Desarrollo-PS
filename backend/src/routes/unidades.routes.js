import { Router } from 'express';
import { estadoCuentaHandler } from '../controllers/pagos.controller.js';
import { requireAuth, requireResident } from '../middlewares/auth.middleware.js';
const router = Router();
// La unidad se toma de req.user (revalidado contra la BD); el cliente no puede elegir otra.
router.get('/mi-estado-cuenta', requireAuth, requireResident, estadoCuentaHandler);
export default router;
