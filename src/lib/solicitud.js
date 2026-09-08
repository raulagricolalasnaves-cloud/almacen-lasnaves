// ═══════════════════════════════════════════════════════════════════
//  solicitud.js — el Excel del Ing. Miguel, de archivo a órdenes
//
//  El Ing. Miguel manda cada semana un Excel con lo que pide cada
//  rancho. No viene en renglones: viene en MATRIZ — los productos
//  abajo y los ranchos a lo ancho. Por eso hasta hoy se capturaba a
//  mano, renglón por renglón.
//
//  Lo que hace este archivo:
//
//  1. LEE la matriz y la desdobla. El empate de las columnas se hace
//     por el NOMBRE del encabezado contra el catálogo de ranchos —
//     no por la posición — así que si Miguel mueve una columna de
//     lugar, o agrega un rancho, sigue funcionando.
//
//  2. PROPONE qué hacer con cada renglón, sin preguntar nada:
//       · si hay existencia contada, surtir del almacén
//       · si hay un solo proveedor en el historial, comprarle a ese
//       · si no hay ninguno, marcarlo para cotizar
//     De los 120 productos que se han comprado alguna vez, 113
//     tienen un solo proveedor. El sistema no adivina: lee.
//
//  3. GENERA las órdenes agrupadas por proveedor, con el plazo de
//     crédito que ese proveedor usa siempre.
//
//  Nada de esto pide capturar información vieja. Todo sale de
//  v_producto_ficha, que a su vez sale de las compras, las salidas
//  y las órdenes que ya están adentro.
// ═══════════════════════════════════════════════════════════════════

let solDatos   = null;   // { archivo, columnas, productos:[...] }
let solRanchos = [];
let solFichas  = new Map();

const solNorm = s => String(s == null ? '' : s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const solNum = v => {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
};
const solF = n => (n % 1 === 0 ? n.toLocaleString('es-MX')
                              : n.toLocaleString('es-MX', { maximumFractionDigits: 2 }));
const solM = n => n == null ? '—' : '$' + Number(n).toLocaleString('es-MX',
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const solEsc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── 1 · Leer el archivo ────────────────────────────────────────────

async function solCargarCatalogos() {
  if (!solRanchos.length) {
    const { data, error } = await db.from('ranchos')
      .select('id,nombre,alias,activo').order('nombre');
    if (error) throw error;
    solRanchos = (data || []).filter(r => r.activo !== false);
  }
}

// Busca en el encabezado cuál columna es cuál. Devuelve null si el
// archivo no se parece a una solicitud.
function solLeerMatriz(filas) {
  let hi = -1, colProd = -1, colUnidad = -1;
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const f = filas[i] || [];
    for (let j = 0; j < f.length; j++) {
      if (solNorm(f[j]) === 'producto') { hi = i; colProd = j; break; }
    }
    if (hi >= 0) break;
  }
  if (hi < 0) return null;

  const enc = filas[hi];
  const cols = [];
  for (let j = 0; j < enc.length; j++) {
    if (j === colProd) continue;
    const n = solNorm(enc[j]);
    if (!n) continue;
    if (n === 'unidad' || n === 'unidades' || n === 'um') { colUnidad = j; continue; }
    if (n === 'total' || n === 'totales' || n === 'suma') continue;

    // ¿este encabezado es un rancho? se busca por nombre y por alias,
    // y también si el nombre del rancho viene dentro del encabezado
    // ("Martineña (Zarza)" contiene "Martineña").
    let rancho = null, cultivo = null;
    for (const r of solRanchos) {
      const rn = solNorm(r.nombre), ra = solNorm(r.alias);
      if (n === rn || (ra && n === ra)) { rancho = r; break; }
      // nombre entre paréntesis: el resto es el cultivo
      const base = rn.split(' (')[0];
      if (base && (n === base || n.startsWith(base + ' '))) {
        rancho = r;
        cultivo = String(enc[j]).replace(/^[^(]*\(?|\)$/g, '').trim() || null;
        break;
      }
      if (ra && (n === ra || n.startsWith(ra + ' '))) { rancho = r; break; }
    }
    cols.push({ i: j, encabezado: String(enc[j]).trim(), rancho, cultivo });
  }

  const productos = [];
  for (let i = hi + 1; i < filas.length; i++) {
    const f = filas[i] || [];
    const nombre = String(f[colProd] == null ? '' : f[colProd]).trim();
    if (!nombre) continue;
    const cant = cols.map(c => solNum(f[c.i]));
    const total = cant.reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    productos.push({
      nombre,
      unidadExcel: colUnidad >= 0 ? String(f[colUnidad] == null ? '' : f[colUnidad]).trim() : '',
      cant, total
    });
  }
  return { cols, productos };
}

async function solArchivo(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const cont = document.getElementById('sol-cuerpo');
  cont.innerHTML = '<div class="loading">Leyendo el archivo...</div>';
  try {
    await solCargarCatalogos();
    const buf   = await file.arrayBuffer();
    const wb    = XLSX.read(buf, { type: 'array' });
    const hoja  = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: true });

    const m = solLeerMatriz(filas);
    if (!m) {
      cont.innerHTML = '<div class="empty">No encontré la columna <b>Producto</b> en las primeras filas. '
        + '¿Es la solicitud del Ing. Miguel?</div>';
      return;
    }
    if (!m.productos.length) {
      cont.innerHTML = '<div class="empty">El archivo se leyó bien pero ningún producto trae cantidad.</div>';
      return;
    }
    solDatos = { archivo: file.name, cols: m.cols, productos: m.productos };
    await solEmparejar();
    solRender();
  } catch (e) {
    cont.innerHTML = '<div class="empty">No se pudo leer: ' + solEsc(e.message) + '</div>';
  }
  input.value = '';
}

