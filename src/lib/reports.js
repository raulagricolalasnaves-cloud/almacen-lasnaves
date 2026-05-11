// =====================================================
//  REPORTES — Exportar Excel y PDF
// =====================================================

async function obtenerDatosReporte() {
  const tipo   = document.getElementById('rep-tipo').value;
  const inicio = document.getElementById('rep-inicio').value;
  const fin    = document.getElementById('rep-fin').value;
  const hoy    = new Date();

  if (tipo === 'inventario') return await API.getProductos();
  if (tipo === 'alertas') {
    const prods = await API.getProductos();
    return prods.filter(p => {
      const bajo = Number(p.stock) <= Number(p.min);
      const dias = p.caducidad ? Math.floor((new Date(p.caducidad)-hoy)/86400000) : 999;
      return bajo || dias < CONFIG.DIAS_ALERTA_CADUCIDAD;
    });
  }

  let datos = tipo === 'pedidos' ? await API.getPedidos() : await API.getMovimientos(500);
  if (inicio) datos = datos.filter(d => (d.created_at||'') >= inicio);
  if (fin)    datos = datos.filter(d => (d.created_at||'') <= fin + 'T23:59:59');
  return datos;
}

async function exportarExcel() {
  toast('Generando Excel...');
  try {
    const datos = await obtenerDatosReporte();
    if (!datos.length) { toast('Sin datos para exportar'); return; }

    const ws   = XLSX.utils.json_to_sheet(datos);
    const wb   = XLSX.utils.book_new();
    const tipo = document.getElementById('rep-tipo').value;
    XLSX.utils.book_append_sheet(wb, ws, tipo);

    const fecha = new Date().toLocaleDateString('es-MX').replace(/\//g,'-');
    XLSX.writeFile(wb, `LasNaves_${tipo}_${fecha}.xlsx`);
    toast('Excel descargado correctamente');
  } catch(e) { toast('Error al generar Excel'); }
}

async function exportarPDF() {
  toast('Generando PDF...');
  try {
    const datos = await obtenerDatosReporte();
    if (!datos.length) { toast('Sin datos para exportar'); return; }

    const tipo   = document.getElementById('rep-tipo').value;
    const inicio = document.getElementById('rep-inicio').value || '—';
    const fin    = document.getElementById('rep-fin').value    || '—';
    const fecha  = new Date().toLocaleDateString('es-MX');

    const cols = Object.keys(datos[0]).filter(k => !k.startsWith('_'));
    const filas = datos.map(d => cols.map(c => d[c] ?? '—').join('</td><td>'));

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Reporte ${tipo} — Las Naves Agrícola</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px}
  .header{display:flex;align-items:center;gap:16px;margin-bottom:20px;border-bottom:2px solid #0f2a5c;padding-bottom:12px}
  h1{font-size:16px;color:#0f2a5c;margin:0}
  .meta{font-size:11px;color:#666;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th{background:#0f2a5c;color:#fff;padding:6px 8px;text-align:left;font-size:10px}
  td{padding:5px 8px;border-bottom:1px solid #e5e5e3;font-size:10px}
  tr:nth-child(even){background:#f9f9f9}
  .footer{margin-top:20px;font-size:10px;color:#999;text-align:right}
</style></head><body>
<div class="header">
  <div><h1>Las Naves Agrícola — Reporte de ${tipo}</h1>
  <div class="meta">Período: ${inicio} al ${fin} · Generado: ${fecha} · Total registros: ${datos.length}</div></div>
</div>
<table><thead><tr><th>${cols.join('</th><th>')}</th></tr></thead>
<tbody><tr><td>${filas.join('</td></tr><tr><td>')}</td></tr></tbody></table>
<div class="footer">Las Naves Agrícola · Sistema de Control de Almacén</div>
</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
    toast('PDF listo para imprimir');
  } catch(e) { toast('Error al generar PDF'); }
}

// Vista previa al cambiar fechas
async function previsualizarReporte() {
  const datos = await obtenerDatosReporte().catch(() => []);
  const prev  = document.getElementById('rep-preview');
  if (!prev) return;
  if (!datos.length) { prev.innerHTML = '<div class="empty">Sin datos para el período seleccionado</div>'; return; }

  const cols = Object.keys(datos[0]).filter(k => !k.startsWith('_') && !['id','usuario_id'].includes(k)).slice(0,6);
  prev.innerHTML = `<div style="overflow-x:auto"><table class="rep-table">
    <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${datos.slice(0,10).map(d=>`<tr>${cols.map(c=>`<td>${d[c]??'—'}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  ${datos.length>10?`<div class="hint" style="margin-top:8px">Mostrando 10 de ${datos.length} registros. Exporta para ver todos.</div>`:''}`;
}

document.addEventListener('DOMContentLoaded', () => {
  ['rep-inicio','rep-fin','rep-tipo'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', previsualizarReporte);
  });
  // Fechas por defecto: primer día del mes hasta hoy
  const hoy = new Date();
  const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const repIni = document.getElementById('rep-inicio');
  const repFin = document.getElementById('rep-fin');
  if (repIni) repIni.value = ini.toISOString().split('T')[0];
  if (repFin) repFin.value = hoy.toISOString().split('T')[0];
});
