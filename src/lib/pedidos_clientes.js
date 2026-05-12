// =====================================================
//  PEDIDOS DE CLIENTES v13
//  Seguimiento completo: recepción → entrega
// =====================================================

const ESTADOS_PEDIDO = [
  { key:'Recibido',    color:'#6b7280', label:'Recibido',    desc:'Pedido registrado en el sistema' },
  { key:'Confirmado',  color:'#2563eb', label:'Confirmado',  desc:'Pedido confirmado con el cliente' },
  { key:'En proceso',  color:'#d97706', label:'En proceso',  desc:'Preparando el pedido en almacén' },
  { key:'Listo',       color:'#16a34a', label:'Listo',       desc:'Pedido preparado para entrega' },
  { key:'En camino',   color:'#7c3aed', label:'En camino',   desc:'En tránsito hacia el cliente' },
  { key:'Entregado',   color:'#16a34a', label:'Entregado',   desc:'Entregado y confirmado' },
  { key:'Cancelado',   color:'#dc2626', label:'Cancelado',   desc:'Pedido cancelado' },
];

let pedidoClienteDetalle = null;
let pedidosClienteProductos = [];

// ── CARGAR PEDIDOS ────────────────────────────────────
async function cargarPedidosClientes() {
  document.getElementById('pc-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const peds = await API.getPedidosClientes();
    renderPedidosClientes(peds);
  } catch { document.getElementById('pc-lista').innerHTML = '<div class="empty">Error al cargar</div>'; }
}