// ── 2 · Empatar con el catálogo y traer la ficha ───────────────────

async function solEmparejar() {
  const { data: prods, error } = await db.from('productos')
    .select('id,nombre,unidad,activo');
  if (error) throw error;

  const vivos = (prods || []).filter(p => p.activo !== false);
  const porNombre = new Map();
  vivos.forEach(p => porNombre.set(solNorm(p.nombre), p));

  // Miguel escribe "Pepton" y el catálogo dice "Pepton 85/16". Si el
  // nombre exacto no está, se busca un ÚNICO producto que empiece
  // igual. Si hay dos que empiezan igual no se adivina: se manda a
  // alta y que lo decida Raúl. Un empate por aproximación se marca
  // para que se vea en la pantalla.
  function solEmpatar(nombre) {
    const n = solNorm(nombre);
    const exacto = porNombre.get(n);
    if (exacto) return { p: exacto, aprox: false };
    if (n.length < 4) return { p: null, aprox: false };
    const cand = vivos.filter(x => {
      const xn = solNorm(x.nombre);
      return xn.startsWith(n + ' ') || n.startsWith(xn + ' ');
    });
    return cand.length === 1 ? { p: cand[0], aprox: true } : { p: null, aprox: false };
  }

  solDatos.productos.forEach(p => {
    const r = solEmpatar(p.nombre);
    const m = r.p;
    p.producto_id = m ? m.id : null;
    p.catalogo    = m ? m.nombre : null;
    p.empateAprox = r.aprox;
    p.unidad      = m ? (m.unidad || p.unidadExcel) : p.unidadExcel;
    p.conflictoUnidad = !!(m && m.unidad && p.unidadExcel &&
                           solNorm(m.unidad) !== solNorm(p.unidadExcel));
  });

  const ids = solDatos.productos.map(p => p.producto_id).filter(Boolean);
  solFichas = new Map();
  if (ids.length) {
    const { data: fichas } = await db.from('v_producto_ficha')
      .select('producto_id,stock,stock_verificado,minimo,origen_minimo,proveedor_id,proveedor_nombre,'
            + 'n_proveedores,costo_historico,costo_promedio,dias_credito,plazo_confiable,almacen_nombre,ubicacion')
      .in('producto_id', ids);
    (fichas || []).forEach(f => solFichas.set(f.producto_id, f));
  }

  // El sistema propone. Nada de esto se pregunta.
  solDatos.productos.forEach(p => {
    const f = solFichas.get(p.producto_id);
    p.ficha = f || null;
    const stock = f && f.stock_verificado ? Number(f.stock) || 0 : 0;
    const sabeCuanto = !!(f && f.stock_verificado);

    if (!p.producto_id)                 p.plan = 'alta';
    else if (!f || !f.proveedor_nombre) p.plan = 'cotizar';
    else if (sabeCuanto && stock >= p.total) p.plan = 'surtir';
    else if (sabeCuanto && stock > 0)   p.plan = 'mixto';
    else                                p.plan = 'comprar';

    p.surtir  = p.plan === 'surtir' ? p.total : (p.plan === 'mixto' ? stock : 0);
    p.comprar = +(p.total - p.surtir).toFixed(3);
    // Un costo de 0 no es un costo: las remisiones de algunos
    // proveedores llegan sin precio y quedan en cero. Decir "$0.00"
    // seria mentir; se dice "sin precio".
    const cp = f && Number(f.costo_promedio)  > 0 ? Number(f.costo_promedio)  : null;
    const ch = f && Number(f.costo_historico) > 0 ? Number(f.costo_historico) : null;
    p.costo   = cp != null ? cp : ch;
  });
}

