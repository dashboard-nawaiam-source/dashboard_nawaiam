import { FacturaRepository } from '../repositories/factura.repository';

export class FacturaService {
  constructor(private repository: FacturaRepository) { }

  /**
   * Obtiene el mes actual en formato MM-YYYY
   */
  private obtenerMesActual(): string {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const año = hoy.getFullYear();
    return `${mes}-${año}`;
  }

  /**
   * Obtiene el año actual
   */
  private obtenerAñoActual(): string {
    return new Date().getFullYear().toString();
  }

  private agruparPorDimension(facturas: any[]): Record<string, number> {
    const dimensiones: Record<string, number> = {};
    for (const f of facturas) {
      const dim = f.dimensionValor;
      if (!dim || dim === 'Sin dimensión valor') continue;
      dimensiones[dim] = (dimensiones[dim] || 0) + f.total;
    }
    return Object.fromEntries(
      Object.entries(dimensiones)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k, Math.round(v * 100) / 100])
    );
  }

  /**
   * Obtiene todos los meses disponibles agrupados por año,
   * más la lista de años disponibles ordenados de más reciente a más antiguo.
   *
   * Respuesta:
   *   mesesPorAño: { "2026": ["01-2026","02-2026",...], "2025": [...], ... }
   *   años: ["2026","2025","2024",...]
   *
   * @deprecated mesesActual se mantiene por compatibilidad con el PDF nav-bar
   */
  async obtenerMesesDisponibles(): Promise<{
    mesesActual: string[];   // meses del año actual (compat)
    años: string[];
    mesesPorAño: Record<string, string[]>;
  }> {
    try {
      const meses = await this.repository.obtenerPorMeses();
      const años  = await this.repository.obtenerPorAños();

      const añoActual = this.obtenerAñoActual();

      // Meses del año actual, ordenados de más reciente a más antiguo (compat)
      const mesesActualArray = Object.keys(meses)
        .filter(m => m.endsWith(`-${añoActual}`))
        .sort((a, b) => parseInt(b) - parseInt(a));

      // Años disponibles, más recientes primero
      const añosDisponibles = Object.keys(años)
        .sort((a, b) => parseInt(b) - parseInt(a));

      // Todos los meses agrupados por año, cada grupo ordenado de más reciente a más antiguo
      const mesesPorAño: Record<string, string[]> = {};
      for (const año of añosDisponibles) {
        mesesPorAño[año] = Object.keys(meses)
          .filter(m => m.endsWith(`-${año}`))
          .sort((a, b) => parseInt(b) - parseInt(a));
      }

      return {
        mesesActual: mesesActualArray,
        años: añosDisponibles,
        mesesPorAño,
      };
    } catch (error) {
      console.error('Error en obtenerMesesDisponibles:', error);
      throw error;
    }
  }

  /**
   * Obtiene el dashboard general con estadísticas del mes actual
   */
  async obtenerDashboardGeneral(mesEspecifico?: string, añoEspecifico?: string): Promise<{
    mes: string;
    mesFormato: string;
    tipo: 'mes' | 'año';
    totalVentas: number;
    cantidadFacturas: number;
    dimensiones: Record<string, number>;
    promedioPorFactura: number;
    montoPendiente: number;
  }> {
    try {
      let facturas: any[] = [];
      let mes: string;
      let tipo: 'mes' | 'año' = 'mes';

      if (añoEspecifico) {
        facturas = await this.repository.obtenerPorAño(añoEspecifico);
        mes = `01-${añoEspecifico}`;
        tipo = 'año';
      } else {
        mes = mesEspecifico || this.obtenerMesActual();
        facturas = await this.repository.obtenerPorMes(mes);
      }

      const totalVentas = facturas.reduce((sum, f) => sum + f.total, 0);
      const cantidadFacturas = facturas.length;
      const promedioPorFactura = cantidadFacturas > 0 ? totalVentas / cantidadFacturas : 0;
      const montoPendiente = facturas.reduce((sum, f) => sum + f.importePendiente, 0);
      const dimensiones = this.agruparPorDimension(facturas);

      const [mesNum, año] = mes.split('-');
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const mesFormato = tipo === 'año'
        ? año
        : `${meses[parseInt(mesNum) - 1]} ${año}`;

      return {
        mes: tipo === 'año' ? año : mes,
        mesFormato,
        tipo,
        totalVentas: Math.round(totalVentas * 100) / 100,
        cantidadFacturas,
        dimensiones,
        promedioPorFactura: Math.round(promedioPorFactura * 100) / 100,
        montoPendiente: Math.round(montoPendiente * 100) / 100,
      };
    } catch (error) {
      console.error('Error en FacturaService.obtenerDashboardGeneral:', error);
      throw error;
    }
  }

  /**
   * Obtiene ventas por producto para un mes específico o año completo
   */
  async obtenerVentasXProducto(mesEspecifico?: string, añoEspecifico?: string): Promise<{
    mes: string;
    mesFormato: string;
    tipo: 'mes' | 'año';
    datos: {
      producto: string;
      totalVentas: number;
      cantidadFacturas: number;
      montoPendiente: number;
      dimensionValor: string;
    }[]
  }> {
    try {
      let facturas: any[] = [];
      let mes: string;
      let tipo: 'mes' | 'año' = 'mes';

      if (añoEspecifico) {
        facturas = await this.repository.obtenerPorAño(añoEspecifico);
        mes = `01-${añoEspecifico}`;
        tipo = 'año';
      } else {
        mes = mesEspecifico || this.obtenerMesActual();
        facturas = await this.repository.obtenerPorMes(mes);
      }

      const map = new Map<
        string,
        { totalVentas: number; cantidadFacturas: number; montoPendiente: number; dimensionValor: string }
      >();

      for (const f of facturas) {
        const key = f.producto || 'Sin producto';

        if (!map.has(key)) {
          map.set(key, {
            totalVentas: 0,
            cantidadFacturas: 0,
            montoPendiente: 0,
            dimensionValor: f.dimensionValor || '',
          });
        }

        const acc = map.get(key)!;
        acc.totalVentas += f.total;
        acc.cantidadFacturas += 1;
        acc.montoPendiente += f.importePendiente || 0;
      }

      const [mesNum, año] = mes.split('-');
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const mesFormato = tipo === 'año'
        ? año
        : `${meses[parseInt(mesNum) - 1]} ${año}`;

      return {
        mes: tipo === 'año' ? año : mes,
        mesFormato,
        tipo,
        datos: Array.from(map.entries()).map(([producto, data]) => ({
          producto,
          totalVentas: Math.round(data.totalVentas * 100) / 100,
          cantidadFacturas: data.cantidadFacturas,
          montoPendiente: Math.round(data.montoPendiente * 100) / 100,
          dimensionValor: data.dimensionValor,
        }))
      };
    } catch (error) {
      console.error('Error en obtenerVentasXProducto', error);
      throw error;
    }
  }

  /**
   * Obtiene ranking de vendedores para un mes específico o año completo
   */
  async obtenerRankingVendedores(mesEspecifico?: string, añoEspecifico?: string): Promise<{
    mes: string;
    mesFormato: string;
    tipo: 'mes' | 'año';
    datos: {
      vendedor: string;
      cantidadVentas: number;
      ingresos: number;
      dimensionValor: string;
    }[]
  }> {
    try {
      let facturas: any[] = [];
      let mes: string;
      let tipo: 'mes' | 'año' = 'mes';

      if (añoEspecifico) {
        facturas = await this.repository.obtenerPorAño(añoEspecifico);
        mes = `01-${añoEspecifico}`;
        tipo = 'año';
      } else {
        mes = mesEspecifico || this.obtenerMesActual();
        facturas = await this.repository.obtenerPorMes(mes);
      }

      // Acumular por vendedor conservando la lista de dimensiones para filtrar en frontend
      const map = new Map<
        string,
        { cantidadVentas: number; ingresos: number; items: { total: number; dimensionValor: string }[] }
      >();

      for (const f of facturas) {
        const key = f.vendedor || 'Sin vendedor';

        if (!map.has(key)) {
          map.set(key, { cantidadVentas: 0, ingresos: 0, items: [] });
        }

        const acc = map.get(key)!;
        acc.cantidadVentas += 1;
        acc.ingresos += f.total;
        acc.items.push({ total: f.total, dimensionValor: f.dimensionValor || '' });
      }

      const [mesNum, año] = mes.split('-');
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const mesFormato = tipo === 'año'
        ? año
        : `${meses[parseInt(mesNum) - 1]} ${año}`;

      return {
        mes: tipo === 'año' ? año : mes,
        mesFormato,
        tipo,
        datos: Array.from(map.entries()).map(([vendedor, data]) => ({
          vendedor,
          cantidadVentas: data.cantidadVentas,
          ingresos: Math.round(data.ingresos * 100) / 100,
          // Monto correspondiente solo a Prueba Piloto, para que el frontend pueda restar
          ingresospp: Math.round(
            data.items
              .filter(i => (i.dimensionValor || '').trim().toLowerCase() === 'prueba piloto')
              .reduce((s, i) => s + i.total, 0) * 100
          ) / 100,
          dimensionValor: '',  // campo de compat, no usado
        }))
      };
    } catch (error) {
      console.error('Error en obtenerRankingVendedores', error);
      throw error;
    }
  }

  /**
   * Obtiene contratos para un mes específico o año completo
   */
  async obtenerContratos(mesEspecifico?: string, añoEspecifico?: string): Promise<{
    mes: string;
    mesFormato: string;
    tipo: 'mes' | 'año';
    datos: {
      numeroContrato: string;
      cantidad: number;
      totalVentas: number;
      totalVentasSinPP: number;
    }[]
  }> {
    try {
      let facturas: any[] = [];
      let mes: string;
      let tipo: 'mes' | 'año' = 'mes';

      if (añoEspecifico) {
        facturas = await this.repository.obtenerPorAño(añoEspecifico);
        mes = `01-${añoEspecifico}`;
        tipo = 'año';
      } else {
        mes = mesEspecifico || this.obtenerMesActual();
        facturas = await this.repository.obtenerPorMes(mes);
      }

      const contratos: {
        [key: string]: { cantidad: number; totalVentas: number; totalVentasSinPP: number }
      } = {};

      for (const f of facturas) {
        const numeroContrato = f.numeroContrato?.trim() || 'Otros';
        const esPP = (f.dimensionValor || '').trim().toLowerCase() === 'prueba piloto';

        if (!contratos[numeroContrato]) {
          contratos[numeroContrato] = { cantidad: 0, totalVentas: 0, totalVentasSinPP: 0 };
        }

        contratos[numeroContrato].cantidad += 1;
        contratos[numeroContrato].totalVentas += f.total;
        if (!esPP) contratos[numeroContrato].totalVentasSinPP += f.total;
      }

      const [mesNum, año] = mes.split('-');
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const mesFormato = tipo === 'año'
        ? año
        : `${meses[parseInt(mesNum) - 1]} ${año}`;

      return {
        mes: tipo === 'año' ? año : mes,
        mesFormato,
        tipo,
        datos: Object.entries(contratos).map(([numeroContrato, data]) => ({
          numeroContrato,
          cantidad: data.cantidad,
          totalVentas: Math.round(data.totalVentas * 100) / 100,
          totalVentasSinPP: Math.round(data.totalVentasSinPP * 100) / 100,
        }))
      };
    } catch (error) {
      console.error('Error en obtenerContratos', error);
      throw error;
    }
  }

  /**
   * Obtiene empresas para un mes específico o año completo
   */
  async obtenerEmpresas(mesEspecifico?: string, añoEspecifico?: string): Promise<{
    mes: string;
    mesFormato: string;
    tipo: 'mes' | 'año';
    datos: {
      empresa: string;
      cantidadFacturas: number;
      totalVentas: number;
      dimensiones: Record<string, number>;
    }[]
  }> {
    try {
      let facturas: any[] = [];
      let mes: string;
      let tipo: 'mes' | 'año' = 'mes';

      if (añoEspecifico) {
        facturas = await this.repository.obtenerPorAño(añoEspecifico);
        mes = `01-${añoEspecifico}`;
        tipo = 'año';
      } else {
        mes = mesEspecifico || this.obtenerMesActual();
        facturas = await this.repository.obtenerPorMes(mes);
      }

      const empresas: {
        [key: string]: {
          cantidadFacturas: number;
          totalVentas: number;
          dimensiones: Record<string, number>;
        }
      } = {};

      for (const f of facturas) {
        const empresa = f.empresa?.trim() || 'Otros';

        if (!empresas[empresa]) {
          empresas[empresa] = { cantidadFacturas: 0, totalVentas: 0, dimensiones: {} };
        }

        empresas[empresa].cantidadFacturas += 1;
        empresas[empresa].totalVentas += f.total;

        const dim = f.dimensionValor;
        if (dim && dim !== 'Sin dimensión valor') {
          empresas[empresa].dimensiones[dim] =
            (empresas[empresa].dimensiones[dim] || 0) + f.total;
        }
      }

      const [mesNum, año] = mes.split('-');
      const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const mesFormato = tipo === 'año'
        ? año
        : `${meses[parseInt(mesNum) - 1]} ${año}`;

      return {
        mes: tipo === 'año' ? año : mes,
        mesFormato,
        tipo,
        datos: Object.entries(empresas).map(([empresa, data]) => ({
          empresa,
          cantidadFacturas: data.cantidadFacturas,
          totalVentas: Math.round(data.totalVentas * 100) / 100,
          dimensiones: Object.fromEntries(
            Object.entries(data.dimensiones)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => [k, Math.round(v * 100) / 100])
          ),
        }))
      };
    } catch (error) {
      console.error('Error en obtenerEmpresas', error);
      throw error;
    }
  }

  /**
   * Obtiene clientes únicos por tipo de contrato para un mes específico o año completo.
   */
  async obtenerClientesUnicos(mesEspecifico?: string, añoEspecifico?: string): Promise<{
    mes: string;
    mesFormato: string;
    tipo: 'mes' | 'año';
    nuevos: number;
    recompra: number;
    b2bTotal: number;
    marketplace: number;
    total: number;
  }> {
    try {
      let facturas: any[] = [];
      let mes: string;
      let tipo: 'mes' | 'año' = 'mes';

      if (añoEspecifico) {
        facturas = await this.repository.obtenerPorAño(añoEspecifico);
        mes = `01-${añoEspecifico}`;
        tipo = 'año';
      } else {
        mes = mesEspecifico || this.obtenerMesActual();
        facturas = await this.repository.obtenerPorMes(mes);
      }

      const clientesNuevos      = new Set<string>();
      const clientesRecompra    = new Set<string>();
      const clientesB2B         = new Set<string>();
      const clientesMarketplace = new Set<string>();

      for (const f of facturas) {
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

      const [mesNum, año] = mes.split('-');
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const mesFormato = tipo === 'año' ? año : `${meses[parseInt(mesNum) - 1]} ${año}`;

      return {
        mes: tipo === 'año' ? año : mes,
        mesFormato,
        tipo,
        nuevos:      clientesNuevos.size,
        recompra:    clientesRecompra.size,
        b2bTotal:    clientesB2B.size,
        marketplace: clientesMarketplace.size,
        total:       new Set([...clientesB2B, ...clientesMarketplace]).size,
      };
    } catch (error) {
      console.error('Error en obtenerClientesUnicos', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las facturas
   */
  async obtenerTodas() {
    return this.repository.obtenerTodas();
  }
}