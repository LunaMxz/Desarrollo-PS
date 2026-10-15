import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Archivos subidos (fotos y comprobantes de Transparencia, CU-12)
app.use('/uploads', express.static('uploads'));

app.use('/', routes);

// Siempre al final: captura cualquier error no manejado en los controllers
app.use(errorHandler);

export default app;
