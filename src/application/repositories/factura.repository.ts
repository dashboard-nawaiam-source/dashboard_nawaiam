import { FinnegansHttp } from '../../infrastructure/http/finnegans.http';
import { ICacheRepository } from '../../infrastructure/cache/cache.repository';
import { Factura } from '../../domain/entities/factura.entity';

export class FacturaRepository {
  private readonly CACHE_KEY = 'facturas:5years';
  private readonly CACHE_TTL = 3600; // 1 hora

  constructor(
    private http: FinnegansHttp,
    private cache: ICacheRepository,
  ) {}

  async obtenerTodas(): Promise<Factura[]> {
    try {
      console.log('🔍 Buscando en caché...');
      const cached = await this.cache.hgetall(this.CACHE_KEY);

      if (cached) {
        console.log('📦 Datos desde caché');
        return Object.values(cached) as Factura[];
      }

      console.log('📡 Solicitando datos de los últimos 5 años a Finnegans API...');
      const datos = await this.http.get<any[]>('/reports/ANAFACTURACION', {
        PARAMWEBREPORT_FechaDesde: this.obtenerPrimerDiaHace5Anos(),
        PARAMWEBREPORT_FechaHasta: this.obtenerUltimoDiaDelAño(),
        PARAMWEBREPORT_dimension: 'DIMCTC',
      });

      const facturas = Array.isArray(datos)
        ? datos.map(d => this.normalizar(d))
        : [];

      if (facturas.length > 0) {
        console.log('💾 Guardando en caché...');
        const cacheData: Record<string, any> = {};
        facturas.forEach((f, idx) => { cacheData[`factura:${idx}`] = f; });

        await this.cache.hset(this.CACHE_KEY, cacheData);
        await this.cache.expire(this.CACHE_KEY, this.CACHE_TTL);
      }

      console.log(`✅ ${facturas.length} facturas obtenidas`);
      return facturas;

    } catch (error) {
      console.error('❌ Error en FacturaRepository.obtenerTodas:', error);
      throw error;
    }
  }

  async obtenerPorMes(mes: string): Promise<Factura[]> {
    const todas = await this.obtenerTodas();
    return todas.filter(f => f.mes === mes);
  }

  async obtenerPorMeses(): Promise<Record<string, Factura[]>> {
    const todas = await this.obtenerTodas();
    const meses: Record<string, Factura[]> = {};
    todas.forEach(f => {
      if (!meses[f.mes]) meses[f.mes] = [];
      meses[f.mes].push(f);
    });
    return meses;
  }

  async obtenerPorAños(): Promise<Record<string, Factura[]>> {
    const todas = await this.obtenerTodas();
    const años: Record<string, Factura[]> = {};
    todas.forEach(f => {
      const año = f.mes.split('-')[1];
      if (!años[año]) años[año] = [];
      años[año].push(f);
    });
    return años;
  }

  async obtenerPorAño(año: string): Promise<Factura[]> {
    const todas = await this.obtenerTodas();
    return todas.filter(f => f.mes.endsWith(`-${año}`));
  }

  async invalidarCache(): Promise<void> {
    await this.cache.del(this.CACHE_KEY);
    console.log('🗑️ Caché invalidado');
  }

  private extraerMes(fecha: string): string {
    const partes = fecha.split('-');
    if (partes.length === 3) return `${partes[1]}-${partes[2]}`;
    return '';
  }

  private obtenerPrimerDiaHace5Anos(): string {
    const año = new Date().getFullYear() - 4;
    return `${año}-01-01`;
  }

  private obtenerUltimoDiaDelAño(): string {
    const año = new Date().getFullYear();
    return `${año}-12-31`;
  }

  private normalizar(data: any): Factura {
    const fecha = data.FECHA || '';
    return {
      transaccionId:   data.TRANSACCIONID?.toString() || '',
      fecha,
      mes:             this.extraerMes(fecha),
      cliente:         data.CLIENTE || '',
      vendedor:        data.VENDEDOR || '',
      producto:        data.PRODUCTO || '',
      total:           parseFloat(data.IMPORTEMONSECUNDARIA) || 0,
      totalBruto:      parseFloat(data.TOTALBRUTO) || 0,
      totalConceptos:  parseFloat(data.TOTALCONCEPTOS) || 0,
      cantidad:        parseFloat(data.CANTIDAD) || 0,
      estado:          data.ESTADO || '',
      condicionPago:   data.CONDICIONPAGO || '',
      moneda:          data.MONEDA || '',
      importePendiente: parseFloat(data.IMPORTENETOPENDIENTE) || 0,
      comprobante:     data.COMPROBANTE || '',
      descripcion:     data.DESCRIPCION || '',
      numeroContrato:  data.NUMEROCONTRATO || '',
      empresa:         data.EMPRESA || '',
      dimensionValor:  data.DIMENSIONVALOR || '',
    };
  }
}