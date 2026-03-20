import { FacturaRepository } from '../repositories/factura.repository';
import { Factura } from '../../domain/entities/factura.entity';

export interface PeriodoResuelto {
  facturas: Factura[];
  mes: string; // MM-YYYY (o "01-YYYY" cuando es año completo)
  tipo:'mes' | 'año';
  mesFormato: string;
}

export interface CabeceraPeriodo {
  mes: string;
  mesFormato: string;
  tipo: 'mes' | 'año';
}

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export class PeriodoService {
  constructor(private repository: FacturaRepository) {}

  obtenerMesActual(): string {
    const hoy = new Date();
    return `${String(hoy.getMonth() + 1).padStart(2, '0')}-${hoy.getFullYear()}`;
  }

  obtenerAñoActual(): string {
    return new Date().getFullYear().toString();
  }

  formatearMes(mes: string, tipo: 'mes' | 'año'): string {
    const [mesNum, año] = mes.split('-');
    return tipo === 'año'
      ? año
      : `${NOMBRES_MESES[parseInt(mesNum) - 1]} ${año}`;
  }

  cabecera(p: PeriodoResuelto): CabeceraPeriodo {
    return {
      mes: p.tipo === 'año' ? p.mes.split('-')[1] : p.mes,
      mesFormato: p.mesFormato,
      tipo: p.tipo,
    };
  }

  /**
   * Punto central de resolución de período.
   * Determina qué facturas cargar según los parámetros recibidos.
   */
  async resolver(mesEspecifico?: string, añoEspecifico?: string): Promise<PeriodoResuelto> {
    let facturas: Factura[];
    let mes: string;
    let tipo: 'mes' | 'año';

    if (añoEspecifico) {
      facturas = await this.repository.obtenerPorAño(añoEspecifico);
      mes      = `01-${añoEspecifico}`;
      tipo     = 'año';
    } else {
      mes      = mesEspecifico || this.obtenerMesActual();
      facturas = await this.repository.obtenerPorMes(mes);
      tipo     = 'mes';
    }

    return { facturas, mes, tipo, mesFormato: this.formatearMes(mes, tipo) };
  }

  /**
   * Lista todos los meses y años disponibles en los datos.
   */
  async obtenerDisponibles(): Promise<{
    mesesActual:  string[];
    años:         string[];
    mesesPorAño:  Record<string, string[]>;
  }> {
    const meses     = await this.repository.obtenerPorMeses();
    const años      = await this.repository.obtenerPorAños();
    const añoActual = this.obtenerAñoActual();

    const mesesActualArray = Object.keys(meses)
      .filter(m => m.endsWith(`-${añoActual}`))
      .sort((a, b) => parseInt(b) - parseInt(a));

    const añosDisponibles = Object.keys(años)
      .sort((a, b) => parseInt(b) - parseInt(a));

    const mesesPorAño: Record<string, string[]> = {};
    for (const año of añosDisponibles) {
      mesesPorAño[año] = Object.keys(meses)
        .filter(m => m.endsWith(`-${año}`))
        .sort((a, b) => parseInt(b) - parseInt(a));
    }

    return { mesesActual: mesesActualArray, años: añosDisponibles, mesesPorAño };
  }
}