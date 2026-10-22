import { Router } from 'express';
import { publicarTransparenciaHandler, listarTransparenciaHandler } from '../controllers/transparencia.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';
import { uploadTransparencia } from '../middlewares/upload.middleware.js';
const router = Router();
// La sesión y el rol se revisan antes de subir: un usuario sin permiso nunca guarda archivos
router.post('/', requireAuth, requireAdmin, uploadTransparencia, publicarTransparenciaHandler); // CU-12
router.get('/', requireAuth, listarTransparenciaHandler); // CU-12 (admin y residentes, solo lectura)
export default router;
