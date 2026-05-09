// =====================================================
//  APP — Las Naves Agrícola · Almacén de Químicos
//  Seguridad: Supabase Auth + RLS + Zero Trust
// =====================================================

let currentUser   = null;   // sesión Supabase
let currentProfile = null;  // perfil con rol
let productoEscaneado = null;
let accionSeleccionada = null;
let todosMovimientos = [];
let todosProductos   = [];
let pendingMovimiento = null;
let scanner = null;

// ── INIT ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Actualizar fecha en dashboard
  const d = new Date();
  const el = document.getElementById('dash-date');
  if (el) el.textContent = d.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });

  // Revisar sesión existente
  const session = await API.getSession();
  if (session) {
    currentUser = session.user;
    await cargarPerfil();
  }

  // Escuchar cambios de auth
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      await cargarPerfil();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      mostrarLogin();
    }
  });
});

async function cargarPerfil() {
  try {
    currentProfile = await API.getProfile(currentUser.id);
    mostrarApp();
  } catch {
    toast('Error al cargar perfil');
    await API.signOut();
  }
}

// ── AUTH ──────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  const btn   = document.getElementById('btn-login');
  const err   = document.getElementById('login-error');

  if (!email || !pass) { err.textContent = 'Ingresa tu correo y contraseña'; err.style.color = '#c0392b'; return; }

  btn.disabled = true;
  document.getElementById('login-label').textContent = 'Verificando...';
  err.textContent = '';

  try {
    await API.signIn(email, pass);
    // onAuthStateChange se encarga del resto
  } catch (e) {
    err.textContent = 'Correo o contraseña incorrectos';
    err.style.color = '#c0392b';
    btn.disabled = false;
    document.getElementById('login-label').textContent = 'Iniciar sesión';
  }
}

async function doLogout() {
  await API.signOut();
}

function mostrarLogin() {
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('hidden');
  document.getElementById('screen-login').classList.add('active');
  document.getElementById('l-pass').value = '';
  document.getElementById('login-error').textContent = '';
  document.getElementById('btn-login').disabled = false;
  document.getElementById('login-label').textContent = 'Iniciar sesión';
}

function mostrarApp() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');

  // Actualizar topbar
  const nombre = currentProfile?.nombre || currentUser?.email || '—';
  const rol    = currentProfile?.rol || 'operador';
  document.getElementById('topbar-name').textContent = nombre;
  document.getElementById('topbar-role').textContent = rol;
  document.getElementById('topbar-avatar').textContent = nombre.substring(0,2).toUpperCase();

  // Mostrar/ocultar tabs según rol
  aplicarPermisosTabs(rol);

  // Cargar dashboard
  cargarDashboard();
}

function aplicarPermisosTabs(rol) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const roles = btn.getAttribute('data-roles')?.split(',') || [];
    if (roles.includes(rol)) {
      btn.style.display = '';
    } else {
      btn.style.display = 'none';
    }
  });

  // Panel de agregar producto solo admin/supervisor
  const invPanel = document.getElementById('inv-admin-panel');
  if (invPanel) {
    if (rol === 'admin' || rol === 'supervisor') invPanel.classList.remove('hidden');
    else invPanel.classList.add('hidden');
  }
}

// ── NAVEGACIÓN ────────────────────────────────────────
function goTo(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  btn.classList.add('active');
  stopScanner();

  const loaders = { dashboard: cargarDashboard, inventario: cargarInventario, movimientos: cargarMovimientos, pedidos: cargarPedidos, usuarios: cargarUsuarios, alertas: cargarAlertas };
  if (loaders[tab]) loaders[tab]();
}

// ── DASHBOARD ─────────────────────────────────────────
async function cargarDashboard() {
  try {
    const [prods, movs, peds] = await Promise.all([API.getProductos(), API.getMovimientos(6), API.getPedidos()]);
    todosProductos = prods;

    const hoy = new Date();
    const bajo = prods.filter(p => Number(p.stock) <= Number(p.min)).length;
    const caduca = prods.filter(p => {
      if (!p.caducidad) return false;
      return Math.floor((new Date(p.caducidad) - hoy) / 86400000) < CONFIG.DIAS_ALERTA_CADUCIDAD;
    }).length;
    const activos = peds.filter(p => p.estado !== 'Entregado').length;

    document.getElementById('m-prod').textContent = prods.length;
    document.getElementById('m-bajo').textContent = bajo;
    document.getElementById('m-cad').textContent  = caduca;
    document.getElementById('m-ped').textContent  = activos;

    const cnt = bajo + caduca;
    const dot = document.getElementById('alert-count');
    dot.textContent = cnt;
    cnt > 0 ? dot.classList.remove('hidden') : dot.classList.add('hidden');

    document.getElementById('dash-movs').innerHTML = movs.length
      ? movs.map(renderMovItem).join('')
      : '<div class="empty">Sin movimientos registrados aún</div>';
  } catch (e) {
    document.getElementById('dash-movs').innerHTML = '<div class="empty">Error al cargar. Verifica tu configuración de Supabase.</div>';
  }
}

