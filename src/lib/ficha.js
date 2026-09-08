// ═══════════════════════════════════════════════════════════════════
//  ficha.js — lo que sabe un producto, al pulsarlo
//
//  El inventario ya tenía un panel que se abría al hacer clic en un
//  renglón, pero sólo repetía lo que ya se veía arriba. Este archivo
//  le mete adentro las cuatro cosas que de verdad hacen falta para
//  decidir algo en ese momento:
//
//     · dónde está y cuánto se consume al mes
//     · cómo se ha movido, con el folio del vale
//     · quién lo pide, de qué rancho y para qué cultivo
//     · a quién comprarlo, a qué precio y con qué plazo
//
//  Nada de esto se captura. Sale de v_producto_ficha, v_quien_pide y
//  de los movimientos que ya están adentro. Lo que el sistema dedujo
//  se marca con ƒ y dice de dónde lo sacó, para que nunca se confunda
//  con un dato leído del papel.
//
//  No se toca app.js: se envuelve toggleProductoInfo y se inyecta el
//  bloque debajo del panel que ya existía.
// ═══════════════════════════════════════════════════════════════════

const fichaCache = new Map();

const fchF = n => n == null ? '—'
  : (Number(n) % 1 === 0 ? Number(n).toLocaleString('es-MX')
                         : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 }));
