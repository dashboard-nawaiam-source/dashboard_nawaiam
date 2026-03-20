class PdfGenerator {
  constructor() {
    this.pageW    = 210;
    this.pageH    = 297;
    this.margin   = 14;
    this.contentW = 210 - 14 * 2; // 182
  }

  async _cargarJsPDF() {
    if (window.jspdf) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  _checkY(doc, y) {
    if (y > this.pageH - 20) { doc.addPage(); return this.margin; }
    return y;
  }

  _escribirEncabezado(doc, periodoLabel) {
    const { margin } = this;
    let y = margin;
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Dashboard', margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Período: ${periodoLabel}`, margin, y);
    y += 10;
    return y;
  }

  _escribirTituloSeccion(doc, y, title) {
    const { margin, contentW } = this;
    doc.setFillColor(14, 165, 164);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 3, y + 5.5);
    return y + 12;
  }

  _escribirGraficos(doc, y, section) {
    const { margin, contentW, pageH } = this;
    if (!section.chartImgs?.length) return y;

    for (let ci = 0; ci < section.chartImgs.length; ci++) {
      const { imgData, ratio } = section.chartImgs[ci];
      const chartH = Math.round(contentW / ratio);
      if (y + chartH > pageH - margin) { doc.addPage(); y = margin; }

      if (section.chartLabels?.[ci]) {
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(section.chartLabels[ci], margin, y + 4);
        y += 6;
      }

      doc.addImage(imgData, 'PNG', margin, y, contentW, chartH);
      y += chartH + 6;
    }
    return y;
  }

  _escribirTabla(doc, y, section) {
    const { margin, contentW, pageH } = this;
    if (!section.tableHtml || !section.tableHeaders) return y;

    const colW = contentW / section.tableHeaders.length;

    // Encabezado
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    section.tableHeaders.forEach((h, i) => doc.text(h, margin + colW * i + 2, y + 5));
    y += 7;

    // Filas
    const tmp = document.createElement('tbody');
    tmp.innerHTML = section.tableHtml;
    tmp.querySelectorAll('tr').forEach((row, ri) => {
      if (y + 7 > pageH - margin) { doc.addPage(); y = margin; }

      const isTotalRow = row.style.borderTop || row.querySelector('td strong')?.textContent === 'Total';
      if (ri % 2 === 0)  { doc.setFillColor(248, 250, 252); doc.rect(margin, y, contentW, 7, 'F'); }
      if (isTotalRow)    { doc.setFillColor(226, 232, 240); doc.rect(margin, y, contentW, 7, 'F'); }

      doc.setFontSize(8.5);
      doc.setFont('helvetica', isTotalRow ? 'bold' : 'normal');
      doc.setTextColor(71, 85, 105);
      row.querySelectorAll('td').forEach((cell, i) => {
        doc.text(cell.textContent.trim(), margin + colW * i + 2, y + 5, { maxWidth: colW - 4 });
      });
      y += 7;
    });

    return y;
  }

  /**
   * Genera y descarga el PDF.
   * @param {object[]} sections  - Array de secciones construidas por PdfSectionBuilder
   * @param {string}   periodoLabel - Ej: "Enero 2026" | "Año 2026"
   */
  async generar(sections, periodoLabel) {
    await this._cargarJsPDF();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let y = this._escribirEncabezado(doc, periodoLabel);

    for (const section of sections) {
      if (!section) continue;
      y = this._checkY(doc, y);
      y = this._escribirTituloSeccion(doc, y, section.title);
      y = this._escribirGraficos(doc, y, section);
      y = this._escribirTabla(doc, y, section);
      y += 10;
    }

    doc.save(`dashboard_${periodoLabel.replace(/ /g, '_')}.pdf`);
  }
}