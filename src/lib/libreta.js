// ═══════════════════════════════════════════════════════════════════
//  libreta.js — el board
//
//  Raúl corrigió cómo usa su libreta:
//
//    "uso la libreta como un board donde pongo qué le pido a quién y
//     si ya llegó o ya lo entregué, lo de los circulitos"
//
//  Dos cosas cambiaron respecto de la primera versión:
//
//  1. SON TRES ESTADOS, no dos. El renglón no se acaba cuando llega la
//     mercancía: se acaba cuando el rancho ya la recibió.
//
//         ●   pedido       se lo pedí a alguien, no ha llegado
//         ◉   llegó        ya está aquí, falta repartirlo
//         ✓   entregado    ya salió en un vale al rancho
//
//  2. ES UN BOARD, no una lista. Tres columnas y las tarjetas se
//     mueven de izquierda a derecha. Es como lo tiene en el papel.
//
//  Un detalle que importa: una compra puede ir a varios ranchos.
//  Entonces "entregado" no es sí o no — es 1 de 2. La tarjeta lo dice
//  en vez de redondear.
//
//  El estado de "llegó pero falta repartir" es el que se atora, y por
//  eso esa columna lleva el botón que va directo a hacer el vale.
// ═══════════════════════════════════════════════════════════════════

let libDatos = [];
let libVerEntregado = false;

const libEsc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const libF = n => n == null ? '' : (Number(n) % 1 === 0 ? Number(n).toLocaleString('es-MX')
  : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 }));
const libFecha = s => {
  if (!s) return '—';
  const d = new Date(String(s).slice(0, 10) + 'T12:00');
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
};

const LIB_COLS = [
  { k:'Pedido',    marca:'●', t:'Pedido',    d:'se lo pedí a alguien' },
  { k:'Llego',     marca:'◉', t:'Llegó',     d:'aquí, falta repartirlo' },
  { k:'Entregado', marca:'✓', t:'Entregado', d:'ya salió al rancho' },
];

async function cargarLibreta() {
  const cont = document.getElementById('sol-libreta');
  if (!cont) return;
  cont.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const { data, error } = await db.from('v_en_camino').select('*');
    if (error) throw error;
    // Las órdenes históricas están cerradas: el board es de aquí en
    // adelante, no un repaso del año pasado.
    libDatos = (data || []).filter(r => r.estado_oc !== 'Cerrada');
    libRender();
  } catch (e) {
    cont.innerHTML = '<div class="empty">No se pudo cargar: ' + libEsc(e.message)
      + '<br><span class="sol-sub">¿Ya corriste el SQL 28?</span></div>';
  }
}

function libTarjeta(r) {
  const atrasado = r.estado === 'Pedido' && r.atrasado;
  const destinos = Number(r.destinos) || 0;
  const entregados = Number(r.entregados) || 0;

  // a dónde va
  const destino = r.ranchos_destino
    ? libEsc(r.ranchos_destino)
    : (r.entregar_en ? libEsc(r.entregar_en) : '<span class="sol-mut">sin destino</span>');

  // El conteo del reparto sólo tiene sentido una vez que la mercancía
  // está aquí. Antes de que llegue, "0 de 3 entregados" no es una
  // noticia: es lo obvio, y estorba.
  const reparto = (r.estado !== 'Pedido' && destinos > 0)
    ? `<div class="lib-reparto">${entregados} de ${destinos} entregados</div>` : '';

  let pie = '';
  if (r.estado === 'Pedido') {
    pie = `<div class="lib-pie">
      <input class="input lib-fecha" type="date" value="${r.fecha_esperada || ''}"
        onchange="libEsperada('${r.oc_id}', this.value)" title="Más o menos cuándo se espera">
      <button class="btn btn-sm btn-primary" onclick="libLlego('${r.oc_id}')">Ya llegó</button>
    </div>${atrasado ? `<div class="lib-atraso">${r.dias_de_atraso} día(s) tarde</div>` : ''}`;
  } else if (r.estado === 'Llego') {
    pie = `<div class="lib-pie">
      <span class="sol-sub">llegó ${libFecha(r.fecha_recepcion)}${r.recibido_por ? ' · ' + libEsc(r.recibido_por) : ''}</span>
      ${destinos ? `<button class="btn btn-sm btn-primary" onclick="libAlVale('${r.oc_id}')">Hacer el vale</button>` : ''}
    </div>`;
  } else {
    pie = `<div class="lib-pie"><span class="sol-sub">${r.folios_vale ? libEsc(r.folios_vale) : 'entregado'}</span></div>`;
  }

  return `<article class="lib-card ${atrasado ? 'tarde' : ''}">
    <div class="lib-card-t">${libEsc(r.producto_nombre)}</div>
    <div class="lib-card-q">${libF(r.cantidad)} ${libEsc(r.unidad || '')}</div>
    <div class="lib-card-p">${libEsc(r.proveedor_nombre || '—')}
      ${r.condiciones_pago ? `<span class="badge badge-info">${libEsc(r.condiciones_pago)}</span>` : ''}</div>
    <div class="lib-card-d">→ ${destino}</div>
    ${reparto}
    <div class="lib-card-f">${libEsc(r.folio)} · pedido ${libFecha(r.fecha_pedido)}</div>
    ${pie}
  </article>`;
}