function solRecalcular(idx, plan) {
  const p = solDatos.productos[idx];
  const f = p.ficha;
  const stock = f && f.stock_verificado ? Number(f.stock) || 0 : 0;
  p.plan = plan;
  p.surtir  = plan === 'surtir' ? Math.min(p.total, stock || p.total)
            : plan === 'mixto'  ? Math.min(stock, p.total) : 0;
  p.comprar = +(p.total - p.surtir).toFixed(3);
  solRender();
}

// ── 3 · Pantalla ───────────────────────────────────────────────────

const SOL_PLAN = {
  surtir : ['badge-ok',     'Surto del almacén'],
  mixto  : ['badge-warn',   'Surto parte'],
  comprar: ['badge-info',   'Compro al de siempre'],
  cotizar: ['badge-danger', 'Hay que cotizar'],
  alta   : ['badge-danger', 'Alta + cotizar'],
};

function solRender() {
  const cont = document.getElementById('sol-cuerpo');
  if (!solDatos) { cont.innerHTML = ''; return; }
  const P = solDatos.productos;

  const n = k => P.filter(p => p.plan === k).length;
  const importe = P.reduce((s, p) => s + (p.costo != null ? p.costo * p.comprar : 0), 0);
  const sinPrecio = P.filter(p => p.comprar > 0 && p.costo == null).length;

  const resumen = `
    <div class="sol-tiles">
      <div class="sol-tile"><span class="k">Renglones</span><span class="v">${P.length}</span></div>
      <div class="sol-tile ok"><span class="k">Surto sin comprar</span><span class="v">${n('surtir')}</span></div>
      <div class="sol-tile"><span class="k">Al proveedor de siempre</span><span class="v">${n('comprar') + n('mixto')}</span></div>
      <div class="sol-tile bad"><span class="k">Hay que cotizar</span><span class="v">${n('cotizar') + n('alta')}</span></div>
      <div class="sol-tile"><span class="k">Importe estimado</span><span class="v" style="font-size:16px">${solM(importe)}</span>
        ${sinPrecio ? `<span class="s">${sinPrecio} sin precio conocido</span>` : ''}</div>
    </div>`;

  const filas = P.map((p, i) => {
    const f = p.ficha;
    const [cls, txt] = SOL_PLAN[p.plan];
    const existencia = !p.producto_id ? '<span class="sol-mut">—</span>'
      : (f && f.stock_verificado ? solF(Number(f.stock)) + ' ' + (p.unidad || '')
                                 : '<span class="badge badge-warn">sin contar</span>');
    const prov = f && f.proveedor_nombre
      ? `<span class="sol-der" title="Deducido: único proveedor de este producto en el historial">${solEsc(f.proveedor_nombre)}</span>`
        + (f.dias_credito != null ? ` <span class="badge badge-info">${f.dias_credito} d</span>` : '')
      : '<span class="sol-falta">ninguno todavía</span>';

    const opciones = ['surtir', 'mixto', 'comprar', 'cotizar']
      .map(o => `<option value="${o}"${p.plan === o ? ' selected' : ''}>${SOL_PLAN[o][1]}</option>`).join('');

    const detalle = solDatos.cols.map((c, j) => p.cant[j] > 0
      ? `<span class="sol-pill">${solEsc(c.rancho ? c.rancho.nombre : c.encabezado)}${c.cultivo ? ' · ' + solEsc(c.cultivo) : ''}: <b>${solF(p.cant[j])}</b></span>`
      : '').join('');

    return `<tr>
      <td>
        <div class="sol-prod">${solEsc(p.nombre)}</div>
        <div class="sol-sub">${p.producto_id || '<span class="sol-falta">no está en el catálogo</span>'}${
          p.empateAprox ? ` · <span class="badge badge-warn" title="El nombre del Excel no era idéntico al del catálogo">= ${solEsc(p.catalogo)}</span>` : ''}${
          p.conflictoUnidad ? ` · <span class="badge badge-warn">pide ${solEsc(p.unidadExcel)}, tienes ${solEsc(p.unidad)}</span>` : ''}</div>
        <div class="sol-ranchos">${detalle}</div>
      </td>
      <td class="sol-num">${solF(p.total)} ${solEsc(p.unidad || '')}</td>
      <td class="sol-num">${existencia}</td>
      <td>
        <span class="badge ${cls}">${txt}</span>
        ${p.plan !== 'alta' ? `<select class="input sol-sel" onchange="solRecalcular(${i}, this.value)">${opciones}</select>` : ''}
      </td>
      <td class="sol-num">${p.surtir > 0 ? solF(p.surtir) : '<span class="sol-mut">·</span>'}</td>
      <td class="sol-num">${p.comprar > 0 ? solF(p.comprar) : '<span class="sol-mut">·</span>'}</td>
      <td>${prov}</td>
      <td class="sol-num">${p.costo != null ? solM(p.costo) : '<span class="badge badge-warn">s/precio</span>'}</td>
    </tr>`;
  }).join('');

  cont.innerHTML = resumen + `
    <div class="sol-arch">📄 ${solEsc(solDatos.archivo)} · ${solDatos.cols.filter(c => c.rancho).length} de ${solDatos.cols.length} columnas empataron con un rancho</div>
    <div class="sol-scroll"><table class="sol-tabla">
      <thead><tr><th>Producto</th><th class="sol-num">Piden</th><th class="sol-num">Tengo</th>
      <th>Qué hago</th><th class="sol-num">Surto</th><th class="sol-num">Compro</th>
      <th>Proveedor</th><th class="sol-num">Costo</th></tr></thead>
      <tbody>${filas}</tbody></table></div>
    <div class="sol-acciones">
      <button class="btn btn-primary" onclick="solGuardar()">Guardar solicitud</button>
      <button class="btn" onclick="solGenerarOC()">Guardar y generar órdenes</button>
      <button class="btn" onclick="solDatos=null;solRender()">Descartar</button>
    </div>`;
}

