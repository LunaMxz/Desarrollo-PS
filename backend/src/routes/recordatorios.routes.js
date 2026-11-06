import { Router } from 'express';
import {
  enviarRecordatorioHandler,
  marcarVistoHandler,
  recordatorioPendienteHandler,
} from '../controllers/recordatorios.controller.js';
import { requireAdmin, requireAuth, requireResident } from '../middlewares/auth.middleware.js';

const router = Router();
router.post('/', requireAuth, requireAdmin, enviarRecordatorioHandler);                // CU-14
router.get('/pendiente', requireAuth, requireResident, recordatorioPendienteHandler);  // CU-14
router.patch('/:id/visto', requireAuth, requireResident, marcarVistoHandler);          // CU-14
export default router;
