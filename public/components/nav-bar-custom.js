class NavBarCustom extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div style="margin-bottom:16px">
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
    `;

    const select = this.querySelector('#nav-select');
    select.value = window.location.pathname;

    select.addEventListener('change', e => {
      window.location.href = e.target.value;
    });
  }
}

customElements.define('nav-bar-custom', NavBarCustom);
