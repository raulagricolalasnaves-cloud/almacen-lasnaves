// ═══════════════════════════════════════════════════════════════════
//  solicitud.js — de la solicitud a las órdenes
//
//  Cada semana llega lo que pide cada rancho. Casi siempre en un
//  Excel en MATRIZ — los productos abajo y los ranchos a lo ancho —
//  pero a veces hay que meterlo a mano. Las dos entradas terminan
//  en la misma pantalla de reparto.
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
        + '¿Es un archivo de solicitud?</div>';
      return;
    }
    if (!m.productos.length) {
      cont.innerHTML = '<div class="empty">El archivo se leyó bien pero ningún producto trae cantidad.</div>';
      return;
    }
    solDatos = { archivo: file.name, origen: 'Excel', cols: m.cols, productos: m.productos };
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

  // El sistema pone lo que sabe. Nada de esto se pregunta.
  solDatos.productos.forEach(p => {
    const f = solFichas.get(p.producto_id);
    p.ficha = f || null;

    // sistema = null quiere decir "nunca se ha contado", que NO es cero
    p.sistema = (f && f.stock_verificado) ? (Number(f.stock) || 0) : null;
    p.contado = null;      // lo llena él si verifica
    p.surtir  = null;      // solReplan pone el valor por omisión

    // Un costo de 0 no es un costo: las remisiones de algunos
    // proveedores llegan sin precio y quedan en cero. Decir "$0.00"
    // seria mentir; se dice "sin precio".
    const cp = f && Number(f.costo_promedio)  > 0 ? Number(f.costo_promedio)  : null;
    const ch = f && Number(f.costo_historico) > 0 ? Number(f.costo_historico) : null;
    p.costo   = cp != null ? cp : ch;

    solReplan(p);
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

// ── 3 · Reparto: lo que se surte, lo que se compra, y la verificación
//
//  Tres cosas cambian aquí respecto de la primera versión:
//
//  · SURTIDO PARCIAL. Ya no es "surto todo o no surto nada": se
//    escribe la cantidad. Lo que no se surte se compra, solo.
//
//  · VERIFICACIÓN. Una columna "conté" al lado de lo que dice el
//    sistema. Es el momento natural para revisarlo: estás decidiendo
//    qué sacas del almacén, o sea que tienes el anaquel enfrente.
//    Si no coincide, al guardar se ajusta y queda el movimiento.
//
//  · SIN CONTAR ≠ CERO. Si el producto nunca se ha contado, el
//    sistema no dice cero: dice que no sabe. Y si escribes lo que
//    contaste, ese producto queda contado desde ese momento.

const SOL_PLAN = {
  surtir : ['badge-ok',     'Surto todo'],
  mixto  : ['badge-warn',   'Surto parte'],
  comprar: ['badge-info',   'Compro'],
  cotizar: ['badge-danger', 'Cotizar'],
  alta   : ['badge-danger', 'Alta + cotizar'],
};

// Lo que se puede sacar del almacén: lo contado si lo anotó, si no
// lo que dice el sistema, y 0 si nunca se ha contado.
function solDisponible(p) {
  if (p.contado != null) return Number(p.contado);
  return p.sistema != null ? Number(p.sistema) : 0;
}

// ── El reparto entre ranchos ───────────────────────────────────────
//
//  Raúl: "yo quiero tener control de cuánto reparto a cada lugar".
//
//  Mientras no opine, se prorratea — que es lo razonable y es lo que
//  ya hacía. En cuanto toca una casilla, manda él y el sistema deja de
//  repartir solo.

// Las columnas donde este producto sí se pidió.
function solColsDe(p) {
  return (p.cant || []).map((v, j) => (v > 0 ? j : -1)).filter(j => j >= 0);
}

// Cuánto sale del almacén para cada rancho, en el orden de solColsDe.
function solReparto(p) {
  const cols = solColsDe(p);
  if (p.porCol) return cols.map(j => Math.max(0, Number(p.porCol[j]) || 0));
  return cols.map(j => (p.total > 0 ? +(p.surtir * p.cant[j] / p.total).toFixed(3) : 0));
}

// El tope de un rancho: lo que ese rancho pidió, y nunca más de lo que
// queda después de lo repartido a los otros.
function solTopeCol(p, j) {
  const cols = solColsDe(p);
  const otros = cols.filter(c => c !== j)
    .reduce((s, c) => s + (p.porCol ? (Number(p.porCol[c]) || 0) : 0), 0);
  return Math.min(Number(p.cant[j]), Math.max(0, solDisponible(p) - otros));
}

function solSetPorCol(i, j, valor) {
  const p = solDatos.productos[i];
  const cols = solColsDe(p);
  if (!p.porCol) {
    // Primera vez: se arranca de lo prorrateado, para que sólo tenga
    // que mover lo que quiere cambiar.
    const pro = solReparto(p);
    p.porCol = [];
    cols.forEach((c, k) => { p.porCol[c] = pro[k]; });
  }
  p.porCol[j] = Math.max(0, Math.min(solNum(valor), solTopeCol(p, j)));
  solReplan(p);
  solRender();
}

// Devolverle el reparto al sistema.
function solParejo(i) {
  const p = solDatos.productos[i];
  p.porCol = null;
  solReplan(p);
  solRender();
}

function solAbrirReparto(i) {
  const p = solDatos.productos[i];
  p.abierto = !p.abierto;
  solRender();
}

function solReplan(p) {
  const disp = solDisponible(p);
  // Si repartió a mano, el total a surtir ES lo que él repartió. No se
  // recalcula por encima de su decisión.
  if (p.porCol) {
    p.surtir = +solColsDe(p)
      .reduce((s, j) => s + (Number(p.porCol[j]) || 0), 0).toFixed(3);
  }
  if (p.surtir == null) p.surtir = Math.min(p.total, disp);
  p.surtir  = Math.max(0, Math.min(p.surtir, p.total, disp));
  p.comprar = +(p.total - p.surtir).toFixed(3);
  const f = p.ficha;
  if (!p.producto_id)                    p.plan = 'alta';
  else if (p.surtir >= p.total)          p.plan = 'surtir';
  else if (p.surtir > 0)                 p.plan = 'mixto';
  else if (!f || !f.proveedor_nombre)    p.plan = 'cotizar';
  else                                   p.plan = 'comprar';
}

function solSetContado(i, valor) {
  const p = solDatos.productos[i];
  const t = String(valor).trim();
  p.contado = t === '' ? null : Math.max(0, solNum(t));
  p.surtir = null;              // se recalcula con lo nuevo
  solReplan(p);
  solRender();
}

function solSetSurtir(i, valor) {
  const p = solDatos.productos[i];
  // Mover el total vuelve a repartirlo solo: si quería otro reparto, ya
  // lo hizo abajo, y ahí manda él.
  p.porCol = null;
  p.surtir = Math.max(0, solNum(valor));
  solReplan(p);
  solRender();
}

function solRender() {
  const cont = document.getElementById('sol-cuerpo');
  if (!solDatos) { cont.innerHTML = ''; return; }
  if (solDatos.manual) { solRenderManual(); return; }

  const P = solDatos.productos;
  P.forEach(solReplan);

  const n = k => P.filter(p => p.plan === k).length;
  const importe   = P.reduce((s, p) => s + (p.costo != null ? p.costo * p.comprar : 0), 0);
  const sinPrecio = P.filter(p => p.comprar > 0 && p.costo == null).length;
  const difs      = P.filter(p => p.contado != null && p.sistema != null
                                  && Number(p.contado) !== Number(p.sistema));
  const nuevos    = P.filter(p => p.contado != null && p.sistema == null);

  const resumen = `
    <div class="sol-tiles">
      <div class="sol-tile"><span class="k">Renglones</span><span class="v">${P.length}</span></div>
      <div class="sol-tile ok"><span class="k">Sale del almacén</span><span class="v">${n('surtir') + n('mixto')}</span></div>
      <div class="sol-tile"><span class="k">Se compra</span><span class="v">${n('comprar') + n('mixto')}</span></div>
      <div class="sol-tile bad"><span class="k">Hay que cotizar</span><span class="v">${n('cotizar') + n('alta')}</span></div>
      <div class="sol-tile"><span class="k">Importe estimado</span><span class="v" style="font-size:16px">${solM(importe)}</span>
        ${sinPrecio ? `<span class="s">${sinPrecio} sin precio conocido</span>` : ''}</div>
    </div>`;

  const filas = P.map((p, i) => {
    const f = p.ficha;
    const [cls, txt] = SOL_PLAN[p.plan];
    const disp = solDisponible(p);

    // lo que dice el sistema
    const sist = !p.producto_id ? '<span class="sol-mut">—</span>'
      : (p.sistema == null ? '<span class="badge badge-warn" title="Nunca se ha contado">sin contar</span>'
                           : solF(p.sistema));

    // lo que él contó, y la diferencia
    const inpContado = p.producto_id
      ? `<input class="input sol-inp" type="number" min="0" step="any" inputmode="decimal"
           value="${p.contado != null ? p.contado : ''}" placeholder="—"
           onchange="solSetContado(${i}, this.value)" title="Lo que de verdad hay en el anaquel">`
      : '';
    let dif = '';
    if (p.contado != null && p.sistema != null) {
      const d = +(Number(p.contado) - Number(p.sistema)).toFixed(3);
      dif = d === 0 ? '<span class="badge badge-ok">cuadra</span>'
        : `<span class="badge ${d > 0 ? 'badge-info' : 'badge-danger'}">${d > 0 ? '+' : ''}${solF(d)}</span>`;
    } else if (p.contado != null && p.sistema == null) {
      dif = '<span class="badge badge-ok">queda contado</span>';
    }

    const inpSurtir = p.producto_id
      ? `<input class="input sol-inp" type="number" min="0" max="${Math.min(p.total, disp)}" step="any"
           inputmode="decimal" value="${p.surtir}" onchange="solSetSurtir(${i}, this.value)"
           ${disp <= 0 ? 'disabled title="No hay existencia registrada"' : ''}>`
      : '<span class="sol-mut">·</span>';

    const prov = f && f.proveedor_nombre
      ? `<span class="sol-der" title="Deducido: único proveedor de este producto en el historial">${solEsc(f.proveedor_nombre)}</span>`
        + (f.dias_credito != null ? ` <span class="badge badge-info">${f.dias_credito} d</span>` : '')
      : (p.comprar > 0 ? '<span class="sol-falta">ninguno todavía</span>' : '<span class="sol-mut">—</span>');

    // A dónde va. Si va a más de un lado y algo sale del almacén, se
    // puede abrir para decir cuánto a cada quien; mientras esté
    // cerrado no estorba, que es lo que él pidió de la interfaz.
    const cols = solColsDe(p);
    const rep  = solReparto(p);
    const puedeRepartir = cols.length > 1 && p.producto_id && disp > 0;

    const detalle = p.abierto && puedeRepartir
      ? `<div class="sol-rep">
          ${cols.map((j, k) => {
            const c = solDatos.cols[j];
            return `<label class="sol-rep-f">
              <span class="n">${solEsc(c.rancho ? c.rancho.nombre : c.encabezado)}${c.cultivo ? ' · ' + solEsc(c.cultivo) : ''}</span>
              <span class="sol-mut">pide ${solF(p.cant[j])}</span>
              <input class="input sol-inp" type="number" min="0" max="${solTopeCol(p, j)}" step="any"
                inputmode="decimal" value="${rep[k]}" title="Cuánto le sale del almacén a este rancho"
                onchange="solSetPorCol(${i}, ${j}, this.value)">
            </label>`;
          }).join('')}
          <div class="sol-rep-pie">
            <span class="sol-sub">${p.porCol ? 'lo repartiste tú' : 'repartido a la mitad'}</span>
            ${p.porCol ? `<button class="btn btn-sm" onclick="solParejo(${i})">Que lo reparta el sistema</button>` : ''}
            <button class="btn btn-sm" onclick="solAbrirReparto(${i})">Cerrar</button>
          </div>
        </div>`
      : solDatos.cols.map((c, j) => p.cant[j] > 0
          ? `<span class="sol-pill">${solEsc(c.rancho ? c.rancho.nombre : c.encabezado)}${c.cultivo ? ' · ' + solEsc(c.cultivo) : ''}: <b>${solF(p.cant[j])}</b></span>`
          : '').join('')
        + (puedeRepartir
            ? ` <button class="sol-rep-abre" onclick="solAbrirReparto(${i})"
                  title="Decidir cuánto sale del almacén para cada rancho">${
                  p.porCol ? '✎ lo repartiste tú' : '¿cuánto a cada uno?'}</button>`
            : '');

    return `<tr>
      <td>
        <div class="sol-prod">${solEsc(p.nombre)}</div>
        <div class="sol-sub">${p.producto_id || '<span class="sol-falta">no está en el catálogo</span>'}${
          p.empateAprox ? ` · <span class="badge badge-warn" title="El nombre del Excel no era idéntico al del catálogo">= ${solEsc(p.catalogo)}</span>` : ''}${
          p.conflictoUnidad ? ` · <span class="badge badge-warn">pide ${solEsc(p.unidadExcel)}, tienes ${solEsc(p.unidad)}</span>` : ''}</div>
        <div class="sol-ranchos">${detalle}</div>
      </td>
      <td class="sol-num">${solF(p.total)} ${solEsc(p.unidad || '')}</td>
      <td class="sol-num">${sist}</td>
      <td class="sol-num">${inpContado}</td>
      <td class="sol-num">${dif}</td>
      <td class="sol-num">${inpSurtir}</td>
      <td class="sol-num">${p.comprar > 0 ? solF(p.comprar) : '<span class="sol-mut">·</span>'}</td>
      <td><span class="badge ${cls}">${txt}</span></td>
      <td style="font-size:12.5px">${prov}</td>
      <td class="sol-num">${p.costo != null ? solM(p.costo) : '<span class="badge badge-warn">s/precio</span>'}</td>
    </tr>`;
  }).join('');

  const avisoDif = (difs.length || nuevos.length) ? `
    <div class="rep-nota"><b>Al guardar se ajusta el inventario.</b>
      ${difs.length ? `${difs.length} producto(s) no cuadran con lo que dice el sistema` : ''}${difs.length && nuevos.length ? ' y ' : ''}${nuevos.length ? `${nuevos.length} quedan contados por primera vez` : ''}.
      Queda un movimiento de ajuste por cada uno, con tu nombre y la fecha.</div>` : '';

  cont.innerHTML = resumen + `
    <div class="sol-arch">${solDatos.archivo ? '📄 ' + solEsc(solDatos.archivo) : '✎ Capturada a mano'}
      · ${solDatos.cols.filter(c => c.rancho).length} de ${solDatos.cols.length} columnas empataron con un rancho</div>
    <div class="sol-scroll"><table class="sol-tabla">
      <thead><tr>
        <th>Producto</th><th class="sol-num">Piden</th>
        <th class="sol-num" title="Lo que dice el sistema">Sistema</th>
        <th class="sol-num" title="Lo que de verdad hay">Conté</th>
        <th class="sol-num">Dif.</th>
        <th class="sol-num" title="Cuánto sale del almacén">Surto</th>
        <th class="sol-num">Compro</th><th>Queda</th><th>Proveedor ƒ</th><th class="sol-num">Costo</th>
      </tr></thead>
      <tbody>${filas}</tbody></table></div>
    ${avisoDif}
    <div class="sol-acciones">
      <button class="btn btn-primary" onclick="solGuardar()">Guardar solicitud</button>
      <button class="btn" onclick="solGenerarOC()">Guardar y generar órdenes</button>
      <button class="btn" onclick="solDatos=null;solRender()">Descartar</button>
    </div>`;
}

// ── 3b · Capturar a mano, con las mismas columnas del Excel ───────

async function solManual() {
  const cont = document.getElementById('sol-cuerpo');
  cont.innerHTML = '<div class="loading">Preparando...</div>';
  try {
    await solCargarCatalogos();
    // Las columnas: cada rancho, y para los que manejan más de un
    // cultivo, una columna por cultivo. Sale del histórico, no se
    // captura.
    const { data: hist } = await db.from('v_quien_pide').select('rancho_nombre,cultivo_nombre');
    const porRancho = new Map();
    (hist || []).forEach(h => {
      if (!h.cultivo_nombre) return;
      if (!porRancho.has(h.rancho_nombre)) porRancho.set(h.rancho_nombre, new Set());
      porRancho.get(h.rancho_nombre).add(h.cultivo_nombre);
    });
    const cols = [];
    solRanchos.forEach(r => {
      const cult = [...(porRancho.get(r.nombre) || [])].filter(c => c && c !== 'General').sort();
      if (cult.length > 1) cult.forEach(c => cols.push({ i: cols.length, encabezado: r.nombre + ' (' + c + ')', rancho: r, cultivo: c }));
      else cols.push({ i: cols.length, encabezado: r.nombre, rancho: r, cultivo: cult[0] || null });
    });
    const { data: prods } = await db.from('productos').select('id,nombre,unidad,activo').order('nombre');
    solDatos = { manual: true, origen: 'Manual', cols, productos: [],
                 catalogo: (prods || []).filter(p => p.activo !== false) };
    solRenderManual();
  } catch (e) {
    cont.innerHTML = '<div class="empty">No se pudo preparar: ' + solEsc(e.message) + '</div>';
  }
}

function solManualAgregar(nombre) {
  const t = String(nombre || '').trim();
  if (!t) return;
  const cat = (solDatos.catalogo || []).find(x => solNorm(x.nombre) === solNorm(t));
  solDatos.productos.push({
    nombre: cat ? cat.nombre : t,
    producto_id: cat ? cat.id : null,
    unidad: cat ? (cat.unidad || '') : '',
    unidadExcel: cat ? (cat.unidad || '') : '',
    cant: solDatos.cols.map(() => 0), total: 0,
  });
  solRenderManual();
}

function solManualCelda(i, j, valor) {
  const p = solDatos.productos[i];
  p.cant[j] = Math.max(0, solNum(valor));
  p.total = +p.cant.reduce((a, b) => a + b, 0).toFixed(3);
  solRenderManual();
}

function solManualQuitar(i) { solDatos.productos.splice(i, 1); solRenderManual(); }

function solRenderManual() {
  const cont = document.getElementById('sol-cuerpo');
  const th = solDatos.cols.map(c =>
    `<th class="sol-num" title="${solEsc(c.encabezado)}">${solEsc(c.cultivo ? c.cultivo : (c.rancho ? c.rancho.nombre : c.encabezado))}
      ${c.cultivo ? `<div class="sol-sub" style="font-weight:400">${solEsc(c.rancho.nombre)}</div>` : ''}</th>`).join('');

  const filas = solDatos.productos.map((p, i) => `<tr>
      <td><div class="sol-prod">${solEsc(p.nombre)}</div>
        <div class="sol-sub">${p.producto_id || '<span class="sol-falta">nuevo, se dará de alta</span>'}</div></td>
      ${p.cant.map((v, j) => `<td class="sol-num"><input class="input sol-inp" type="number" min="0" step="any"
         inputmode="decimal" value="${v || ''}" placeholder="·" onchange="solManualCelda(${i},${j},this.value)"></td>`).join('')}
      <td class="sol-num"><b>${solF(p.total)}</b> ${solEsc(p.unidad || '')}</td>
      <td><button class="btn btn-sm" onclick="solManualQuitar(${i})" title="Quitar">✕</button></td>
    </tr>`).join('');

  const opciones = (solDatos.catalogo || []).slice(0, 500)
    .map(x => `<option value="${solEsc(x.nombre)}"></option>`).join('');

  const conCantidad = solDatos.productos.filter(p => p.total > 0).length;

  cont.innerHTML = `
    <div class="sol-arch">✎ Capturando a mano · un renglón por producto, una columna por rancho</div>
    <div class="sol-manual-add">
      <input class="input" id="sol-buscar-prod" list="sol-catalogo" placeholder="Escribe el producto y dale Enter"
        onkeydown="if(event.key==='Enter'){event.preventDefault();solManualAgregar(this.value);this.value='';}">
      <datalist id="sol-catalogo">${opciones}</datalist>
      <button class="btn" onclick="const e=document.getElementById('sol-buscar-prod');solManualAgregar(e.value);e.value='';">Agregar</button>
    </div>
    ${solDatos.productos.length ? `<div class="sol-scroll"><table class="sol-tabla">
      <thead><tr><th>Producto</th>${th}<th class="sol-num">Total</th><th></th></tr></thead>
      <tbody>${filas}</tbody></table></div>`
      : '<div class="empty">Agrega el primer producto arriba.</div>'}
    <div class="sol-acciones">
      <button class="btn btn-primary" ${conCantidad ? '' : 'disabled'} onclick="solManualContinuar()">
        Continuar con ${conCantidad} renglón(es)</button>
      <button class="btn" onclick="solDatos=null;solRender()">Descartar</button>
    </div>
    <div class="rep-nota">Si el producto no está en el catálogo, escríbelo igual: queda marcado para darlo de
      alta, como cuando viene en el Excel.</div>`;
}

async function solManualContinuar() {
  solDatos.productos = solDatos.productos.filter(p => p.total > 0);
  if (!solDatos.productos.length) { toast('Ningún renglón tiene cantidad'); return; }
  solDatos.manual = false;
  const cont = document.getElementById('sol-cuerpo');
  cont.innerHTML = '<div class="loading">Buscando existencias y proveedores...</div>';
  try { await solEmparejar(); solRender(); }
  catch (e) { cont.innerHTML = '<div class="empty">No se pudo: ' + solEsc(e.message) + '</div>'; }
}

// ── 4 · Guardar ────────────────────────────────────────────────────

function solFolio() {
  const d = new Date();
  return 'SOL-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0')
       + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0')
       + String(d.getMinutes()).padStart(2, '0');
}

// Antes de guardar, lo que él contó se vuelve realidad: se ajusta la
// existencia y queda el movimiento con su nombre y la fecha. El
// producto que nunca se había contado queda contado.
async function solAplicarConteos() {
  const P = solDatos.productos.filter(p => p.producto_id && p.contado != null);
  if (!P.length) return 0;
  const hoy = new Date().toISOString().slice(0, 10);
  let hechos = 0;
  for (const p of P) {
    const nuevo = Number(p.contado);
    const antes = p.sistema;
    try {
      await db.from('productos').update({
        stock: nuevo, stock_verificado: true, fecha_conteo: hoy
      }).eq('id', p.producto_id);

      if (antes != null && Number(antes) !== nuevo) {
        const dif = +(nuevo - Number(antes)).toFixed(3);
        const mov = {
          tipo: dif >= 0 ? 'entrada' : 'salida',
          id_producto: p.producto_id, nombre: p.nombre,
          cantidad: Math.abs(dif), unidad: p.unidad || null,
          usuario_id: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null,
          usuario_nombre: (typeof currentProfile !== 'undefined' && currentProfile) ? currentProfile.nombre : null,
          destino: 'Verificacion al repartir',
          nota: 'Verificado al repartir la solicitud: el sistema decia '
                + antes + ' y se contaron ' + nuevo + ' ' + (p.unidad || ''),
          stock_resultante: nuevo,
          almacen_id: (typeof almacenActivo !== 'undefined' && almacenActivo) ? almacenActivo.id : null,
          created_at: new Date().toISOString(),
        };
        if (typeof API !== 'undefined' && API.addMovimiento) await API.addMovimiento(mov);
        else await db.from('movimientos').insert(mov);
      }
      p.sistema = nuevo;
      hechos++;
    } catch (e) { toast('No se pudo ajustar ' + p.nombre + ': ' + e.message); }
  }
  if (typeof todosProductos !== 'undefined') todosProductos = [];
  if (typeof fichaOlvidar === 'function') fichaOlvidar();
  return hechos;
}

async function solGuardar(silencioso) {
  if (!solDatos) return null;
  try {
    const ajustes = await solAplicarConteos();
    const folio = solFolio();
    const { data: sol, error: e1 } = await db.from('solicitudes').insert({
      folio, archivo: solDatos.archivo || null,
      origen: solDatos.origen || 'Excel',
      solicitante: solDatos.solicitante || null, estado: 'Abierta',
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
      toast('✓ Solicitud ' + folio + ' guardada · ' + lineas.length + ' renglones'
        + (ajustes ? ' · ' + ajustes + ' existencia(s) verificadas' : ''));
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

      // Amarrar los renglones de la solicitud con su orden. Sin esto
      // no se puede saber si lo que falta para un rancho ya llego.
      const ids = grupo.items.map(p => p.producto_id).filter(Boolean);
      if (ids.length) {
        await db.from('solicitud_lineas').update({ oc_id: oc.id })
          .eq('solicitud_id', g.sol.id).in('producto_id', ids);
      }
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
