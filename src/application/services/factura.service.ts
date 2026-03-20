import { FacturaRepository } from '../repositories/factura.repository';
import { PeriodoService } from './periodo.service';
import { DimensionService } from './dimension.service';

export class FacturaService {
  private periodoService:   PeriodoService;
  private dimensionService: DimensionService;

  constructor(private repository: FacturaRepository) {
    this.periodoService   = new PeriodoService(repository);
    this.dimensionService = new DimensionService();
  }

  // ── Períodos disponibles ───────────────────────────────────────────────────

  async obtenerMesesDisponibles() {
    return this.periodoService.obtenerDisponibles();
  }

  // ── Consultas por período ──────────────────────────────────────────────────

  async obtenerDashboardGeneral(mesEspecifico?: string, añoEspecifico?: string) {
    const p = await this.periodoService.resolver(mesEspecifico, añoEspecifico);

    const totalVentas        = p.facturas.reduce((s, f) => s + f.total, 0);
    const cantidadFacturas   = p.facturas.length;
    const promedioPorFactura = cantidadFacturas > 0 ? totalVentas / cantidadFacturas : 0;
    const montoPendiente     = p.facturas.reduce((s, f) => s + f.importePendiente, 0);
    const dimensiones        = this.dimensionService.agruparPorDimension(p.facturas);

    return {
      ...this.periodoService.cabecera(p),
      totalVentas:       Math.round(totalVentas * 100) / 100,
      cantidadFacturas,
      dimensiones,
      promedioPorFactura: Math.round(promedioPorFactura * 100) / 100,
      montoPendiente:    Math.round(montoPendiente * 100) / 100,
    };
  }

  async obtenerVentasXProducto(mesEspecifico?: string, añoEspecifico?: string) {
    const p = await this.periodoService.resolver(mesEspecifico, añoEspecifico);

    const map = new Map<string, {
      totalVentas:     number;
      cantidadFacturas: number;
      montoPendiente:  number;
      dimensionValor:  string;
    }>();

    for (const f of p.facturas) {
      const key = f.producto || 'Sin producto';
      if (!map.has(key)) {
        map.set(key, { totalVentas: 0, cantidadFacturas: 0, montoPendiente: 0, dimensionValor: f.dimensionValor || '' });
      }
      const acc = map.get(key)!;
      acc.totalVentas      += f.total;
      acc.cantidadFacturas += 1;
      acc.montoPendiente   += f.importePendiente || 0;
    }

    return {
      ...this.periodoService.cabecera(p),
      datos: Array.from(map.entries()).map(([producto, data]) => ({
        producto,
        totalVentas:     Math.round(data.totalVentas * 100) / 100,
        cantidadFacturas: data.cantidadFacturas,
        montoPendiente:  Math.round(data.montoPendiente * 100) / 100,
        dimensionValor:  data.dimensionValor,
      })),
    };
  }

  async obtenerRankingVendedores(mesEspecifico?: string, añoEspecifico?: string) {
    const p = await this.periodoService.resolver(mesEspecifico, añoEspecifico);

    const map = new Map<string, {
      cantidadVentas: number;
      ingresos:       number;
      items:          { total: number; dimensionValor: string }[];
    }>();

    for (const f of p.facturas) {
      const key = f.vendedor || 'Sin vendedor';
      if (!map.has(key)) map.set(key, { cantidadVentas: 0, ingresos: 0, items: [] });
      const acc = map.get(key)!;
      acc.cantidadVentas += 1;
      acc.ingresos       += f.total;
      acc.items.push({ total: f.total, dimensionValor: f.dimensionValor || '' });
    }

    return {
      ...this.periodoService.cabecera(p),
      datos: Array.from(map.entries()).map(([vendedor, data]) => ({
        vendedor,
        cantidadVentas: data.cantidadVentas,
        ingresos:       Math.round(data.ingresos * 100) / 100,
        ingresospp:     Math.round(
          data.items
            .filter(i => this.dimensionService.esPruebaPiloto(i.dimensionValor))
            .reduce((s, i) => s + i.total, 0) * 100,
        ) / 100,
        dimensionValor: '',
      })),
    };
  }

