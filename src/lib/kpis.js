// =====================================================
//  KPIs v16 — Indicadores automáticos del almacén
//  + Predicción de demanda basada en consumo histórico
// =====================================================

async function cargarKPIs() {
  const el = document.getElementById('kpi-content');
  if (!el) return;
  el.innerHTML = '<div class="loading">Calculando KPIs...</div>';

  try {
    const [prods, movs] = await Promise.all([
      API.getProductos(),
      API.getMovimientos(1000)
    ]);

    const hoy     = new Date();
    const hace30  = new Date(); hace30.setDate(hace30.getDate() - 30);
    const hace90  = new Date(); hace90.setDate(hace90.getDate() - 90);
    const hace365 = new Date(); hace365.setDate(hace365.getDate() - 365);

    const movs30  = movs.filter(m => new Date(m.created_at) >= hace30);
    const movs90  = movs.filter(m => new Date(m.created_at) >= hace90);
    const movs365 = movs.filter(m => new Date(m.created_at) >= hace365);

    // ── KPI 1: Valor total del inventario
    const valorTotal = prods.reduce((s,p) => s + (Number(p.stock) * Number(p.precio_unitario||0)), 0);

    // ── KPI 2: Rotación de inventario (últimos 90 días anualizado)
    const salidas90 = movs90.filter(m => m.tipo==='salida').reduce((s,m) => s + Number(m.cantidad||0), 0);
    const stockProm = prods.reduce((s,p) => s + Number(p.stock||0), 0) / (prods.length||1);
    const rotacion  = stockProm > 0 ? ((salidas90 / 90) * 365 / stockProm).toFixed(1) : '0';

    // ── KPI 3: Días de stock promedio
    const consumoDiario = salidas90 / 90;
    const diasStock     = consumoDiario > 0 ? Math.round(stockProm / consumoDiario) : '∞';

    // ── KPI 4: Valor en riesgo por caducidad (<90 días)
    const enRiesgo = prods.filter(p => {
      if (!p.caducidad || !p.precio_unitario) return false;
      const dias = Math.floor((new Date(p.caducidad) - hoy) / 86400000);
      return dias > 0 && dias < 90;
    });
    const valorRiesgo = enRiesgo.reduce((s,p) => s + (Number(p.stock) * Number(p.precio_unitario||0)), 0);

    // ── KPI 5: Exactitud de inventario (basada en conteos)
    const exactitud = '—'; // Se calculará cuando haya conteos físicos

    // ── KPI 6: Productos sin movimiento 60+ días
    const conMov60 = new Set(movs.filter(m => new Date(m.created_at) >= new Date(Date.now()-60*86400000)).map(m=>m.id_producto));
    const sinMov60 = prods.filter(p => !conMov60.has(p.id) && Number(p.stock)>0);

    // ── KPI 7: Stock bajo
    const stockBajo = prods.filter(p => Number(p.stock) <= Number(p.min) && Number(p.min) > 0);

    // ── KPI 8: Puntualidad proveedores
    const peds = await API.getPedidos();
    const pedsConFechas = peds.filter(p => p.fecha_estimada && p.fecha_entrega_real);
    const aTiempo = pedsConFechas.filter(p => new Date(p.fecha_entrega_real) <= new Date(p.fecha_estimada));
    const puntualidad = pedsConFechas.length > 0 ? Math.round((aTiempo.length/pedsConFechas.length)*100) : null;

    // ── PREDICCIÓN DE DEMANDA por producto
    const predicciones = calcularPredicciones(prods, movs30, movs90, movs365);

    el.innerHTML = `
      <!-- MÉTRICAS PRINCIPALES -->
      <div class="kpi-grid-main">
        ${kpiCard('💰','Valor del inventario','$'+valorTotal.toLocaleString('es-MX',{maximumFractionDigits:0}),valorTotal>0?'':'Sin precios registrados','green')}
        ${kpiCard('🔄','Rotación anualizada',rotacion+'x','veces por año · benchmark: 12-24x',rotacion>=12?'green':rotacion>=6?'amber':'red')}
        ${kpiCard('📦','Días de stock',diasStock,'días de inventario disponible',typeof diasStock==='number'&&diasStock>30?'green':typeof diasStock==='number'&&diasStock>15?'amber':'red')}
        ${kpiCard('⚠','Valor en riesgo','$'+valorRiesgo.toLocaleString('es-MX',{maximumFractionDigits:0}),'productos caducan en &lt;90 días',valorRiesgo===0?'green':valorRiesgo<valorTotal*0.05?'amber':'red')}
        ${kpiCard('📉','Stock bajo',stockBajo.length,'productos bajo el mínimo',stockBajo.length===0?'green':stockBajo.length<3?'amber':'red')}
        ${kpiCard('😴','Sin movimiento 60d',sinMov60.length,'productos con stock parado',sinMov60.length===0?'green':sinMov60.length<5?'amber':'red')}
        ${puntualidad!==null?kpiCard('🚚','Puntualidad proveedores',puntualidad+'%','de pedidos a tiempo · benchmark: 95%+',puntualidad>=95?'green':puntualidad>=80?'amber':'red'):kpiCard('🚚','Puntualidad proveedores','—','Registra fechas de entrega en pedidos','gray')}
        ${kpiCard('📊','Movimientos (30d)',movs30.length,'entradas + salidas este mes','blue')}
      </div>

      <!-- PRODUCTOS EN RIESGO -->
      ${enRiesgo.length ? `
      <div class="kpi-section">
        <div class="kpi-section-title">⚠ Productos en riesgo de caducidad (próximos 90 días)</div>
        ${enRiesgo.sort((a,b)=>new Date(a.caducidad)-new Date(b.caducidad)).map(p=>{
          const dias=Math.floor((new Date(p.caducidad)-hoy)/86400000);
          const val=(Number(p.stock)*Number(p.precio_unitario||0)).toLocaleString('es-MX',{maximumFractionDigits:0});
          return`<div class="kpi-alert-item">
            <div>
              <div class="kpi-alert-nombre">${p.nombre}</div>
              <div class="kpi-alert-sub">${p.stock} ${p.unidad||''} · Caduca en ${dias} días (${p.caducidad})</div>
            </div>
            <div class="kpi-alert-val ${dias<30?'danger':''}">${p.precio_unitario?'$'+val:'—'}</div>
          </div>`;
        }).join('')}
      </div>` : ''}

      <!-- PRODUCTOS SIN MOVIMIENTO -->
      ${sinMov60.length ? `
      <div class="kpi-section">
        <div class="kpi-section-title">😴 Productos sin movimiento en 60+ días</div>
        ${sinMov60.slice(0,5).map(p=>`<div class="kpi-alert-item">
          <div><div class="kpi-alert-nombre">${p.nombre}</div><div class="kpi-alert-sub">Stock actual: ${p.stock} ${p.unidad||''}</div></div>
          <div class="kpi-alert-val">${p.precio_unitario?'$'+(Number(p.stock)*Number(p.precio_unitario)).toLocaleString('es-MX',{maximumFractionDigits:0}):'—'}</div>
        </div>`).join('')}
        ${sinMov60.length>5?`<div style="font-size:11px;color:var(--text3);padding:6px 0">+${sinMov60.length-5} más</div>`:''}
      </div>` : ''}

      <!-- PREDICCIÓN DE DEMANDA -->
      <div class="kpi-section">
        <div class="kpi-section-title">🔮 Predicción de demanda — cuándo se agotará cada producto</div>
        ${predicciones.length ? `
        <div style="overflow-x:auto">
          <table class="kpi-table">
            <thead><tr><th>Producto</th><th>Stock</th><th>Consumo/día</th><th>Se agota en</th><th>Fecha estimada</th><th>Estado</th></tr></thead>
            <tbody>${predicciones.map(p=>`<tr>
              <td>${p.nombre}</td>
              <td>${p.stock} ${p.unidad}</td>
              <td>${p.consumoDiario.toFixed(2)} ${p.unidad}/día</td>
              <td class="${p.diasRestantes<7?'pred-danger':p.diasRestantes<30?'pred-warn':'pred-ok'}">${p.diasRestantes === Infinity ? '∞' : p.diasRestantes + 'd'}</td>
              <td>${p.fechaAgotamiento||'No calculable'}</td>
              <td><span class="badge ${p.diasRestantes<7?'badge-danger':p.diasRestantes<30?'badge-warn':'badge-ok'}">${p.diasRestantes<7?'Urgente':p.diasRestantes<30?'Pronto':'OK'}</span></td>
            </tr>`).join('')}</tbody>
          </table>
        </div>` : '<div class="empty">Sin suficiente historial de movimientos para predecir. Registra algunas salidas primero.</div>'}
      </div>

      <!-- TENDENCIA 30 DÍAS -->
      <div class="kpi-section">
        <div class="kpi-section-title">📈 Actividad de los últimos 30 días</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div class="kpi-mini"><div class="kpi-mini-val green">${movs30.filter(m=>m.tipo==='entrada').length}</div><div class="kpi-mini-label">Entradas</div></div>
          <div class="kpi-mini"><div class="kpi-mini-val red">${movs30.filter(m=>m.tipo==='salida').length}</div><div class="kpi-mini-label">Salidas</div></div>
          <div class="kpi-mini"><div class="kpi-mini-val amber">${movs30.filter(m=>m.tipo==='ajuste').length}</div><div class="kpi-mini-label">Ajustes</div></div>
          <div class="kpi-mini"><div class="kpi-mini-val blue">${new Set(movs30.map(m=>m.usuario_nombre)).size}</div><div class="kpi-mini-label">Usuarios activos</div></div>
          <div class="kpi-mini"><div class="kpi-mini-val">${new Set(movs30.map(m=>m.id_producto)).size}</div><div class="kpi-mini-label">Productos movidos</div></div>
        </div>
      </div>

      <div style="font-size:11px;color:var(--text3);margin-top:10px;text-align:right">
        Actualizado: ${new Date().toLocaleString('es-MX')} · 
        <button class="btn btn-sm" onclick="cargarKPIs()" style="font-size:11px;padding:2px 8px">↻ Recalcular</button>
      </div>
    `;
  } catch(e) {
    document.getElementById('kpi-content').innerHTML = '<div class="empty">Error al calcular KPIs: ' + e.message + '</div>';
  }
}

