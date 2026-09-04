// ═══════════════════════════════════════════════════════════════════
//  disponibilidad.js — "¿surto o compro?"
//
//  El hueco que cierra: hasta hoy, al levantar un pedido se escribia el
//  nombre del producto a mano en una caja de texto. Nadie veia si ya
//  habia existencia, ni cuanto costo la ultima vez, ni a que proveedor
//  salio mas barato. Se mandaba a comprar material que estaba en la
//  bodega.
//
//  Este archivo agrega un buscador arriba de las dos cajas de producto
//  (pedido recibido y pedido a proveedor). Al elegir un producto:
//    · rellena el nombre, para que no se escriba mal
//    · dice si hay existencia y en cual almacen
//    · avisa cuando la existencia es 0 PORQUE NADIE LO HA CONTADO,
//      que no es lo mismo que estar agotado
//    · muestra el ultimo precio pagado y el proveedor mas barato
//
//  No modifica ninguna funcion existente: se engancha al DOM y llena
//  los mismos campos que la persona llenaria a mano.
// ═══════════════════════════════════════════════════════════════════

let dispCache = null;      // v_disponibilidad, cargada una vez por sesion
let dispCargando = false;

async function cargarDisponibilidad(forzar) {
  if (dispCache && !forzar) return dispCache;
  if (dispCargando) {                       // evita dos cargas simultaneas
    while (dispCargando) await new Promise(r => setTimeout(r, 80));
    return dispCache;
  }
  dispCargando = true;
  try {
    const { data, error } = await db.from('v_disponibilidad')
      .select('*').order('nombre').limit(2000);
    if (error) throw error;
    dispCache = data || [];
  } catch (e) {
    console.warn('[disponibilidad]', e.message);
    dispCache = [];
  } finally { dispCargando = false; }
  return dispCache;
}

// ── Presentacion ───────────────────────────────────────────────────

// Color segun la situacion. Verde = surte. Ambar = alcanza pero poco.
// Rojo = agotado de verdad. Gris = no sabemos, nadie lo conto.
function dispColor(s) {
  if (!s) return '#94a3b8';
  if (s.startsWith('Hay en'))      return '#16a34a';
  if (s.startsWith('Queda poco'))  return '#d97706';
  if (s === 'Agotado')             return '#dc2626';
  return '#64748b';                       // Sin contar
}

