// ═══════════════════════════════════════════════════════════════════
//  reparto.js — de la solicitud al vale, y el rastreo de lo comprado
//
//  La solicitud del Ing. Miguel ya viene partida por rancho: cada
//  columna de su Excel es un rancho. Entonces el vale no hay que
//  armarlo: ya está armado. Este archivo sólo lo saca.
//
//  Dos cosas:
//
//  1. VALE POR RANCHO. Se abre una solicitud guardada, se ve lo que
//     le toca a cada rancho, y de ahí sale el vale. Al imprimir se
//     descuenta del almacén y el renglón queda amarrado a su folio,
//     así que el papel y el sistema no se separan.
//
//  2. RASTREO. Las órdenes que salieron de esa solicitud, con su
//     destino y el botón de "ya llegó". Cuando el proveedor entrega
//     directo en el rancho, hoy no hay dato de eso en ningún lado:
//     esta pantalla es donde empieza a haberlo.
//
//  Todo vive DENTRO de la pantalla de Solicitudes. No se agregó
//  ningún botón al menú.
// ═══════════════════════════════════════════════════════════════════

let repSol = null;   // { sol, lineas, ocs }
let repCant = {};    // id de renglón → cuánto lleva ESTE vale
let repVer  = {};    // rancho → si está desplegada la lista de lo que falta

function repVerEspera(rancho) { repVer[rancho] = !repVer[rancho]; repRender(); }

// ── Cuánto falta y cuánto se puede llevar hoy ──────────────────────
//
//  Raúl: "que pueda hacer vales parciales también".
//
//  Antes el vale era todo o nada: se marcaba el renglón y se acabó.
//  Ahora el renglón guarda CUÁNTO se ha entregado, y se le puede
//  llevar la mitad hoy y el resto el jueves. El renglón se cierra
//  cuando la suma alcanza lo que el rancho pidió, no antes.

const repPendiente = l =>
  Math.max(0, +(Number(l.cantidad || 0) - Number(l.entregado || 0)).toFixed(3));

// Lo que se puede llevar HOY.
//
//  Mientras lo comprado no llegue, lo único que puede salir es lo que
//  ya estaba en el almacén — o sea, lo que se decidió surtir. En cuanto
//  la orden se marca como recibida, ya se puede llevar todo lo que
//  falte. Y si el renglón ni siquiera tiene orden (está por cotizar),
//  tampoco hay de dónde: sólo lo del almacén.
function repTope(l) {
  const pend = repPendiente(l);
  if (!pend) return 0;
  const oc = l.oc_id && repSol ? repSol.ocs.find(o => o.id === l.oc_id) : null;
  if (oc && oc.fecha_recepcion) return pend;
  const deAlmacen = Math.max(0, +(Number(l.surtir || 0) - Number(l.entregado || 0)).toFixed(3));
  return Math.min(pend, deAlmacen);
}

// Lo que va a llevar este vale: lo que él escribió, o el tope.
function repLleva(l) {
  const t = repTope(l);
  const v = repCant[l.id];
  return Math.max(0, Math.min(v == null ? t : Number(v), t));
}

function repSetCant(id, valor) {
  const l = repSol && repSol.lineas.find(x => x.id === id);
  if (!l) return;
  repCant[id] = Math.max(0, Math.min(solNum(valor), repTope(l)));
  repRender();
}

// ── Abrir una solicitud guardada ───────────────────────────────────

