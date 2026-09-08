// ═══════════════════════════════════════════════════════════════════
//  cxp.js — cuentas por pagar: la pantalla de la contadora
//
//  Lo que pidió Raúl: «un canal de comunicación con la contadora que
//  hace los pagos, que ella pueda ver las órdenes de compra que estoy
//  metiendo y los plazos y los datos para poder hacer el pago
//  oportuno».
//
//  El problema medido: ninguna de las 109 facturas trae condiciones
//  de pago. No se van a capturar. El plazo se DEDUCE del proveedor —
//  13 de 16 usan siempre el mismo — y toda fecha deducida sale
//  marcada con ƒ, para que nunca se confunda con una leída del papel.
//
//  Dos papeles distintos, a propósito:
//    · Raúl DA FE de que eso que cobran sí lo pidió. No autoriza el
//      pago: valida la procedencia.
//    · La contadora registra el pago cuando lo hace.
//
//  Y el Excel: columnas fijas, para que ella lo capture en CONTPAQi
//  sin pelearse con el formato. No se integra CONTPAQi a propósito;
//  sus plantillas cambian con cada versión y se rompería sola.
// ═══════════════════════════════════════════════════════════════════

let cxpDatos = [];
let cxpFiltro = 'Pendientes';

const cxpM = n => n == null ? '—' : '$' + Number(n).toLocaleString('es-MX',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cxpM0 = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const cxpEsc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cxpF = s => {
  if (!s) return '—';
  const d = new Date(String(s).slice(0, 10) + 'T12:00');
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
};

const CXP_TONO = {
  'Vencida':      'badge-danger',
  'Esta semana':  'badge-warn',
  'Este mes':     'badge-info',
  'Mas adelante': 'badge-info',
  'Sin fecha':    'badge-warn',
  'Sin importe':  'badge-info',
  'Pagada':       'badge-ok',
};
const CXP_ORDEN = ['Vencida', 'Esta semana', 'Este mes', 'Mas adelante', 'Sin fecha', 'Sin importe', 'Pagada'];

// ── Cargar ─────────────────────────────────────────────────────────

async function cargarCxp() {
  const cont = document.getElementById('cxp-cuerpo');
  if (!cont) return;
  cont.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const { data, error } = await db.from('v_cuentas_por_pagar').select('*');
    if (error) throw error;
    cxpDatos = (data || []).sort((a, b) => {
      const d = CXP_ORDEN.indexOf(a.estado) - CXP_ORDEN.indexOf(b.estado);
      if (d) return d;
      return String(a.vence || '9999').localeCompare(String(b.vence || '9999'));
    });
    cxpRender();
  } catch (e) {
    cont.innerHTML = '<div class="empty">No se pudo cargar: ' + cxpEsc(e.message)
      + '<br><span class="sol-sub">¿Ya corriste el SQL 26?</span></div>';
  }
}

function cxpFiltrar(f) { cxpFiltro = f; cxpRender(); }

function cxpVisibles() {
  if (cxpFiltro === 'Pendientes') return cxpDatos.filter(r => r.estado !== 'Pagada' && r.estado !== 'Sin importe');
  if (cxpFiltro === 'Todas')      return cxpDatos;
  return cxpDatos.filter(r => r.estado === cxpFiltro);
}

// ── Pantalla ───────────────────────────────────────────────────────