function num(n, d) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('es-MX', { maximumFractionDigits: d ?? 2 });
}
function pesos(n) {
  if (n === null || n === undefined || n === '') return '—';
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// La tarjeta que aparece al elegir un producto
function dispTarjeta(p) {
  const c = dispColor(p.situacion);
  const filas = [];

  filas.push(`<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
      <span style="font-weight:700;font-size:15px">${num(p.existencia,3)} ${p.unidad || ''}</span>
      <span style="color:${c};font-weight:600;font-size:13px">${p.situacion || ''}</span>
    </div>`);

  filas.push(`<div style="font-size:13px;margin-top:2px;color:#334155">${p.que_hacer || ''}</div>`);

  const detalle = [];
  if (Number(p.minimo) > 0)
    detalle.push(`mínimo ${num(p.minimo,2)} ${p.unidad || ''}`);
  if (Number(p.salida_90d) > 0)
    detalle.push(`salieron ${num(p.salida_90d,2)} en 90 días`);
  if (Number(p.ya_pedido) > 0)
    detalle.push(`<b>ya hay ${num(p.ya_pedido,2)} pedidos</b>`);
  if (p.fecha_conteo)
    detalle.push(`contado el ${p.fecha_conteo}`);
  if (detalle.length)
    filas.push(`<div style="font-size:12px;color:#64748b;margin-top:4px">${detalle.join(' · ')}</div>`);

  // Precios: solo si hay historial real
  if (p.ultimo_costo_pagado || p.mejor_costo) {
    const pr = [];
    if (p.ultimo_costo_pagado)
      pr.push(`Último: <b>${pesos(p.ultimo_costo_pagado)}</b>/${p.unidad || 'u'} · ${p.ultimo_proveedor || ''} (${p.fecha_ultima || ''})`);
    if (p.mejor_costo && p.proveedor_mas_barato !== p.ultimo_proveedor)
      pr.push(`Más barato: <b>${pesos(p.mejor_costo)}</b>/${p.unidad || 'u'} · ${p.proveedor_mas_barato}`);
    filas.push(`<div style="font-size:12px;color:#334155;margin-top:6px;line-height:1.6">${pr.join('<br>')}</div>`);
  } else {
    filas.push(`<div style="font-size:12px;color:#94a3b8;margin-top:6px">Sin precio registrado todavía</div>`);
  }

  return `<div style="border-left:4px solid ${c};background:#f8fafc;border-radius:6px;padding:10px 12px;margin-top:8px">
      <div style="font-weight:600;font-size:14px;color:#0f172a">${p.nombre}</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:6px">${p.id} · ${p.categoria || 'sin categoría'} · ${p.almacen || 'sin almacén'}</div>
      ${filas.join('')}
    </div>`;
}

// Un renglon de la lista de resultados
function dispRenglon(p, destino) {
  const c = dispColor(p.situacion);
  return `<div onclick="dispElegir('${p.id}','${destino}')"
       style="display:flex;justify-content:space-between;align-items:center;gap:10px;
              padding:8px 10px;border-bottom:1px solid #e2e8f0;cursor:pointer"
       onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background=''">
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nombre}</div>
        <div style="font-size:11px;color:#64748b">${p.categoria || ''}</div>
      </div>
      <div style="text-align:right;white-space:nowrap">
        <div style="font-size:13px;font-weight:700;color:${c}">${num(p.existencia,2)} ${p.unidad || ''}</div>
        <div style="font-size:11px;color:${c}">${p.situacion || ''}</div>
      </div>
    </div>`;
}

// ── Comportamiento ─────────────────────────────────────────────────

// destino: 'pc' (pedido recibido) o 'pp' (pedido a proveedor)
async function dispBuscar(destino) {
  const caja = document.getElementById('disp-q-' + destino);
  const res  = document.getElementById('disp-res-' + destino);
  if (!caja || !res) return;
  const q = caja.value.trim().toLowerCase();
  if (q.length < 2) { res.innerHTML = ''; res.style.display = 'none'; return; }

  const todos = await cargarDisponibilidad();
  if (!todos.length) {
    res.style.display = 'block';
    res.innerHTML = `<div style="padding:10px;font-size:12px;color:#64748b">
        No se pudo leer el catálogo. Revisa que el SQL 19 ya esté corrido.</div>`;
    return;
  }

  // Busqueda simple: todas las palabras tienen que aparecer.
  // Primero los que empiezan con lo escrito, luego el resto.
  const palabras = q.split(/\s+/);
  const hit = todos.filter(p => {
    const t = ((p.nombre || '') + ' ' + (p.categoria || '') + ' ' + (p.id || '')).toLowerCase();
    return palabras.every(w => t.includes(w));
  });
  hit.sort((a, b) => {
    const ax = (a.nombre || '').toLowerCase().startsWith(q) ? 0 : 1;
    const bx = (b.nombre || '').toLowerCase().startsWith(q) ? 0 : 1;
    if (ax !== bx) return ax - bx;
    // con existencia primero: es lo que evita comprar de mas
    const ae = Number(a.existencia) > 0 ? 0 : 1;
    const be = Number(b.existencia) > 0 ? 0 : 1;
    if (ae !== be) return ae - be;
    return (a.nombre || '').localeCompare(b.nombre || '');
  });

  res.style.display = 'block';
  res.innerHTML = hit.length
    ? hit.slice(0, 12).map(p => dispRenglon(p, destino)).join('')
      + (hit.length > 12 ? `<div style="padding:6px 10px;font-size:11px;color:#94a3b8">y ${hit.length - 12} más — escribe algo más específico</div>` : '')
    : `<div style="padding:10px;font-size:12px;color:#64748b">
         Ningún producto se llama así. Puedes escribirlo a mano abajo y darlo de alta después.</div>`;
}

async function dispElegir(id, destino) {
  const todos = await cargarDisponibilidad();
  const p = todos.find(x => x.id === id);
  if (!p) return;

  // Rellena el campo de nombre que la persona iba a escribir
  const campo = document.getElementById(destino + '-prod-nombre');
  if (campo) campo.value = p.nombre;

  // Si es pedido recibido y hay costo, precarga el precio
  if (destino === 'pc' && p.costo_promedio) {
    const pr = document.getElementById('pc-prod-precio');
    if (pr && !pr.value) pr.value = Number(p.costo_promedio).toFixed(2);
  }

  // Sugiere la unidad en la caja de cantidad, sin pisarla si ya hay algo
  const qty = document.getElementById(destino + '-prod-qty');
  if (qty && !qty.value && p.unidad) qty.placeholder = 'Ej: 10 ' + p.unidad;

  const res = document.getElementById('disp-res-' + destino);
  if (res) { res.innerHTML = ''; res.style.display = 'none'; }
  const caja = document.getElementById('disp-q-' + destino);
  if (caja) caja.value = '';

  const tarjeta = document.getElementById('disp-sel-' + destino);
  if (tarjeta) { tarjeta.innerHTML = dispTarjeta(p); tarjeta.style.display = 'block'; }

  if (qty) qty.focus();
}

function dispLimpiar(destino) {
  const t = document.getElementById('disp-sel-' + destino);
  if (t) { t.innerHTML = ''; t.style.display = 'none'; }
}

// ── Montaje ────────────────────────────────────────────────────────
// Se inserta el buscador justo antes del campo de producto de cada
// formulario. Si el formulario no existe (version vieja del HTML), no
// pasa nada: la funcion simplemente no hace nada.

function dispMontar(destino, etiqueta) {
  const campo = document.getElementById(destino + '-prod-nombre');
  if (!campo) return false;
  if (document.getElementById('disp-q-' + destino)) return true;  // ya montado

  // el contenedor de la fila del formulario
  const fila = campo.closest('.form-row') || campo.closest('.form-group') || campo.parentElement;
  if (!fila || !fila.parentElement) return false;

  const bloque = document.createElement('div');
  bloque.style.marginBottom = '10px';
  bloque.innerHTML = `
    <label style="display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:4px">
      ${etiqueta}
    </label>
    <input class="input" type="text" id="disp-q-${destino}" autocomplete="off"
           placeholder="Escribe 2 letras del producto…"
           oninput="dispBuscar('${destino}')">
    <div id="disp-res-${destino}" style="display:none;border:1px solid #e2e8f0;border-top:none;
         border-radius:0 0 6px 6px;max-height:280px;overflow-y:auto;background:#fff"></div>
    <div id="disp-sel-${destino}" style="display:none"></div>`;

  fila.parentElement.insertBefore(bloque, fila);
  return true;
}

function dispMontarTodo() {
  dispMontar('pc', '¿Ya hay en almacén? — busca aquí antes de pedir');
  dispMontar('pp', '¿Ya hay en almacén? — busca aquí antes de comprar');
}

// Los formularios estan ocultos hasta que alguien les da al boton, y en
// algunos casos se pintan despues. Por eso se intenta montar al cargar,
// al cambiar de pestaña y cada vez que se abre un formulario.
document.addEventListener('DOMContentLoaded', () => {
  dispMontarTodo();
  cargarDisponibilidad();          // precarga en segundo plano
});

// Engancharse a los botones que abren los formularios, sin tocarlos
['mostrarFormPedidoCliente', 'mostrarFormPedido', 'switchPedidos'].forEach(fn => {
  const orig = window[fn];
  if (typeof orig !== 'function') return;
  window[fn] = function () {
    const r = orig.apply(this, arguments);
    setTimeout(dispMontarTodo, 30);
    return r;
  };
});