async function repAbrir(id) {
  const cont = document.getElementById('sol-historial');
  if (!cont) return;
  cont.innerHTML = '<div class="loading">Abriendo...</div>';
  try {
    const [s, l] = await Promise.all([
      db.from('solicitudes').select('*').eq('id', id).maybeSingle(),
      db.from('solicitud_lineas').select('*').eq('solicitud_id', id).order('rancho_nombre'),
    ]);
    if (!s.data) throw new Error('No se encontró la solicitud');
    const { data: ocs } = await db.from('ordenes_compra')
      .select('id,folio,proveedor_nombre,estado,condiciones_pago,entregar_en,rancho_id,entrega_directa,fecha_recepcion,recibido_por,fecha_esperada')
      .ilike('observaciones', '%' + s.data.folio + '%');
    // Cuál rancho ya está completo: es lo que le dice cuándo hacer la
    // salida. Sale de v_rancho_listo, no se captura.
    const { data: listos } = await db.from('v_rancho_listo')
      .select('rancho_nombre,renglones,listos,faltan,completo,entregados,a_medias,situaciones,cantidad_pedida,cantidad_entregada')
      .eq('solicitud_id', id);
    if (!repSol || repSol.sol.id !== id) repCant = {};   // otra solicitud, otras casillas
    repSol = { sol: s.data, lineas: l.data || [], ocs: ocs || [],
               listos: new Map((listos || []).map(x => [x.rancho_nombre, x])) };
    repRender();
  } catch (e) {
    cont.innerHTML = '<div class="empty">No se pudo abrir: ' + solEsc(e.message) + '</div>';
  }
}

function repCerrar() {
  repSol = null;
  cargarSolicitudes();
  if (typeof cargarLibreta === 'function') cargarLibreta();
}

// ── Pantalla ───────────────────────────────────────────────────────

