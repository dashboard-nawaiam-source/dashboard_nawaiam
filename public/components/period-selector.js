/**
 * period-selector.js
 *
 * Selector de período en cascada: dropdown Año (arriba) → dropdown Mes (abajo).
 * Primera opción de mes: "No especificar" (= año completo).
 * Toggle opcional de Prueba Piloto.
 *
 * Uso:
 *   const ps = new PeriodSelector({
 *     container:    document.getElementById('periodoContainer'),
 *     showPPToggle: true,
 *     onChange: ({ mes, año, includePP }) => { ... }
 *   });
 *   await ps.init();
 */

class PeriodSelector {
  constructor(opts) {
    this.container    = opts.container;
    this.showPPToggle = opts.showPPToggle || false;
    this.onChange     = opts.onChange || (() => {});

    this._mesesPorAño = {};
    this._años        = [];
    this._mes         = null;   // MM-YYYY | null
    this._año         = null;   // YYYY
    this._includePP   = false;
  }

  get mes()       { return this._mes; }
  get año()       { return this._año; }
  get includePP() { return this._includePP; }

  async init() {
    this._render();
    await this._cargarPeriodos();
  }

  _render() {
    const ppHtml = this.showPPToggle ? `
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
        <label style="position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0">
          <input type="checkbox" id="ps-toggle-pp" style="opacity:0;width:0;height:0;position:absolute" />
          <span class="ps-slider" style="position:absolute;cursor:pointer;inset:0;background:#e2e8f0;border-radius:20px;transition:.2s"></span>
          <span class="ps-knob"   style="position:absolute;height:14px;width:14px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s;pointer-events:none"></span>
        </label>
        <label for="ps-toggle-pp" style="font-size:13px;font-weight:600;color:#475569;cursor:pointer">Incluir Prueba Piloto</label>
      </div>
    ` : '';

    this.container.innerHTML = `
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <label style="font-weight:600;font-size:14px;width:40px">Año:</label>
          <select id="ps-año-select" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:4px;font-size:14px;cursor:pointer;min-width:160px">
            <option value="">Cargando...</option>
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <label style="font-weight:600;font-size:14px;width:40px">Mes:</label>
          <select id="ps-mes-select" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:4px;font-size:14px;cursor:pointer;min-width:160px">
            <option value="">No especificar</option>
          </select>
        </div>
        ${ppHtml}
      </div>
    `;

    this._añoSelect = this.container.querySelector('#ps-año-select');
    this._mesSelect = this.container.querySelector('#ps-mes-select');

    this._añoSelect.addEventListener('change', () => this._onAñoChange());
    this._mesSelect.addEventListener('change', () => this._onMesChange());

    if (this.showPPToggle) {
      const ppInput = this.container.querySelector('#ps-toggle-pp');
      const slider  = this.container.querySelector('.ps-slider');
      const knob    = this.container.querySelector('.ps-knob');
      ppInput.addEventListener('change', () => {
        this._includePP         = ppInput.checked;
        slider.style.background = ppInput.checked ? '#0ea5a4' : '#e2e8f0';
        knob.style.transform    = ppInput.checked ? 'translateX(16px)' : 'translateX(0)';
        this._notify();
      });
    }
  }

  async _cargarPeriodos() {
    try {
      const res  = await Auth.fetch('/facturas/meses');
      const json = await res.json();

      this._años        = json.data.años        || [];
      this._mesesPorAño = json.data.mesesPorAño || {};

      // Fallback para backend sin mesesPorAño
      if (!Object.keys(this._mesesPorAño).length && json.data.mesesActual) {
        const añoActual = this._años[0] || new Date().getFullYear().toString();
        this._mesesPorAño[añoActual] = json.data.mesesActual;
      }

      this._añoSelect.innerHTML = '';
      this._años.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a; opt.textContent = a;
        this._añoSelect.appendChild(opt);
      });

      if (this._años.length) {
        this._año = this._años[0];
        this._añoSelect.value = this._año;
        this._llenarMeses(this._año);
      }
    } catch (e) {
      if (e.message === 'AUTH_REQUIRED') { window.location.href = '/login'; return; }
      console.error('PeriodSelector: error cargando períodos', e);
    }
  }

  _llenarMeses(año) {
    const NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const meses   = this._mesesPorAño[año] || [];

    this._mesSelect.innerHTML = '';

    // Primera opción: sin especificar mes = año completo
    const optTodo = document.createElement('option');
    optTodo.value = ''; optTodo.textContent = 'No especificar';
    this._mesSelect.appendChild(optTodo);

    meses.forEach(m => {
      const [mesNum] = m.split('-');
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = NOMBRES[parseInt(mesNum) - 1];
      this._mesSelect.appendChild(opt);
    });

    // Seleccionar el primer mes disponible por defecto
    if (meses.length) {
      this._mes = meses[0];
      this._mesSelect.value = meses[0];
    } else {
      this._mes = null;
      this._mesSelect.value = '';
    }

    this._notify();
  }

  _onAñoChange() {
    this._año = this._añoSelect.value;
    this._llenarMeses(this._año);
  }

  _onMesChange() {
    this._mes = this._mesSelect.value || null;
    this._notify();
  }

  _notify() {
    this.onChange({ mes: this._mes, año: this._año, includePP: this._includePP });
  }
}