// ── 4 · Guardar ────────────────────────────────────────────────────

function solFolio() {
  const d = new Date();
  return 'SOL-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0')
       + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0')
       + String(d.getMinutes()).padStart(2, '0');
}

async function solGuardar(silencioso) {
  if (!solDatos) return null;
  try {
    const folio = solFolio();
    const { data: sol, error: e1 } = await db.from('solicitudes').insert({
      folio, archivo: solDatos.archivo, origen: 'Excel',
      solicitante: 'Ing. Miguel', estado: 'Abierta',
      creado_por: (typeof currentProfile !== 'undefined' && currentProfile) ? currentProfile.nombre : null
    }).select().single();
    if (e1) throw e1;

    // Un renglón por producto y rancho: así el vale de cada rancho
    // sale solo, sin volver a decidir nada.
    const lineas = [];
    solDatos.productos.forEach(p => {
      const f = p.ficha;
      solDatos.cols.forEach((c, j) => {
        if (!(p.cant[j] > 0)) return;
        lineas.push({
          solicitud_id   : sol.id,
          producto_id    : p.producto_id,
          producto_nombre: p.nombre,
          rancho_id      : c.rancho ? c.rancho.id : null,
          rancho_nombre  : c.rancho ? c.rancho.nombre : c.encabezado,
          cultivo_nombre : c.cultivo,
          cantidad       : p.cant[j],
          unidad         : p.unidad || null,
          plan           : p.plan,
          surtir         : p.total > 0 ? +(p.surtir  * p.cant[j] / p.total).toFixed(3) : 0,
          comprar        : p.total > 0 ? +(p.comprar * p.cant[j] / p.total).toFixed(3) : 0,
          proveedor_id   : f ? f.proveedor_id   : null,
          proveedor_nombre: f ? f.proveedor_nombre : null,
          origen_proveedor: (f && f.proveedor_nombre) ? 'historial' : null,
          costo_estimado : p.costo,
          estado         : 'Pendiente'
        });
      });
    });
    const { error: e2 } = await db.from('solicitud_lineas').insert(lineas);
    if (e2) throw e2;

    if (!silencioso) {
      toast('✓ Solicitud ' + folio + ' guardada · ' + lineas.length + ' renglones');
      solDatos = null; solRender();
      if (typeof repAbrir === 'function') repAbrir(sol.id);
    }
    return { sol, lineas };
  } catch (e) {
    toast('No se pudo guardar: ' + e.message);
    return null;
  }
}