function repRender() {
  const cont = document.getElementById('sol-historial');
  if (!cont || !repSol) return;
  const { sol, lineas, ocs } = repSol;

  // Un vale por rancho. Un renglón aparece mientras le falte algo, aunque
  // ya le hayan llevado una parte.
  const porRancho = new Map();
  lineas.forEach(l => {
    const k = l.rancho_nombre || 'Sin rancho';
    if (!porRancho.has(k)) porRancho.set(k, { nombre: k, id: l.rancho_id, items: [], surtidos: 0, cultivos: new Set() });
    const g = porRancho.get(k);
    if (l.cultivo_nombre) g.cultivos.add(l.cultivo_nombre);
    if (repPendiente(l) > 0) g.items.push(l);
    else if (Number(l.entregado) > 0) g.surtidos++;
  });

  // Sólo salen las tarjetas donde hay algo que hacer: algo que llevar
  // hoy, o algo que ya se llevó a medias. Un rancho cuyo pedido entero
  // está comprado y sin llegar no necesita tarjeta — eso se ve en el
  // board, en la columna de Pedido.
  const ranchos = [...porRancho.values()]
    .filter(g => g.items.some(l => repTope(l) > 0)
              || g.items.some(l => Number(l.entregado) > 0)
              || g.surtidos)
    .sort((a, b) => b.items.length - a.items.length);

  const bloqueVales = ranchos.length ? ranchos.map(g => {
    const est = repSol.listos ? repSol.listos.get(g.nombre) : null;
    const completo = est ? est.completo : false;
    const pct = est && est.renglones ? Math.round(est.listos / est.renglones * 100) : 0;

    // La tarjeta enseña lo que SE PUEDE LLEVAR HOY. Lo que está
    // comprado y sin llegar se resume en un renglón: si se listara
    // completo, la tarjeta se volvería una lista de pendientes ajenos,
    // que es justo lo que Raúl no quiere ver.
    const hoyVan   = g.items.filter(l => repTope(l) > 0 || Number(l.entregado) > 0);
    const esperando = g.items.filter(l => repTope(l) <= 0 && !(Number(l.entregado) > 0));

    const filas = hoyVan.map(l => {
      const pend = repPendiente(l), tope = repTope(l), lleva = repLleva(l);
      const yaLlevo = Number(l.entregado) > 0
        ? `<span class="rep-ya">ya le llevaste ${solF(Number(l.entregado))} de ${solF(Number(l.cantidad))}</span>` : '';
      const control = tope > 0
        ? `<input class="input rep-cant" type="number" min="0" max="${tope}" step="any"
             inputmode="decimal" value="${lleva}" title="Cuánto le llevas en este vale"
             onchange="repSetCant('${l.id}', this.value)"> ${solEsc(l.unidad || '')}`
        : `<span class="badge badge-warn" title="Está comprado pero todavía no llega">falta que llegue</span>`;
      return `<li class="${tope > 0 ? '' : 'rep-espera'}">
        <span class="l">${solEsc(l.producto_nombre)}${l.cultivo_nombre ? ' · ' + solEsc(l.cultivo_nombre) : ''}
          <span class="sol-sub">falta ${solF(pend)} ${solEsc(l.unidad || '')}</span>${yaLlevo}</span>
        <span class="r">${control}</span></li>`;
    }).join('');

    const abierto = !!repVer[g.nombre];
    const bloqueEspera = esperando.length ? `
      <button type="button" class="rep-espera-r" onclick="repVerEspera('${solEsc(g.nombre).replace(/'/g, "\\'")}')">
        ${abierto ? '▾' : '▸'} ${esperando.length} esperando a que lleguen</button>
      ${abierto ? `<ul class="fch-mini rep-espera">${esperando.map(l =>
        `<li><span class="l">${solEsc(l.producto_nombre)}${l.cultivo_nombre ? ' · ' + solEsc(l.cultivo_nombre) : ''}</span>
         <span class="r sol-sub">${solF(repPendiente(l))} ${solEsc(l.unidad || '')}</span></li>`).join('')}</ul>` : ''}` : '';

    // Cuántos renglones van en este vale. Si él bajó todo a cero, no
    // hay vale que imprimir y el botón lo dice en vez de fallar.
    const enElVale = g.items.filter(l => repLleva(l) > 0).length;
    const parcial  = g.items.some(l => repLleva(l) > 0 && repLleva(l) < repPendiente(l));

    // El semáforo: cuántos renglones de este rancho ya están listos,
    // contando lo que salió del almacén y lo que ya llegó del proveedor.
    const prog = est ? `<div class="rep-prog ${completo ? 'completo' : ''}">
        <span>${est.listos} de ${est.renglones} listos</span>
        <span class="barra"><i style="width:${pct}%"></i></span>
        ${completo ? '<span class="badge badge-ok">completo</span>'
                   : `<span class="badge badge-warn">faltan ${est.faltan}</span>`}
        ${Number(est.a_medias) > 0
          ? `<span class="badge badge-info" title="Renglones a los que ya les llevaste una parte">${est.a_medias} a medias</span>` : ''}
      </div>` : '';

    const aviso = (est && !completo && g.items.length)
      ? `<div class="sol-sub" style="margin-top:6px">Puedes surtir lo que ya está, o esperar a que llegue el resto.</div>`
      : '';

    return `<div class="rep-card ${completo ? 'completo' : ''}">
      <div class="rep-card-h">
        <div><b>${solEsc(g.nombre)}</b>${g.cultivos.size ? ` <span class="sol-sub">${[...g.cultivos].map(solEsc).join(' · ')}</span>` : ''}</div>
        ${enElVale ? `<span class="badge badge-info">${enElVale} por llevar</span>`
          : g.items.length ? `<span class="badge badge-warn">falta que llegue</span>`
          : `<span class="badge badge-ok">ya surtido</span>`}
      </div>
      ${prog}
      ${g.items.length ? `${filas ? `<ul class="fch-mini">${filas}</ul>` : ''}${bloqueEspera}
        ${hoyVan.length ? `<button class="btn rep-imprimir ${completo ? 'btn-primary' : ''} btn-sm" style="margin-top:8px"
          ${enElVale ? '' : 'disabled title="Pon cuánto le llevas de algo"'}
          onclick="repVale('${solEsc(g.nombre).replace(/'/g, "\\'")}')">${
          enElVale ? (parcial ? 'Imprimir vale parcial y descontar' : 'Imprimir vale y descontar')
                   : 'Nada por llevar'}</button>${aviso}` : ''}`
        : '<div class="sol-sub" style="padding:4px 0">Todo lo de este rancho ya salió del almacén.</div>'}
    </div>`;
  }).join('') : '<div class="empty">Esta solicitud no tiene nada por surtir del almacén.</div>';

  // Órdenes generadas de esta solicitud
  const bloqueOcs = ocs.length ? ocs.map(o => {
    const llego = !!o.fecha_recepcion;
    return `<tr>
      <td class="sol-prod">${solEsc(o.folio)}<div class="sol-sub">${solEsc(o.proveedor_nombre || '')}</div></td>
      <td>${o.condiciones_pago ? solEsc(o.condiciones_pago) : '<span class="sol-mut">—</span>'}</td>
      <td>${llego ? solEsc(o.entregar_en || '—')
        : `<select class="input sol-sel" style="max-width:210px" onchange="repDestino('${o.id}', this.value)">
             <option value="">¿A dónde va?</option>
             <option value="__alm"${o.entregar_en === 'Almacén' ? ' selected' : ''}>Al almacén</option>
             ${repRanchosOpts(o)}
             <option value="__rec"${o.entregar_en === 'Recojo yo' ? ' selected' : ''}>Recojo yo</option>
           </select>`}</td>
      <td>${llego
        ? `<span class="badge badge-ok">llegó ${solEsc(o.fecha_recepcion)}</span>`
             + (o.recibido_por ? `<div class="sol-sub">confirmó ${solEsc(o.recibido_por)}</div>` : '')
        : '<span class="badge badge-warn">sin confirmar</span>'}</td>
      <td>${llego ? '' : `<div class="rep-acts">
          <button class="btn btn-sm btn-primary" onclick="repLlego('${o.id}')">Ya llegó</button>
          ${o.entrega_directa ? `<button class="btn btn-sm" onclick="repWhats('${o.id}')">Preguntar por WhatsApp</button>` : ''}
        </div>`}</td>
    </tr>`;
  }).join('') : '';

  cont.innerHTML = `
    <div class="rep-head">
      <div><b>${solEsc(sol.folio)}</b> <span class="sol-sub">${solEsc(sol.fecha || '')} · ${solEsc(sol.archivo || '')}</span></div>
      <button class="btn btn-sm" onclick="repCerrar()">← Volver</button>
    </div>

    <div class="card-header" style="margin-top:12px">Lo que sale del almacén — un vale por rancho</div>
    <div class="rep-grid">${bloqueVales}</div>

    ${ocs.length ? `<div class="card-header" style="margin-top:16px">Lo que se compró — ¿ya llegó?</div>
    <div class="sol-scroll"><table class="sol-tabla">
      <thead><tr><th>Orden</th><th>Crédito</th><th>Destino</th><th>Estado</th><th></th></tr></thead>
      <tbody>${bloqueOcs}</tbody></table></div>
    <div class="rep-nota">El sistema no puede saber solo si el proveedor entregó en el rancho.
      Ese dato empieza a existir aquí, la primera vez que alguien lo confirma.</div>` : ''}`;
}

