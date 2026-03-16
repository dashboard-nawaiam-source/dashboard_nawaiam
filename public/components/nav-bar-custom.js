/*
NavBarCustom es un componente web que implementa una barra de navegación personalizada
 para un dashboard de facturación. Incluye un selector de pestañas para navegar entre 
 diferentes vistas del dashboard y un botón para generar un PDF con la información mostrada.

Al hacer clic en el botón de generar PDF, se abre un modal que permite 
 seleccionar el período a incluir y las pestañas que se desean exportar. 
 El PDF se genera utilizando jsPDF, renderizando gráficos con Chart.js en canvases offscreen
 y extrayendo su dataURL para incluirlos en el PDF. La información de cada pestaña se obtiene 
 mediante llamadas a endpoints específicos, y se formatea adecuadamente para su presentación en el PDF.
*/
class NavBarCustom extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px">
        <label style="font-weight:600;margin-right:8px">Dashboard</label>
        <select id="nav-select">
          <option value="/facturas">General</option>
          <option value="/productos">Ventas por producto</option>
          <option value="/vendedores">Ranking vendedores</option>
          <option value="/contratos">Contratos</option>
          <option value="/empresas">Empresas</option>
          <option value="/kpis">KPIs</option>
        </select>
      </div>
      <div style="margin-bottom:16px">
        <button id="nav-pdf-btn" style="
          padding:7px 16px;
          background:#0ea5a4;
          color:#fff;
          border:none;
          border-radius:6px;
          font-weight:600;
          font-size:13px;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          gap:6px;
        ">
          ↓ Descargar PDF
        </button>
      </div>

      <!-- Modal PDF -->
      <div id="pdf-modal-overlay" style="
        display:none;
        position:fixed;
        inset:0;
        background:rgba(0,0,0,0.45);
        z-index:9999;
        align-items:center;
        justify-content:center;
      ">
        <div style="
          background:#fff;
          border-radius:10px;
          padding:28px 32px;
          width:100%;
          max-width:420px;
          box-shadow:0 8px 32px rgba(0,0,0,0.18);
          position:relative;
        ">
          <h2 style="font-size:17px;font-weight:700;margin-bottom:4px;color:#0f172a">Generar PDF</h2>
          <p style="font-size:13px;color:#64748b;margin-bottom:20px">Seleccioná el período y las pestañas a incluir.</p>

          <!-- Selector período -->
          <div style="margin-bottom:18px">
            <label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px">Período</label>
            <select id="pdf-periodo-select" style="
              width:100%;padding:8px 10px;
              border:1px solid #e2e8f0;border-radius:6px;
              font-size:14px;
            ">
              <option value="">Cargando...</option>
            </select>
          </div>

          <!-- Pestañas -->
          <div style="margin-bottom:18px">
            <label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:10px">Pestañas a incluir</label>
            <div style="display:flex;flex-direction:column;gap:8px" id="pdf-tabs-list">
              <!-- generado dinámicamente -->
            </div>
          </div>

          <!-- Toggle PP — solo visible si General está chequeado -->
          <div id="pdf-pp-row" style="
            display:none;
            align-items:center;
            gap:10px;
            margin-bottom:18px;
            padding:10px 12px;
            background:#f8fafc;
            border:1px solid #e2e8f0;
            border-radius:6px;
          ">
            <label style="position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0">
              <input type="checkbox" id="pdf-toggle-pp" style="opacity:0;width:0;height:0;position:absolute">
              <span id="pdf-pp-slider" style="
                position:absolute;cursor:pointer;inset:0;
                background:#e2e8f0;border-radius:20px;transition:.2s;
              "></span>
              <span id="pdf-pp-knob" style="
                position:absolute;content:'';height:14px;width:14px;
                left:3px;bottom:3px;background:#fff;border-radius:50%;
                transition:.2s;pointer-events:none;
              "></span>
            </label>
            <label for="pdf-toggle-pp" style="font-size:13px;color:#475569;cursor:pointer">Incluir Prueba Piloto en General</label>
          </div>

          <!-- Botones -->
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
            <button id="pdf-cancel-btn" style="
              padding:8px 18px;border:1px solid #e2e8f0;
              background:#fff;border-radius:6px;
              font-size:13px;font-weight:600;cursor:pointer;color:#475569;
            ">Cancelar</button>
            <button id="pdf-generate-btn" style="
              padding:8px 18px;background:#0ea5a4;
              color:#fff;border:none;border-radius:6px;
              font-size:13px;font-weight:600;cursor:pointer;
            ">Generar PDF</button>
          </div>

          <!-- Estado generando -->
          <div id="pdf-loading" style="
            display:none;
            position:absolute;inset:0;
            background:rgba(255,255,255,0.92);
            border-radius:10px;
            align-items:center;justify-content:center;
            flex-direction:column;gap:12px;
            font-size:14px;font-weight:600;color:#0ea5a4;
          ">
            <div id="pdf-loading-spinner" style="
              width:32px;height:32px;
              border:3px solid #e2e8f0;
              border-top-color:#0ea5a4;
              border-radius:50%;
              animation:spin .8s linear infinite;
            "></div>
            <span id="pdf-loading-msg">Generando PDF...</span>
          </div>
        </div>
      </div>

      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
        #nav-pdf-btn:hover { background:#0d9488; }
      </style>
    `;

    // Nav select
    const select = this.querySelector('#nav-select');
    select.value = window.location.pathname;
    select.addEventListener('change', e => { window.location.href = e.target.value; });

    // Tabs config
    const TABS = [
      { id: 'general',   label: 'General',             endpoint: 'dashboardGeneral',    available: true },
      { id: 'productos', label: 'Ventas por Producto',  endpoint: 'ventas-por-producto', available: true },
      { id: 'vendedores',label: 'Ranking Vendedores',   endpoint: 'ranking-vendedores',  available: true },
      { id: 'contratos', label: 'Contratos',            endpoint: 'contratos',           available: true },
      { id: 'empresas',  label: 'Empresas',             endpoint: 'empresas',            available: true },
      { id: 'kpis',      label: 'KPIs (no disponible)', endpoint: null,                  available: false },
    ];

    // Render checkboxes
    const tabsList = this.querySelector('#pdf-tabs-list');
    TABS.forEach(tab => {
      const row = document.createElement('label');
      row.style.cssText = `display:flex;align-items:center;gap:8px;font-size:14px;cursor:${tab.available ? 'pointer' : 'not-allowed'};color:${tab.available ? '#0f172a' : '#94a3b8'}`;
      row.innerHTML = `
        <input type="checkbox" data-tab="${tab.id}" ${tab.available ? '' : 'disabled'}
          style="width:15px;height:15px;cursor:${tab.available ? 'pointer' : 'not-allowed'}">
        ${tab.label}
      `;
      tabsList.appendChild(row);
    });

    // Toggle PP visibility when General checkbox changes
    const togglePPRow = () => {
      const generalCb = this.querySelector('[data-tab="general"]');
      const ppRow = this.querySelector('#pdf-pp-row');
      ppRow.style.display = generalCb.checked ? 'flex' : 'none';
    };
    this.querySelector('[data-tab="general"]').addEventListener('change', togglePPRow);

    // Toggle PP slider visual
    const ppInput = this.querySelector('#pdf-toggle-pp');
    const ppSlider = this.querySelector('#pdf-pp-slider');
    const ppKnob = this.querySelector('#pdf-pp-knob');
    ppInput.addEventListener('change', () => {
      if (ppInput.checked) {
        ppSlider.style.background = '#0ea5a4';
        ppKnob.style.transform = 'translateX(16px)';
      } else {
        ppSlider.style.background = '#e2e8f0';
        ppKnob.style.transform = 'translateX(0)';
      }
    });

    // Open/close modal
    const overlay = this.querySelector('#pdf-modal-overlay');
    this.querySelector('#nav-pdf-btn').addEventListener('click', () => {
      overlay.style.display = 'flex';
      this._cargarPeriodos();
    });
    this.querySelector('#pdf-cancel-btn').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });

    // Generate
    this.querySelector('#pdf-generate-btn').addEventListener('click', () => this._generarPDF());
  }

  async _cargarPeriodos() {
    try {
      const token = localStorage.getItem('dashboard_token');
      const res = await fetch('/facturas/meses', { headers: { 'x-auth-token': token } });
      const json = await res.json();
      const mesesActual = json.data.mesesActual || [];
      const años = json.data.años || [];

      const sel = this.querySelector('#pdf-periodo-select');
      sel.innerHTML = '';
      const mesesNombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

      mesesActual.forEach(mes => {
        const opt = document.createElement('option');
        opt.value = `mes:${mes}`;
        const [mn, an] = mes.split('-');
        opt.textContent = `${mesesNombres[parseInt(mn)-1]} ${an}`;
        sel.appendChild(opt);
      });
      if (mesesActual.length && años.length) {
        const sep = document.createElement('option');
        sep.disabled = true; sep.textContent = 'Acumulados Anuales:';
        sel.appendChild(sep);
      }
      años.forEach(año => {
        const opt = document.createElement('option');
        opt.value = `año:${año}`;
        opt.textContent = `${año}`;
        sel.appendChild(opt);
      });
    } catch(e) { console.error('Error cargando períodos:', e); }
  }

  async _fetchJSON(endpoint, mes, año) {
    const token = localStorage.getItem('dashboard_token');
    const params = [];
    if (mes) params.push(`mes=${mes}`);
    if (año) params.push(`año=${año}`);
    const url = `/facturas/${endpoint}${params.length ? '?' + params.join('&') : ''}`;
    const res = await fetch(url, { headers: { 'x-auth-token': token } });
    const json = await res.json();
    return json.data;
  }

  _formatMoney(v) {
    return new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS' }).format(v);
  }

  _mapProducto(producto) {
    const c = producto?.trim().toLowerCase() || '';
    if (c.includes('otros')) return 'Otros Servicios';
    if (c.includes('representacion')) return 'Representaciones';
    if (c.includes('vocacional')) return 'Orientación Vocacional';
    if (c.includes('nawi')) return 'Nawi';
    return 'Nawaiam';
  }

  _mapEmpresa(empresa) {
    const c = empresa?.trim().toLowerCase() || '';
    switch(c) {
      case 'nawaiam sa': return 'Argentina';
      case 'nawaiam españa': return 'España';
      case 'tu primera pega spa': return 'Chile';
      default: return 'Otros';
    }
  }

  _mapContractType(n) {
    const c = n.trim().toLowerCase();
    switch(c) {
      case '0001': return 'Nuevos';
      case '0002': return 'Recompra';
      case 'orientación vocacional': return 'Orientación Vocacional';
      case 'conócete': return 'Conócete';
      default: return 'Otros';
    }
  }

  // Renderiza un Chart.js en un canvas offscreen y devuelve { imgData, ratio }
  async _renderChart(type, data, options, ratio = 2.8) {
    const baseW = 700;
    const baseH = Math.round(baseW / ratio);
    const canvas = document.createElement('canvas');
    canvas.width  = baseW;
    canvas.height = baseH;
    canvas.style.position = 'absolute';
    canvas.style.left = '-9999px';
    document.body.appendChild(canvas);
    const chart = new Chart(canvas.getContext('2d'), {
      type,
      data,
      options: { ...options, animation: false, responsive: false }
    });
    await new Promise(r => setTimeout(r, 150));
    const imgData = canvas.toDataURL('image/png');
    chart.destroy();
    document.body.removeChild(canvas);
    return { imgData, ratio };
  }

  // Construye la sección de cada pestaña: { title, chartImgs[], tableHtml }
  async _buildSection(tabId, mes, año, incluirPP) {
    const fmt = this._formatMoney.bind(this);
    const DIM_COLORS = ['#22c55e','#60a5fa','#f97316','#a78bfa','#f43f5e','#facc15','#34d399','#fb923c'];

    if (tabId === 'general') {
      const d = await this._fetchJSON('dashboardGeneral', mes, año);
      let dimEntries = Object.entries(d.dimensiones || {});
      if (!incluirPP) dimEntries = dimEntries.filter(([k]) => k.trim().toLowerCase() !== 'prueba piloto');
      const pilotoVal = incluirPP ? 0 : Object.entries(d.dimensiones || {}).reduce((a,[k,v]) => a + (k.trim().toLowerCase()==='prueba piloto'?Number(v):0), 0);
      const totalLabel = incluirPP ? 'Total' : 'Total sin prueba piloto';
      const totalMostrado = Number(d.totalVentas||0) - pilotoVal;

      const labels = [totalLabel, ...dimEntries.map(([k])=>k), 'Promedio por factura', 'Cantidad facturas'];
      const values = [totalMostrado, ...dimEntries.map(([,v])=>v), d.promedioPorFactura, d.cantidadFacturas];
      const colors = ['#0ea5a4', ...dimEntries.map((_,i)=>DIM_COLORS[i%DIM_COLORS.length]), '#f97316','#60a5fa'];
      const max = Math.max(...values.map(v=>Math.abs(v)||0));
      const scaled = values.map(v => max ? (v/max)*100 : 0);

      const chartImg = await this._renderChart('bar', {
        labels,
        datasets: [{ label:'Comparación (normalizada)', data:scaled, backgroundColor:colors }]
      }, { plugins:{ legend:{display:false} }, scales:{ y:{ beginAtZero:true, ticks:{callback:v=>v+'%'} } } }, 2.8);

      const rows = [
        `<tr><td><strong>${totalLabel}</strong></td><td>${fmt(totalMostrado)}</td></tr>`,
        ...dimEntries.map(([k,v]) => `<tr style="background:#f8fafc"><td>&nbsp;&nbsp;↳ ${k}</td><td>${fmt(v)}</td></tr>`),
        `<tr><td><strong>Promedio por Factura</strong></td><td>${fmt(d.promedioPorFactura)}</td></tr>`,
        `<tr><td><strong>Cantidad de Facturas</strong></td><td>${d.cantidadFacturas}</td></tr>`,
      ].join('');

      return { title: 'General', chartImgs: [chartImg], tableHtml: rows, tableHeaders: ['Métrica','Valor'] };
    }

    if (tabId === 'productos') {
      const d = await this._fetchJSON('ventas-por-producto', mes, año);
      const datos = d.datos || [];

      // Gráfico 1: categorías
      const catMap = {};
      datos.forEach(item => {
        const cat = this._mapProducto(item.producto);
        catMap[cat] = (catMap[cat]||0) + item.totalVentas;
      });
      const catEntries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
      const img1 = await this._renderChart('bar', {
        labels: catEntries.map(([k])=>k),
        datasets: [{ label:'Por categoría', data:catEntries.map(([,v])=>v), backgroundColor:'#60a5fa' }]
      }, { plugins:{ tooltip:{callbacks:{label:c=>fmt(c.raw)}} }, scales:{ y:{ticks:{callback:v=>fmt(v)}} } }, 2.8);

      // Gráfico 2: subproductos
      const sorted = [...datos].sort((a,b)=>b.totalVentas-a.totalVentas);
      const img2 = await this._renderChart('bar', {
        labels: sorted.map(d=>d.producto||'Sin producto'),
        datasets: [{ label:'Por subproducto', data:sorted.map(d=>d.totalVentas), backgroundColor:'#a78bfa' }]
      }, { plugins:{ tooltip:{callbacks:{label:c=>fmt(c.raw)}} }, scales:{ y:{ticks:{callback:v=>fmt(v)}} } }, 2.8);

      const rows = catEntries.map(([k,v]) => `<tr><td><strong>${k}</strong></td><td>${fmt(v)}</td></tr>`).join('');
      return { title:'Ventas por Producto', chartImgs:[img1,img2], tableHtml:rows, tableHeaders:['Categoría','Total'] };
    }

    if (tabId === 'vendedores') {
      const d = await this._fetchJSON('ranking-vendedores', mes, año);
      const datos = (d.datos||[]).sort((a,b)=>b.ingresos-a.ingresos);
      const img = await this._renderChart('bar', {
        labels: datos.map(d=>d.vendedor),
        datasets: [{ label:'Ingresos', data:datos.map(d=>d.ingresos), backgroundColor:'#22c55e' }]
      }, { plugins:{ tooltip:{callbacks:{label:c=>fmt(c.raw)}} }, scales:{ y:{ticks:{callback:v=>fmt(v)}} } }, 2.8);

      const rows = datos.map(d => `<tr><td><strong>${d.vendedor}</strong></td><td>${fmt(d.ingresos)}</td><td>${d.cantidadVentas}</td></tr>`).join('');
      return { title:'Ranking Vendedores', chartImgs:[img], tableHtml:rows, tableHeaders:['Vendedor','Ingresos','Ventas'] };
    }

    if (tabId === 'contratos') {
      const d = await this._fetchJSON('contratos', mes, año);
      const contratos = d.datos || [];
      const tipoMap = {};
      const segMap = { B2B:{cantidad:0,totalVentas:0}, Marketplace:{cantidad:0,totalVentas:0} };
      contratos.forEach(c => {
        const tipo = this._mapContractType(c.numeroContrato);
        const seg = (c.numeroContrato==='0001'||c.numeroContrato==='0002') ? 'B2B' : 'Marketplace';
        if (!tipoMap[tipo]) tipoMap[tipo] = { totalVentas:0, cantidad:0 };
        tipoMap[tipo].totalVentas += c.totalVentas;
        tipoMap[tipo].cantidad    += c.cantidad;
        segMap[seg].cantidad      += c.cantidad;
        segMap[seg].totalVentas   += c.totalVentas;
      });
      const orden = ['Nuevos','Recompra','Orientación Vocacional','Conócete','Otros'];
      const labels = orden.filter(l => tipoMap[l]);
      const CTCOLORS = { Nuevos:'#0ea5a4', Recompra:'#0ea5a4', 'Orientación Vocacional':'#f97316', 'Conócete':'#f97316', Otros:'#f97316' };

      const img1 = await this._renderChart('bar', {
        labels,
        datasets: [{ label:'Total de ventas', data:labels.map(l=>tipoMap[l].totalVentas), backgroundColor:labels.map(l=>CTCOLORS[l]||'#60a5fa') }]
      }, { scales:{ y:{beginAtZero:true} } }, 2.8);

      const segLabels = Object.keys(segMap);
      const segCants = segLabels.map(k=>segMap[k].cantidad);
      const totalCant = segCants.reduce((a,b)=>a+b,0);
      const img2 = await this._renderChart('doughnut', {
        labels: segLabels,
        datasets: [{ data:segCants, backgroundColor:['#0ea5a4','#f97316'] }]
      }, { plugins:{ legend:{display:true,position:'bottom'} } }, 1.2);

      const totalV = labels.reduce((s,l)=>s+tipoMap[l].totalVentas,0);
      const totalC = labels.reduce((s,l)=>s+tipoMap[l].cantidad,0);
      const rows = labels.map(l=>`<tr><td><strong>${l}</strong></td><td>${fmt(tipoMap[l].totalVentas)}</td><td>${tipoMap[l].cantidad}</td></tr>`).join('')
        + `<tr style="border-top:2px solid #cbd5e1;background:#f1f5f9"><td><strong>Total</strong></td><td><strong>${fmt(totalV)}</strong></td><td><strong>${totalC}</strong></td></tr>`;

      return { title:'Contratos', chartImgs:[img1,img2], tableHtml:rows, tableHeaders:['Tipo de Contrato','Total de Ventas','Cantidad de Operaciones'] };
    }

    if (tabId === 'empresas') {
      const d = await this._fetchJSON('empresas', mes, año);
      const datos = d.datos || [];
      const empresaMap = {};
      datos.forEach(f => {
        const region = this._mapEmpresa(f.empresa);
        if (!empresaMap[region]) empresaMap[region] = { ingresos:0, ventas:0, dimensiones:{} };
        empresaMap[region].ingresos += Number(f.totalVentas)||0;
        empresaMap[region].ventas   += Number(f.cantidadFacturas)||0;
        Object.entries(f.dimensiones||{}).forEach(([k,v]) => {
          empresaMap[region].dimensiones[k] = (empresaMap[region].dimensiones[k]||0)+Number(v);
        });
      });
      const orden = ['Argentina','España','Chile','Otros'];
      const sorted = orden.filter(e=>empresaMap[e]).map(e=>[e,empresaMap[e]]);

      const chartImgs = [];
      for (const [region, data] of sorted) {
        const dims = Object.entries(data.dimensiones||{}).sort((a,b)=>b[1]-a[1]);
        const piloto = dims.reduce((a,[k,v])=>a+((k||'').trim().toLowerCase()==='prueba piloto'?Number(v):0),0);
        const lbls = ['Total sin prueba piloto', ...dims.map(([k])=>k)];
        const vals = [Number(data.ingresos||0)-piloto, ...dims.map(([,v])=>v)];
        const cols = ['#0ea5a4', ...dims.map((_,i)=>DIM_COLORS[i%DIM_COLORS.length])];
        const img = await this._renderChart('bar', {
          labels: lbls,
          datasets: [{ label:region, data:vals, backgroundColor:cols }]
        }, { plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>fmt(c.raw)}} }, scales:{ y:{beginAtZero:true,ticks:{callback:v=>fmt(v)}} } }, 2.8);
        chartImgs.push({ img, region });
      }

      const totalI = sorted.reduce((s,[,d])=>s+d.ingresos,0);
      const totalV = sorted.reduce((s,[,d])=>s+d.ventas,0);
      const rows = sorted.map(([emp,data]) => {
        const piloto = Object.entries(data.dimensiones||{}).reduce((a,[k,v])=>a+((k||'').trim().toLowerCase()==='prueba piloto'?Number(v):0),0);
        return `<tr><td><strong>${emp}</strong></td><td>${fmt(Number(data.ingresos||0)-piloto)}</td><td>${data.ventas}</td><td>${totalV>0?((data.ventas/totalV)*100).toFixed(1):0}%</td></tr>`;
      }).join('');

      return { title:'Empresas', chartImgs: chartImgs.map(c=>c.img), chartLabels: chartImgs.map(c=>c.region), tableHtml:rows, tableHeaders:['Empresa','Ingresos sin PP','Facturas','% Ventas'] };
    }
  }

  async _generarPDF() {
    const checkedTabs = [...this.querySelectorAll('[data-tab]:checked')].map(cb => cb.dataset.tab);
    if (!checkedTabs.length) { alert('Seleccioná al menos una pestaña.'); return; }

    const periodoVal = this.querySelector('#pdf-periodo-select').value;
    let mes = null, año = null;
    if (periodoVal.startsWith('mes:')) { mes = periodoVal.substring(4); año = mes.split('-')[1]; }
    else if (periodoVal.startsWith('año:')) { año = periodoVal.substring(4); }

    const incluirPP = this.querySelector('#pdf-toggle-pp').checked;

    // Mostrar loading
    const loading = this.querySelector('#pdf-loading');
    const loadingMsg = this.querySelector('#pdf-loading-msg');
    loading.style.display = 'flex';
    this.querySelector('#pdf-generate-btn').disabled = true;

    try {
      // Cargar jsPDF si no está
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
      const pageW = 210;
      const pageH = 297;
      const margin = 14;
      const contentW = pageW - margin * 2;
      let y = margin;

      // Período label
      const mesesNombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const periodoLabel = mes
        ? `${mesesNombres[parseInt(mes.split('-')[0])-1]} ${mes.split('-')[1]}`
        : `Año ${año}`;

      // Header general
      doc.setFontSize(18);
      doc.setTextColor(15,23,42);
      doc.setFont('helvetica','bold');
      doc.text('Dashboard', margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica','normal');
      doc.setTextColor(100,116,139);
      doc.text(`Período: ${periodoLabel}`, margin, y);
      y += 10;

      const checkY = () => {
        if (y > pageH - 20) { doc.addPage(); y = margin; }
      };

      for (const tabId of checkedTabs) {
        loadingMsg.textContent = `Generando sección: ${tabId}...`;

        const section = await this._buildSection(tabId, mes, año, incluirPP);
        if (!section) continue;

        checkY();

        // Título sección
        doc.setFillColor(14,165,164);
        doc.rect(margin, y, contentW, 8, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica','bold');
        doc.setTextColor(255,255,255);
        doc.text(section.title, margin + 3, y + 5.5);
        y += 12;

        // Gráficos
        if (section.chartImgs && section.chartImgs.length) {
          for (let ci = 0; ci < section.chartImgs.length; ci++) {
            const { imgData, ratio } = section.chartImgs[ci];
            const chartH = Math.round(contentW / ratio); // altura exacta según ratio
            if (y + chartH > pageH - margin) { doc.addPage(); y = margin; }

            if (section.chartLabels && section.chartLabels[ci]) {
              doc.setFontSize(10); doc.setFont('helvetica','bold');
              doc.setTextColor(15,23,42);
              doc.text(section.chartLabels[ci], margin, y + 4);
              y += 6;
            }

            doc.addImage(imgData, 'PNG', margin, y, contentW, chartH);
            y += chartH + 6;
          }
        }

        // Tabla
        if (section.tableHtml && section.tableHeaders) {
          checkY();
          // Cabecera tabla
          const colW = contentW / section.tableHeaders.length;
          doc.setFillColor(241,245,249);
          doc.rect(margin, y, contentW, 7, 'F');
          doc.setFontSize(9); doc.setFont('helvetica','bold');
          doc.setTextColor(15,23,42);
          section.tableHeaders.forEach((h, i) => {
            doc.text(h, margin + colW*i + 2, y + 5);
          });
          y += 7;

          // Filas — parsear tableHtml
          const tmp = document.createElement('tbody');
          tmp.innerHTML = section.tableHtml;
          const rows = tmp.querySelectorAll('tr');

          rows.forEach((row, ri) => {
            if (y + 7 > pageH - margin) { doc.addPage(); y = margin; }
            const cells = row.querySelectorAll('td');
            const isTotalRow = row.style.borderTop || row.querySelector('td strong')?.textContent === 'Total';

            if (ri % 2 === 0) {
              doc.setFillColor(248,250,252);
              doc.rect(margin, y, contentW, 7, 'F');
            }
            if (isTotalRow) {
              doc.setFillColor(226,232,240);
              doc.rect(margin, y, contentW, 7, 'F');
            }

            doc.setFontSize(8.5);
            doc.setFont('helvetica', isTotalRow ? 'bold' : 'normal');
            doc.setTextColor(71,85,105);

            cells.forEach((cell, i) => {
              const text = cell.textContent.trim();
              doc.text(text, margin + colW*i + 2, y + 5, { maxWidth: colW - 4 });
            });
            y += 7;
          });
        }

        y += 10; // espacio entre secciones
      }

      const filename = `dashboard_${periodoLabel.replace(/ /g,'_')}.pdf`;
      doc.save(filename);

    } catch(e) {
      console.error('Error generando PDF:', e);
      alert('Hubo un error generando el PDF. Revisá la consola.');
    } finally {
      loading.style.display = 'none';
      this.querySelector('#pdf-generate-btn').disabled = false;
    }
  }
}

customElements.define('nav-bar-custom', NavBarCustom);