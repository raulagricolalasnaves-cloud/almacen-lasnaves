// =====================================================
//  PROVEEDORES v8
//  Directorio, evaluaciones y tiempos de entrega
// =====================================================

let proveedorSeleccionado = null;
let evalScores = { puntualidad: 0, calidad: 0, precio: 0 };

// ── CARGAR LISTA ──────────────────────────────────────
async function cargarProveedores() {
  document.getElementById('prov-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const provs = await API.getProveedores();
    if (!provs.length) {
      document.getElementById('prov-lista').innerHTML = '<div class="empty">Sin proveedores registrados</div>';
      return;
    }
    document.getElementById('prov-lista').innerHTML = provs.map(p => renderProvCard(p)).join('');
  } catch { document.getElementById('prov-lista').innerHTML = '<div class="empty">Error al cargar</div>'; }
}

function renderProvCard(p) {
  return `<div class="prov-card">
    <div class="prov-header">
      <div>
        <div class="prov-name">${p.nombre}</div>
        ${p.rfc ? `<div class="prov-rfc">RFC: ${p.rfc}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm" onclick="verDetalleProveedor('${p.id}')">Ver detalle</button>
        <button class="btn btn-sm btn-primary" onclick="abrirEvaluar('${p.id}','${p.nombre}')">⭐ Evaluar</button>
      </div>
    </div>
    <div class="prov-info">
      ${p.telefono ? `<div class="prov-info-item">📞 <span>${p.telefono}</span></div>` : ''}
      ${p.correo   ? `<div class="prov-info-item">✉ <span>${p.correo}</span></div>` : ''}
      ${p.direccion? `<div class="prov-info-item">📍 <span>${p.direccion}</span></div>` : ''}
    </div>
    ${p.productos ? `<div class="prov-productos">🧪 Productos: ${p.productos}</div>` : ''}
  </div>`;
}

// ── DETALLE DEL PROVEEDOR ─────────────────────────────
async function verDetalleProveedor(id) {
  proveedorSeleccionado = await API.getProveedor(id);
  if (!proveedorSeleccionado) return;

  const [evals, pedidos] = await Promise.all([
    API.getEvaluaciones(id),
    API.getPedidosByProveedor(id)
  ]);

  // Calcular promedios
  let promPunt=0, promCal=0, promPrec=0;
  if (evals.length) {
    promPunt = (evals.reduce((s,e)=>s+e.puntualidad,0)/evals.length).toFixed(1);
    promCal  = (evals.reduce((s,e)=>s+e.calidad,0)/evals.length).toFixed(1);
    promPrec = (evals.reduce((s,e)=>s+e.precio,0)/evals.length).toFixed(1);
  }

  const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5-Math.round(n));

  // Tiempos de entrega
  const tiemposHtml = pedidos.length
    ? pedidos.map(p => {
        let diasDiff = '—', cls = 'tiempo-pend', label = 'Pendiente';
        if (p.fecha_estimada && p.fecha_entrega_real) {
          const est  = new Date(p.fecha_estimada);
          const real = new Date(p.fecha_entrega_real);
          const diff = Math.round((real-est)/(1000*60*60*24));
          diasDiff = diff === 0 ? 'A tiempo' : diff > 0 ? `${diff} días tarde` : `${Math.abs(diff)} días antes`;
          cls   = diff <= 0 ? 'tiempo-ok' : 'tiempo-late';
          label = diasDiff;
        } else if (p.estado === 'Entregado') {
          label = 'Entregado (sin fecha)'; cls = 'tiempo-pend';
        }
        return `<div class="tiempo-item">
          <div>${p.num||'PED'} · ${new Date(p.created_at).toLocaleDateString('es-MX')}</div>
          <div class="${cls}">${label}</div>
        </div>`;
      }).join('')
    : '<div class="empty">Sin pedidos registrados</div>';

  // Historial de evaluaciones
  const evalsHtml = evals.length
    ? evals.map(e => `<div class="eval-item">
        <div class="eval-scores">
          <span class="eval-badge punt">Puntualidad: ${e.puntualidad}/5</span>
          <span class="eval-badge cal">Calidad: ${e.calidad}/5</span>
          <span class="eval-badge prec">Precio: ${e.precio}/5</span>
        </div>
        ${e.comentario ? `<div style="font-size:12px;color:var(--text2);margin-top:4px">"${e.comentario}"</div>` : ''}
        <div style="font-size:11px;color:var(--text3);margin-top:4px">${e.usuario_nombre||'—'} · ${new Date(e.created_at).toLocaleDateString('es-MX')}</div>
      </div>`).join('')
    : '<div class="empty">Sin evaluaciones aún</div>';

  document.getElementById('prov-detalle-content').innerHTML = `
    <div class="page-header" style="margin-bottom:14px">
      <div class="page-title">${proveedorSeleccionado.nombre}</div>
      <button class="btn btn-sm" onclick="cerrarDetalle()">← Volver</button>
    </div>

    <div class="card">
      <div class="card-header">Información de contacto</div>
      <div class="prov-info" style="grid-template-columns:1fr">
        ${proveedorSeleccionado.telefono?`<div class="prov-info-item">📞 Teléfono: <span>${proveedorSeleccionado.telefono}</span></div>`:''}
        ${proveedorSeleccionado.correo?`<div class="prov-info-item">✉ Correo: <span>${proveedorSeleccionado.correo}</span></div>`:''}
        ${proveedorSeleccionado.direccion?`<div class="prov-info-item">📍 Dirección: <span>${proveedorSeleccionado.direccion}</span></div>`:''}
        ${proveedorSeleccionado.rfc?`<div class="prov-info-item">🏢 RFC: <span>${proveedorSeleccionado.rfc}</span></div>`:''}
        ${proveedorSeleccionado.productos?`<div class="prov-info-item">🧪 Productos: <span>${proveedorSeleccionado.productos}</span></div>`:''}
      </div>
    </div>

    ${evals.length ? `
    <div class="card">
      <div class="card-header">Calificación promedio</div>
      <div class="prov-promedio">
        <div class="prom-item"><div class="prom-val">${promPunt}</div><div class="prom-stars">${stars(promPunt)}</div><div class="prom-label">Puntualidad</div></div>
        <div class="prom-item"><div class="prom-val">${promCal}</div><div class="prom-stars">${stars(promCal)}</div><div class="prom-label">Calidad</div></div>
        <div class="prom-item"><div class="prom-val">${promPrec}</div><div class="prom-stars">${stars(promPrec)}</div><div class="prom-label">Precio</div></div>
        <div class="prom-item"><div class="prom-val">${evals.length}</div><div class="prom-label">Evaluaciones</div></div>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-header">Tiempos de entrega</div>
      ${tiemposHtml}
    </div>

    <div class="card">
      <div class="card-header">Historial de evaluaciones</div>
      <button class="btn btn-primary btn-full" style="margin-bottom:12px" onclick="abrirEvaluar('${proveedorSeleccionado.id}','${proveedorSeleccionado.nombre}')">⭐ Nueva evaluación</button>
      ${evalsHtml}
    </div>
  `;

  document.getElementById('prov-lista-view').classList.add('hidden');
  document.getElementById('prov-detalle-view').classList.remove('hidden');
}

function cerrarDetalle() {
  document.getElementById('prov-detalle-view').classList.add('hidden');
  document.getElementById('prov-lista-view').classList.remove('hidden');
  proveedorSeleccionado = null;
  cargarProveedores();
}

// ── EVALUACIÓN ────────────────────────────────────────
function abrirEvaluar(id, nombre) {
  evalScores = { puntualidad: 0, calidad: 0, precio: 0 };
  document.getElementById('eval-prov-id').value   = id;
  document.getElementById('eval-prov-nombre').textContent = nombre;
  document.getElementById('eval-comentario').value = '';
  document.getElementById('eval-pedido').value     = '';
  ['puntualidad','calidad','precio'].forEach(k => renderStars(k, 0));
  document.getElementById('modal-evaluar').classList.remove('hidden');
}

function cerrarEvaluar() {
  document.getElementById('modal-evaluar').classList.add('hidden');
}

function renderStars(campo, valor) {
  const cont = document.getElementById(`stars-${campo}`);
  if (!cont) return;
  cont.innerHTML = [1,2,3,4,5].map(i =>
    `<span class="star ${i<=valor?'active':''}" onclick="setEval('${campo}',${i})" onmouseover="hoverStars('${campo}',${i})" onmouseout="renderStars('${campo}',${evalScores[campo]})">${i<=valor?'★':'☆'}</span>`
  ).join('');
}

function hoverStars(campo, val) {
  const cont = document.getElementById(`stars-${campo}`);
  if (!cont) return;
  cont.querySelectorAll('.star').forEach((s,i) => {
    s.textContent = i<val ? '★' : '☆';
    s.classList.toggle('active', i<val);
  });
}

function setEval(campo, val) {
  evalScores[campo] = val;
  renderStars(campo, val);
}

async function guardarEvaluacion() {
  const id     = document.getElementById('eval-prov-id').value;
  const nombre = document.getElementById('eval-prov-nombre').textContent;

  if (!evalScores.puntualidad || !evalScores.calidad || !evalScores.precio) {
    toast('Califica los 3 criterios antes de guardar'); return;
  }

  const eval_ = {
    proveedor_id:    id,
    proveedor_nombre: nombre,
    puntualidad:     evalScores.puntualidad,
    calidad:         evalScores.calidad,
    precio:          evalScores.precio,
    comentario:      document.getElementById('eval-comentario').value.trim(),
    pedido_num:      document.getElementById('eval-pedido').value.trim(),
    usuario_nombre:  currentProfile?.nombre || currentUser?.email,
  };

  try {
    await API.addEvaluacion(eval_);
    toast('✓ Evaluación guardada');
    cerrarEvaluar();
    if (proveedorSeleccionado?.id === id) verDetalleProveedor(id);
  } catch(e) { toast('Error: ' + e.message); }
}

// ── NUEVO PROVEEDOR ───────────────────────────────────
function mostrarFormProveedor() {
  ['np-nombre','np-telefono','np-correo','np-direccion','np-rfc','np-productos'].forEach(id => {
    const e = document.getElementById(id); if(e) e.value='';
  });
  document.getElementById('form-proveedor').classList.remove('hidden');
  document.getElementById('form-proveedor').scrollIntoView({behavior:'smooth'});
}

async function guardarProveedor() {
  const nombre = document.getElementById('np-nombre').value.trim();
  if (!nombre) { toast('El nombre es obligatorio'); return; }

  const prov = {
    nombre,
    telefono:  document.getElementById('np-telefono').value.trim(),
    correo:    document.getElementById('np-correo').value.trim(),
    direccion: document.getElementById('np-direccion').value.trim(),
    rfc:       document.getElementById('np-rfc').value.trim(),
    productos: document.getElementById('np-productos').value.trim(),
    activo:    true,
  };

  try {
    await API.addProveedor(prov);
    await API.addAuditoria({ tipo:'producto_nuevo', descripcion:`Proveedor agregado: ${nombre}`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
    toast('✓ Proveedor guardado: ' + nombre);
    document.getElementById('form-proveedor').classList.add('hidden');
    cargarProveedores();
  } catch(e) { toast('Error: ' + e.message); }
}

// ── BÚSQUEDA ──────────────────────────────────────────
async function buscarProveedor(q) {
  if (!q) { cargarProveedores(); return; }
  try {
    const provs = await API.getProveedores();
    const f = provs.filter(p =>
      p.nombre.toLowerCase().includes(q.toLowerCase()) ||
      (p.productos||'').toLowerCase().includes(q.toLowerCase()) ||
      (p.rfc||'').toLowerCase().includes(q.toLowerCase())
    );
    document.getElementById('prov-lista').innerHTML = f.length
      ? f.map(renderProvCard).join('')
      : '<div class="empty">Sin resultados</div>';
  } catch {}
}
