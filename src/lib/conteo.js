// =====================================================
//  CONTEO FÍSICO v17 — Rediseñado completamente
//  Flujo: Iniciar → Contar → Revisar diferencias →
//         Decidir ajuste por ajuste → Firmar PDF
// =====================================================

let conteoEnCurso = null; // { id, fecha, productos: [], estado }
const CONTEO_KEY = 'lasnaves_conteo_activo';

// ── PASO 1: INICIAR CONTEO ────────────────────────────
async function iniciarNuevoConteo() {
  if (conteoEnCurso && conteoEnCurso.estado === 'en_curso') {
    if (!confirm('Ya tienes un conteo en curso. ¿Descartarlo y comenzar uno nuevo?')) return;
  }

  const prods = await API.getProductos(almacenActivo?.id);
  if (!prods.length) { toast('No hay productos en el inventario'); return; }

  conteoEnCurso = {
    id: Date.now(),
    fecha: new Date().toLocaleString('es-MX'),
    almacen: almacenActivo?.nombre || 'Almacén principal',
    usuario: currentProfile?.nombre || currentUser?.email,
    productos: prods.map(p => ({
      id: p.id,
      nombre: p.nombre,
      unidad: p.unidad || '',
      ubicacion: p.ubicacion || '',
      stock_sistema: Number(p.stock),
      stock_fisico: null, // null = no contado aún
    })),
    estado: 'en_curso',
  };

  // Guardar en localStorage por si se cierra accidentalmente
  localStorage.setItem(CONTEO_KEY, JSON.stringify(conteoEnCurso));
  renderConteoEnCurso();
}

function recuperarConteo() {
  try {
    const guardado = localStorage.getItem(CONTEO_KEY);
    if (!guardado) return false;
    conteoEnCurso = JSON.parse(guardado);
    if (conteoEnCurso?.estado === 'en_curso') {
      renderConteoEnCurso();
      return true;
    }
  } catch {}
  return false;
}

// ── PASO 2: INTERFAZ DE CONTEO ────────────────────────
function renderConteoEnCurso() {
  const contados   = conteoEnCurso.productos.filter(p => p.stock_fisico !== null).length;
  const total      = conteoEnCurso.productos.length;
  const porcentaje = Math.round((contados / total) * 100);

  document.getElementById('conteo-inicio').classList.add('hidden');
  document.getElementById('conteo-activo').classList.remove('hidden');
  document.getElementById('conteo-revision').classList.add('hidden');

  document.getElementById('conteo-progreso-bar').style.width = porcentaje + '%';
  document.getElementById('conteo-progreso-txt').textContent = `${contados} de ${total} productos contados (${porcentaje}%)`;
  document.getElementById('conteo-fecha').textContent = conteoEnCurso.fecha;

  const lista = document.getElementById('conteo-lista');
  lista.innerHTML = conteoEnCurso.productos.map((p, i) => {
    const contado = p.stock_fisico !== null;
    const diff    = contado ? p.stock_fisico - p.stock_sistema : null;
    return `<div class="conteo-fila ${contado?'contado':''}" id="cf-${i}">
      <div class="conteo-fila-info">
        <div class="conteo-fila-nombre">${p.nombre}</div>
        <div class="conteo-fila-sub">
          Sistema: <strong>${p.stock_sistema} ${p.unidad}</strong>
          ${p.ubicacion ? ` · 📍 ${p.ubicacion}` : ''}
        </div>
      </div>
      <div class="conteo-fila-derecha">
        ${contado
          ? `<div class="conteo-fisico-val ${diff>0?'pos':diff<0?'neg':'igual'}">
               ${p.stock_fisico} ${p.unidad}
               <span class="conteo-diff">${diff>0?'+':diff<0?'':''  }${diff!==0?diff+' '+p.unidad:'✓ OK'}</span>
             </div>
             <button class="btn btn-sm" onclick="editarConteo(${i})">Editar</button>`
          : `<div style="display:flex;gap:6px;align-items:center">
               <input class="input conteo-input" type="number" min="0" step="0.01"
                 id="fi-${i}" placeholder="Cant. física"
                 onkeydown="if(event.key==='Enter')guardarLinea(${i})">
               <button class="btn btn-sm btn-primary" onclick="guardarLinea(${i})">✓</button>
             </div>`
        }
      </div>
    </div>`;
  }).join('');

  // Botón finalizar solo si hay al menos un producto contado
  const btnFin = document.getElementById('btn-finalizar-conteo');
  btnFin.disabled = contados === 0;
  btnFin.textContent = contados < total
    ? `Revisar diferencias (${contados} contados, ${total-contados} pendientes)`
    : 'Revisar diferencias y ajustar stock';
}