// ── SCANNER ───────────────────────────────────────────
function startScanner() {
  if (scanner) return;
  scanner = new Html5Qrcode('reader');
  scanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 260, height: 140 } },
    (codigo) => { stopScanner(); buscarProducto(codigo.trim()); },
    () => {}
  ).catch(() => toast('No se pudo acceder a la cámara. Verifica los permisos.'));
}

function stopScanner() {
  if (scanner) { scanner.stop().catch(() => {}); scanner = null; }
}

async function buscarManual() {
  const cod = document.getElementById('manual-code').value.trim();
  if (!cod) { toast('Ingresa un código'); return; }
  await buscarProducto(cod);
}

async function buscarProducto(codigo) {
  toast('Buscando...');
  const p = await API.getProducto(codigo);
  if (!p) { toast('Producto no encontrado: ' + codigo); return; }

  productoEscaneado = p;
  accionSeleccionada = null;

  const hoy = new Date();
  const dias = p.caducidad ? Math.floor((new Date(p.caducidad) - hoy) / 86400000) : null;

  document.getElementById('scan-info-rows').innerHTML = `
    <div class="scan-info-row"><span>Nombre</span><strong>${p.nombre}</strong></div>
    <div class="scan-info-row"><span>Código</span><span>${p.id}</span></div>
    <div class="scan-info-row"><span>Stock actual</span><strong style="font-family:'DM Mono',monospace">${p.stock} ${p.unidad||''}</strong></div>
    <div class="scan-info-row"><span>Stock mínimo</span><span>${p.min} ${p.unidad||''}</span></div>
    <div class="scan-info-row"><span>Lote</span><span>${p.lote||'—'}</span></div>
    <div class="scan-info-row"><span>Caducidad</span><span>${p.caducidad||'—'}${dias!==null?` <span class="badge ${dias<30?'badge-danger':dias<90?'badge-warn':'badge-ok'}">${dias}d</span>`:''}</span></div>
  `;

  // Resetear selección visual
  document.getElementById('btn-entrada')?.classList.remove('selected-entrada');
  document.getElementById('btn-salida')?.classList.remove('selected-salida');
  document.getElementById('scan-form-card').classList.add('hidden');
  document.getElementById('scan-result-card').classList.remove('hidden');
  document.getElementById('action-selector').style.display = '';
}

