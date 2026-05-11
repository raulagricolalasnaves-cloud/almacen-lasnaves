// =====================================================
//  APP v5 — Las Naves Agrícola
//  Con evidencia fotográfica en movimientos
// =====================================================

let currentUser    = null;
let currentProfile = null;
let todosMovimientos = [];
let todosProductos   = [];
let todaAuditoria    = [];


// ── INIT ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const d = new Date();
  const el = document.getElementById('dash-date');
  if (el) el.textContent = d.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });

  const session = await API.getSession();
  if (session) { currentUser = session.user; await cargarPerfil(); }

  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      await cargarPerfil();
      API.addAuditoria({ tipo:'login', descripcion:'Inicio de sesión', usuario_id: session.user.id, usuario_nombre: currentProfile?.nombre || session.user.email });
    } else if (event === 'SIGNED_OUT') {
      currentUser = null; currentProfile = null; mostrarLogin();
    }
  });
});

async function cargarPerfil() {
  try { currentProfile = await API.getProfile(currentUser.id); mostrarApp(); }
  catch { toast('Error al cargar perfil'); await API.signOut(); }
}

// ── AUTH ──────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  const btn   = document.getElementById('btn-login');
  const err   = document.getElementById('login-error');
  if (!email || !pass) { err.textContent='Ingresa tu correo y contraseña'; err.style.color='#c0392b'; return; }
  btn.disabled = true;
  document.getElementById('login-label').textContent = 'Verificando...';
  err.textContent = '';
  try { await API.signIn(email, pass); }
  catch { err.textContent='Correo o contraseña incorrectos'; err.style.color='#c0392b'; btn.disabled=false; document.getElementById('login-label').textContent='Iniciar sesión'; }
}

async function doLogout() { await API.signOut(); }

function mostrarLogin() {
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('l-pass').value = '';
  document.getElementById('login-error').textContent = '';
  document.getElementById('btn-login').disabled = false;
  document.getElementById('login-label').textContent = 'Iniciar sesión';
}

function mostrarApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  const nombre = currentProfile?.nombre || currentUser?.email || '—';
  const rol    = currentProfile?.rol || 'operador';
  document.getElementById('topbar-name').textContent = nombre;
  document.getElementById('topbar-role').textContent = rol;
  document.getElementById('topbar-avatar').textContent = nombre.substring(0,2).toUpperCase();
  aplicarPermisosTabs(rol);
  cargarDashboard();
}

function aplicarPermisosTabs(rol) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const roles = btn.getAttribute('data-roles')?.split(',') || [];
    btn.style.display = roles.includes(rol) ? '' : 'none';
  });
  const p = document.getElementById('inv-admin-panel');
  if (p) { if (['admin','supervisor'].includes(rol)) p.classList.remove('hidden'); else p.classList.add('hidden'); }
}

// ── NAVEGACIÓN ────────────────────────────────────────
function goTo(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  btn.classList.add('active');
  if (typeof stopScanner === 'function') stopScanner();
  ({ dashboard: cargarDashboard, inventario: cargarInventario, movimientos: cargarMovimientos,
     pedidos: cargarPedidos, usuarios: cargarUsuarios, alertas: cargarAlertas,
     graficas: cargarGraficas, auditoria: cargarAuditoria })[tab]?.();
}

// ── DASHBOARD ─────────────────────────────────────────
async function cargarDashboard() {
  try {
    const [prods, movs, peds] = await Promise.all([API.getProductos(), API.getMovimientos(6), API.getPedidos()]);
    todosProductos = prods;
    const hoy  = new Date();
    const bajo = prods.filter(p => Number(p.stock) <= Number(p.min)).length;
    const cad  = prods.filter(p => p.caducidad && Math.floor((new Date(p.caducidad)-hoy)/86400000) < CONFIG.DIAS_ALERTA_CADUCIDAD).length;
    const act  = peds.filter(p => p.estado !== 'Entregado').length;
    document.getElementById('m-prod').textContent = prods.length;
    document.getElementById('m-bajo').textContent = bajo;
    document.getElementById('m-cad').textContent  = cad;
    document.getElementById('m-ped').textContent  = act;
    const cnt = bajo + cad;
    const dot = document.getElementById('alert-count');
    dot.textContent = cnt;
    cnt > 0 ? dot.classList.remove('hidden') : dot.classList.add('hidden');
    document.getElementById('dash-movs').innerHTML = movs.length ? movs.map(renderMovItem).join('') : '<div class="empty">Sin movimientos aún</div>';
  } catch {
    document.getElementById('dash-movs').innerHTML = '<div class="empty">Error al cargar. Verifica tu configuración.</div>';
  }
}

