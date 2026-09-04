// ═══════════════════════════════════════════════════════════════════
//  evidencias.js — las fotos de vales y facturas, dentro del sistema
//
//  Hasta hoy las 241 fotos de los documentos en papel vivían sueltas en
//  una carpeta del escritorio. El ERP guardaba el NOMBRE del archivo,
//  pero no el archivo. Si alguien pregunta "¿de dónde salió este
//  movimiento?", la respuesta estaba en otra computadora.
//
//  Este archivo hace tres cosas:
//
//  1. SUBE. Una pantalla donde se elige la carpeta completa y se suben
//     solo las fotos que el sistema está esperando. No sube fotos que
//     no correspondan a nada, ni vuelve a subir las que ya están.
//
//  2. RESUELVE. La app venía tratando foto_evidencia como si fuera una
//     URL. Ahora casi siempre es un nombre de archivo, así que hay que
//     pedirle a Supabase una liga firmada antes de mostrarla. Se
//     resuelve al vuelo y se guarda en memoria para no pedir la misma
//     dos veces.
//
//  3. AVISA. Dice cuántas evidencias faltan y a cuántos renglones de
//     movimiento respaldan, para saber qué tan documentado está el
//     historial.
//
//  El archivo nunca sale del navegador de quien sube: la sesión es la
//  suya, y las claves nunca pasan por ningún otro lado.
// ═══════════════════════════════════════════════════════════════════

const EV_BUCKET = 'evidencias';
const evUrlCache = new Map();      // nombre de archivo -> liga firmada
let evLista = null;                // v_evidencias, cargada una vez

// ── 1 · Resolver un nombre de archivo a una liga que se pueda ver ───

function evEsUrl(v) {
  return typeof v === 'string' && /^(https?:|data:|blob:)/i.test(v);
}

async function evidenciaURL(nombre) {
  if (!nombre) return null;
  if (evEsUrl(nombre)) return nombre;              // ya era una URL
  if (evUrlCache.has(nombre)) return evUrlCache.get(nombre);
  try {
    const { data, error } = await db.storage.from(EV_BUCKET)
      .createSignedUrl(nombre, 60 * 60);           // una hora basta
    if (error) throw error;
    evUrlCache.set(nombre, data.signedUrl);
    return data.signedUrl;
  } catch (e) {
    console.warn('[evidencias] no se pudo firmar', nombre, e.message);
    return null;
  }
}

// Reemplaza verFoto sin tocar app.js. Acepta URL o nombre de archivo.
(function engancharVerFoto() {
  const orig = window.verFoto;
  window.verFoto = async function (v) {
    const url = await evidenciaURL(v);
    if (!url) {
      if (typeof toast === 'function')
        toast('Esa foto todavía no está en el sistema. Súbela desde Evidencias.');
      return;
    }
    if (typeof orig === 'function') return orig(url);
    const modal = document.getElementById('foto-modal');
    const img = document.getElementById('foto-modal-img');
    if (modal && img) { img.src = url; modal.classList.remove('hidden'); }
  };
})();

// Algunas pantallas pintan <img src="IMG_....jpg"> directo. Eso da 404
// silencioso. Aquí se buscan y se les cambia la liga por la firmada.
async function evResolverImgs(raiz) {
  const imgs = (raiz || document).querySelectorAll('img[src]');
  for (const img of imgs) {
    const v = img.getAttribute('src') || '';
    if (evEsUrl(v) || !/\.(jpe?g|png|webp)$/i.test(v) || v.includes('/')) continue;
    const url = await evidenciaURL(v);
    if (url) img.src = url;
    else { img.alt = 'Evidencia no subida'; img.style.display = 'none'; }
  }
}

// ── 2 · Qué evidencias espera el sistema ────────────────────────────

async function evCargarLista(forzar) {
  if (evLista && !forzar) return evLista;
  const { data, error } = await db.from('v_evidencias').select('*').limit(1000);
  if (error) throw error;
  evLista = data || [];
  return evLista;
}

// Qué hay ya subido en el bucket, para no volver a subirlo
async function evYaEnBucket() {
  const nombres = new Set();
  let desde = 0;
  for (;;) {
    const { data, error } = await db.storage.from(EV_BUCKET)
      .list('', { limit: 1000, offset: desde });
    if (error) throw error;
    (data || []).forEach(o => { if (o.name) nombres.add(o.name); });
    if (!data || data.length < 1000) break;
    desde += 1000;
  }
  return nombres;
}


// ── 3 · La pantalla ─────────────────────────────────────────────────

