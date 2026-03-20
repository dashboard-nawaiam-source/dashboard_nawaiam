class PdfSectionBuilder {
  constructor(token) {
    this._token = token;
  }

  // ── Fetching ───────────────────────────────────────────────────────────────

  async _fetchJSON(endpoint, mes, año) {
    const params = [];
    if (mes)      params.push(`mes=${mes}`);
    else if (año) params.push(`año=${año}`);
    const url = `/facturas/${endpoint}${params.length ? '?' + params.join('&') : ''}`;
    const res = await fetch(url, { headers: { 'x-auth-token': this._token } });
    return (await res.json()).data;
  }

  // ── Renderizado de charts offscreen ───────────────────────────────────────

  async _renderChart(type, data, options, ratio = 2.8) {
    const baseW  = 700;
    const baseH  = Math.round(baseW / ratio);
    const canvas = document.createElement('canvas');
    canvas.width  = baseW;
    canvas.height = baseH;
    canvas.style.cssText = 'position:absolute;left:-9999px';
    document.body.appendChild(canvas);

    const chart = new Chart(canvas.getContext('2d'), {
      type,
      data,
      options: { ...options, animation: false, responsive: false },
    });

    await new Promise(r => setTimeout(r, 150));
    const imgData = canvas.toDataURL('image/png');
    chart.destroy();
    document.body.removeChild(canvas);
    return { imgData, ratio };
  }

  // ── Builders por sección ───────────────────────────────────────────────────

  async buildGeneral(mes, año, incluirPP) {
    const d = await this._fetchJSON('dashboardGeneral', mes, año);

    let dimEntries = Object.entries(d.dimensiones || {});
    if (!incluirPP) dimEntries = dimEntries.filter(([k]) => !esPP(k));

    const ppVal         = calcularMontoPP(d.dimensiones);
    const totalMostrado = Number(d.totalVentas || 0) - (incluirPP ? 0 : ppVal);
    const totalLabel    = incluirPP ? 'Total' : 'Total sin prueba piloto';

    const labels = [totalLabel, ...dimEntries.map(([k]) => k), 'Promedio por factura', 'Cantidad facturas'];
    const values = [totalMostrado, ...dimEntries.map(([, v]) => v), d.promedioPorFactura, d.cantidadFacturas];
    const colors = ['#0ea5a4', ...dimEntries.map((_, i) => DIM_COLORS[i % DIM_COLORS.length]), '#f97316', '#60a5fa'];
    const max    = Math.max(...values.map(v => Math.abs(v) || 0));
    const scaled = values.map(v => max ? (v / max) * 100 : 0);

    const chartImg = await this._renderChart('bar', {
      labels,
      datasets: [{ label: 'Comparación (normalizada)', data: scaled, backgroundColor: colors }],
    }, {
      plugins: { legend: { display: false } },
      scales:  { y: { beginAtZero: true, ticks: { callback: v => v + '%' } } },
    });

    const rows = [
      `<tr><td><strong>${totalLabel}</strong></td><td>${formatMoney(totalMostrado)}</td></tr>`,
      ...dimEntries.map(([k, v]) => `<tr style="background:#f8fafc"><td>&nbsp;&nbsp;↳ ${k}</td><td>${formatMoney(v)}</td></tr>`),
      `<tr><td><strong>Promedio por Factura</strong></td><td>${formatMoney(d.promedioPorFactura)}</td></tr>`,
      `<tr><td><strong>Cantidad de Facturas</strong></td><td>${d.cantidadFacturas}</td></tr>`,
    ].join('');

    return { title: 'General', chartImgs: [chartImg], tableHtml: rows, tableHeaders: ['Métrica', 'Valor'] };
  }

  async buildProductos(mes, año, incluirPP) {
    const d     = await this._fetchJSON('ventas-por-producto', mes, año);
    const datos = incluirPP
      ? (d.datos || [])
      : (d.datos || []).filter(item => !esPP(item.dimensionValor));

    const catMap = {};
    datos.forEach(item => {
      const cat = mapProducto(item.producto);
      catMap[cat] = (catMap[cat] || 0) + item.totalVentas;
    });
    const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    const img1 = await this._renderChart('bar', {
      labels:   catEntries.map(([k]) => k),
      datasets: [{ label: 'Por categoría', data: catEntries.map(([, v]) => v), backgroundColor: '#60a5fa' }],
    }, { plugins: { tooltip: { callbacks: { label: c => formatMoney(c.raw) } } }, scales: { y: { ticks: { callback: v => formatMoney(v) } } } });

    const sorted = [...datos].sort((a, b) => b.totalVentas - a.totalVentas);
    const img2   = await this._renderChart('bar', {
      labels:   sorted.map(d => d.producto || 'Sin producto'),
      datasets: [{ label: 'Por subproducto', data: sorted.map(d => d.totalVentas), backgroundColor: '#a78bfa' }],
    }, { plugins: { tooltip: { callbacks: { label: c => formatMoney(c.raw) } } }, scales: { y: { ticks: { callback: v => formatMoney(v) } } } });

    const rows = catEntries.map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${formatMoney(v)}</td></tr>`).join('');
    return { title: 'Ventas por Producto', chartImgs: [img1, img2], tableHtml: rows, tableHeaders: ['Categoría', 'Total'] };
  }

  async buildVendedores(mes, año, incluirPP) {
    const d     = await this._fetchJSON('ranking-vendedores', mes, año);
    const datos = (d.datos || [])
      .map(d => ({ ...d, ingresos: incluirPP ? d.ingresos : d.ingresos - (d.ingresospp || 0) }))
      .sort((a, b) => b.ingresos - a.ingresos);

    const img  = await this._renderChart('bar', {
      labels:   datos.map(d => d.vendedor),
      datasets: [{ label: 'Ingresos', data: datos.map(d => d.ingresos), backgroundColor: '#22c55e' }],
    }, { plugins: { tooltip: { callbacks: { label: c => formatMoney(c.raw) } } }, scales: { y: { ticks: { callback: v => formatMoney(v) } } } });

    const rows = datos.map(d =>
      `<tr><td><strong>${d.vendedor}</strong></td><td>${formatMoney(d.ingresos)}</td><td>${d.cantidadVentas}</td></tr>`
    ).join('');
    return { title: 'Ranking Vendedores', chartImgs: [img], tableHtml: rows, tableHeaders: ['Vendedor', 'Ingresos', 'Ventas'] };
  }

  async buildContratos(mes, año, incluirPP) {
    const d        = await this._fetchJSON('contratos', mes, año);
    const tipoMap  = {};
    const segMap   = { B2B: { cantidad: 0, totalVentas: 0 }, Marketplace: { cantidad: 0, totalVentas: 0 } };
    const CTCOLORS = { Nuevos: '#0ea5a4', Recompra: '#0ea5a4', 'Orientación Vocacional': '#f97316', 'Conócete': '#f97316', Otros: '#f97316' };

    (d.datos || []).forEach(c => {
      const tipo  = mapContractType(c.numeroContrato);
      const seg   = getSegmentationType(c.numeroContrato);
      const monto = incluirPP ? c.totalVentas : c.totalVentasSinPP;
      if (!tipoMap[tipo]) tipoMap[tipo] = { totalVentas: 0, cantidad: 0 };
      tipoMap[tipo].totalVentas  += monto;
      tipoMap[tipo].cantidad     += c.cantidad;
      segMap[seg].cantidad       += c.cantidad;
      segMap[seg].totalVentas    += monto;
    });

    const orden  = ['Nuevos', 'Recompra', 'Orientación Vocacional', 'Conócete', 'Otros'];
    const labels = orden.filter(l => tipoMap[l]);

    const img1 = await this._renderChart('bar', {
      labels,
      datasets: [{ label: 'Total de ventas', data: labels.map(l => tipoMap[l].totalVentas), backgroundColor: labels.map(l => CTCOLORS[l] || '#60a5fa') }],
    }, { scales: { y: { beginAtZero: true } } });

    const segLabels = Object.keys(segMap);
    const segCants  = segLabels.map(k => segMap[k].cantidad);
    const img2      = await this._renderChart('doughnut', {
      labels:   segLabels,
      datasets: [{ data: segCants, backgroundColor: ['#0ea5a4', '#f97316'] }],
    }, { plugins: { legend: { display: true, position: 'bottom' } } }, 1.2);

    const totalV = labels.reduce((s, l) => s + tipoMap[l].totalVentas, 0);
    const totalC = labels.reduce((s, l) => s + tipoMap[l].cantidad, 0);
    const rows   = labels.map(l =>
      `<tr><td><strong>${l}</strong></td><td>${formatMoney(tipoMap[l].totalVentas)}</td><td>${tipoMap[l].cantidad}</td></tr>`
    ).join('') + `<tr style="border-top:2px solid #cbd5e1;background:#f1f5f9"><td><strong>Total</strong></td><td><strong>${formatMoney(totalV)}</strong></td><td><strong>${totalC}</strong></td></tr>`;

    return { title: 'Contratos', chartImgs: [img1, img2], tableHtml: rows, tableHeaders: ['Tipo de Contrato', 'Total de Ventas', 'Cantidad de Operaciones'] };
  }

  async buildEmpresas(mes, año, incluirPP) {
    const d          = await this._fetchJSON('empresas', mes, año);
    const empresaMap = {};

    (d.datos || []).forEach(f => {
      const region = mapEmpresa(f.empresa);
      if (!empresaMap[region]) empresaMap[region] = { ingresos: 0, ventas: 0, dimensiones: {} };
      empresaMap[region].ingresos += Number(f.totalVentas) || 0;
      empresaMap[region].ventas   += Number(f.cantidadFacturas) || 0;
      Object.entries(f.dimensiones || {}).forEach(([k, v]) => {
        empresaMap[region].dimensiones[k] = (empresaMap[region].dimensiones[k] || 0) + Number(v);
      });
    });

    const orden      = ['Argentina', 'España', 'Chile', 'Otros'];
    const sorted     = orden.filter(e => empresaMap[e]).map(e => [e, empresaMap[e]]);
    const chartImgs  = [];

    for (const [region, data] of sorted) {
      let dims = Object.entries(data.dimensiones || {}).sort((a, b) => b[1] - a[1]);
      if (!incluirPP) dims = dims.filter(([k]) => !esPP(k));
      const pp   = calcularMontoPP(data.dimensiones);
      const lbls = ['Total sin prueba piloto', ...dims.map(([k]) => k)];
      const vals = [Number(data.ingresos || 0) - pp, ...dims.map(([, v]) => v)];
      const cols = ['#0ea5a4', ...dims.map((_, i) => DIM_COLORS[i % DIM_COLORS.length])];

      const img = await this._renderChart('bar', {
        labels:   lbls,
        datasets: [{ label: region, data: vals, backgroundColor: cols }],
      }, {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => formatMoney(c.raw) } } },
        scales:  { y: { beginAtZero: true, ticks: { callback: v => formatMoney(v) } } },
      });
      chartImgs.push({ img, region });
    }

    const totalV = sorted.reduce((s, [, d]) => s + d.ventas, 0);
    const rows   = sorted.map(([emp, data]) => {
      const pp = calcularMontoPP(data.dimensiones);
      return `<tr><td><strong>${emp}</strong></td><td>${formatMoney(Number(data.ingresos || 0) - pp)}</td><td>${data.ventas}</td><td>${totalV > 0 ? ((data.ventas / totalV) * 100).toFixed(1) : 0}%</td></tr>`;
    }).join('');

    return {
      title:        'Empresas',
      chartImgs:    chartImgs.map(c => c.img),
      chartLabels:  chartImgs.map(c => c.region),
      tableHtml:    rows,
      tableHeaders: ['Empresa', 'Ingresos sin PP', 'Facturas', '% Ventas'],
    };
  }

  // ── Dispatcher principal ───────────────────────────────────────────────────

  async build(tabId, mes, año, incluirPP) {
    switch (tabId) {
      case 'general':    return this.buildGeneral(mes, año, incluirPP);
      case 'productos':  return this.buildProductos(mes, año, incluirPP);
      case 'vendedores': return this.buildVendedores(mes, año, incluirPP);
      case 'contratos':  return this.buildContratos(mes, año, incluirPP);
      case 'empresas':   return this.buildEmpresas(mes, año, incluirPP);
      default:           return null;
    }
  }
}