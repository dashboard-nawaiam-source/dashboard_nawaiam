import { Factura } from '../../domain/entities/factura.entity';

const SIN_DIMENSION   = 'Sin dimensión valor';
const PRUEBA_PILOTO   = 'prueba piloto';

export class DimensionService {
  esPruebaPiloto(dimensionValor: string): boolean {
    return (dimensionValor || '').trim().toLowerCase() === PRUEBA_PILOTO;
  }

  /**
   * Agrupa el total de ventas por dimensión, excluyendo "Sin dimensión valor".
   * Devuelve el resultado ordenado de mayor a menor.
   */
  agruparPorDimension(facturas: Factura[]): Record<string, number> {
    const dimensiones: Record<string, number> = {};

    for (const f of facturas) {
      const dim = f.dimensionValor;
      if (!dim || dim === SIN_DIMENSION) continue;
      dimensiones[dim] = (dimensiones[dim] || 0) + f.total;
    }

    return Object.fromEntries(
      Object.entries(dimensiones)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k, Math.round(v * 100) / 100]),
    );
  }

  /**
   * Calcula el monto total correspondiente a Prueba Piloto
   * a partir de un mapa de dimensiones { nombre: monto }.
   */
  calcularMontoPP(dimensiones: Record<string, number>): number {
    return Object.entries(dimensiones || {}).reduce(
      (acc, [k, v]) => acc + (this.esPruebaPiloto(k) ? Number(v) : 0),
      0,
    );
  }

  /**
   * Filtra las entradas de un mapa de dimensiones excluyendo Prueba Piloto.
   */
  filtrarSinPP(dimensiones: Record<string, number>): Record<string, number> {
    return Object.fromEntries(
      Object.entries(dimensiones).filter(([k]) => !this.esPruebaPiloto(k)),
    );
  }
}