function repRanchosOpts(o) {
  return (solRanchos || []).map(r =>
    `<option value="${r.id}"${o.rancho_id === r.id ? ' selected' : ''}>Rancho ${solEsc(r.nombre)}</option>`).join('');
}

// ── Destino de la orden ────────────────────────────────────────────

async function repDestino(ocId, valor) {
  if (!valor) return;
  const alm = valor === '__alm', rec = valor === '__rec';
  const r = (solRanchos || []).find(x => x.id === valor);
  try {
    const { error } = await db.from('ordenes_compra').update({
      entregar_en    : alm ? 'Almacén' : rec ? 'Recojo yo' : ('Rancho ' + (r ? r.nombre : '')),
      rancho_id      : r ? r.id : null,
      entrega_directa: !!r,
    }).eq('id', ocId);
    if (error) throw error;
    const oc = repSol.ocs.find(x => x.id === ocId);
    if (oc) { oc.entregar_en = alm ? 'Almacén' : rec ? 'Recojo yo' : ('Rancho ' + (r ? r.nombre : ''));
              oc.rancho_id = r ? r.id : null; oc.entrega_directa = !!r; }
    repRender();
    toast('✓ Destino guardado');
  } catch (e) { toast('No se pudo guardar el destino: ' + e.message); }
}