function selectAction(tipo) {
  accionSeleccionada = tipo;

  document.getElementById('btn-entrada').classList.toggle('selected-entrada', tipo === 'entrada');
  document.getElementById('btn-salida').classList.toggle('selected-salida',   tipo === 'salida');

  document.getElementById('scan-form-title').textContent =
    tipo === 'entrada' ? '↓ Agregar al inventario' : '↑ Descontar del inventario';

  document.getElementById('f-entrada-extra').style.display = tipo === 'entrada' ? 'block' : 'none';
  document.getElementById('scan-form-card').classList.remove('hidden');
  document.getElementById('scan-form-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function solicitarPin() {
  if (!accionSeleccionada) { toast('Selecciona una acción primero'); return; }
  const qty = Number(document.getElementById('f-qty').value);
  if (!qty || qty <= 0) { toast('Ingresa una cantidad válida'); return; }
  document.getElementById('pin-pass').value = '';
  document.getElementById('pin-error').textContent = '';
  document.getElementById('pin-modal').classList.remove('hidden');
  document.getElementById('pin-pass').focus();
}

function cancelPin() {
  document.getElementById('pin-modal').classList.add('hidden');
}

async function confirmPin() {
  const pass = document.getElementById('pin-pass').value;
  if (!pass) { document.getElementById('pin-error').textContent = 'Ingresa tu contraseña'; return; }

  document.getElementById('pin-error').textContent = 'Verificando...';
  const ok = await API.verificarPassword(pass);

  if (!ok) {
    document.getElementById('pin-error').textContent = 'Contraseña incorrecta';
    return;
  }

  document.getElementById('pin-modal').classList.add('hidden');
  await registrarMovimiento();
}

async function registrarMovimiento() {
  const qty  = Number(document.getElementById('f-qty').value);
  const tipo = accionSeleccionada;
  const stockActual = Number(productoEscaneado.stock);

  if (tipo === 'salida' && qty > stockActual) {
    toast(`Stock insuficiente. Solo hay ${stockActual} ${productoEscaneado.unidad||''}`);
    return;
  }

  const nuevoStock = tipo === 'entrada' ? stockActual + qty : stockActual - qty;
  const unit = document.getElementById('f-unit').value;
  const now  = new Date().toISOString();

  const mov = {
    tipo,
    id_producto:      productoEscaneado.id,
    nombre:           productoEscaneado.nombre,
    cantidad:         qty,
    unidad:           unit,
    usuario_id:       currentUser.id,
    usuario_nombre:   currentProfile?.nombre || currentUser.email,
    destino:          document.getElementById('f-dest').value,
    lote:             tipo === 'entrada' ? document.getElementById('f-lote').value : productoEscaneado.lote,
    caducidad_lote:   tipo === 'entrada' ? document.getElementById('f-cad').value  : productoEscaneado.caducidad,
    nota:             document.getElementById('f-nota').value,
    stock_resultante: nuevoStock,
    created_at:       now,
  };

  try {
    await Promise.all([API.addMovimiento(mov), API.updateStock(productoEscaneado.id, nuevoStock)]);
    toast(`✓ ${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada — nuevo stock: ${nuevoStock} ${unit}`);
    limpiarScanner();
  } catch (e) {
    toast('Error al guardar. Intenta de nuevo.');
  }
}

function limpiarScanner() {
  productoEscaneado = null;
  accionSeleccionada = null;
  document.getElementById('scan-result-card').classList.add('hidden');
  document.getElementById('scan-form-card').classList.add('hidden');
  document.getElementById('manual-code').value = '';
  ['f-qty','f-dest','f-lote','f-nota'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  const cad = document.getElementById('f-cad'); if (cad) cad.value = '';
}

// ── INVENTARIO ────────────────────────────────────────
async function cargarInventario() {
  document.getElementById('inv-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try {
    todosProductos = await API.getProductos();
    renderInventario(todosProductos);
  } catch { document.getElementById('inv-lista').innerHTML = '<div class="empty">Error al cargar</div>'; }
}

function renderInventario(lista) {
  const hoy = new Date();
  document.getElementById('inv-lista').innerHTML = lista.length
    ? lista.map(p => {
        const stockN = Number(p.stock), minN = Number(p.min);
        const dias = p.caducidad ? Math.floor((new Date(p.caducidad) - hoy) / 86400000) : null;
        let badge = 'badge-ok', badgeText = 'OK';
        if (stockN <= minN) { badge = 'badge-danger'; badgeText = 'Stock bajo'; }
        else if (dias !== null && dias < CONFIG.DIAS_ALERTA_CADUCIDAD) { badge = 'badge-warn'; badgeText = 'Por caducar'; }
        return `<div class="inv-item">
          <div>
            <div class="inv-name">${p.nombre}</div>
            <div class="inv-sub">${p.id} · Lote: ${p.lote||'—'} · Cad: ${p.caducidad||'—'}</div>
          </div>
          <div class="inv-right">
            <div class="inv-stock">${p.stock} <small>${p.unidad||''}</small></div>
            <span class="badge ${badge}">${badgeText}</span>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty">Sin productos registrados</div>';
}

function filtrarInv(q) {
  const f = todosProductos.filter(p =>
    p.nombre.toLowerCase().includes(q.toLowerCase()) ||
    p.id.toLowerCase().includes(q.toLowerCase())
  );
  renderInventario(f);
}

function mostrarFormProducto() {
  const f = document.getElementById('form-producto');
  f.classList.remove('hidden');
  f.scrollIntoView({ behavior: 'smooth' });
}

async function guardarProducto() {
  const prod = {
    id:        document.getElementById('np-id').value.trim(),
    nombre:    document.getElementById('np-nombre').value.trim(),
    stock:     Number(document.getElementById('np-stock').value) || 0,
    min:       Number(document.getElementById('np-min').value)   || 0,
    unidad:    document.getElementById('np-unit').value,
    proveedor: document.getElementById('np-prov').value.trim(),
    lote:      document.getElementById('np-lote').value.trim(),
    caducidad: document.getElementById('np-cad').value,
  };
  if (!prod.id || !prod.nombre) { toast('Completa código y nombre'); return; }
  try {
    await API.addProducto(prod);
    toast('Producto guardado');
    document.getElementById('form-producto').classList.add('hidden');
    cargarInventario();
  } catch (e) { toast('Error: ' + e.message); }
}

// ── MOVIMIENTOS ───────────────────────────────────────
async function cargarMovimientos() {
  document.getElementById('mov-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try {
    todosMovimientos = await API.getMovimientos(100);
    // Poblar filtro de usuarios
    const usuarios = [...new Set(todosMovimientos.map(m => m.usuario_nombre).filter(Boolean))];
    const sel = document.getElementById('fil-user');
    sel.innerHTML = '<option value="">Todos los usuarios</option>' +
      usuarios.map(u => `<option value="${u}">${u}</option>`).join('');
    filtrarMov();
  } catch { document.getElementById('mov-lista').innerHTML = '<div class="empty">Error al cargar</div>'; }
}

function filtrarMov() {
  const tipo = document.getElementById('fil-tipo').value;
  const user = document.getElementById('fil-user').value;
  const f = todosMovimientos.filter(m =>
    (!tipo || m.tipo === tipo) && (!user || m.usuario_nombre === user)
  );
  document.getElementById('mov-lista').innerHTML = f.length
    ? f.map(renderMovItem).join('')
    : '<div class="empty">Sin movimientos</div>';
}

function renderMovItem(m) {
  const signo = m.tipo === 'entrada' ? '+' : '−';
  const fecha = m.created_at ? new Date(m.created_at).toLocaleString('es-MX') : '—';
  return `<div class="mov-item">
    <div class="mov-dot ${m.tipo}">${m.tipo === 'entrada' ? '↓' : '↑'}</div>
    <div class="mov-body">
      <div class="mov-name">${m.nombre}</div>
      <div class="mov-meta">${fecha} · ${m.usuario_nombre||'—'}${m.destino?' · '+m.destino:''}</div>
    </div>
    <div class="mov-qty ${m.tipo}">${signo}${m.cantidad} ${m.unidad||''}</div>
  </div>`;
}

// ── PEDIDOS ───────────────────────────────────────────
async function cargarPedidos() {
  document.getElementById('ped-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const peds = await API.getPedidos();
    document.getElementById('ped-lista').innerHTML = peds.length
      ? peds.map(p => `<div class="pedido-item">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div class="pedido-name">${p.num||'PED'} — ${p.producto}</div>
              <div class="pedido-meta">${p.proveedor} · ${p.cantidad} · ${p.fecha_estimada||'—'}</div>
            </div>
            <span class="badge ${p.estado==='Entregado'?'badge-ok':p.estado==='En tránsito'?'badge-info':'badge-warn'}">${p.estado}</span>
          </div>
          ${p.estado!=='Entregado'?`<button class="btn btn-sm btn-green" style="margin-top:8px" onclick="marcarEntregado('${p.id}')">✓ Marcar entregado</button>`:''}
        </div>`).join('')
      : '<div class="empty">Sin pedidos registrados</div>';
  } catch { document.getElementById('ped-lista').innerHTML = '<div class="empty">Error al cargar</div>'; }
}

function mostrarFormPedido() {
  const f = document.getElementById('form-pedido');
  f.classList.remove('hidden');
  f.scrollIntoView({ behavior: 'smooth' });
}

async function guardarPedido() {
  const peds = await API.getPedidos();
  const num  = 'PED-' + String(peds.length + 1).padStart(3, '0');
  const ped  = {
    num,
    proveedor:       document.getElementById('pp-prov').value.trim(),
    producto:        document.getElementById('pp-prod').value.trim(),
    cantidad:        document.getElementById('pp-qty').value.trim(),
    fecha_estimada:  document.getElementById('pp-fecha').value,
    estado:          'Confirmado',
    creado_por:      currentProfile?.nombre || currentUser?.email,
  };
  if (!ped.proveedor || !ped.producto) { toast('Completa proveedor y producto'); return; }
  try {
    await API.addPedido(ped);
    toast('Pedido ' + num + ' creado');
    document.getElementById('form-pedido').classList.add('hidden');
    cargarPedidos();
  } catch (e) { toast('Error: ' + e.message); }
}

async function marcarEntregado(id) {
  try {
    await API.updatePedidoEstado(id, 'Entregado');
    toast('Pedido marcado como entregado');
    cargarPedidos();
  } catch { toast('Error al actualizar'); }
}

// ── USUARIOS (solo admin) ─────────────────────────────
async function cargarUsuarios() {
  if (currentProfile?.rol !== 'admin') return;
  document.getElementById('users-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const users = await API.getUsuarios();
    document.getElementById('users-lista').innerHTML = users.length
      ? users.map(u => `<div class="user-item">
          <div class="user-item-avatar">${(u.nombre||u.email||'?').substring(0,2).toUpperCase()}</div>
          <div class="user-item-body">
            <div class="user-item-name">${u.nombre||'—'}</div>
            <div class="user-item-email">${u.email||'—'}</div>
          </div>
          <div class="rol-select">
            <select onchange="cambiarRol('${u.id}', this.value)" ${u.id === currentUser.id ? 'disabled title="Tu propio rol"' : ''}>
              <option value="operador"   ${u.rol==='operador'?'selected':''}>Operador</option>
              <option value="supervisor" ${u.rol==='supervisor'?'selected':''}>Supervisor</option>
              <option value="admin"      ${u.rol==='admin'?'selected':''}>Admin</option>
            </select>
            <span class="badge badge-${u.rol}">${u.rol}</span>
          </div>
        </div>`).join('')
      : '<div class="empty">Sin usuarios</div>';
  } catch { document.getElementById('users-lista').innerHTML = '<div class="empty">Error al cargar</div>'; }
}

async function cambiarRol(userId, nuevoRol) {
  try {
    await API.updateRol(userId, nuevoRol);
    toast('Rol actualizado a: ' + nuevoRol);
    cargarUsuarios();
  } catch (e) { toast('Error: ' + e.message); }
}

function mostrarFormUsuario() {
  const f = document.getElementById('form-usuario');
  f.classList.remove('hidden');
  f.scrollIntoView({ behavior: 'smooth' });
}

async function crearUsuario() {
  const nombre = document.getElementById('nu-nombre').value.trim();
  const email  = document.getElementById('nu-email').value.trim();
  const pass   = document.getElementById('nu-pass').value;
  const rol    = document.getElementById('nu-rol').value;
  if (!nombre || !email || !pass) { toast('Completa todos los campos'); return; }
  if (pass.length < 8) { toast('La contraseña debe tener al menos 8 caracteres'); return; }
  try {
    await API.crearUsuario(email, pass, nombre, rol);
    toast('Usuario creado: ' + nombre);
    document.getElementById('form-usuario').classList.add('hidden');
    cargarUsuarios();
  } catch (e) { toast('Error: ' + e.message); }
}

// ── ALERTAS ───────────────────────────────────────────
async function cargarAlertas() {
  document.getElementById('alertas-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const prods = await API.getProductos();
    const hoy = new Date();
    const alertas = [];
    prods.forEach(p => {
      if (Number(p.stock) <= Number(p.min))
        alertas.push({ tipo:'danger', icon:'⚠', nombre:p.nombre, detalle:`Stock bajo: ${p.stock} ${p.unidad||''} (mínimo: ${p.min})` });
      if (p.caducidad) {
        const dias = Math.floor((new Date(p.caducidad) - hoy) / 86400000);
        if (dias < CONFIG.DIAS_ALERTA_CADUCIDAD)
          alertas.push({ tipo:'warn', icon:'⏰', nombre:p.nombre, detalle:`Caduca en ${dias} días (${p.caducidad})` });
      }
    });
    document.getElementById('alertas-lista').innerHTML = alertas.length
      ? alertas.map(a => `<div class="alert-item">
          <div class="alert-icon ${a.tipo}">${a.icon}</div>
          <div><div class="alert-name">${a.nombre}</div><div class="alert-detail">${a.detalle}</div></div>
        </div>`).join('')
      : '<div class="empty">✓ Sin alertas activas</div>';
  } catch { document.getElementById('alertas-lista').innerHTML = '<div class="empty">Error al cargar</div>'; }
}

// ── TOAST ─────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
}

// Enter en login
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('l-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('pin-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') confirmPin(); });
});