function kpiCard(icon, label, val, sub, color) {
  const colors = { green:'var(--green)', amber:'var(--amber)', red:'var(--red)', blue:'var(--blue)', gray:'var(--text3)' };
  const bgs    = { green:'var(--green-bg)', amber:'var(--amber-bg)', red:'var(--red-bg)', blue:'var(--blue-bg)', gray:'var(--bg)' };
  const c = colors[color]||'var(--text)';
  const b = bgs[color]||'var(--bg)';
  return `<div class="kpi-main-card" style="border-left:3px solid ${c}">
    <div class="kpi-icon" style="background:${b};color:${c}">${icon}</div>
    <div>
      <div class="kpi-label">${label}</div>
      <div class="kpi-val" style="color:${c}">${val}</div>
      <div class="kpi-sub">${sub}</div>
    </div>
  </div>`;
}

function calcularPredicciones(prods, movs30, movs90, movs365) {
  const predicciones = [];
  const hoy = new Date();

  prods.forEach(p => {
    if (Number(p.stock) <= 0) return;

    // Calcular consumo en diferentes períodos
    const sal30  = movs30.filter(m => m.tipo==='salida' && m.id_producto===p.id).reduce((s,m)=>s+Number(m.cantidad||0),0);
    const sal90  = movs90.filter(m => m.tipo==='salida' && m.id_producto===p.id).reduce((s,m)=>s+Number(m.cantidad||0),0);
    const sal365 = movs365.filter(m => m.tipo==='salida' && m.id_producto===p.id).reduce((s,m)=>s+Number(m.cantidad||0),0);

    // Dar más peso a los últimos 30 días (tendencia reciente)
    let consumoDiario = 0;
    if (sal30 > 0) consumoDiario = (sal30/30)*0.6 + (sal90/90)*0.3 + (sal365/365)*0.1;
    else if (sal90 > 0) consumoDiario = (sal90/90)*0.7 + (sal365/365)*0.3;
    else if (sal365 > 0) consumoDiario = sal365/365;
    else return; // Sin historial

    if (consumoDiario <= 0) return;

    const diasRestantes = Math.round(Number(p.stock) / consumoDiario);
    const fechaAgotamiento = new Date(hoy.getTime() + diasRestantes*86400000).toLocaleDateString('es-MX');

    predicciones.push({
      nombre: p.nombre,
      stock: p.stock,
      unidad: p.unidad||'',
      consumoDiario,
      diasRestantes,
      fechaAgotamiento,
    });
  });

  return predicciones.sort((a,b) => a.diasRestantes - b.diasRestantes);
}