function renderPedidosClientes(peds) {
  if (!peds.length) {
    document.getElementById('pc-lista').innerHTML = '<div class="empty">Sin pedidos de clientes registrados</div>';
    return;
  }

  // Métricas rápidas
  const hoy = new Date();
  const activos   = peds.filter(p => !['Entregado','Cancelado'].includes(p.estado));
  const vencidos  = activos.filter(p => p.fecha_entrega_est && new Date(p.fecha_entrega_est) < hoy);
  const hoy_list  = activos.filter(p => p.fecha_entrega_est === hoy.toISOString().split('T')[0]);

  document.getElementById('pc-lista').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      <div class="metric-card"><div class="metric-icon blue"><span style="font-size:18px">📋</span></div><div class="metric-body"><div class="metric-val">${activos.length}</div><div class="metric-label">Activos</div></div></div>
      <div class="metric-card"><div class="metric-icon ${vencidos.length?'red':'green'}"><span style="font-size:18px">${vencidos.length?'⚠':'✓'}</span></div><div class="metric-body"><div class="metric-val">${vencidos.length}</div><div class="metric-label">Vencidos</div></div></div>
      <div class="metric-card"><div class="metric-icon amber"><span style="font-size:18px">📅</span></div><div class="metric-body"><div class="metric-val">${hoy_list.length}</div><div class="metric-label">Hoy</div></div></div>
    </div>
    ${peds.map(p => renderPedidoClienteCard(p)).join('')}
  `;
}

function renderPedidoClienteCard(p) {
  const estado = ESTADOS_PEDIDO.find(e => e.key === p.estado) || ESTADOS_PEDIDO[0];
  const hoy = new Date();
  const est = p.fecha_entrega_est ? new Date(p.fecha_entrega_est) : null;
  const diasRestantes = est ? Math.ceil((est - hoy) / 86400000) : null;
  const vencido = diasRestantes !== null && diasRestantes < 0 && !['Entregado','Cancelado'].includes(p.estado);

  let prods = [];
  try { prods = JSON.parse(p.productos_json || '[]'); } catch {}

  return `<div class="pc-card ${vencido?'pc-vencido':''}" onclick="verDetallePedidoCliente('${p.id}')">
    <div class="pc-card-header">
      <div>
        <div class="pc-num">${p.num} <span class="pc-prioridad pc-prioridad-${p.prioridad||'normal'}">${p.prioridad||'normal'}</span></div>
        <div class="pc-cliente">👤 ${p.cliente_nombre}</div>
      </div>
      <div style="text-align:right">
        <div class="badge" style="background:${estado.color}20;color:${estado.color};border:1px solid ${estado.color}40">${estado.label}</div>
        ${vencido?'<div style="font-size:11px;color:var(--red);margin-top:3px">⚠ Vencido hace '+Math.abs(diasRestantes)+'d</div>':''}
        ${!vencido&&diasRestantes!==null&&!['Entregado','Cancelado'].includes(p.estado)?`<div style="font-size:11px;color:var(--text3);margin-top:3px">${diasRestantes===0?'Entrega hoy':diasRestantes+' días'}</div>`:''}
      </div>
    </div>
    <div class="pc-productos">${prods.slice(0,2).map(pr=>`• ${pr.nombre} (${pr.qty})`).join(' &nbsp; ')}${prods.length>2?` +${prods.length-2} más`:''}</div>
    <div class="pc-fechas">
      <span>📅 Pedido: ${p.fecha_pedido||'—'}</span>
      <span>🚚 Est: ${p.fecha_entrega_est||'—'}</span>
      ${p.total_estimado?`<span>💰 $${Number(p.total_estimado).toLocaleString('es-MX')}</span>`:''}
    </div>
  </div>`;
}

// ── DETALLE DEL PEDIDO ────────────────────────────────
async function verDetallePedidoCliente(id) {
  try {
    const [peds, hist] = await Promise.all([API.getPedidosClientes(), API.getHistorialPedidoCliente(id)]);
    pedidoClienteDetalle = peds.find(p => p.id === id);
    if (!pedidoClienteDetalle) return;

    let prods = [];
    try { prods = JSON.parse(pedidoClienteDetalle.productos_json || '[]'); } catch {}

    const estado = ESTADOS_PEDIDO.find(e => e.key === pedidoClienteDetalle.estado) || ESTADOS_PEDIDO[0];

    // Timeline de estados
    const timelineHtml = `
      <div class="pc-timeline">
        ${ESTADOS_PEDIDO.filter(e=>e.key!=='Cancelado').map(e => {
          const hecho = ESTADOS_PEDIDO.findIndex(x=>x.key===pedidoClienteDetalle.estado) >= ESTADOS_PEDIDO.findIndex(x=>x.key===e.key);
          return `<div class="pc-timeline-item ${hecho?'done':''}">
            <div class="pc-timeline-dot" style="background:${hecho?e.color:'var(--border)'}"></div>
            <div class="pc-timeline-label">${e.label}</div>
          </div>`;
        }).join('')}
      </div>`;

    document.getElementById('pc-detalle-content').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div>
          <div style="font-size:17px;font-weight:600;color:var(--navy)">${pedidoClienteDetalle.num}</div>
          <div style="font-size:13px;color:var(--text2)">Cliente: <strong>${pedidoClienteDetalle.cliente_nombre}</strong></div>
        </div>
        <button class="btn btn-sm" onclick="cerrarDetallePedidoCliente()">← Volver</button>
      </div>

      ${timelineHtml}

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">Información del pedido</div>
        <div class="prov-info" style="grid-template-columns:1fr">
          ${pedidoClienteDetalle.cliente_tel?`<div class="prov-info-item">📞 <span>${pedidoClienteDetalle.cliente_tel}</span></div>`:''}
          ${pedidoClienteDetalle.cliente_correo?`<div class="prov-info-item">✉ <span>${pedidoClienteDetalle.cliente_correo}</span></div>`:''}
          <div class="prov-info-item">📅 Fecha pedido: <span>${pedidoClienteDetalle.fecha_pedido||'—'}</span></div>
          <div class="prov-info-item">🚚 Entrega estimada: <span><strong>${pedidoClienteDetalle.fecha_entrega_est||'—'}</strong></span></div>
          ${pedidoClienteDetalle.fecha_entrega_real?`<div class="prov-info-item">✓ Entrega real: <span>${pedidoClienteDetalle.fecha_entrega_real}</span></div>`:''}
          ${pedidoClienteDetalle.total_estimado?`<div class="prov-info-item">💰 Total: <span><strong>$${Number(pedidoClienteDetalle.total_estimado).toLocaleString('es-MX')}</strong></span></div>`:''}
          ${pedidoClienteDetalle.nota?`<div class="prov-info-item">📝 Nota: <span>${pedidoClienteDetalle.nota}</span></div>`:''}
        </div>
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">Productos solicitados</div>
        ${prods.map(pr=>`<div class="pedido-detalle-item">• ${pr.nombre} — ${pr.qty}${pr.precio?` · $${pr.precio}`:''}${pr.nota?' · '+pr.nota:''}</div>`).join('')}
        ${!prods.length?'<div class="empty">Sin productos registrados</div>':''}
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">Actualizar estado</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          ${ESTADOS_PEDIDO.map(e=>`<button class="btn btn-sm ${pedidoClienteDetalle.estado===e.key?'btn-primary':''}"
            onclick="cambiarEstadoPedidoCliente('${pedidoClienteDetalle.id}','${e.key}')"
            style="${pedidoClienteDetalle.estado===e.key?'':'border-color:'+e.color+';color:'+e.color}">${e.label}</button>`).join('')}
        </div>
        <div class="form-group"><label>Nota del cambio (opcional)</label><input class="input" type="text" id="pc-nota-estado" placeholder="Ej: Esperando autorización"></div>
      </div>

      <div class="card">
        <div class="card-header">Historial de estados</div>
        ${hist.length?hist.map(h=>`<div class="eval-item">
          <div style="font-size:13px;font-weight:500">${h.estado}</div>
          ${h.nota?`<div style="font-size:12px;color:var(--text2)">${h.nota}</div>`:''}
          <div style="font-size:11px;color:var(--text3)">${h.usuario||'—'} · ${h.created_at?new Date(h.created_at).toLocaleString('es-MX'):'—'}</div>
        </div>`).join(''):'<div class="empty">Sin historial</div>'}
      </div>
    `;

    document.getElementById('pc-lista-view').classList.add('hidden');
    document.getElementById('pc-detalle-view').classList.remove('hidden');
  } catch(e) { toast('Error: ' + e.message); }
}