// ── MOVIMIENTOS ───────────────────────────────────────
async function cargarMovimientos() {
  document.getElementById('mov-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try {
    todosMovimientos = await API.getMovimientos(100);
    const users = [...new Set(todosMovimientos.map(m => m.usuario_nombre).filter(Boolean))];
    const sel = document.getElementById('fil-user');
    sel.innerHTML = '<option value="">Todos los usuarios</option>' + users.map(u=>`<option>${u}</option>`).join('');
    filtrarMov();
  } catch { document.getElementById('mov-lista').innerHTML='<div class="empty">Error al cargar</div>'; }
}

function filtrarMov() {
  const tipo = document.getElementById('fil-tipo').value;
  const user = document.getElementById('fil-user').value;
  const f = todosMovimientos.filter(m => (!tipo||m.tipo===tipo) && (!user||m.usuario_nombre===user));
  document.getElementById('mov-lista').innerHTML = f.length ? f.map(renderMovItem).join('') : '<div class="empty">Sin movimientos</div>';
}

function renderMovItem(m) {
  const signo = m.tipo === 'entrada' ? '+' : '−';
  const fecha = m.created_at ? new Date(m.created_at).toLocaleString('es-MX') : '—';
  const fotoHtml = m.foto_evidencia
    ? `<div class="mov-foto"><a href="#" onclick="verFoto('${m.foto_evidencia}');return false;">📎 Ver ${m.tipo==='entrada'?'recibo':'vale de entrega'}</a></div>`
    : `<div class="mov-foto" style="color:var(--text3);font-size:11px">Sin evidencia fotográfica</div>`;
  return `<div class="mov-item">
    <div class="mov-dot ${m.tipo}">${m.tipo==='entrada'?'↓':'↑'}</div>
    <div class="mov-body">
      <div class="mov-name">${m.nombre}</div>
      <div class="mov-meta">${fecha} · ${m.usuario_nombre||'—'}${m.destino?' · '+m.destino:''}</div>
      ${fotoHtml}
    </div>
    <div class="mov-qty ${m.tipo}">${signo}${m.cantidad} ${m.unidad||''}</div>
  </div>`;
}

// ── VISOR DE FOTO ─────────────────────────────────────
function verFoto(url) {
  const modal = document.getElementById('foto-modal');
  const img   = document.getElementById('foto-modal-img');
  if (!modal || !img) return;
  img.src = url;
  modal.classList.remove('hidden');
}

function cerrarFotoModal() {
  document.getElementById('foto-modal')?.classList.add('hidden');
  const img = document.getElementById('foto-modal-img');
  if (img) img.src = '';
}

