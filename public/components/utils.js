// ─── Paleta de colores para dimensiones ──────────────────────────────────────

const DIM_COLORS = [
  '#22c55e', '#60a5fa', '#f97316', '#a78bfa',
  '#f43f5e', '#facc15', '#34d399', '#fb923c',
];

// ─── Formateo ─────────────────────────────────────────────────────────────────

function formatMoney(v) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v);
}

function formatPct(v) {
  return (v * 100).toFixed(1) + '%';
}

// ─── Mapeos de dominio ────────────────────────────────────────────────────────

function mapEmpresa(empresa) {
  switch ((empresa?.trim().toLowerCase()) || '') {
    case 'nawaiam sa':          return 'Argentina';
    case 'nawaiam españa':      return 'España';
    case 'tu primera pega spa': return 'Chile';
    default:                    return 'Otros';
  }
}

function mapContractType(numeroContrato) {
  const c = numeroContrato?.trim().toLowerCase() || '';
  if (c === '0001')               return 'Nuevos';
  if (c === '0002')               return 'Recompra';
  if (c.includes('vocacional'))   return 'Orientación Vocacional';
  if (c.includes('conocete') || c.includes('conócete')) return 'Conócete';
  return 'Otros';
}

function getSegmentationType(numeroContrato) {
  return (numeroContrato === '0001' || numeroContrato === '0002') ? 'B2B' : 'Marketplace';
}

function mapProducto(producto) {
  const c = producto?.trim().toLowerCase() || '';
  if (c.includes('otros'))           return 'Otros Servicios';
  if (c.includes('representacion'))  return 'Representaciones';
  if (c.includes('vocacional'))      return 'Orientación Vocacional';
  if (c.includes('nawi'))            return 'Nawi';
  return 'Nawaiam';
}

// ─── Helpers de Prueba Piloto ────────────────────────────────────────────────

/** Suma el monto de las dimensiones que corresponden a "Prueba Piloto" */
function calcularMontoPP(dimensiones) {
  return Object.entries(dimensiones || {}).reduce(
    (acc, [k, v]) => acc + ((k || '').trim().toLowerCase() === 'prueba piloto' ? Number(v) : 0),
    0,
  );
}

/** Devuelve true si el dimensionValor es "Prueba Piloto" */
function esPP(dimensionValor) {
  return (dimensionValor || '').trim().toLowerCase() === 'prueba piloto';
}

// ─── Auth redirect helper ────────────────────────────────────────────────────

/**
 * Wrapper sobre Auth.fetch que redirige a /login si el token expiró.
 */
async function authFetch(url, options = {}) {
  try {
    const res = await Auth.fetch(url, options);
    return res;
  } catch (e) {
    if (e.message === 'AUTH_REQUIRED') {
      window.location.href = '/login';
      return null;
    }
    throw e;
  }
}