function cerrarDetallePedidoCliente() {
  document.getElementById('pc-detalle-view').classList.add('hidden');
  document.getElementById('pc-lista-view').classList.remove('hidden');
  pedidoClienteDetalle = null;
  cargarPedidosClientes();
}

async function cambiarEstadoPedidoCliente(id, estado) {
  const nota = document.getElementById('pc-nota-estado')?.value || '';
  try {
    await API.updateEstadoPedidoCliente(id, estado);
    await API.addHistorialPedidoCliente({ pedido_id:id, estado, nota, usuario:currentProfile?.nombre||currentUser?.email });
    if (estado === 'Entregado') {
      await API.updatePedidoClienteFechaReal(id, new Date().toISOString().split('T')[0]);
    }
    toast('✓ Estado actualizado: ' + estado);
    verDetallePedidoCliente(id);
  } catch(e) { toast('Error: ' + e.message); }
}

// ── CREAR PEDIDO ──────────────────────────────────────
function mostrarFormPedidoCliente() {
  pedidosClienteProductos = [];
  renderProdsPedidoCliente();
  document.getElementById('form-pedido-cliente').classList.remove('hidden');
  document.getElementById('form-pedido-cliente').scrollIntoView({behavior:'smooth'});
  // Fecha de hoy por defecto
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('pc-fecha-pedido').value = hoy;
}

function agregarProdPedidoCliente() {
  const nombre = document.getElementById('pc-prod-nombre').value.trim();
  const qty    = document.getElementById('pc-prod-qty').value.trim();
  const precio = document.getElementById('pc-prod-precio').value.trim();
  const nota   = document.getElementById('pc-prod-nota').value.trim();
  if (!nombre || !qty) { toast('Ingresa nombre y cantidad'); return; }
  pedidosClienteProductos.push({ nombre, qty, precio, nota });
  ['pc-prod-nombre','pc-prod-qty','pc-prod-precio','pc-prod-nota'].forEach(id => {
    const e = document.getElementById(id); if(e) e.value = '';
  });
  renderProdsPedidoCliente();
}

function renderProdsPedidoCliente() {
  const lista = document.getElementById('pc-prods-lista');
  if (!lista) return;
  lista.innerHTML = pedidosClienteProductos.length
    ? pedidosClienteProductos.map((p,i)=>`
        <div class="pedido-prod-item">
          <div class="pedido-prod-item-name">${p.nombre}${p.nota?' — '+p.nota:''}</div>
          <div class="pedido-prod-item-qty">${p.qty}${p.precio?' · $'+p.precio:''}</div>
          <button class="pedido-prod-remove" onclick="pedidosClienteProductos.splice(${i},1);renderProdsPedidoCliente()">✕</button>
        </div>`).join('')
    : '<div style="font-size:12px;color:var(--text3);padding:8px 0">Agrega al menos un producto</div>';
  // Calcular total estimado
  const total = pedidosClienteProductos.reduce((s,p)=>{
    const qty = parseFloat(p.qty)||0;
    const precio = parseFloat(p.precio)||0;
    return s + qty*precio;
  }, 0);
  const totalEl = document.getElementById('pc-total-calc');
  if(totalEl) totalEl.textContent = total > 0 ? '$' + total.toLocaleString('es-MX',{minimumFractionDigits:2}) : '—';
}

async function guardarPedidoCliente() {
  const cliente = document.getElementById('pc-cliente').value.trim();
  if (!cliente) { toast('Ingresa el nombre del cliente'); return; }
  if (!pedidosClienteProductos.length) { toast('Agrega al menos un producto'); return; }

  const peds = await API.getPedidosClientes();
  const num  = 'PC-' + String(peds.length + 1).padStart(3, '0');

  const total = pedidosClienteProductos.reduce((s,p)=>{
    return s + (parseFloat(p.qty)||0)*(parseFloat(p.precio)||0);
  }, 0);

  const ped = {
    num,
    cliente_nombre:   cliente,
    cliente_tel:      document.getElementById('pc-tel').value.trim(),
    cliente_correo:   document.getElementById('pc-correo').value.trim(),
    productos_json:   JSON.stringify(pedidosClienteProductos),
    fecha_pedido:     document.getElementById('pc-fecha-pedido').value,
    fecha_entrega_est:document.getElementById('pc-fecha-est').value,
    prioridad:        document.getElementById('pc-prioridad').value,
    nota:             document.getElementById('pc-nota').value.trim(),
    total_estimado:   total,
    estado:           'Recibido',
    creado_por:       currentProfile?.nombre || currentUser?.email,
  };

  try {
    const newId = await API.addPedidoCliente(ped);
    await API.addHistorialPedidoCliente({ pedido_id: newId, estado:'Recibido', nota:'Pedido creado', usuario:ped.creado_por });
    toast('✓ Pedido ' + num + ' registrado');
    document.getElementById('form-pedido-cliente').classList.add('hidden');
    pedidosClienteProductos = [];
    cargarPedidosClientes();
  } catch(e) { toast('Error: ' + e.message); }
}