async function cargarEvidencias() {
  const cont = document.getElementById('ev-content');
  if (!cont) return;
  cont.innerHTML = '<div class="loading">Revisando qué evidencias faltan…</div>';

  let lista, enBucket;
  try {
    lista = await evCargarLista(true);
    enBucket = await evYaEnBucket();
  } catch (e) {
    cont.innerHTML = `<div class="empty">No se pudo leer el catálogo de evidencias.<br>
      <span class="hint">${e.message}. Revisa que el SQL 20 ya esté corrido.</span></div>`;
    return;
  }

  const total    = lista.length;
  const subidas  = lista.filter(e => enBucket.has(e.archivo)).length;
  const faltan   = total - subidas;
  const renglones = lista.reduce((s, e) => s + (e.renglones || 0), 0);
  const renglonesSinRespaldo = lista.filter(e => !enBucket.has(e.archivo))
                                    .reduce((s, e) => s + (e.renglones || 0), 0);

  const porTipo = {};
  lista.forEach(e => {
    const t = e.tipo || 'otro';
    porTipo[t] = porTipo[t] || { total: 0, subidas: 0 };
    porTipo[t].total++;
    if (enBucket.has(e.archivo)) porTipo[t].subidas++;
  });

  cont.innerHTML = `
    <div class="card">
      <div class="card-header">Estado de las evidencias</div>
      <div class="metrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:6px">
        <div class="metric-card" style="padding:14px">
          <div class="metric-label">Documentos</div>
          <div class="metric-val">${total}</div>
        </div>
        <div class="metric-card" style="padding:14px">
          <div class="metric-label">Ya en el sistema</div>
          <div class="metric-val" style="color:var(--green)">${subidas}</div>
        </div>
        <div class="metric-card" style="padding:14px">
          <div class="metric-label">Faltan</div>
          <div class="metric-val" style="color:${faltan ? 'var(--red)' : 'var(--green)'}">${faltan}</div>
        </div>
        <div class="metric-card" style="padding:14px">
          <div class="metric-label">Renglones sin respaldo</div>
          <div class="metric-val">${renglonesSinRespaldo}</div>
        </div>
      </div>
      <div class="hint">
        ${renglones} renglones de movimiento se apoyan en estos ${total} documentos.
        ${faltan ? `Mientras falten ${faltan}, hay ${renglonesSinRespaldo} renglones que nadie puede comprobar desde el sistema.` : 'Todo el historial tiene su papel detrás.'}
      </div>
    </div>

    <div class="card">
      <div class="card-header">Subir</div>
      <p class="hint" style="margin-bottom:12px">
        Elige la carpeta completa donde tienes las fotos. El sistema toma
        solo las que está esperando por nombre; ignora todo lo demás y no
        vuelve a subir lo que ya está.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input type="file" id="ev-files" multiple accept="image/*,application/pdf"
               webkitdirectory directory style="display:none" onchange="evPrepararSubida(this.files)">
        <input type="file" id="ev-files-sueltos" multiple accept="image/*,application/pdf"
               style="display:none" onchange="evPrepararSubida(this.files)">
        <button class="btn btn-primary" onclick="document.getElementById('ev-files').click()">
          Elegir carpeta
        </button>
        <button class="btn" onclick="document.getElementById('ev-files-sueltos').click()">
          Elegir archivos sueltos
        </button>
        <button class="btn btn-sm" onclick="cargarEvidencias()">↻ Revisar de nuevo</button>
      </div>
      <div id="ev-progreso" style="margin-top:14px"></div>
    </div>

    <div class="card">
      <div class="card-header">Documentos ${faltan ? '· faltan ' + faltan : '· completo'}</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px">
        ${Object.entries(porTipo).map(([t, v]) => `
          <span class="badge ${v.subidas === v.total ? 'badge-ok' : 'badge-warn'}">
            ${t} ${v.subidas}/${v.total}
          </span>`).join('')}
      </div>
      <div style="max-height:520px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">
        ${lista
          .slice()
          .sort((a, b) => (enBucket.has(a.archivo) ? 1 : 0) - (enBucket.has(b.archivo) ? 1 : 0)
                       || String(a.folio_vale || '').localeCompare(String(b.folio_vale || '')))
          .map(e => evRenglon(e, enBucket.has(e.archivo))).join('')}
      </div>
    </div>`;
}

function evRenglon(e, subida) {
  return `<div class="mov-item" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
      <div style="min-width:0">
        <div class="mov-name">${e.folio_vale || e.archivo}</div>
        <div class="mov-meta">
          ${e.fecha || 'sin fecha'} · ${e.destinos || ''} ·
          ${e.renglones} renglón(es) · <span class="folio">${e.archivo}</span>
        </div>
      </div>
      <div style="white-space:nowrap;display:flex;gap:8px;align-items:center">
        ${subida
          ? `<button class="btn btn-sm" onclick="verFoto('${e.archivo}')">Ver</button>
             <span class="badge badge-ok">En el sistema</span>`
          : `<span class="badge badge-warn">Falta subir</span>`}
      </div>
    </div>`;
}


// ── 4 · La subida ───────────────────────────────────────────────────