async function repLlego(ocId) {
  const oc = repSol.ocs.find(x => x.id === ocId);
  if (!oc) return;
  const quien = prompt('¿Quién confirmó que llegó?\n(el encargado del rancho, el chofer, o tú)',
    (typeof currentProfile !== 'undefined' && currentProfile) ? currentProfile.nombre : '');
  if (quien === null) return;
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const { error } = await db.from('ordenes_compra').update({
      fecha_recepcion: hoy, recibido_por: quien || null, estado: 'Recibida'
    }).eq('id', ocId);
    if (error) throw error;
    oc.fecha_recepcion = hoy; oc.recibido_por = quien || null; oc.estado = 'Recibida';
    repAbrir(repSol.sol.id);          // recalcula el semáforo de los ranchos
    if (typeof cargarLibreta === 'function') cargarLibreta();
    toast('✓ ' + oc.folio + ' marcada como recibida');
  } catch (e) { toast('No se pudo guardar: ' + e.message); }
}

// Abre WhatsApp con el mensaje ya escrito. No manda nada solo: sólo
// evita volver a redactarlo cada vez.
function repWhats(ocId) {
  const oc = repSol.ocs.find(x => x.id === ocId);
  if (!oc) return;
  const txt = 'Hola, ¿ya llegó a ' + (oc.entregar_en || 'el rancho') + ' lo de '
    + (oc.proveedor_nombre || 'el proveedor') + ' (' + oc.folio + ')? '
    + 'Si sí, mándame foto de la remisión firmada, por favor.';
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
}

// ── El vale ────────────────────────────────────────────────────────

async function repFolioVale() {
  try {
    const { data } = await db.from('movimientos').select('folio_vale')
      .like('folio_vale', 'VALE-%').order('folio_vale', { ascending: false }).limit(1);
    const ult = data && data[0] && data[0].folio_vale;
    const n = ult ? parseInt(String(ult).replace(/\D/g, ''), 10) : 0;
    return 'VALE-' + String((isFinite(n) ? n : 0) + 1).padStart(4, '0');
  } catch { return 'VALE-' + Date.now().toString().slice(-6); }
}

