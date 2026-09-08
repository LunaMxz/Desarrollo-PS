import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';               // <- CU-01, cuando lo creen
// import residentesRoutes from './residentes.routes.js';   // <- CU-04 / CU-05
const router = Router();
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
// router.use('/residentes', residentesRoutes);
export default router;