async function evPrepararSubida(archivos) {
  const prog = document.getElementById('ev-progreso');
  if (!prog || !archivos || !archivos.length) return;

  let lista, enBucket;
  try {
    lista = await evCargarLista();
    enBucket = await evYaEnBucket();
  } catch (e) {
    prog.innerHTML = `<div class="empty">No se pudo revisar el bucket: ${e.message}</div>`;
    return;
  }

  const esperados = new Set(lista.map(e => e.archivo));
  const elegidos = Array.from(archivos);

  // Se comparan solo por nombre de archivo, sin la ruta de la carpeta.
  const aSubir = elegidos.filter(f => esperados.has(f.name) && !enBucket.has(f.name));
  const yaEstaban = elegidos.filter(f => esperados.has(f.name) && enBucket.has(f.name)).length;
  const ajenos = elegidos.length - aSubir.length - yaEstaban;

  if (!aSubir.length) {
    prog.innerHTML = `<div class="empty">
      Nada nuevo que subir.<br>
      <span class="hint">De ${elegidos.length} archivos elegidos: ${yaEstaban} ya estaban en el sistema
      y ${ajenos} no corresponden a ningún movimiento registrado.</span></div>`;
    return;
  }

  prog.innerHTML = `
    <div class="hint" style="margin-bottom:8px">
      Se van a subir <b>${aSubir.length}</b> de ${elegidos.length} archivos elegidos.
      ${yaEstaban ? yaEstaban + ' ya estaban. ' : ''}${ajenos ? ajenos + ' no corresponden a nada registrado y se ignoran.' : ''}
    </div>
    <div style="background:var(--border-2);border-radius:999px;height:8px;overflow:hidden;margin-bottom:8px">
      <div id="ev-barra" style="height:100%;width:0;background:var(--navy2);transition:width .2s"></div>
    </div>
    <div id="ev-estado" class="hint"></div>
    <div id="ev-errores" style="margin-top:8px"></div>`;

  await evSubir(aSubir);
}

async function evSubir(archivos) {
  const barra   = document.getElementById('ev-barra');
  const estado  = document.getElementById('ev-estado');
  const errBox  = document.getElementById('ev-errores');
  const fallos  = [];
  let hechos = 0;

  for (const f of archivos) {
    estado.textContent = `Subiendo ${f.name}… (${hechos + 1} de ${archivos.length})`;
    try {
      // upsert:false a proposito. Si el archivo ya existe, se respeta el
      // que ya estaba: una evidencia no se pisa en silencio.
      const { error } = await db.storage.from(EV_BUCKET).upload(f.name, f, {
        upsert: false, cacheControl: '31536000',
        contentType: f.type || 'image/jpeg',
      });
      if (error && !/exists/i.test(error.message)) throw error;

      // Marcar los movimientos que se apoyan en esta foto
      const { error: e2 } = await db.from('movimientos')
        .update({ evidencia_path: f.name })
        .eq('foto_evidencia', f.name)
        .is('evidencia_path', null);
      if (e2) throw e2;

    } catch (e) {
      fallos.push({ nombre: f.name, motivo: e.message });
    }
    hechos++;
    if (barra) barra.style.width = Math.round(hechos / archivos.length * 100) + '%';
  }

  estado.innerHTML = fallos.length
    ? `<b>${hechos - fallos.length}</b> subidas · <b style="color:var(--red)">${fallos.length}</b> fallaron.`
    : `<b style="color:var(--green)">Listo.</b> ${hechos} evidencias quedaron en el sistema.`;

  if (fallos.length) {
    errBox.innerHTML = `<div class="card" style="background:var(--red-bg);border-color:#f2cbc8">
        <div class="card-header" style="color:var(--red);border:none;margin:0;padding:0">No se pudieron subir</div>
        ${fallos.slice(0, 12).map(f => `<div class="hint">${f.nombre} — ${f.motivo}</div>`).join('')}
        ${fallos.length > 12 ? `<div class="hint">y ${fallos.length - 12} más</div>` : ''}
      </div>`;
  }

  evUrlCache.clear();
  setTimeout(cargarEvidencias, 900);
}


// ── 5 · Registrar la pestaña ────────────────────────────────────────
// app.js reconstruye TAB_LOADERS dentro de goTo cada vez que se cambia
// de pestaña ("TAB_LOADERS = loaders"), así que registrar el loader una
// sola vez al arrancar no sirve: la siguiente navegación lo borra.
// Por eso se vuelve a poner DESPUÉS de cada goTo, y se dispara la carga
// a mano cuando la pestaña que se abre es la de evidencias.
(function engancharPestanaEvidencias() {
  const orig = window.goTo;
  if (typeof orig !== 'function') return;
  window.goTo = function (tab) {
    const r = orig.apply(this, arguments);
    if (typeof TAB_LOADERS === 'object' && TAB_LOADERS) TAB_LOADERS.evidencias = cargarEvidencias;
    if (tab === 'evidencias') cargarEvidencias();
    setTimeout(() => evResolverImgs(), 250);
    return r;
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (typeof TAB_LOADERS === 'object' && TAB_LOADERS) TAB_LOADERS.evidencias = cargarEvidencias;
  setTimeout(() => evResolverImgs(), 600);
});