async function solGenerarOC() {
  const g = await solGuardar(true);
  if (!g) return;
  try {
    // Agrupar por proveedor lo que hay que comprar
    const porProv = new Map();
    solDatos.productos.forEach(p => {
      if (!(p.comprar > 0)) return;
      const f = p.ficha;
      if (!f || !f.proveedor_id) return;      // sin proveedor: se queda para cotizar
      if (!porProv.has(f.proveedor_id)) porProv.set(f.proveedor_id, { f, items: [] });
      porProv.get(f.proveedor_id).items.push(p);
    });
    if (!porProv.size) { toast('✓ Solicitud guardada. Ningún renglón tiene proveedor todavía.'); solDatos = null; solRender(); return; }

    const hoy = new Date().toISOString().slice(0, 10);
    let hechas = 0;
    for (const [provId, grupo] of porProv) {
      const f = grupo.f;
      const folio = 'OC-' + g.sol.folio.replace('SOL-', '') + '-' + String(++hechas).padStart(2, '0');
      const { data: oc, error: e1 } = await db.from('ordenes_compra').insert({
        folio, fecha: hoy, proveedor_id: provId, proveedor_nombre: f.proveedor_nombre,
        estado: 'Abierta', moneda: 'MXN',
        condiciones_pago: f.dias_credito != null
          ? (f.dias_credito === 0 ? 'Contado' : f.dias_credito + ' dias') : null,
        elaboro: (typeof currentProfile !== 'undefined' && currentProfile) ? currentProfile.nombre : null,
        observaciones: 'Generada de la solicitud ' + g.sol.folio
          + (f.dias_credito != null ? '. Plazo tomado del historial de este proveedor.' : '')
      }).select().single();
      if (e1) throw e1;

      const lin = grupo.items.map(p => ({
        oc_id: oc.id, producto_id: p.producto_id, producto_nombre: p.nombre,
        cantidad: p.comprar, unidad: p.unidad || null,
        cantidad_base: p.comprar, unidad_base: p.unidad || null,
        precio_unitario: p.costo, importe: p.costo != null ? +(p.costo * p.comprar).toFixed(2) : null,
        observaciones: p.costo != null ? 'Costo estimado del historial; confirmar contra factura.'
                                       : 'Sin precio conocido: confirmar al recibir.'
      }));
      const { error: e2 } = await db.from('oc_lineas').insert(lin);
      if (e2) throw e2;
    }
    toast('✓ ' + g.sol.folio + ' guardada · ' + hechas + ' orden(es) de compra generadas');
    solDatos = null; solRender();
    if (typeof repAbrir === 'function') repAbrir(g.sol.id);
  } catch (e) {
    toast('La solicitud se guardó, pero las órdenes no: ' + e.message);
  }
}

