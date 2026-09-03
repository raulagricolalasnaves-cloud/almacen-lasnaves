// =====================================================
//  COMPRAS — Módulo unificado compras ↔ almacén
//  Las Naves Agrícola · v1
//
//  Lo que resuelve: hasta ahora, marcar un pedido como entregado
//  no generaba la entrada al almacén. Aquí, recibir una compra
//  crea el movimiento, suma al stock y recalcula el costo promedio,
//  todo en una sola transacción del lado de la base.
// =====================================================

let comprasCache   = [];
let productosCache = [];
let provCache      = [];
let rsCache        = [];
let lineasNuevas   = [];

// ── API ───────────────────────────────────────────────
const APIC = {
  async getCompras(filtro = {}) {
    let q = db.from('compras').select('*').order('fecha_compra', { ascending: false }).limit(300);
    if (filtro.estado)    q = q.eq('estado', filtro.estado);
    if (filtro.proveedor) q = q.eq('proveedor_id', filtro.proveedor);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async getLineas(compraId) {
    const { data, error } = await db.from('compra_lineas').select('*')
      .eq('compra_id', compraId).order('created_at');
    if (error) throw error;
    return data || [];
  },
  async addCompra(c) {
    const { data, error } = await db.from('compras').insert(c).select('id').single();
    if (error) throw error;
    return data.id;
  },
  async addLineas(ls) {
    const { error } = await db.from('compra_lineas').insert(ls);
    if (error) throw error;
  },
  async recibir(compraId, usuario) {
    const { data, error } = await db.rpc('recibir_compra', {
      p_compra_id: compraId, p_usuario: usuario || 'sistema',
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  },
  async getPresentaciones(productoId) {
    const { data, error } = await db.from('presentaciones').select('*')
      .eq('producto_id', productoId).order('factor');
    if (error) throw error;
    return data || [];
  },
  async getPorConfirmar() {
    const { data, error } = await db.from('v_precios_por_confirmar').select('*').limit(200);
    if (error) throw error;
    return data || [];
  },
  async confirmarPrecio(lineaId, precio, importe) {
    const { error } = await db.from('compra_lineas')
      .update({ precio_unitario: precio, importe, precio_confirmado: true })
      .eq('id', lineaId);
    if (error) throw error;
  },
  async getSaldos() {
    const { data, error } = await db.from('v_saldos_proveedores').select('*')
      .order('saldo', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async addPago(p) {
    const { error } = await db.from('pagos_proveedores').insert(p);
    if (error) throw error;
  },
};

// ── UTILIDADES ────────────────────────────────────────
const mxn = n => (n == null || isNaN(n)) ? '—'
  : '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

function puedeEditarCompras() {
  return ['admin', 'supervisor'].includes(currentProfile?.rol);
}

async function precargarCatalogos() {
  if (productosCache.length) return;
  const [p, pr, rs] = await Promise.all([
    db.from('productos').select('id,nombre,unidad,stock,costo_promedio').eq('activo', true).order('nombre'),
    db.from('proveedores').select('id,nombre').eq('activo', true).order('nombre'),
    db.from('razones_sociales').select('id,nombre').eq('activo', true).order('nombre'),
  ]);
  productosCache = p.data || [];
  provCache      = pr.data || [];
  rsCache        = rs.data || [];
}

// ── SUBPESTAÑAS ───────────────────────────────────────
function comprasVista(cual, btn) {
  ['lista', 'nueva', 'precios', 'saldos'].forEach(v => {
    document.getElementById('cmp-' + v)?.classList.add('hidden');
  });
  document.querySelectorAll('#tab-compras .subtab').forEach(b => b.classList.remove('active'));
  document.getElementById('cmp-' + cual)?.classList.remove('hidden');
  btn?.classList.add('active');
  ({ lista: cargarCompras, nueva: formNuevaCompra,
     precios: cargarPorConfirmar, saldos: cargarSaldos }[cual])?.();
}

// ── 1 · LISTA DE COMPRAS ──────────────────────────────
async function cargarCompras() {
  const el = document.getElementById('cmp-lista-body');
  if (!el) return;
  el.innerHTML = '<div class="loading">Cargando…</div>';
  try {
    await precargarCatalogos();
    const filtro = document.getElementById('cmp-filtro-estado')?.value || '';
    comprasCache = await APIC.getCompras(filtro ? { estado: filtro } : {});
    if (!comprasCache.length) { el.innerHTML = '<div class="empty">Sin compras registradas</div>'; return; }

    el.innerHTML = comprasCache.map(c => {
      const badge = c.estado === 'Recibida' ? 'badge-ok'
                  : c.estado === 'Cancelada' ? 'badge-warn' : 'badge-info';
      const vence = c.fecha_vencimiento
        ? `<span class="inv-sub">Vence: ${c.fecha_vencimiento}${
            c.fecha_vencimiento < new Date().toISOString().slice(0,10) ? ' ⚠' : ''}</span>` : '';
      return `
      <div class="inv-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div>
            <div class="inv-name">${esc(c.factura || 'Sin factura')} — ${esc(c.proveedor_nombre || '')}</div>
            <div class="inv-sub">${c.fecha_compra || 'sin fecha'} · ${mxn(c.total)}${
              c.condiciones_pago ? ' · ' + esc(c.condiciones_pago) : ''}</div>
            ${vence}
          </div>
          <span class="badge ${badge}">${esc(c.estado)}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="verLineasCompra('${c.id}')">Ver renglones</button>
          ${c.estado === 'Registrada' && puedeEditarCompras()
            ? `<button class="btn btn-sm btn-green" onclick="recibirCompra('${c.id}')">✓ Recibir en almacén</button>` : ''}
        </div>
        <div id="cmp-lin-${c.id}" class="hidden" style="margin-top:4px"></div>
      </div>`;
    }).join('');
  } catch (e) { el.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; }
}

async function verLineasCompra(id) {
  const cont = document.getElementById('cmp-lin-' + id);
  if (!cont) return;
  if (!cont.classList.contains('hidden')) { cont.classList.add('hidden'); return; }
  cont.classList.remove('hidden');
  cont.innerHTML = '<div class="loading">Cargando…</div>';
  try {
    const ls = await APIC.getLineas(id);
    cont.innerHTML = ls.length ? `
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr style="text-align:left;opacity:.7">
          <th>Producto</th><th>Cantidad</th><th>Base</th><th>Precio</th><th>Importe</th><th></th>
        </tr>
        ${ls.map(l => `<tr>
          <td>${esc(l.producto_nombre)}<br><span style="opacity:.6">${esc(l.producto_id || '')}</span></td>
          <td>${l.cantidad_recibida ?? '—'} ${esc(l.unidad || '')}</td>
          <td>${l.cantidad_base ?? '—'} ${esc(l.unidad_base || '')}</td>
          <td>${mxn(l.precio_unitario)}</td>
          <td>${mxn(l.importe)}</td>
          <td>${l.es_bonificacion ? '<span class="badge badge-info">bonif.</span>'
                : (l.precio_confirmado ? '' : '<span class="badge badge-warn">sin precio</span>')}</td>
        </tr>`).join('')}
      </table>` : '<div class="empty">Sin renglones</div>';
  } catch (e) { cont.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; }
}

// ── 2 · RECIBIR (aquí ocurre la unificación) ──────────
async function recibirCompra(id) {
  const c = comprasCache.find(x => x.id === id);
  const ls = await APIC.getLineas(id);
  const conProd = ls.filter(l => l.producto_id && l.cantidad_base);
  if (!conProd.length) { toast('Esta compra no tiene renglones con producto y cantidad'); return; }

  const resumen = conProd.slice(0, 8)
    .map(l => `• ${l.producto_nombre}: +${l.cantidad_base} ${l.unidad_base || ''}`).join('\n');
  const ok = confirm(
    `Recibir ${c?.factura || 'esta compra'} de ${c?.proveedor_nombre || ''}\n\n` +
    `Se van a SUMAR al inventario ${conProd.length} renglón(es):\n\n${resumen}` +
    (conProd.length > 8 ? `\n… y ${conProd.length - 8} más` : '') +
    `\n\nEsto crea los movimientos de entrada y recalcula el costo promedio.\n` +
    `No se puede deshacer con un clic: habría que hacer un ajuste.\n\n¿Continuar?`);
  if (!ok) return;

  try {
    const r = await APIC.recibir(id, currentProfile?.nombre || currentUser?.email);
    toast(`✓ Recibida: ${r?.lineas_procesadas ?? conProd.length} renglones, ` +
          `${r?.unidades_ingresadas ?? ''} unidades al almacén`);
    cargarCompras();
    if (typeof cargarInventario === 'function') { todosProductos = []; }
  } catch (e) {
    toast('Error al recibir: ' + e.message);
  }
}

// ── 3 · NUEVA COMPRA ──────────────────────────────────
async function formNuevaCompra() {
  await precargarCatalogos();
  const sel = id => document.getElementById(id);
  sel('cmp-prov').innerHTML = '<option value="">— proveedor —</option>' +
    provCache.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('');
  sel('cmp-rs').innerHTML = '<option value="">— razón social —</option>' +
    rsCache.map(r => `<option value="${r.id}">${esc(r.nombre)}</option>`).join('');
  sel('cmp-prod-list').innerHTML =
    productosCache.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)} (${esc(p.unidad || '')})</option>`).join('');
  if (!sel('cmp-fecha').value) sel('cmp-fecha').value = new Date().toISOString().slice(0, 10);
  lineasNuevas = [];
  renderLineasNuevas();
}

async function alSeleccionarProducto() {
  const id = document.getElementById('cmp-l-prod').value.trim();
  const p = productosCache.find(x => x.id === id);
  const info = document.getElementById('cmp-l-info');
  const selU = document.getElementById('cmp-l-unidad');
  if (!p) { info.textContent = 'Selecciona un producto del catálogo'; selU.innerHTML = ''; return; }
  info.textContent = `${p.nombre} · stock ${p.stock ?? 0} ${p.unidad || ''}` +
    (p.costo_promedio ? ` · costo actual ${mxn(p.costo_promedio)}` : ' · sin costo registrado');
  const pres = await APIC.getPresentaciones(id);
  selU.innerHTML = pres.length
    ? pres.map(s => `<option value="${s.id}" data-factor="${s.factor}" data-base="${esc(s.unidad_base)}">${esc(s.unidad_pedida)} × ${s.factor} = ${esc(s.unidad_base)}</option>`).join('')
    : `<option value="" data-factor="1" data-base="${esc(p.unidad || '')}">${esc(p.unidad || 'unidad')} (sin presentación registrada)</option>`;
  calcularBase();
}

function calcularBase() {
  const cant = parseFloat(document.getElementById('cmp-l-cant').value) || 0;
  const opt  = document.getElementById('cmp-l-unidad').selectedOptions[0];
  const f    = parseFloat(opt?.dataset.factor) || 1;
  const base = document.getElementById('cmp-l-base');
  base.textContent = cant ? `= ${+(cant * f).toFixed(4)} ${opt?.dataset.base || ''}` : '';
}

function agregarLineaCompra() {
  const id   = document.getElementById('cmp-l-prod').value.trim();
  const p    = productosCache.find(x => x.id === id);
  if (!p) { toast('Elige un producto del catálogo'); return; }
  const cant = parseFloat(document.getElementById('cmp-l-cant').value);
  if (!cant || cant <= 0) { toast('La cantidad debe ser mayor que cero'); return; }
  const opt  = document.getElementById('cmp-l-unidad').selectedOptions[0];
  const f    = parseFloat(opt?.dataset.factor) || 1;
  const precioRaw = document.getElementById('cmp-l-precio').value;
  const precio = precioRaw === '' ? null : parseFloat(precioRaw);

  lineasNuevas.push({
    producto_id: p.id, producto_nombre: p.nombre,
    presentacion_id: opt?.value || null,
    cantidad_recibida: cant,
    unidad: opt ? opt.textContent.split(' ×')[0] : (p.unidad || ''),
    cantidad_base: +(cant * f).toFixed(4),
    unidad_base: opt?.dataset.base || p.unidad || '',
    precio_unitario: precio,
    importe: precio == null ? null : +(precio * cant).toFixed(2),
    precio_confirmado: precio != null,
  });
  ['cmp-l-prod','cmp-l-cant','cmp-l-precio'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('cmp-l-info').textContent = '';
  document.getElementById('cmp-l-base').textContent = '';
  renderLineasNuevas();
}

function renderLineasNuevas() {
  const el = document.getElementById('cmp-lineas-lista');
  if (!el) return;
  if (!lineasNuevas.length) {
    el.innerHTML = '<div style="font-size:12px;opacity:.6;padding:8px 0">Agrega al menos un renglón</div>';
    document.getElementById('cmp-total').textContent = '';
    return;
  }
  const total = lineasNuevas.reduce((s, l) => s + (l.importe || 0), 0);
  const sinPrecio = lineasNuevas.filter(l => l.precio_unitario == null).length;
  el.innerHTML = lineasNuevas.map((l, i) => `
    <div class="pedido-prod-item">
      <div class="pedido-prod-item-name">
        ${esc(l.producto_nombre)}
        <span style="opacity:.6;font-size:11px"> — ${l.cantidad_recibida} ${esc(l.unidad)} = ${l.cantidad_base} ${esc(l.unidad_base)}</span>
      </div>
      <div class="pedido-prod-item-qty">${l.precio_unitario == null
        ? '<span class="badge badge-warn">sin precio</span>' : mxn(l.importe)}</div>
      <button class="pedido-prod-remove" onclick="lineasNuevas.splice(${i},1);renderLineasNuevas()">✕</button>
    </div>`).join('');
  document.getElementById('cmp-total').textContent =
    `Total: ${mxn(total)}` + (sinPrecio ? ` · ${sinPrecio} renglón(es) sin precio` : '');
}

async function guardarCompra() {
  if (!puedeEditarCompras()) { toast('Solo admin o supervisor pueden registrar compras'); return; }
  const factura = document.getElementById('cmp-factura').value.trim();
  const provId  = document.getElementById('cmp-prov').value;
  if (!provId)  { toast('Elige el proveedor'); return; }
  if (!lineasNuevas.length) { toast('Agrega al menos un renglón'); return; }

  const dias  = parseInt(document.getElementById('cmp-dias').value) || null;
  const fecha = document.getElementById('cmp-fecha').value || null;
  let vence = null;
  if (dias && fecha) {
    const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() + dias);
    vence = d.toISOString().slice(0, 10);
  }
  const total = lineasNuevas.reduce((s, l) => s + (l.importe || 0), 0);

  try {
    const compraId = await APIC.addCompra({
      folio_interno: 'C-' + Date.now(),
      proveedor_id: provId,
      proveedor_nombre: provCache.find(p => p.id === provId)?.nombre,
      razon_social_id: document.getElementById('cmp-rs').value || null,
      factura: factura || null,
      fecha_compra: fecha,
      almacen_id: almacenActivo?.id || null,
      moneda: document.getElementById('cmp-moneda').value,
      tipo_cambio: parseFloat(document.getElementById('cmp-tc').value) || null,
      total: total || null,
      condiciones_pago: document.getElementById('cmp-cond').value.trim() || null,
      dias_credito: dias,
      fecha_vencimiento: vence,
      estado: 'Registrada',
      origen_dato: 'captura en ERP',
      observaciones: document.getElementById('cmp-nota').value.trim() || null,
    });
    await APIC.addLineas(lineasNuevas.map(l => ({ ...l, compra_id: compraId })));
    toast('✓ Compra registrada. Falta recibirla para que entre al almacén.');
    lineasNuevas = [];
    ['cmp-factura','cmp-nota','cmp-cond'].forEach(i => document.getElementById(i).value = '');
    renderLineasNuevas();
    comprasVista('lista', document.querySelector('#tab-compras .subtab'));
  } catch (e) { toast('Error al guardar: ' + e.message); }
}

// ── 4 · PRECIOS POR CONFIRMAR ─────────────────────────
async function cargarPorConfirmar() {
  const el = document.getElementById('cmp-precios-body');
  if (!el) return;
  el.innerHTML = '<div class="loading">Cargando…</div>';
  try {
    const rows = await APIC.getPorConfirmar();
    if (!rows.length) { el.innerHTML = '<div class="empty" style="color:var(--green)">✓ No hay precios pendientes</div>'; return; }
    el.innerHTML = `<div class="inv-sub" style="margin-bottom:8px">${rows.length} renglón(es) entraron sin precio. Captúralo con la factura en la mano.</div>` +
      rows.map(r => `
      <div class="inv-item">
        <div>
          <div class="inv-name">${esc(r.producto_nombre)}</div>
          <div class="inv-sub">${esc(r.factura || 'sin factura')} · ${esc(r.proveedor_nombre || '')} · ${r.fecha_compra || ''}</div>
          <div class="inv-sub">${r.cantidad_recibida ?? '—'} ${esc(r.unidad || '')} = ${r.cantidad_base ?? '—'} ${esc(r.unidad_base || '')}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <input class="input" type="number" step="0.01" placeholder="Precio unitario"
                 id="pc-${r.compra_linea_id}" style="width:130px">
          <button class="btn btn-sm btn-green"
                  onclick="guardarPrecio('${r.compra_linea_id}',${r.cantidad_recibida || 0})">Guardar</button>
        </div>
      </div>`).join('');
  } catch (e) { el.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; }
}

async function guardarPrecio(lineaId, cantidad) {
  const v = parseFloat(document.getElementById('pc-' + lineaId)?.value);
  if (!v || v <= 0) { toast('Captura un precio válido'); return; }
  try {
    await APIC.confirmarPrecio(lineaId, v, +(v * cantidad).toFixed(2));
    toast('✓ Precio confirmado');
    cargarPorConfirmar();
  } catch (e) { toast('Error: ' + e.message); }
}

// ── 5 · SALDOS POR PROVEEDOR ──────────────────────────
async function cargarSaldos() {
  const el = document.getElementById('cmp-saldos-body');
  if (!el) return;
  el.innerHTML = '<div class="loading">Cargando…</div>';
  try {
    const rows = (await APIC.getSaldos()).filter(r => r.compras > 0);
    if (!rows.length) { el.innerHTML = '<div class="empty">Sin saldos</div>'; return; }
    const totalSaldo = rows.reduce((s, r) => s + Number(r.saldo || 0), 0);
    el.innerHTML = `
      <div class="metric-card" style="margin-bottom:10px">
        <div class="metric-body">
          <div class="metric-val">${mxn(totalSaldo)}</div>
          <div class="metric-label">Saldo total con proveedores</div>
        </div>
      </div>` + rows.map(r => `
      <div class="inv-item">
        <div>
          <div class="inv-name">${esc(r.proveedor)}</div>
          <div class="inv-sub">${r.compras} compra(s) · comprado ${mxn(r.total_comprado)} · pagado ${mxn(r.total_pagado)}</div>
          ${r.compras_vencidas > 0
            ? `<div class="inv-sub" style="color:var(--red)">⚠ ${r.compras_vencidas} vencida(s)</div>`
            : (r.proximo_vencimiento ? `<div class="inv-sub">Próximo vencimiento: ${r.proximo_vencimiento}</div>` : '')}
        </div>
        <div style="text-align:right">
          <div class="inv-name">${mxn(r.saldo)}</div>
          ${currentProfile?.rol === 'admin'
            ? `<button class="btn btn-sm" onclick="registrarPago('${r.proveedor_id}','${esc(r.proveedor)}')">Registrar pago</button>` : ''}
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div class="empty">Error: ${esc(e.message)}<br><span style="font-size:11px">Los saldos solo los ve un administrador.</span></div>`;
  }
}

async function registrarPago(provId, nombre) {
  const monto = parseFloat(prompt(`Monto del pago a ${nombre}:`));
  if (!monto || monto <= 0) return;
  const ref = prompt('Referencia (transferencia, cheque, etc.):') || null;
  try {
    await APIC.addPago({
      proveedor_id: provId, fecha: new Date().toISOString().slice(0, 10),
      monto, tipo: 'pago', referencia: ref,
      registrado_por: currentProfile?.nombre || currentUser?.email,
    });
    toast('✓ Pago registrado');
    cargarSaldos();
  } catch (e) { toast('Error: ' + e.message); }
}