// ── INVENTARIO ────────────────────────────────────────
async function cargarInventario() {
  document.getElementById('inv-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try { todosProductos = await API.getProductos(); renderInventario(todosProductos); }
  catch { document.getElementById('inv-lista').innerHTML = '<div class="empty">Error al cargar</div>'; }
}

function renderInventario(lista) {
  const hoy = new Date();
  document.getElementById('inv-lista').innerHTML = lista.length
    ? lista.map(p => {
        const sN=Number(p.stock), mN=Number(p.min);
        const dias=p.caducidad?Math.floor((new Date(p.caducidad)-hoy)/86400000):null;
        let badge='badge-ok', bt='OK';
        if(sN<=mN){badge='badge-danger';bt='Stock bajo';}
        else if(dias!==null&&dias<CONFIG.DIAS_ALERTA_CADUCIDAD){badge='badge-warn';bt='Por caducar';}
        return `<div class="inv-item"><div><div class="inv-name">${p.nombre}</div><div class="inv-sub">${p.id} · Lote: ${p.lote||'—'} · Cad: ${p.caducidad||'—'}</div></div><div class="inv-right"><div class="inv-stock">${p.stock} <small>${p.unidad||''}</small></div><span class="badge ${badge}">${bt}</span></div></div>`;
      }).join('')
    : '<div class="empty">Sin productos registrados</div>';
}

function filtrarInv(q) {
  renderInventario(todosProductos.filter(p =>
    p.nombre.toLowerCase().includes(q.toLowerCase()) || p.id.toLowerCase().includes(q.toLowerCase())
  ));
}

function mostrarFormProducto() {
  const f = document.getElementById('form-producto');
  f.classList.remove('hidden'); f.scrollIntoView({behavior:'smooth'});
}

async function guardarProducto() {
  const prod = { id:document.getElementById('np-id').value.trim(), nombre:document.getElementById('np-nombre').value.trim(), stock:Number(document.getElementById('np-stock').value)||0, min:Number(document.getElementById('np-min').value)||0, unidad:document.getElementById('np-unit').value, proveedor:document.getElementById('np-prov').value.trim(), lote:document.getElementById('np-lote').value.trim(), caducidad:document.getElementById('np-cad').value };
  if (!prod.id||!prod.nombre) { toast('Completa código y nombre'); return; }
  try {
    await API.addProducto(prod);
    await API.addAuditoria({tipo:'producto_nuevo',descripcion:`Producto agregado: ${prod.nombre}`,usuario_id:currentUser.id,usuario_nombre:currentProfile?.nombre||currentUser.email,metadata:{id:prod.id}});
    toast('Producto guardado'); document.getElementById('form-producto').classList.add('hidden'); cargarInventario();
  } catch(e) { toast('Error: '+e.message); }
}

// ── PEDIDOS ───────────────────────────────────────────
async function cargarPedidos() {
  document.getElementById('ped-lista').innerHTML='<div class="loading">Cargando...</div>';
  try {
    const peds = await API.getPedidos();
    document.getElementById('ped-lista').innerHTML = peds.length
      ? peds.map(p=>`<div class="pedido-item"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="pedido-name">${p.num||'PED'} — ${p.producto}</div><div class="pedido-meta">${p.proveedor} · ${p.cantidad} · ${p.fecha_estimada||'—'}</div></div><span class="badge ${p.estado==='Entregado'?'badge-ok':p.estado==='En tránsito'?'badge-info':'badge-warn'}">${p.estado}</span></div>${p.estado!=='Entregado'?`<button class="btn btn-sm btn-green" style="margin-top:8px" onclick="marcarEntregado('${p.id}')">✓ Marcar entregado</button>`:''}</div>`).join('')
      : '<div class="empty">Sin pedidos</div>';
  } catch { document.getElementById('ped-lista').innerHTML='<div class="empty">Error al cargar</div>'; }
}

function mostrarFormPedido() { const f=document.getElementById('form-pedido'); f.classList.remove('hidden'); f.scrollIntoView({behavior:'smooth'}); }

async function guardarPedido() {
  const peds = await API.getPedidos();
  const num  = 'PED-'+String(peds.length+1).padStart(3,'0');
  const ped  = { num, proveedor:document.getElementById('pp-prov').value.trim(), producto:document.getElementById('pp-prod').value.trim(), cantidad:document.getElementById('pp-qty').value.trim(), fecha_estimada:document.getElementById('pp-fecha').value, estado:'Confirmado', creado_por:currentProfile?.nombre||currentUser?.email };
  if (!ped.proveedor||!ped.producto) { toast('Completa proveedor y producto'); return; }
  try { await API.addPedido(ped); toast('Pedido '+num+' creado'); document.getElementById('form-pedido').classList.add('hidden'); cargarPedidos(); }
  catch(e) { toast('Error: '+e.message); }
}

async function marcarEntregado(id) {
  try { await API.updatePedidoEstado(id,'Entregado'); toast('Pedido marcado como entregado'); cargarPedidos(); }
  catch { toast('Error al actualizar'); }
}

// ── USUARIOS ──────────────────────────────────────────
async function cargarUsuarios() {
  if (currentProfile?.rol !== 'admin') return;
  document.getElementById('users-lista').innerHTML='<div class="loading">Cargando...</div>';
  try {
    const users = await API.getUsuarios();
    document.getElementById('users-lista').innerHTML = users.length
      ? users.map(u=>`<div class="user-item"><div class="user-item-avatar">${(u.nombre||'?').substring(0,2).toUpperCase()}</div><div class="user-item-body"><div class="user-item-name">${u.nombre||'—'}</div><div class="user-item-email">${u.email||'—'}</div></div><div class="rol-select"><select onchange="cambiarRol('${u.id}',this.value,'${u.nombre}')" ${u.id===currentUser.id?'disabled':''}><option value="operador" ${u.rol==='operador'?'selected':''}>Operador</option><option value="supervisor" ${u.rol==='supervisor'?'selected':''}>Supervisor</option><option value="admin" ${u.rol==='admin'?'selected':''}>Admin</option></select><span class="badge badge-${u.rol}">${u.rol}</span></div></div>`).join('')
      : '<div class="empty">Sin usuarios</div>';
  } catch { document.getElementById('users-lista').innerHTML='<div class="empty">Error al cargar</div>'; }
}

async function cambiarRol(userId, nuevoRol, nombre) {
  try {
    await API.updateRol(userId, nuevoRol);
    await API.addAuditoria({tipo:'rol_cambio',descripcion:`Rol de ${nombre} cambiado a ${nuevoRol}`,usuario_id:currentUser.id,usuario_nombre:currentProfile?.nombre||currentUser.email,metadata:{usuario_afectado:userId,nuevo_rol:nuevoRol}});
    toast('Rol actualizado a: '+nuevoRol); cargarUsuarios();
  } catch(e) { toast('Error: '+e.message); }
}

function mostrarFormUsuario() { const f=document.getElementById('form-usuario'); f.classList.remove('hidden'); f.scrollIntoView({behavior:'smooth'}); }

async function crearUsuario() {
  const nombre=document.getElementById('nu-nombre').value.trim();
  const email=document.getElementById('nu-email').value.trim();
  const pass=document.getElementById('nu-pass').value;
  const rol=document.getElementById('nu-rol').value;
  if (!nombre||!email||!pass) { toast('Completa todos los campos'); return; }
  if (pass.length<8) { toast('La contraseña debe tener al menos 8 caracteres'); return; }
  try { await API.crearUsuario(email,pass,nombre,rol); toast('Usuario creado: '+nombre); document.getElementById('form-usuario').classList.add('hidden'); cargarUsuarios(); }
  catch(e) { toast('Error: '+e.message); }
}

// ── AUDITORÍA ─────────────────────────────────────────
async function cargarAuditoria() {
  document.getElementById('aud-lista').innerHTML='<div class="loading">Cargando...</div>';
  try {
    todaAuditoria = await API.getAuditoria();
    const users = [...new Set(todaAuditoria.map(a=>a.usuario_nombre).filter(Boolean))];
    const sel = document.getElementById('aud-user');
    sel.innerHTML = '<option value="">Todos los usuarios</option>'+users.map(u=>`<option>${u}</option>`).join('');
    filtrarAuditoria();
  } catch { document.getElementById('aud-lista').innerHTML='<div class="empty">Sin registros</div>'; }
}

function filtrarAuditoria() {
  const tipo = document.getElementById('aud-tipo').value;
  const user = document.getElementById('aud-user').value;
  const f = todaAuditoria.filter(a => (!tipo||a.tipo===tipo) && (!user||a.usuario_nombre===user));
  const icons={login:'🔑',rol_cambio:'👤',producto_nuevo:'📦',movimiento:'🔄'};
  const clases={login:'login',rol_cambio:'rol',producto_nuevo:'prod',movimiento:'mov'};
  document.getElementById('aud-lista').innerHTML = f.length
    ? f.map(a=>`<div class="aud-item"><div class="aud-icon ${clases[a.tipo]||'mov'}">${icons[a.tipo]||'📋'}</div><div><div class="aud-name">${a.descripcion||a.tipo}</div><div class="aud-meta">${a.usuario_nombre||'—'} · ${a.created_at?new Date(a.created_at).toLocaleString('es-MX'):'—'}</div></div></div>`).join('')
    : '<div class="empty">Sin registros</div>';
}

// ── ALERTAS ───────────────────────────────────────────
async function cargarAlertas() {
  document.getElementById('alertas-lista').innerHTML='<div class="loading">Cargando...</div>';
  try {
    const prods = await API.getProductos();
    const hoy = new Date(); const alertas = [];
    prods.forEach(p => {
      if (Number(p.stock)<=Number(p.min)) alertas.push({tipo:'danger',icon:'⚠',nombre:p.nombre,detalle:`Stock bajo: ${p.stock} ${p.unidad||''} (mínimo: ${p.min})`});
      if (p.caducidad) { const dias=Math.floor((new Date(p.caducidad)-hoy)/86400000); if(dias<CONFIG.DIAS_ALERTA_CADUCIDAD) alertas.push({tipo:'warn',icon:'⏰',nombre:p.nombre,detalle:`Caduca en ${dias} días (${p.caducidad})`}); }
    });
    document.getElementById('alertas-lista').innerHTML = alertas.length
      ? alertas.map(a=>`<div class="alert-item"><div class="alert-icon ${a.tipo}">${a.icon}</div><div><div class="alert-name">${a.nombre}</div><div class="alert-detail">${a.detalle}</div></div></div>`).join('')
      : '<div class="empty">✓ Sin alertas activas</div>';
  } catch { document.getElementById('alertas-lista').innerHTML='<div class="empty">Error al cargar</div>'; }
}

// ── TOAST ─────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 3200);
}

// ── EVENTOS ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('l-pass')?.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  document.getElementById('pin-pass')?.addEventListener('keydown', e => { if(e.key==='Enter') confirmPin(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape') cerrarFotoModal(); });
});