function guardarLinea(i) {
  const input = document.getElementById('fi-' + i);
  if (!input) return;
  const val = parseFloat(input.value);
  if (isNaN(val) || val < 0) { toast('Ingresa una cantidad válida (0 o más)'); input.focus(); return; }
  conteoEnCurso.productos[i].stock_fisico = val;
  localStorage.setItem(CONTEO_KEY, JSON.stringify(conteoEnCurso));
  renderConteoEnCurso();
  // Enfocar el siguiente no contado
  const siguientes = conteoEnCurso.productos.slice(i+1).findIndex(p => p.stock_fisico === null);
  if (siguientes >= 0) {
    setTimeout(() => {
      const next = document.getElementById('fi-' + (i + 1 + siguientes));
      next?.focus(); next?.scrollIntoView({behavior:'smooth', block:'nearest'});
    }, 100);
  }
}

function editarConteo(i) {
  conteoEnCurso.productos[i].stock_fisico = null;
  localStorage.setItem(CONTEO_KEY, JSON.stringify(conteoEnCurso));
  renderConteoEnCurso();
  setTimeout(() => document.getElementById('fi-' + i)?.focus(), 100);
}

function descartarConteo() {
  if (!confirm('¿Descartar el conteo en curso? Se perderán todos los datos ingresados.')) return;
  conteoEnCurso = null;
  localStorage.removeItem(CONTEO_KEY);
  renderPantallaInicio();
}