  async obtenerContratos(mesEspecifico?: string, añoEspecifico?: string) {
    const p = await this.periodoService.resolver(mesEspecifico, añoEspecifico);

    const contratos: Record<string, {
      cantidad:         number;
      totalVentas:      number;
      totalVentasSinPP: number;
    }> = {};

    for (const f of p.facturas) {
      const key  = f.numeroContrato?.trim() || 'Otros';
      const esPP = this.dimensionService.esPruebaPiloto(f.dimensionValor);

      if (!contratos[key]) contratos[key] = { cantidad: 0, totalVentas: 0, totalVentasSinPP: 0 };
      contratos[key].cantidad         += 1;
      contratos[key].totalVentas      += f.total;
      if (!esPP) contratos[key].totalVentasSinPP += f.total;
    }

    return {
      ...this.periodoService.cabecera(p),
      datos: Object.entries(contratos).map(([numeroContrato, data]) => ({
        numeroContrato,
        cantidad:         data.cantidad,
        totalVentas:      Math.round(data.totalVentas * 100) / 100,
        totalVentasSinPP: Math.round(data.totalVentasSinPP * 100) / 100,
      })),
    };
  }

  async obtenerEmpresas(mesEspecifico?: string, añoEspecifico?: string) {
    const p = await this.periodoService.resolver(mesEspecifico, añoEspecifico);

    const empresas: Record<string, {
      cantidadFacturas: number;
      totalVentas:      number;
      dimensiones:      Record<string, number>;
    }> = {};

    for (const f of p.facturas) {
      const key = f.empresa?.trim() || 'Otros';
      if (!empresas[key]) empresas[key] = { cantidadFacturas: 0, totalVentas: 0, dimensiones: {} };
      empresas[key].cantidadFacturas += 1;
      empresas[key].totalVentas      += f.total;

      const dim = f.dimensionValor;
      if (dim && dim !== 'Sin dimensión valor') {
        empresas[key].dimensiones[dim] = (empresas[key].dimensiones[dim] || 0) + f.total;
      }
    }

    return {
      ...this.periodoService.cabecera(p),
      datos: Object.entries(empresas).map(([empresa, data]) => ({
        empresa,
        cantidadFacturas: data.cantidadFacturas,
        totalVentas:      Math.round(data.totalVentas * 100) / 100,
        dimensiones:      Object.fromEntries(
          Object.entries(data.dimensiones)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => [k, Math.round(v * 100) / 100]),
        ),
      })),
    };
  }

  async obtenerClientesUnicos(mesEspecifico?: string, añoEspecifico?: string) {
    const p = await this.periodoService.resolver(mesEspecifico, añoEspecifico);

    const clientesNuevos      = new Set<string>();
    const clientesRecompra    = new Set<string>();
    const clientesB2B         = new Set<string>();
    const clientesMarketplace = new Set<string>();

    for (const f of p.facturas) {
      const cliente  = f.cliente?.trim() || 'Sin cliente';
      const contrato = f.numeroContrato?.trim() || '';

      if (contrato === '0001') {
        clientesNuevos.add(cliente);
        clientesB2B.add(cliente);
      } else if (contrato === '0002') {
        clientesRecompra.add(cliente);
        clientesB2B.add(cliente);
      } else {
        clientesMarketplace.add(cliente);
      }
    }

    return {
      ...this.periodoService.cabecera(p),
      nuevos:      clientesNuevos.size,
      recompra:    clientesRecompra.size,
      b2bTotal:    clientesB2B.size,
      marketplace: clientesMarketplace.size,
      total:       new Set([...clientesB2B, ...clientesMarketplace]).size,
    };
  }

  async obtenerTodas() {
    return this.repository.obtenerTodas();
  }
}