async function repVale(rancho) {
  if (!repSol) return;
  // Va lo que él puso en cada casilla. Si bajó algo a cero, ese renglón
  // simplemente no va en este vale y sigue pendiente para el siguiente.
  const items = repSol.lineas.filter(l =>
    (l.rancho_nombre || 'Sin rancho') === rancho && repLleva(l) > 0);
  if (!items.length) { toast('No pusiste nada por llevar a ' + rancho); return; }

  // Sólo se puede surtir lo que el almacén sabe que tiene
  const ids = [...new Set(items.map(l => l.producto_id).filter(Boolean))];
  const { data: prods, error: ep } = await db.from('productos')
    .select('id,nombre,stock,unidad,almacen_id').in('id', ids);
  if (ep) { toast('No se pudo leer el inventario: ' + ep.message); return; }
  const porId = new Map((prods || []).map(p => [p.id, p]));

  const faltan = items.filter(l => {
    const p = porId.get(l.producto_id);
    return !p || Number(p.stock) < repLleva(l);
  });
  if (faltan.length) {
    const lista = faltan.map(l => {
      const p = porId.get(l.producto_id);
      return '· ' + l.producto_nombre + ': vas a llevar ' + solF(repLleva(l))
        + ', hay ' + (p ? solF(Number(p.stock)) : 0);
    }).join('\n');
    if (!confirm('Estos renglones no alcanzan con la existencia registrada:\n\n' + lista
      + '\n\n¿Sacar sólo lo que sí hay?')) return;
  }

  const folio = await repFolioVale();
  const hoy   = new Date().toISOString().slice(0, 10);
  const salidas = [], surtidos = [];

  for (const l of items) {
    const p = porId.get(l.producto_id);
    if (!p) continue;
    const cant = Math.min(repLleva(l), Number(p.stock));
    if (!(cant > 0)) continue;
    const nuevo = +(Number(p.stock) - cant).toFixed(3);
    salidas.push({ linea: l, prod: p, cant, nuevo });
    surtidos.push({ clave: p.id, nombre: p.nombre, cantidad: cant, unidad: l.unidad || p.unidad || '', lote: '' });
  }
  if (!salidas.length) { toast('No hay existencia registrada de nada de este vale.'); return; }

  try {
    for (const s of salidas) {
      const mov = {
        tipo: 'salida', id_producto: s.prod.id, nombre: s.prod.nombre,
        cantidad: s.cant, unidad: s.linea.unidad || s.prod.unidad || null,
        usuario_id: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null,
        usuario_nombre: (typeof currentProfile !== 'undefined' && currentProfile) ? currentProfile.nombre : null,
        destino: rancho, folio_vale: folio,
        nota: 'Solicitud ' + repSol.sol.folio + (s.linea.cultivo_nombre ? ' · ' + s.linea.cultivo_nombre : ''),
        stock_resultante: s.nuevo,
        almacen_id: s.prod.almacen_id || null,
        rancho_id: s.linea.rancho_id || null,
        created_at: new Date().toISOString(),
      };
      if (typeof API !== 'undefined' && API.addMovimiento && API.updateStock) {
        await Promise.all([API.updateStock(s.prod.id, s.nuevo), API.addMovimiento(mov)]);
      } else {
        await db.from('movimientos').insert(mov);
        await db.from('productos').update({ stock: s.nuevo }).eq('id', s.prod.id);
      }
      // Se SUMA lo entregado en vez de marcar el renglón. Así el vale
      // de hoy y el del jueves conviven, y el renglón se cierra solo
      // cuando entre los dos alcanzan lo que el rancho pidió.
      const acum  = +(Number(s.linea.entregado || 0) + s.cant).toFixed(3);
      const vales = s.linea.vales ? (s.linea.vales + ' · ' + folio) : folio;
      const cerro = acum >= Number(s.linea.cantidad || 0) - 1e-6;
      const { error } = await db.from('solicitud_lineas').update({
        entregado: acum, vales,
        folio_vale: folio, fecha_surtido: hoy,
        estado: cerro ? 'Surtido' : 'Parcial',
      }).eq('id', s.linea.id);
      if (error) throw error;
      s.linea.entregado = acum; s.linea.vales = vales;
      s.linea.folio_vale = folio; s.linea.fecha_surtido = hoy;
      s.linea.estado = cerro ? 'Surtido' : 'Parcial';
      delete repCant[s.linea.id];
    }

    if (typeof imprimirVale === 'function') {
      imprimirVale({
        folio, fecha: hoy, destino: rancho,
        solicitante: repSol.sol.solicitante || 'Ing. Miguel',
        entrega: (typeof currentProfile !== 'undefined' && currentProfile) ? currentProfile.nombre : '',
        almacen: (typeof almacenActivo !== 'undefined' && almacenActivo) ? almacenActivo.nombre : '',
        nota: 'Solicitud ' + repSol.sol.folio,
        items: surtidos,
      });
    }
    const quedan = repSol.lineas.filter(l =>
      (l.rancho_nombre || 'Sin rancho') === rancho && repPendiente(l) > 0).length;
    toast('✓ ' + folio + ' · ' + salidas.length + ' renglón(es) descontados'
      + (quedan ? ' · a ' + rancho + ' todavía le faltan ' + quedan : ''));
    if (typeof todosProductos !== 'undefined') todosProductos = [];
    if (typeof fichaOlvidar === 'function') fichaOlvidar();
    // El semáforo y el board cuentan por cantidad: hay que releerlos.
    repAbrir(repSol.sol.id);
    if (typeof cargarLibreta === 'function') cargarLibreta();
  } catch (e) {
    toast('Se descontó parte y algo falló: ' + e.message + '. Revisa el movimiento ' + folio + '.');
    repRender();
  }
}