// ── PASO 3: REVISIÓN DE DIFERENCIAS ──────────────────
function revisarDiferencias() {
  const contados = conteoEnCurso.productos.filter(p => p.stock_fisico !== null);
  const conDiff  = contados.filter(p => p.stock_fisico !== p.stock_sistema);
  const sinDiff  = contados.filter(p => p.stock_fisico === p.stock_sistema);

  document.getElementById('conteo-inicio').classList.add('hidden');
  document.getElementById('conteo-activo').classList.add('hidden');
  document.getElementById('conteo-revision').classList.remove('hidden');

  const pendientes = conteoEnCurso.productos.filter(p => p.stock_fisico === null).length;

  document.getElementById('rev-resumen').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:14px">
      <div class="metric-card"><div class="metric-icon green"><span>✓</span></div><div class="metric-body"><div class="metric-val">${sinDiff.length}</div><div class="metric-label">Sin diferencia</div></div></div>
      <div class="metric-card"><div class="metric-icon ${conDiff.length?'red':'green'}"><span>${conDiff.length?'⚠':'✓'}</span></div><div class="metric-body"><div class="metric-val">${conDiff.length}</div><div class="metric-label">Con diferencia</div></div></div>
      <div class="metric-card"><div class="metric-icon amber"><span>⏳</span></div><div class="metric-body"><div class="metric-val">${pendientes}</div><div class="metric-label">Sin contar</div></div></div>
    </div>
  `;

  if (!conDiff.length) {
    document.getElementById('rev-diffs').innerHTML = '<div class="empty" style="color:var(--green)">✓ ¡Todo cuadra! No hay diferencias entre el sistema y el conteo físico.</div>';
  } else {
    document.getElementById('rev-diffs').innerHTML = conDiff.map((p, i) => {
      const diff = p.stock_fisico - p.stock_sistema;
      const idx  = conteoEnCurso.productos.indexOf(p);
      return `<div class="rev-item" id="rev-${idx}">
        <div class="rev-info">
          <div class="rev-nombre">${p.nombre}</div>
          <div class="rev-detalle">
            Sistema: <strong>${p.stock_sistema} ${p.unidad}</strong>
            &nbsp;→&nbsp;
            Físico: <strong>${p.stock_fisico} ${p.unidad}</strong>
            &nbsp;·&nbsp;
            <span class="${diff>0?'diff-pos':'diff-neg'}">${diff>0?'+':''}${diff} ${p.unidad}</span>
          </div>
        </div>
        <div class="rev-acciones">
          <button class="btn btn-sm btn-primary" onclick="ajustarUno(${idx})" id="btn-aj-${idx}">
            Ajustar stock → ${p.stock_fisico} ${p.unidad}
          </button>
          <button class="btn btn-sm" onclick="ignorarUno(${idx})" id="btn-ig-${idx}">
            Ignorar
          </button>
        </div>
      </div>`;
    }).join('');
  }
}

async function ajustarUno(idx) {
  const p = conteoEnCurso.productos[idx];
  try {
    const diff = p.stock_fisico - p.stock_sistema;
    await API.updateStock(p.id, p.stock_fisico);
    // Registrar como movimiento
    const mov = {
      tipo: diff > 0 ? 'entrada' : 'salida',
      id_producto: p.id, nombre: p.nombre,
      cantidad: Math.abs(diff), unidad: p.unidad,
      usuario_id: currentUser.id,
      usuario_nombre: currentProfile?.nombre || currentUser.email,
      destino: 'Ajuste por conteo físico',
      nota: `Conteo físico: sistema=${p.stock_sistema}, físico=${p.stock_fisico}`,
      stock_resultante: p.stock_fisico,
      almacen_id: almacenActivo?.id,
      created_at: new Date().toISOString(),
    };
    await API.addMovimiento(mov);
    p.stock_sistema = p.stock_fisico; // Actualizar en memoria
    p.ajustado = true;
    toast(`✓ Stock ajustado: ${p.nombre} → ${p.stock_fisico} ${p.unidad}`);
    // Marcar visualmente
    const btn = document.getElementById('btn-aj-' + idx);
    const btnIg = document.getElementById('btn-ig-' + idx);
    if (btn) { btn.textContent = '✓ Ajustado'; btn.disabled = true; btn.classList.add('btn-green'); }
    if (btnIg) btnIg.disabled = true;
    document.getElementById('rev-' + idx)?.classList.add('rev-ajustado');
  } catch(e) { toast('Error al ajustar: ' + e.message); }
}

function ignorarUno(idx) {
  const p = conteoEnCurso.productos[idx];
  p.ignorado = true;
  const btn = document.getElementById('btn-ig-' + idx);
  const btnAj = document.getElementById('btn-aj-' + idx);
  if (btn) { btn.textContent = '✓ Ignorado'; btn.disabled = true; }
  if (btnAj) btnAj.disabled = true;
  document.getElementById('rev-' + idx)?.classList.add('rev-ignorado');
  toast('Diferencia ignorada: ' + p.nombre);
}

// ── PASO 4: GENERAR PDF CON FIRMA ─────────────────────
function generarPDFConteo() {
  const contados = conteoEnCurso.productos.filter(p => p.stock_fisico !== null);
  const conDiff  = contados.filter(p => p.stock_fisico !== p.stock_sistema);
  const sinDiff  = contados.filter(p => p.stock_fisico === p.stock_sistema);

  const filas = contados.map(p => {
    const diff = p.stock_fisico - p.stock_sistema;
    const estado = p.ajustado ? 'Ajustado' : p.ignorado ? 'Ignorado' : diff === 0 ? 'OK' : 'Pendiente';
    return `<tr>
      <td>${p.nombre}</td>
      <td style="text-align:center">${p.stock_sistema} ${p.unidad}</td>
      <td style="text-align:center;font-weight:600">${p.stock_fisico} ${p.unidad}</td>
      <td style="text-align:center;color:${diff>0?'#16a34a':diff<0?'#dc2626':'#6b7280'};font-weight:${diff!==0?'600':'400'}">${diff>0?'+':''}${diff} ${p.unidad}</td>
      <td style="text-align:center"><span style="background:${estado==='OK'?'#f0faf3':estado==='Ajustado'?'#eff6ff':estado==='Ignorado'?'#f9fafb':'#fff7ed'};color:${estado==='OK'?'#16a34a':estado==='Ajustado'?'#2563eb':estado==='Ignorado'?'#6b7280':'#d97706'};padding:2px 8px;border-radius:20px;font-size:11px">${estado}</span></td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Conteo Físico — Las Naves Agrícola</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:24px;max-width:900px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f2a5c;padding-bottom:14px;margin-bottom:20px}
  .logo-area h1{font-size:18px;color:#0f2a5c;margin:0}
  .logo-area p{font-size:11px;color:#666;margin:3px 0 0}
  .doc-info{text-align:right;font-size:11px;color:#666}
  .resumen{display:flex;gap:16px;margin-bottom:18px}
  .res-box{border:1px solid #e5e5e3;border-radius:8px;padding:10px 16px;flex:1;text-align:center}
  .res-num{font-size:20px;font-weight:700;color:#0f2a5c}
  .res-label{font-size:10px;color:#666;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{background:#0f2a5c;color:#fff;padding:7px 8px;text-align:left;font-size:10px}
  td{padding:6px 8px;border-bottom:1px solid #e5e5e3;font-size:11px}
  tr:nth-child(even){background:#f9f9f9}
  .firmas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
  .firma-box{border-top:1px solid #111;padding-top:8px;text-align:center;font-size:11px;color:#666}
  @media print{body{padding:12px}.no-print{display:none}}
</style></head><body>
<div class="header">
  <div class="logo-area">
    <h1>Las Naves Agrícola</h1>
    <p>Reporte de Conteo Físico — ${conteoEnCurso.almacen}</p>
  </div>
  <div class="doc-info">
    <div><strong>Fecha:</strong> ${conteoEnCurso.fecha}</div>
    <div><strong>Responsable:</strong> ${conteoEnCurso.usuario}</div>
    <div><strong>Folio:</strong> CF-${conteoEnCurso.id}</div>
  </div>
</div>

<div class="resumen">
  <div class="res-box"><div class="res-num">${contados.length}</div><div class="res-label">Productos contados</div></div>
  <div class="res-box"><div class="res-num" style="color:#16a34a">${sinDiff.length}</div><div class="res-label">Sin diferencia</div></div>
  <div class="res-box"><div class="res-num" style="color:${conDiff.length?'#dc2626':'#16a34a'}">${conDiff.length}</div><div class="res-label">Con diferencia</div></div>
  <div class="res-box"><div class="res-num" style="color:#2563eb">${contados.filter(p=>p.ajustado).length}</div><div class="res-label">Ajustados</div></div>
</div>

<table>
  <thead><tr><th>Producto</th><th style="text-align:center">Stock sistema</th><th style="text-align:center">Stock físico</th><th style="text-align:center">Diferencia</th><th style="text-align:center">Estado</th></tr></thead>
  <tbody>${filas}</tbody>
</table>

<div class="firmas">
  <div class="firma-box"><br><br><br>${conteoEnCurso.usuario}<br>Responsable del conteo</div>
  <div class="firma-box"><br><br><br>______________________<br>Visto Bueno / Supervisor</div>
</div>

<div style="margin-top:20px;font-size:9px;color:#999;text-align:center">
  Generado el ${new Date().toLocaleString('es-MX')} · Las Naves Agrícola · Sistema ERP Almacén de Químicos
</div>

<script>window.onload=()=>window.print()<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

// ── FINALIZAR CONTEO ──────────────────────────────────
async function finalizarConteo() {
  // Guardar en auditoría
  const contados = conteoEnCurso.productos.filter(p => p.stock_fisico !== null);
  const ajustados = contados.filter(p => p.ajustado).length;
  await API.addAuditoria({
    tipo: 'ajuste',
    descripcion: `Conteo físico finalizado: ${contados.length} productos contados, ${ajustados} ajustados`,
    usuario_id: currentUser.id,
    usuario_nombre: currentProfile?.nombre || currentUser.email,
    metadata: { folio: 'CF-' + conteoEnCurso.id, almacen: conteoEnCurso.almacen }
  });
  conteoEnCurso = null;
  localStorage.removeItem(CONTEO_KEY);
  todosProductos = [];
  toast('✓ Conteo finalizado y guardado');
  renderPantallaInicio();
  cargarDashboard();
}

// ── PANTALLAS ─────────────────────────────────────────
function renderPantallaInicio() {
  document.getElementById('conteo-inicio').classList.remove('hidden');
  document.getElementById('conteo-activo').classList.add('hidden');
  document.getElementById('conteo-revision').classList.add('hidden');
}

function cargarConteo() {
  // Intentar recuperar conteo guardado
  if (!recuperarConteo()) {
    renderPantallaInicio();
  }
}