function libRender() {
  const cont = document.getElementById('sol-libreta');
  if (!cont) return;

  if (!libDatos.length) {
    cont.innerHTML = '<div class="empty">Nada en el board.<br>'
      + '<span class="sol-sub">Cuando generes órdenes desde una solicitud, aparecen aquí.</span></div>';
    return;
  }

  const porEstado = k => libDatos.filter(r => r.estado === k)
    .sort((a, b) => {
      if (k === 'Pedido') {
        if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
        return String(a.fecha_esperada || '9999').localeCompare(String(b.fecha_esperada || '9999'));
      }
      return String(b.fecha_recepcion || '').localeCompare(String(a.fecha_recepcion || ''));
    });

  const atrasados = libDatos.filter(r => r.estado === 'Pedido' && r.atrasado).length;
  const porRepartir = libDatos.filter(r => r.por_repartir).length;

  const cols = LIB_COLS.map(c => {
    let items = porEstado(c.k);
    const total = items.length;
    // La columna de entregados crece para siempre: se recorta salvo
    // que pida verla completa.
    let recorte = '';
    if (c.k === 'Entregado' && !libVerEntregado && total > 4) {
      items = items.slice(0, 4);
      recorte = `<button class="btn btn-sm lib-mas" onclick="libVerEntregado=true;libRender()">Ver los ${total}</button>`;
    }
    return `<section class="lib-col" data-col="${c.k}">
      <header class="lib-col-h">
        <span class="lib-marca ${c.k === 'Llego' ? 'lleg' : c.k === 'Entregado' ? 'ent' : ''}">${c.marca}</span>
        <span class="lib-col-t">${c.t}<span class="lib-col-d">${c.d}</span></span>
        <span class="lib-col-n">${total}</span>
      </header>
      <div class="lib-col-b">
        ${items.length ? items.map(libTarjeta).join('')
          : '<div class="lib-vacio">nada aquí</div>'}
        ${recorte}
      </div>
    </section>`;
  }).join('');

  const avisos = [];
  if (atrasados) avisos.push(`<span class="badge badge-danger">${atrasados} con atraso</span>`);
  if (porRepartir) avisos.push(`<span class="badge badge-warn">${porRepartir} llegaron y falta repartir</span>`);

  cont.innerHTML = `
    ${avisos.length ? `<div class="lib-cab">${avisos.join(' ')}</div>` : ''}
    <div class="lib-board">${cols}</div>`;
}

// "más o menos cuándo se espera que llegue" — es su estimación, no una
// promesa del proveedor. Se cambia las veces que haga falta.
async function libEsperada(ocId, valor) {
  try {
    const { error } = await db.from('ordenes_compra')
      .update({ fecha_esperada: valor || null }).eq('id', ocId);
    if (error) throw error;
    libDatos.forEach(r => {
      if (r.oc_id !== ocId) return;
      r.fecha_esperada = valor || null;
      if (valor) {
        const dif = Math.floor((new Date() - new Date(valor + 'T12:00')) / 864e5);
        r.dias_de_atraso = dif; r.atrasado = dif > 0 && !r.fecha_recepcion;
      } else { r.dias_de_atraso = null; r.atrasado = false; }
    });
    libRender();
  } catch (e) { toast('No se pudo guardar la fecha: ' + e.message); }
}

// El círculo alrededor del puntito: de Pedido a Llegó.
async function libLlego(ocId) {
  const r = libDatos.find(x => x.oc_id === ocId);
  if (!r) return;
  const quien = prompt('¿Quién confirmó que llegó?\n(el encargado del rancho, el chofer, o tú)',
    (typeof currentProfile !== 'undefined' && currentProfile) ? currentProfile.nombre : '');
  if (quien === null) return;
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const { error } = await db.from('ordenes_compra')
      .update({ fecha_recepcion: hoy, recibido_por: quien || null, estado: 'Recibida' }).eq('id', ocId);
    if (error) throw error;
    libDatos.forEach(x => {
      if (x.oc_id !== ocId) return;
      x.fecha_recepcion = hoy; x.recibido_por = quien || null;
      x.atrasado = false;
      // sólo pasa a Entregado si ya se repartió todo; si no, queda en Llegó
      x.estado = (Number(x.destinos) > 0 && Number(x.entregados) === Number(x.destinos))
        ? 'Entregado' : 'Llego';
      x.por_repartir = Number(x.destinos) > Number(x.entregados);
    });
    libRender();
    toast('✓ ' + r.folio + ' marcada como recibida');
    if (typeof repSol !== 'undefined' && repSol) repAbrir(repSol.sol.id);
    if (typeof cargarHoy === 'function' && document.getElementById('hoy-cuerpo')) cargarHoy();
  } catch (e) { toast('No se pudo guardar: ' + e.message); }
}

// El tercer círculo no se pone a mano: se pone cuando se imprime el
// vale. Este botón lleva ahí, a la solicitud de donde salió la orden.
async function libAlVale(ocId) {
  const r = libDatos.find(x => x.oc_id === ocId);
  if (!r) return;
  try {
    const { data } = await db.from('solicitud_lineas')
      .select('solicitud_id').eq('oc_id', ocId).limit(1);
    const sid = data && data[0] && data[0].solicitud_id;
    if (!sid) { toast('Esta orden no salió de una solicitud, así que no tiene vale.'); return; }
    if (typeof repAbrir === 'function') {
      repAbrir(sid);
      const el = document.getElementById('sol-historial');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (e) { toast('No se pudo abrir la solicitud: ' + e.message); }
}

// ── Engancharse sin tocar app.js ───────────────────────────────────

(function () {
  const orig = window.goTo;
  if (typeof orig !== 'function') return;
  window.goTo = function (tab) {
    const r = orig.apply(this, arguments);
    if (tab === 'solicitudes') cargarLibreta();
    return r;
  };
})();