function cxpRender() {
  const cont = document.getElementById('cxp-cuerpo');
  if (!cont) return;

  const suma = e => cxpDatos.filter(r => r.estado === e).reduce((s, r) => s + Number(r.saldo || 0), 0);
  const cuenta = e => cxpDatos.filter(r => r.estado === e).length;
  const sinPlazo = cxpDatos.filter(r => !r.vence && r.estado !== 'Pagada' && r.estado !== 'Sin importe').length;
  const puedePagar = cxpPuedePagar();
  const puedeDarFe = cxpPuedeDarFe();

  const tiles = `
    <div class="sol-tiles">
      <div class="sol-tile bad"><span class="k">Vencidas</span><span class="v" style="font-size:17px">${cxpM0(suma('Vencida'))}</span><span class="s">${cuenta('Vencida')} facturas</span></div>
      <div class="sol-tile"><span class="k">Esta semana</span><span class="v" style="font-size:17px">${cxpM0(suma('Esta semana'))}</span><span class="s">${cuenta('Esta semana')} facturas</span></div>
      <div class="sol-tile"><span class="k">Este mes</span><span class="v" style="font-size:17px">${cxpM0(suma('Este mes'))}</span><span class="s">${cuenta('Este mes')} facturas</span></div>
      <div class="sol-tile"><span class="k">Más adelante</span><span class="v" style="font-size:17px">${cxpM0(suma('Mas adelante'))}</span><span class="s">${cuenta('Mas adelante')} facturas</span></div>
      <div class="sol-tile"><span class="k">Sin fecha de pago</span><span class="v">${sinPlazo}</span><span class="s">el proveedor varía su plazo</span></div>
    </div>`;

  const filtros = ['Pendientes', 'Vencida', 'Esta semana', 'Este mes', 'Sin fecha', 'Pagada', 'Todas']
    .map(f => `<button class="btn btn-sm${cxpFiltro === f ? ' btn-primary' : ''}" onclick="cxpFiltrar('${f}')">${f}</button>`)
    .join('');

  const filas = cxpVisibles().map(r => {
    const venc = r.vence
      ? (r.origen_plazo === 'proveedor'
          ? `<span class="sol-der" title="Deducido: ${cxpEsc(r.proveedor_nombre || 'este proveedor')} usa siempre ${r.dias_credito} días en sus órdenes">${cxpF(r.vence)}</span>`
          : cxpF(r.vence))
        + (Number(r.dias_para_vencer) < 0 ? `<div class="sol-sub">hace ${Math.abs(r.dias_para_vencer)} días</div>` : '')
      : (r.origen_plazo === 'variable'
          ? '<span class="badge badge-warn" title="Este proveedor usa plazos distintos en sus órdenes; el sistema no adivina">plazo variable</span>'
          : '<span class="sol-mut">sin plazo</span>');

    return `<tr>
      <td class="sol-prod">${cxpEsc(r.factura || r.folio_interno || '—')}
        <div class="sol-sub">${cxpEsc(r.proveedor_nombre || '')}</div></td>
      <td>${r.razon_social
            ? (r.razon_social_origen === 'proveedor'
                ? `<span class="sol-der" title="Deducida del proveedor, no leída del papel">${cxpEsc(r.razon_social)}</span>`
                : cxpEsc(r.razon_social))
            : '<span class="badge badge-warn">falta</span>'}</td>
      <td>${cxpF(r.fecha_compra)}</td>
      <td>${venc}</td>
      <td class="sol-num">${cxpM(r.total)}</td>
      <td class="sol-num">${Number(r.pagado) > 0 ? cxpM(r.pagado) : '<span class="sol-mut">·</span>'}</td>
      <td class="sol-num">${cxpM(r.saldo)}</td>
      <td><span class="badge ${CXP_TONO[r.estado] || 'badge-info'}">${cxpEsc(r.estado)}</span></td>
      <td>${r.validada
            ? `<span class="badge badge-ok">${cxpEsc(r.validada_por || 'sí')}</span>`
            : (puedeDarFe
                ? `<button class="btn btn-sm" onclick="cxpDarFe('${r.compra_id}')">Doy fe</button>`
                : '<span class="sol-mut">pendiente</span>')}</td>
      <td>${r.con_respaldo ? '<span class="badge badge-ok">foto</span>' : '<span class="sol-mut">—</span>'}
        ${puedePagar && Number(r.saldo) > 0
          ? `<div class="rep-acts" style="margin-top:4px"><button class="btn btn-sm btn-primary" onclick="cxpPagar('${r.compra_id}')">Pagué</button></div>`
          : ''}</td>
    </tr>`;
  }).join('');

  const totalPagado = cxpDatos.reduce((s, r) => s + Number(r.pagado || 0), 0);
  const aviso = totalPagado === 0
    ? `<div class="rep-nota"><b>Todavía no hay ningún pago registrado en el sistema.</b>
        Mientras no los haya, esto es <b>deuda registrada, no saldo real</b>: puede haber facturas
        aquí que ya se pagaron. La diferencia se cierra sola conforme la contadora marque
        «Pagué» — un clic por factura, no una captura histórica.</div>`
    : '';

  cont.innerHTML = tiles
    + `<div class="cxp-barra"><div class="cxp-filtros">${filtros}</div>
       <button class="btn btn-sm" onclick="cxpExcel()">Bajar Excel</button></div>`
    + (filas ? `<div class="sol-scroll"><table class="sol-tabla">
        <thead><tr><th>Factura</th><th>Razón social</th><th>Compra</th><th>Vence</th>
        <th class="sol-num">Total</th><th class="sol-num">Pagado</th><th class="sol-num">Saldo</th>
        <th>Estado</th><th>Raúl dio fe</th><th>Respaldo</th></tr></thead>
        <tbody>${filas}</tbody></table></div>`
      : '<div class="empty">No hay facturas en este filtro.</div>')
    + aviso;
}

// ── Quién puede qué ────────────────────────────────────────────────
// Raúl da fe. La contadora paga. El admin puede las dos.

function cxpRol() {
  return (typeof currentProfile !== 'undefined' && currentProfile) ? currentProfile.rol : null;
}
function cxpPuedeDarFe() { return cxpRol() === 'admin'; }
function cxpPuedePagar() { return cxpRol() === 'admin' || cxpRol() === 'contadora'; }