// ── 5 · Historial de solicitudes ───────────────────────────────────

async function cargarSolicitudes() {
  const cont = document.getElementById('sol-historial');
  if (!cont) return;
  // si hay una solicitud abierta, se respeta
  if (typeof repSol !== 'undefined' && repSol) { repRender(); return; }
  cont.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const { data, error } = await db.from('solicitudes')
      .select('id,folio,fecha,archivo,solicitante,estado').order('fecha', { ascending: false }).limit(12);
    if (error) throw error;
    if (!data || !data.length) {
      cont.innerHTML = '<div class="empty">Todavía no se ha importado ninguna solicitud.</div>';
      return;
    }
    const ids = data.map(s => s.id);
    const { data: cnt } = await db.from('solicitud_lineas').select('solicitud_id').in('solicitud_id', ids);
    const porSol = new Map();
    (cnt || []).forEach(l => porSol.set(l.solicitud_id, (porSol.get(l.solicitud_id) || 0) + 1));

    cont.innerHTML = '<div class="sol-scroll"><table class="sol-tabla"><thead><tr>'
      + '<th>Folio</th><th>Fecha</th><th>Archivo</th><th class="sol-num">Renglones</th><th>Estado</th>'
      + '</tr></thead><tbody>'
      + data.map(s => `<tr class="rep-fila" onclick="repAbrir('${s.id}')" title="Abrir para surtir y rastrear">`
        + `<td class="sol-prod">${solEsc(s.folio)}</td>`
        + `<td>${s.fecha || ''}</td><td class="sol-sub">${solEsc(s.archivo || '')}</td>`
        + `<td class="sol-num">${porSol.get(s.id) || 0}</td>`
        + `<td><span class="badge badge-info">${solEsc(s.estado || '')}</span></td></tr>`).join('')
      + '</tbody></table></div>';
  } catch (e) {
    cont.innerHTML = '<div class="empty">No se pudo cargar: ' + solEsc(e.message) + '</div>';
  }
}

// ── 6 · Engancharse sin tocar app.js ───────────────────────────────
// app.js reconstruye TAB_LOADERS dentro de goTo cada vez que se cambia
// de pestaña, así que hay que volver a registrar el loader después.

(function () {
  function registrar() {
    if (typeof TAB_LOADERS === 'object' && TAB_LOADERS) TAB_LOADERS.solicitudes = cargarSolicitudes;
  }
  const orig = window.goTo;
  if (typeof orig === 'function') {
    window.goTo = function (tab, btn) {
      const r = orig.apply(this, arguments);
      registrar();
      if (tab === 'solicitudes') cargarSolicitudes();
      return r;
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registrar);
  else registrar();
})();
