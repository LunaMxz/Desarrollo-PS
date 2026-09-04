import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Uso tipico en un repository:
// import { pool } from '../config/db.js';
// const result = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
