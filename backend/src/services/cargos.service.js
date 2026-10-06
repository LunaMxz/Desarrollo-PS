import { insertarCargo } from '../repositories/cargos.repository.js';
import { obtenerUnidadesConResidenteActivo } from '../repositories/unidades.repository.js';

const CONCEPTO_DEFAULT = 'Cuota mensual';
const MAX_CONCEPTO = 100; // concepto es VARCHAR(100) en la BD
const MAX_MONTO = 99999999.99; // monto es NUMERIC(10,2) en la BD
const VIOLACION_UNICIDAD = '23505';

function periodoActual() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}`;
}

// CU-06: genera un cargo del periodo actual por cada unidad con residente activo
export async function generarCargosMensuales({ monto, concepto } = {}) {
  const montoNum = Number(monto);
  if (!Number.isFinite(montoNum) || montoNum <= 0) {
    const error = new Error('El monto debe ser un número mayor a 0');
    error.status = 400;
    throw error;
  }
  if (montoNum > MAX_MONTO) {
    const error = new Error(`El monto no puede ser mayor a ${MAX_MONTO}`);
    error.status = 400;
    throw error;
  }
  if (concepto !== undefined && concepto !== null && typeof concepto !== 'string') {
    const error = new Error('El campo "concepto" debe ser texto');
    error.status = 400;
    throw error;
  }
  const conceptoFinal = concepto?.trim() || CONCEPTO_DEFAULT;
  if (conceptoFinal.length > MAX_CONCEPTO) {
    const error = new Error(`El concepto no puede exceder ${MAX_CONCEPTO} caracteres`);
    error.status = 400;
    throw error;
  }

  const periodo = periodoActual();
  const unidades = await obtenerUnidadesConResidenteActivo();
  const cargos = [];
  const omitidas = [];
  for (const unidad of unidades) {
    try {
      const cargo = await insertarCargo({
        unidad_id: unidad.id,
        concepto: conceptoFinal,
        monto: montoNum,
        periodo,
      });
      cargos.push(cargo);
    } catch (err) {
      if (err.code !== VIOLACION_UNICIDAD) throw err;
      omitidas.push({ unidad_id: unidad.id, identificador: unidad.identificador });
    }
  }

  // Bloquear si todas las unidades ya tenían su cargo del periodo
  if (unidades.length > 0 && cargos.length === 0) {
    const error = new Error(
      `Los cargos del periodo ${periodo} ya fueron generados para todas las unidades con residente activo`
    );
    error.status = 409;
    throw error;
  }
  return { periodo, cargos, omitidas };
}
