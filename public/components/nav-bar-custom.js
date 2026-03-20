/**
 * nav-bar-custom.js
 *
 * Responsabilidad: renderizar la barra de navegación y el modal PDF,
 * y coordinar PdfSectionBuilder (construye datos) y PdfGenerator (escribe el PDF).
 *
 * Ya NO contiene: lógica de fetching, construcción de charts, ni escritura PDF. (#5)
 *
 * Requiere (en orden):
 *   utils.js, pdf-section-builder.js, pdf-generator.js
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
          padding:7px 16px;background:#0ea5a4;color:#fff;border:none;
          border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;
          display:inline-flex;align-items:center;gap:6px;
        ">↓ Descargar PDF</button>
      </div>

      <!-- Modal PDF -->
      <div id="pdf-modal-overlay" style="
        display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);
        z-index:9999;align-items:center;justify-content:center;
      ">
        <div style="
          background:#fff;border-radius:10px;padding:28px 32px;
          width:100%;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.18);position:relative;
        ">
          <h2 style="font-size:17px;font-weight:700;margin-bottom:4px;color:#0f172a">Generar PDF</h2>
          <p style="font-size:13px;color:#64748b;margin-bottom:20px">Seleccioná el período y las pestañas a incluir.</p>

          <!-- Selector período -->
          <div style="margin-bottom:18px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <label style="font-size:13px;font-weight:600;color:#475569;width:40px">Año:</label>
              <select id="pdf-año-select" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;min-width:150px">
                <option value="">Cargando...</option>
              </select>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <label style="font-size:13px;font-weight:600;color:#475569;width:40px">Mes:</label>
              <select id="pdf-mes-select" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;min-width:150px">
                <option value="">No especificar</option>
              </select>
            </div>
          </div>

          <!-- Pestañas -->
          <div style="margin-bottom:18px">
            <label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:10px">Pestañas a incluir</label>
            <div style="display:flex;flex-direction:column;gap:8px" id="pdf-tabs-list"></div>
          </div>

          <!-- Toggle PP -->
          <div id="pdf-pp-row" style="
            display:flex;align-items:center;gap:10px;margin-bottom:18px;
            padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;
          ">
            <label style="position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0">
              <input type="checkbox" id="pdf-toggle-pp" style="opacity:0;width:0;height:0;position:absolute">
              <span id="pdf-pp-slider" style="position:absolute;cursor:pointer;inset:0;background:#e2e8f0;border-radius:20px;transition:.2s"></span>
              <span id="pdf-pp-knob"   style="position:absolute;height:14px;width:14px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s;pointer-events:none"></span>
            </label>
            <label for="pdf-toggle-pp" style="font-size:13px;color:#475569;cursor:pointer">Incluir Prueba Piloto</label>
          </div>

          <!-- Botones -->
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
            <button id="pdf-cancel-btn" style="
              padding:8px 18px;border:1px solid #e2e8f0;background:#fff;
              border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;color:#475569;
            ">Cancelar</button>
            <button id="pdf-generate-btn" style="
              padding:8px 18px;background:#0ea5a4;color:#fff;border:none;
              border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;
            ">Generar PDF</button>
          </div>

          <!-- Estado generando -->
          <div id="pdf-loading" style="
            display:none;position:absolute;inset:0;background:rgba(255,255,255,0.92);
            border-radius:10px;align-items:center;justify-content:center;
            flex-direction:column;gap:12px;font-size:14px;font-weight:600;color:#0ea5a4;
          ">
            <div style="
              width:32px;height:32px;border:3px solid #e2e8f0;
              border-top-color:#0ea5a4;border-radius:50%;animation:spin .8s linear infinite;
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

    this._initNav();
    this._initTabs();
    this._initTogglePP();
    this._initModal();
  }

  // ── Inicialización de partes de la UI ──────────────────────────────────────

  _initNav() {
    const select = this.querySelector('#nav-select');
    select.value = window.location.pathname;
    select.addEventListener('change', e => { window.location.href = e.target.value; });
  }

  _initTabs() {
    const TABS = [
      { id: 'general',    label: 'General',             available: true  },
      { id: 'productos',  label: 'Ventas por Producto',  available: true  },
      { id: 'vendedores', label: 'Ranking Vendedores',   available: true  },
      { id: 'contratos',  label: 'Contratos',            available: true  },
      { id: 'empresas',   label: 'Empresas',             available: true  },
      { id: 'kpis',       label: 'KPIs (no disponible)', available: false },
    ];

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
  }

  _initTogglePP() {
    const ppInput  = this.querySelector('#pdf-toggle-pp');
    const ppSlider = this.querySelector('#pdf-pp-slider');
    const ppKnob   = this.querySelector('#pdf-pp-knob');
    ppInput.addEventListener('change', () => {
      ppSlider.style.background = ppInput.checked ? '#0ea5a4' : '#e2e8f0';
      ppKnob.style.transform    = ppInput.checked ? 'translateX(16px)' : 'translateX(0)';
    });
  }

  _initModal() {
    const overlay   = this.querySelector('#pdf-modal-overlay');
    const añoSelect = this.querySelector('#pdf-año-select');

    añoSelect.addEventListener('change', () => this._llenarMesesPDF(añoSelect.value));

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
    this.querySelector('#pdf-generate-btn').addEventListener('click', () => this._generarPDF());
  }

  // ── Carga de períodos ──────────────────────────────────────────────────────

  async _cargarPeriodos() {
    try {
      const token = localStorage.getItem('dashboard_token');
      const res   = await fetch('/facturas/meses', { headers: { 'x-auth-token': token } });
      const json  = await res.json();

      this._mesesPorAño = json.data.mesesPorAño || {};
      const años        = json.data.años || [];

      if (!Object.keys(this._mesesPorAño).length && json.data.mesesActual) {
        const añoActual = años[0] || new Date().getFullYear().toString();
        this._mesesPorAño[añoActual] = json.data.mesesActual;
      }

      const añoSelect = this.querySelector('#pdf-año-select');
      añoSelect.innerHTML = '';
      años.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a; opt.textContent = a;
        añoSelect.appendChild(opt);
      });

      if (años.length) {
        añoSelect.value = años[0];
        this._llenarMesesPDF(años[0]);
      }
    } catch (e) { console.error('Error cargando períodos PDF:', e); }
  }

  _llenarMesesPDF(año) {
    const NOMBRES   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const meses     = (this._mesesPorAño || {})[año] || [];
    const mesSelect = this.querySelector('#pdf-mes-select');

    mesSelect.innerHTML = '';
    const optAnual = document.createElement('option');
    optAnual.value = ''; optAnual.textContent = 'No especificar';
    mesSelect.appendChild(optAnual);

    meses.forEach(m => {
      const [mn] = m.split('-');
      const opt  = document.createElement('option');
      opt.value = m; opt.textContent = NOMBRES[parseInt(mn) - 1];
      mesSelect.appendChild(opt);
    });

    if (meses.length) mesSelect.value = meses[0];
  }

  // ── Generación del PDF (solo coordina, no construye ni escribe) ────────────

  async _generarPDF() {
    const checkedTabs = [...this.querySelectorAll('[data-tab]:checked')].map(cb => cb.dataset.tab);
    if (!checkedTabs.length) { alert('Seleccioná al menos una pestaña.'); return; }

    const añoVal    = this.querySelector('#pdf-año-select').value;
    const mesVal    = this.querySelector('#pdf-mes-select').value;
    const mes       = mesVal || null;
    const año       = añoVal || null;
    const incluirPP = this.querySelector('#pdf-toggle-pp').checked;

    const loading    = this.querySelector('#pdf-loading');
    const loadingMsg = this.querySelector('#pdf-loading-msg');
    loading.style.display = 'flex';
    this.querySelector('#pdf-generate-btn').disabled = true;

    try {
      const token   = localStorage.getItem('dashboard_token');
      const builder = new PdfSectionBuilder(token);
      const gen     = new PdfGenerator();

      const sections = [];
      for (const tabId of checkedTabs) {
        loadingMsg.textContent = `Generando sección: ${tabId}...`;
        sections.push(await builder.build(tabId, mes, año, incluirPP));
      }

      const NOMBRES      = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const periodoLabel = mes
        ? `${NOMBRES[parseInt(mes.split('-')[0]) - 1]} ${mes.split('-')[1]}`
        : `Año ${año}`;

      await gen.generar(sections, periodoLabel);

    } catch (e) {
      console.error('Error generando PDF:', e);
      alert('Hubo un error generando el PDF. Revisá la consola.');
    } finally {
      loading.style.display = 'none';
      this.querySelector('#pdf-generate-btn').disabled = false;
    }
  }
}

customElements.define('nav-bar-custom', NavBarCustom);