const fchM = n => n == null ? '—' : '$' + Number(n).toLocaleString('es-MX',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fchEsc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fchDer = (v, t) => '<span class="fch-der" title="' + fchEsc(t) + '">' + v + '</span>';
const fchFecha = s => {
  if (!s) return '—';
  const d = new Date(String(s).length <= 10 ? s + 'T12:00' : s);
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
};

async function fichaCargar(id) {
  if (fichaCache.has(id)) return fichaCache.get(id);
  const r = { ficha: null, movs: [], pide: [] };
  try {
    const [f, m, q] = await Promise.all([
      db.from('v_producto_ficha').select('*').eq('producto_id', id).maybeSingle(),
      db.from('movimientos')
        .select('tipo,cantidad,unidad,destino,created_at,folio_vale,usuario_nombre')
        .eq('id_producto', id).order('created_at', { ascending: false, nullsFirst: false }).limit(6),
      db.from('v_quien_pide')
        .select('rancho_nombre,cultivo_nombre,cantidad,ultimo_pedido')
        .eq('producto_id', id).order('cantidad', { ascending: false }).limit(6),
    ]);
    r.ficha = f.data || null;
    r.movs  = m.data || [];
    r.pide  = q.data || [];
  } catch (e) { r.error = e.message; }
  fichaCache.set(id, r);
  return r;
}

function fichaHTML(d, id) {
  if (d.error) return '<div class="fch-wrap"><div class="fch-vacio">No se pudo cargar la ficha: ' + fchEsc(d.error) + '</div></div>';
  const f = d.ficha;
  if (!f) return '<div class="fch-wrap"><div class="fch-vacio">Este producto todavía no tiene ficha.</div></div>';

  const min = f.minimo != null ? Number(f.minimo) : null;
  const stock = Number(f.stock) || 0;

  // ── aviso, sólo si hay algo que decir ──
  let aviso = '';
  if (!f.stock_verificado) {
    aviso = '<div class="fch-aviso warn"><b>Sin contar.</b> No es que haya cero: es que este producto '
      + 'nunca se ha contado, así que el sistema no decide nada sobre él. Si aparece en una solicitud, '
      + 'lo manda a comprar y lo dice.</div>';
  } else if (min != null && stock < min) {
    aviso = '<div class="fch-aviso"><b>Por debajo de lo que se consume.</b> Salen ' + fchF(min) + ' '
      + fchEsc(f.unidad || '') + ' al mes y quedan ' + fchF(stock) + '.</div>';
  }

  // ── 1 · dónde está ──
  const kv = [
    ['Almacén', fchEsc(f.almacen_nombre || '—')],
    ['Ubicación', f.ubicacion ? fchEsc(f.ubicacion) : '<span class="fch-mut">sin ubicación</span>'],
    ['Existencia', fchF(stock) + ' ' + fchEsc(f.unidad || '')],
    ['Último conteo', f.stock_verificado ? fchFecha(f.fecha_conteo) : '<span class="fch-mut">nunca</span>'],
    ['Sale al mes', f.consumo_mes != null
      ? fchDer(fchF(f.consumo_mes) + ' ' + fchEsc(f.unidad || ''),
               'Promedio real de ' + (f.salidas_registradas || 0) + ' salidas registradas')
      : '<span class="fch-mut">no ha salido</span>'],
    ['Costo promedio', Number(f.costo_promedio) > 0 ? fchM(f.costo_promedio)
      : '<span class="fch-mut">sin precio</span>'],
    ['Valor', Number(f.valor) > 0 ? fchM(f.valor) : '—'],
  ].map(r => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('');

  // ── 2 · cómo se ha movido ──
  const movs = d.movs.length ? d.movs.map(m => {
    const ent = m.tipo === 'entrada';
    const et = [m.folio_vale, m.created_at ? fchFecha(m.created_at) : null].filter(Boolean).join(' · ');
    return '<li><span class="l">' + (ent ? '▲' : '▼') + ' ' + fchEsc(m.destino || (ent ? 'entrada' : 'salida'))
      + '</span><span class="r">' + (ent ? '+' : '−') + fchF(m.cantidad) + (et ? ' · ' + fchEsc(et) : '') + '</span></li>';
  }).join('') : '<li><span class="l fch-mut">sin movimientos registrados</span></li>';

  // ── 3 · quién lo pide ──
  const pide = d.pide.length ? d.pide.map(q =>
    '<li><span class="l">' + fchEsc(q.rancho_nombre)
    + (q.cultivo_nombre ? ' · ' + fchEsc(q.cultivo_nombre) : '')
    + '</span><span class="r">' + fchF(q.cantidad) + ' ' + fchEsc(f.unidad || '') + '</span></li>'
  ).join('') : '<li><span class="l fch-mut">nadie lo ha pedido por escrito</span></li>';

  // ── 4 · dónde comprarlo ──
  let prov;
  if (f.proveedor_nombre) {
    const varios = Number(f.n_proveedores) > 1;
    prov = '<li><span class="l">' + (varios ? fchEsc(f.proveedor_nombre)
             : fchDer(fchEsc(f.proveedor_nombre), 'Único proveedor de este producto en todo el historial'))
      + '</span><span class="r">' + (Number(f.costo_historico) > 0 ? fchM(f.costo_historico)
          : '<span class="fch-mut">sin precio</span>') + '</span></li>'
      + '<li><span class="l fch-mut">' + (f.compras_al_proveedor || 0) + ' compra'
      + ((f.compras_al_proveedor || 0) === 1 ? '' : 's') + ' · última ' + fchFecha(f.ultima_compra)
      + '</span><span class="r">' + (f.dias_credito != null
          ? fchDer(f.dias_credito === 0 ? 'contado' : f.dias_credito + ' días',
                   'Plazo deducido de las órdenes anteriores de este proveedor')
          : (f.plazo_confiable === false ? '<span class="fch-mut">plazo variable</span>' : '—'))
      + '</span></li>'
      + (varios ? '<li><span class="l fch-mut">hay ' + f.n_proveedores + ' proveedores para este producto</span><span class="r"></span></li>' : '');
  } else {
    prov = '<li><span class="l fch-mut">nunca se ha comprado con precio</span></li>';
  }

  return '<div class="fch-wrap">' + aviso
    + '<div class="fch-grid">'
    + '<div class="fch-blk"><h5>Dónde está</h5><dl class="fch-kv">' + kv + '</dl></div>'
    + '<div class="fch-blk"><h5>Cómo se ha movido</h5><ul class="fch-mini">' + movs + '</ul></div>'
    + '<div class="fch-blk"><h5>Quién lo pide</h5><ul class="fch-mini">' + pide + '</ul></div>'
    + '<div class="fch-blk"><h5>Dónde comprarlo</h5><ul class="fch-mini">' + prov + '</ul></div>'
    + '</div></div>';
}

// ── Engancharse al panel que ya existía ────────────────────────────

(function () {
  const orig = window.toggleProductoInfo;
  if (typeof orig !== 'function') return;

  window.toggleProductoInfo = function (id) {
    orig.apply(this, arguments);
    const panel = document.getElementById('info-' + id);
    if (!panel || panel.classList.contains('hidden')) return;

    let host = panel.querySelector('.fch-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'fch-host';
      panel.appendChild(host);
    }
    if (host.dataset.listo === id) return;   // ya cargada
    host.innerHTML = '<div class="fch-wrap"><div class="fch-vacio">Cargando la ficha...</div></div>';
    fichaCargar(id).then(d => {
      host.innerHTML = fichaHTML(d, id);
      host.dataset.listo = id;
    });
  };
})();

// El conteo y los ajustes cambian la existencia: si no se limpia,
// la ficha enseñaría el número viejo.
function fichaOlvidar(id) { if (id) fichaCache.delete(id); else fichaCache.clear(); }
window.fichaOlvidar = fichaOlvidar;
