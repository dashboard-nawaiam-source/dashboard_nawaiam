import { Router } from 'express';
import { FacturaController } from '../controllers/factura.controller';
import { FacturaService } from '../../application/services/factura.service';
import { FacturaRepository } from '../../application/repositories/factura.repository';
import { RedisCacheRepository } from '../../infrastructure/cache/redis-cache.repository';
import { FinnegansHttp } from '../../infrastructure/http/finnegans.http';

export function createFacturaRoutes(http: FinnegansHttp): Router {
  const router = Router();

  const cache      = new RedisCacheRepository();
  const repository = new FacturaRepository(http, cache);
  const service    = new FacturaService(repository);
  const controller = new FacturaController(service);

  router.get('/meses',              (req, res) => controller.obtenerMesesDisponibles(req, res));
  router.get('/dashboardGeneral',   (req, res) => controller.obtenerDashboardGeneral(req, res));
  router.get('/ventas-por-producto',(req, res) => controller.obtenerVentasXProducto(req, res));
  router.get('/ranking-vendedores', (req, res) => controller.obtenerRankingVendedores(req, res));
  router.get('/contratos',          (req, res) => controller.obtenerContratos(req, res));
  router.get('/empresas',           (req, res) => controller.obtenerEmpresas(req, res));
  router.get('/clientes-unicos',    (req, res) => controller.obtenerClientesUnicos(req, res));
  router.get('/',                   (req, res) => controller.obtenerTodas(req, res));

  router.post('/cache/refresh', async (req, res) => {
    try {
      await repository.invalidarCache();
      res.json({ success: true, message: 'Caché eliminada, próxima petición traerá datos frescos' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Error limpiando caché' });
    }
  });

  return router;
}