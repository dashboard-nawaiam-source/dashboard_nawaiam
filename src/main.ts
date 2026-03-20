import express from 'express';
import { config } from './infrastructure/config/config';
import { FinnegansHttp } from './infrastructure/http/finnegans.http';
import { AuthService } from './application/services/auth.service';
import { requireAuth } from './infrastructure/middleware/auth.middleware';
import { createAuthRoutes } from './presentation/routes/auth.routes';
import { createFacturaRoutes } from './presentation/routes/factura.routes';

const app = express();

// Middleware
app.use(express.json());

// Inicializar cliente HTTP de Finnegans (autorefresh token)
const finnegansHttp = new FinnegansHttp(
  config.finnegans.url,
  config.finnegans.clientId,
  config.finnegans.clientSecret,
);

const authService = new AuthService();

// RUTAS SIN PROTECCIÓN (login público)
app.use('/auth', createAuthRoutes(authService));

// RUTAS PROTEGIDAS (requieren token válido)
app.use('/facturas', requireAuth(authService), createFacturaRoutes(finnegansHttp));

// Iniciar servidor
if (require.main === module) {
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log(`API iniciada en puerto ${PORT}`);
    console.log(`Endpoint ejemplo:`);
    console.log(`   GET /facturas`);
    console.log('\n');
  });
}

export default app;