// ── Raúl da fe ─────────────────────────────────────────────────────

async function cxpDarFe(id) {
  const r = cxpDatos.find(x => x.compra_id === id);
  if (!r) return;
  const quien = (typeof currentProfile !== 'undefined' && currentProfile) ? currentProfile.nombre : 'Raúl';
  if (!confirm('¿Confirmas que esto que cobran sí lo pediste?\n\n'
    + (r.factura || r.folio_interno) + '\n' + (r.proveedor_nombre || '') + '\n' + cxpM(r.total))) return;
  try {
    const { error } = await db.from('compras').update({
      validada_por: quien, fecha_validacion: new Date().toISOString().slice(0, 10)
    }).eq('id', id);
    if (error) throw error;
    r.validada = true; r.validada_por = quien;
    cxpRender();
    toast('✓ Diste fe de ' + (r.factura || r.folio_interno));
  } catch (e) { toast('No se pudo guardar: ' + e.message); }
}

// ── La contadora registra el pago ──────────────────────────────────

async function cxpPagar(id) {
  const r = cxpDatos.find(x => x.compra_id === id);
  if (!r) return;
  const txt = prompt('¿De cuánto fue el pago?\n\n' + (r.factura || r.folio_interno) + '\n'
    + (r.proveedor_nombre || '') + '\nSaldo: ' + cxpM(r.saldo), String(Number(r.saldo).toFixed(2)));
  if (txt === null) return;
  const monto = Number(String(txt).replace(/[^0-9.\-]/g, ''));
  if (!(monto > 0)) { toast('Monto inválido'); return; }
  const ref = prompt('Referencia del pago (transferencia, cheque, etc.)\nPuedes dejarlo vacío.', '') || null;
  try {
    const { error } = await db.from('pagos_proveedores').insert({
      compra_id: id, proveedor_id: r.proveedor_id || null,
      fecha: new Date().toISOString().slice(0, 10),
      monto, moneda: r.moneda || 'MXN', tipo: 'Pago', referencia: ref,
      registrado_por: (typeof currentProfile !== 'undefined' && currentProfile) ? currentProfile.nombre : null,
    });
    if (error) throw error;
    toast('✓ Pago registrado');
    cargarCxp();
  } catch (e) { toast('No se pudo registrar: ' + e.message); }
}

// ── El Excel para la contadora ─────────────────────────────────────
// Columnas fijas y en el mismo orden siempre. Es aburrido a
// propósito: así no se rompe cuando CONTPAQi cambie de versión.

function cxpExcel() {
  if (typeof XLSX === 'undefined') { toast('No se pudo cargar el generador de Excel'); return; }
  const filas = cxpVisibles().map(r => ({
    'Factura'        : r.factura || r.folio_interno || '',
    'Proveedor'      : r.proveedor_nombre || '',
    'Razon social'   : r.razon_social || '',
    'Fecha compra'   : r.fecha_compra || '',
    'Dias credito'   : r.dias_credito == null ? '' : r.dias_credito,
    'Plazo tomado de': r.origen_plazo === 'proveedor' ? 'Deducido del proveedor'
                     : r.origen_plazo === 'factura'   ? 'La factura'
                     : r.origen_plazo === 'variable'  ? 'El proveedor varia'
                     : '',
    'Vence'          : r.vence || '',
    'Moneda'         : r.moneda || 'MXN',
    'Total'          : Number(r.total || 0),
    'Pagado'         : Number(r.pagado || 0),
    'Saldo'          : Number(r.saldo || 0),
    'Estado'         : r.estado || '',
    'Raul dio fe'    : r.validada ? (r.validada_por || 'Si') : 'No',
    'Tiene respaldo' : r.con_respaldo ? 'Si' : 'No',
  }));
  if (!filas.length) { toast('No hay nada que bajar con este filtro'); return; }
  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja['!cols'] = [{ wch: 20 }, { wch: 34 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 22 },
                   { wch: 12 }, { wch: 8 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 },
                   { wch: 16 }, { wch: 13 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Cuentas por pagar');
  const hoy = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(libro, 'Cuentas_por_pagar_' + hoy + '.xlsx');
  toast('✓ Excel generado · ' + filas.length + ' renglones');
}

// ── Engancharse sin tocar app.js ───────────────────────────────────

(function () {
  function registrar() {
    if (typeof TAB_LOADERS === 'object' && TAB_LOADERS) TAB_LOADERS.cxp = cargarCxp;
  }
  const orig = window.goTo;
  if (typeof orig === 'function') {
    window.goTo = function (tab) {
      const r = orig.apply(this, arguments);
      registrar();
      if (tab === 'cxp') cargarCxp();
      return r;
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registrar);
  else registrar();
})();
