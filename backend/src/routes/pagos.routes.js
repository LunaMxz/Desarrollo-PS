import { Router } from 'express';
import { listarCargosHandler, registrarPagoHandler} from '../controllers/pagos.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';
const router = Router();
router.get('/unidades/:id/cargos', requireAuth, requireAdmin, listarCargosHandler);
router.post('/', requireAuth, requireAdmin, registrarPagoHandler);
export default router;