// =====================================================
//  DASHBOARD DIRECCIÓN v9
//  KPIs ejecutivos + valor de inventario
// =====================================================

async function cargarDashboardDir() {
  document.getElementById('dir-content').innerHTML = '<div class="loading">Cargando dashboard ejecutivo...</div>';
  try {
    const [prods, movs, peds, provs] = await Promise.all([
      API.getProductos(), API.getMovimientos(500), API.getPedidos(), API.getProveedores()
    ]);

    const hoy = new Date();
    const hace30 = new Date(); hace30.setDate(hace30.getDate()-30);

    // KPIs
    const valorTotal = prods.reduce((s,p) => s + (Number(p.stock)*Number(p.precio_unitario||0)), 0);
    const stockBajo  = prods.filter(p => Number(p.stock) <= Number(p.min)).length;
    const porcaducar = prods.filter(p => p.caducidad && Math.floor((new Date(p.caducidad)-hoy)/86400000) < 90).length;
    const movs30     = movs.filter(m => new Date(m.created_at) >= hace30);
    const entradas30 = movs30.filter(m => m.tipo==='entrada').length;
    const salidas30  = movs30.filter(m => m.tipo==='salida').length;
    const pedPend    = peds.filter(p => p.estado !== 'Entregado').length;

    // Top 5 productos más movidos
    const conteo = {};
    movs30.forEach(m => { conteo[m.nombre] = (conteo[m.nombre]||0)+1; });
    const top5 = Object.entries(conteo).sort((a,b)=>b[1]-a[1]).slice(0,5);

    // Productos sin movimiento en 30 días
    const conMov = new Set(movs30.map(m=>m.id_producto));
    const sinMov = prods.filter(p => !conMov.has(p.id)).slice(0,5);

    // Valor por categoría peligrosidad
    const porPeligro = {};
    prods.forEach(p => {
      const k = p.peligrosidad || 'sin clasificar';
      porPeligro[k] = (porPeligro[k]||0) + (Number(p.stock)*Number(p.precio_unitario||0));
    });

    document.getElementById('dir-content').innerHTML = `
      <!-- KPIs principales -->
      <div class="metrics" style="margin-bottom:14px">
        <div class="metric-card">
          <div class="metric-icon green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <div class="metric-body"><div class="metric-val">$${valorTotal.toLocaleString('es-MX',{minimumFractionDigits:0,maximumFractionDigits:0})}</div><div class="metric-label">Valor del inventario</div></div>
        </div>
        <div class="metric-card">
          <div class="metric-icon blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8"/></svg></div>
          <div class="metric-body"><div class="metric-val">${prods.length}</div><div class="metric-label">Productos en stock</div></div>
        </div>
        <div class="metric-card">
          <div class="metric-icon amber"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/></svg></div>
          <div class="metric-body"><div class="metric-val">${entradas30}</div><div class="metric-label">Entradas (30 días)</div></div>
        </div>
        <div class="metric-card">
          <div class="metric-icon red"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></div>
          <div class="metric-body"><div class="metric-val">${salidas30}</div><div class="metric-label">Salidas (30 días)</div></div>
        </div>
      </div>

      <!-- Alertas ejecutivas -->
      ${(stockBajo>0||porcaducar>0) ? `
      <div class="card" style="border-left:3px solid var(--red);margin-bottom:12px">
        <div class="card-header" style="color:var(--red)">⚠ Alertas que requieren atención</div>
        ${stockBajo?`<div style="font-size:13px;padding:4px 0">${stockBajo} producto(s) por debajo del stock mínimo</div>`:''}
        ${porcaducar?`<div style="font-size:13px;padding:4px 0">${porcaducar} producto(s) por caducar en menos de 90 días</div>`:''}
        ${pedPend?`<div style="font-size:13px;padding:4px 0">${pedPend} pedido(s) pendiente(s) de entrega</div>`:''}
      </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <!-- Top 5 más activos -->
        <div class="card">
          <div class="card-header">Top 5 productos activos (30 días)</div>
          ${top5.length ? top5.map(([nom,cnt],i) => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
              <span style="color:var(--text2)">${i+1}. ${nom.length>20?nom.substring(0,20)+'…':nom}</span>
              <span style="font-weight:500">${cnt} mov.</span>
            </div>`).join('')
          : '<div class="empty">Sin movimientos</div>'}
        </div>

        <!-- Sin movimiento -->
        <div class="card">
          <div class="card-header">Sin movimiento (30 días)</div>
          ${sinMov.length ? sinMov.map(p => `
            <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
              <div style="color:var(--text)">${p.nombre.length>22?p.nombre.substring(0,22)+'…':p.nombre}</div>
              <div style="font-size:11px;color:var(--text3)">Stock: ${p.stock} ${p.unidad||''}</div>
            </div>`).join('')
          : '<div class="empty" style="font-size:12px">Todos los productos tuvieron movimiento</div>'}
        </div>
      </div>

      <!-- Valor por peligrosidad -->
      ${Object.keys(porPeligro).length ? `
      <div class="card">
        <div class="card-header">Valor del inventario por nivel de peligrosidad</div>
        ${Object.entries(porPeligro).sort((a,b)=>b[1]-a[1]).map(([k,v]) => {
          const pct = valorTotal > 0 ? Math.round((v/valorTotal)*100) : 0;
          const cols = {alto:'var(--red)',medio:'var(--amber)',bajo:'var(--green)',ninguno:'var(--blue)','sin clasificar':'var(--text3)'};
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
              <span style="text-transform:capitalize">${k}</span>
              <span style="font-weight:500">$${v.toLocaleString('es-MX',{maximumFractionDigits:0})} (${pct}%)</span>
            </div>
            <div style="height:6px;background:var(--bg);border-radius:10px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${cols[k]||'var(--text3)'};border-radius:10px"></div>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

      <!-- Proveedores -->
      <div class="card">
        <div class="card-header">Resumen de proveedores</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div class="prom-item"><div class="prom-val">${provs.length}</div><div class="prom-label">Proveedores activos</div></div>
          <div class="prom-item"><div class="prom-val">${peds.filter(p=>p.estado==='Entregado').length}</div><div class="prom-label">Pedidos completados</div></div>
          <div class="prom-item"><div class="prom-val">${pedPend}</div><div class="prom-label">Pedidos activos</div></div>
        </div>
      </div>
    `;
  } catch(e) {
    document.getElementById('dir-content').innerHTML = '<div class="empty">Error al cargar el dashboard</div>';
  }
}
