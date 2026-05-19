// =====================================================
//  APP v9 — Las Naves Agrícola
//  Seguridad empresarial + todas las funciones
// =====================================================

let currentUser    = null;
let currentProfile = null;
let todosMovimientos = [];
let todosProductos   = [];
let todaAuditoria    = [];
let productoEntrada  = null;
let fotoEntrada      = null;
let productoSalida   = null;
let fotoSalida       = null;
let pinCallback      = null;
let pedidoProductos  = [];

// ── SEGURIDAD: timeout de sesión (30 min inactividad) ──
let sessionTimer = null;
const SESSION_TIMEOUT = 30 * 60 * 1000;

function resetSessionTimer() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(async () => {
    toast('Sesión cerrada por inactividad');
    await API.signOut();
  }, SESSION_TIMEOUT);
}

['click','keydown','touchstart','scroll'].forEach(ev =>
  document.addEventListener(ev, resetSessionTimer, { passive: true })
);

// ── SEGURIDAD: bloquear devtools en producción ──────────
// (comentado para desarrollo; descomentar en producción)
// document.addEventListener('contextmenu', e => e.preventDefault());

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
      resetSessionTimer();
      API.addAuditoria({
        tipo:'login',
        descripcion:'Inicio de sesión exitoso',
        usuario_id: session.user.id,
        usuario_nombre: currentProfile?.nombre || session.user.email,
        metadata: { ip: 'web', timestamp: new Date().toISOString() }
      });
    } else if (event === 'SIGNED_OUT') {
      clearTimeout(sessionTimer);
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
  const email = document.getElementById('l-email').value.trim().toLowerCase();
  const pass  = document.getElementById('l-pass').value;
  const btn   = document.getElementById('btn-login');
  const err   = document.getElementById('login-error');
  if (!email || !pass) { err.textContent='Ingresa tu correo y contraseña'; err.style.color='#c0392b'; return; }
  // Validar formato de email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent='Correo inválido'; err.style.color='#c0392b'; return; }
  btn.disabled = true;
  document.getElementById('login-label').textContent = 'Verificando...';
  err.textContent = '';
  try { await API.signIn(email, pass); }
  catch {
    err.textContent='Correo o contraseña incorrectos';
    err.style.color='#c0392b';
    btn.disabled=false;
    document.getElementById('login-label').textContent='Iniciar sesión';
  }
}

async function doLogout() {
  await API.addAuditoria({ tipo:'login', descripcion:'Cierre de sesión', usuario_id:currentUser?.id, usuario_nombre:currentProfile?.nombre||currentUser?.email });
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
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  const nombre = currentProfile?.nombre || currentUser?.email || '—';
  const rol    = currentProfile?.rol || 'operador';
  document.getElementById('topbar-name').textContent = nombre;
  document.getElementById('topbar-role').textContent = rol;
  document.getElementById('topbar-avatar').textContent = nombre.substring(0,2).toUpperCase();
  aplicarPermisosTabs(rol);
  iniciarAlmacenes().then(() => cargarDashboard());
}

function aplicarPermisosTabs(rol) {
  // Admin siempre ve todo
  if (rol === 'admin') {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.style.display = '');
    const p = document.getElementById('inv-admin-panel');
    if (p) p.classList.remove('hidden');
    const bar = document.getElementById('almacen-bar');
    if (bar) bar.style.display = '';
    return;
  }
  // Usuarios con permisos individuales
  if (typeof aplicarPermisosMenu === 'function') {
    aplicarPermisosMenu();
  }
  // Barra almacén solo si tiene acceso a almacenes
  const bar = document.getElementById('almacen-bar');
  if (bar) bar.style.display = tienePermiso('almacenes') ? '' : 'none';
}

// ── NAVEGACIÓN ────────────────────────────────────────
function goTo(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  btn.classList.add('active');
  if (typeof stopScanner === 'function') stopScanner();
  if (typeof stopScannerEnt === 'function') stopScannerEnt();
  if (typeof stopScannerSal === 'function') stopScannerSal();
  if (typeof stopScannerEnt === 'function') stopScannerEnt();
  if (typeof stopScannerSal === 'function') stopScannerSal();
  const loaders = {
    dashboard: cargarDashboardUnificado, inventario: cargarInventario,
    movimientos: cargarMovimientos, pedidos: cargarPedidos,
    usuarios: cargarUsuarios, alertas: cargarAlertas,
    auditoria: cargarAuditoria, proveedores: cargarProveedores,
    almacenes: cargarAlmacenes, dir: cargarDashboardDir,
    movstock: () => switchMovStock('entrada'),
    entradas: iniciarEntradas, salidas: iniciarSalidas,
    scanner: () => {}, // scanner integrado en entradas/salidas
    conteo: () => { const el=document.getElementById('conteo-almacen-nombre'); if(el) el.textContent=almacenActivo?.nombre||''; },
    kpis: cargarKPIs,
    'pedidos-clientes': cargarPedidosClientesCompleto,
    notificaciones: cargarNotificaciones,
    respaldo: () => {},
  };
  loaders[tab]?.();
}

// ── DASHBOARD ─────────────────────────────────────────
async function cargarDashboard() {
  try {
    const [prods, movs, peds] = await Promise.all([API.getProductos(almacenActivo?.id), API.getMovimientos(6), API.getPedidos()]);
    todosProductos = prods;
    const hoy  = new Date();
    const bajo = prods.filter(p => Number(p.stock) <= Number(p.min)).length;
    const cad  = prods.filter(p => p.caducidad && Math.floor((new Date(p.caducidad)-hoy)/86400000) < 90).length;
    const act  = peds.filter(p => p.estado !== 'Entregado').length;
    const prodsActivos = prods.filter(p => Number(p.stock) > 0);
    document.getElementById('m-prod').textContent = prodsActivos.length;
    document.getElementById('m-bajo').textContent = bajo;
    document.getElementById('m-cad').textContent  = cad;
    document.getElementById('m-ped').textContent  = act;
    const cnt = bajo + cad;
    const dot = document.getElementById('alert-count');
    dot.textContent = cnt;
    cnt > 0 ? dot.classList.remove('hidden') : dot.classList.add('hidden');
    document.getElementById('dash-movs').innerHTML = movs.length ? movs.map(renderMovItem).join('') : '<div class="empty">Sin movimientos aún</div>';

    const valTot=prods.reduce((s,p)=>s+(Number(p.stock)*Number(p.precio_unitario||0)),0);
    const prodsBajo=prods.filter(p=>Number(p.stock)<=Number(p.min)&&Number(p.min)>0);
    const prodsCad=prods.filter(p=>p.caducidad&&Math.floor((new Date(p.caducidad)-hoy)/86400000)>=0&&Math.floor((new Date(p.caducidad)-hoy)/86400000)<90);
    const prodsCad0=prods.filter(p=>p.caducidad&&new Date(p.caducidad)<hoy);
    const qkpis=document.getElementById('dash-kpis-quick');
    if(qkpis) qkpis.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:10px">
        ${valTot>0?`<div class="kpi-main-card" style="border-left:3px solid var(--green)"><div class="kpi-icon" style="background:var(--green-bg);color:var(--green)">💰</div><div><div class="kpi-label">Valor</div><div class="kpi-val" style="color:var(--green);font-size:14px">$${valTot.toLocaleString('es-MX',{maximumFractionDigits:0})}</div></div></div>`:''}
        <div class="kpi-main-card" style="border-left:3px solid var(--blue)"><div class="kpi-icon" style="background:var(--blue-bg);color:var(--blue)">📦</div><div><div class="kpi-label">En stock</div><div class="kpi-val" style="font-size:20px">${prods.filter(p=>Number(p.stock)>0).length}</div></div></div>
        <div class="kpi-main-card" style="border-left:3px solid ${bajo>0?'var(--red)':'var(--green)'};cursor:pointer" onclick="toggleDashPanel('panel-bajo')"><div class="kpi-icon" style="background:${bajo>0?'var(--red-bg)':'var(--green-bg)'};color:${bajo>0?'var(--red)':'var(--green)'}">📉</div><div><div class="kpi-label">Stock bajo</div><div class="kpi-val" style="color:${bajo>0?'var(--red)':'var(--green)'};font-size:20px">${bajo}</div></div></div>
        <div class="kpi-main-card" style="border-left:3px solid ${cad>0?'var(--amber)':'var(--green)'};cursor:pointer" onclick="toggleDashPanel('panel-cad')"><div class="kpi-icon" style="background:${cad>0?'var(--amber-bg)':'var(--green-bg)'};color:${cad>0?'var(--amber)':'var(--green)'}">⏰</div><div><div class="kpi-label">Por caducar</div><div class="kpi-val" style="color:${cad>0?'var(--amber)':'var(--green)'};font-size:20px">${cad}</div></div></div>
        <div class="kpi-main-card" style="border-left:3px solid ${prodsCad0.length>0?'var(--red)':'var(--green)'};cursor:pointer" onclick="toggleDashPanel('panel-cad0')"><div class="kpi-icon" style="background:${prodsCad0.length>0?'var(--red-bg)':'var(--green-bg)'};color:${prodsCad0.length>0?'var(--red)':'var(--green)'}">🗑</div><div><div class="kpi-label">Caducados</div><div class="kpi-val" style="color:${prodsCad0.length>0?'var(--red)':'var(--green)'};font-size:20px">${prodsCad0.length}</div></div></div>
        <div class="kpi-main-card" style="border-left:3px solid var(--blue);cursor:pointer" onclick="goTo('pedidos',document.querySelector('[onclick*=pedidos]'))"><div class="kpi-icon" style="background:var(--blue-bg);color:var(--blue)">📋</div><div><div class="kpi-label">Pedidos activos</div><div class="kpi-val" style="color:var(--blue);font-size:20px">${act}</div></div></div>
      </div>
      <div id="panel-bajo" class="${bajo>0?'dash-panel':'dash-panel hidden'}"><div class="dash-panel-title">📉 Stock bajo (${bajo})</div>${prodsBajo.map(p=>`<div class="dash-panel-item"><div><div class="dash-panel-nombre">${p.nombre}</div><div class="dash-panel-sub">${p.id}${p.ubicacion?' · 📍 '+p.ubicacion:''}</div></div><div style="text-align:right"><div style="font-weight:700;color:var(--red)">${p.stock} ${p.unidad||''}</div><div style="font-size:11px;color:var(--text3)">mín: ${p.min}</div></div></div>`).join('')}</div>
      <div id="panel-cad" class="${cad>0?'dash-panel':'dash-panel hidden'}"><div class="dash-panel-title">⏰ Por caducar (${cad})</div>${prodsCad.sort((a,b)=>new Date(a.caducidad)-new Date(b.caducidad)).map(p=>{const d=Math.floor((new Date(p.caducidad)-hoy)/86400000);return`<div class="dash-panel-item"><div><div class="dash-panel-nombre">${p.nombre}</div><div class="dash-panel-sub">${p.caducidad} · ${p.stock} ${p.unidad||''}</div></div><div style="font-weight:700;color:${d<30?'var(--red)':'var(--amber)'}">${d===0?'HOY':d+'d'}</div></div>`;}).join('')}</div>
      <div id="panel-cad0" class="${prodsCad0.length>0?'dash-panel':'dash-panel hidden'}"><div class="dash-panel-title">🗑 Caducados (${prodsCad0.length})</div>${prodsCad0.map(p=>{const d=Math.abs(Math.floor((new Date(p.caducidad)-hoy)/86400000));return`<div class="dash-panel-item"><div><div class="dash-panel-nombre">${p.nombre}</div><div class="dash-panel-sub">Caducó: ${p.caducidad}</div></div><div style="font-weight:700;color:var(--red)">Hace ${d}d</div></div>`;}).join('')}</div>`;
  } catch { document.getElementById('dash-movs').innerHTML='<div class="empty">Error al cargar</div>'; }
}

function toggleDashPanel(id) {
  document.getElementById(id)?.classList.toggle('hidden');
}

// ── ENTRADAS ──────────────────────────────────────────
function iniciarEntradas() {
  carritoEntrada = []; fotoEntrada = null; productoEntrada = null;
  document.getElementById('ent-buscar')?.value != null && (document.getElementById('ent-buscar').value = '');
  const res = document.getElementById('ent-resultados'); if(res) res.innerHTML = '';
  document.getElementById('ent-carrito-card')?.classList.add('hidden');
  document.getElementById('ent-form-general')?.classList.add('hidden');
  document.getElementById('ent-form-card')?.classList.add('hidden');
  resetFotoEntrada();
}

async function buscarProductoEntrada(q) {
  if (q.length < 2) { document.getElementById('ent-resultados').innerHTML = ''; return; }
  if (!todosProductos.length) todosProductos = await API.getProductos(almacenActivo?.id);
  const f = todosProductos.filter(p => p.nombre.toLowerCase().includes(q.toLowerCase()) || p.id.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('ent-resultados').innerHTML = f.length
    ? f.map(p => `<div class="search-result-item" onclick="seleccionarProductoEntrada('${p.id}')">
        <div class="search-result-name">${p.nombre} ${p.peligrosidad?`<span style="color:var(--red);font-size:11px">⚠ ${p.peligrosidad}</span>`:''}</div>
        <div class="search-result-meta">${p.id} · Stock: ${p.stock} ${p.unidad||''}${p.ubicacion?' · 📍 '+p.ubicacion:''}</div>
      </div>`).join('')
    : '<div class="empty" style="padding:12px">Sin resultados</div>';
}

async function seleccionarProductoEntrada(id) {
  productoEntrada = await API.getProducto(id);
  if (!productoEntrada) return;
  document.getElementById('ent-resultados').innerHTML = '';
  document.getElementById('ent-buscar').value = productoEntrada.nombre;
  document.getElementById('ent-prod-nombre').textContent = productoEntrada.nombre;
  document.getElementById('ent-prod-id').textContent = productoEntrada.id;
  document.getElementById('ent-prod-stock').textContent = productoEntrada.stock + ' ' + (productoEntrada.unidad||'');
  // Mostrar banner SDS si tiene peligrosidad
  const banner = document.getElementById('ent-sds-banner');
  if (productoEntrada.peligrosidad && productoEntrada.peligrosidad !== 'ninguno') {
    banner.innerHTML = `<div class="sds-banner ${productoEntrada.peligrosidad}">⚠ Producto de peligrosidad <strong>${productoEntrada.peligrosidad}</strong>${productoEntrada.clase_ghs?' — '+productoEntrada.clase_ghs:''} <button class="btn btn-sm" onclick="verSDS(productoEntrada)">Ver SDS</button></div>`;
  } else { banner.innerHTML = ''; }
  if (productoEntrada.unidad) { const sel=document.getElementById('ent-unit'); [...sel.options].forEach(o=>{if(o.value===productoEntrada.unidad)sel.value=o.value;}); }
  document.getElementById('ent-qty').value = '';
  document.getElementById('ent-lote').value = productoEntrada.lote || '';
  document.getElementById('ent-prov').value = productoEntrada.proveedor || '';
  document.getElementById('ent-nota').value = '';
  resetFotoEntrada();
  document.getElementById('ent-form-card').classList.remove('hidden');
  document.getElementById('ent-form-card').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function resetFotoEntrada() {
  fotoEntrada = null;
  const prev=document.getElementById('ent-foto-preview'); const inp=document.getElementById('ent-foto-input');
  if(prev){prev.src='';prev.classList.add('hidden');} if(inp)inp.value='';
  const st=document.getElementById('ent-foto-status'); if(st){st.textContent='Sin foto';st.className='foto-status sin-foto';}
}

function onFotoEntrada(input) {
  const file=input.files[0]; if(!file)return;
  if(!file.type.startsWith('image/')){toast('Solo imágenes');return;}
  if(file.size>5*1024*1024){toast('Máximo 5MB');return;}
  fotoEntrada=file;
  const r=new FileReader(); r.onload=e=>{const p=document.getElementById('ent-foto-preview');p.src=e.target.result;p.classList.remove('hidden');}; r.readAsDataURL(file);
  const st=document.getElementById('ent-foto-status'); st.textContent='✓ Foto lista'; st.className='foto-status con-foto';
}

function solicitarPinEntrada() {
  if(!productoEntrada){toast('Selecciona un producto');return;}
  const qty=Number(document.getElementById('ent-qty').value);
  if(!qty||qty<=0){toast('Ingresa una cantidad válida');return;}
  if(!fotoEntrada){toast('⚠ Debes adjuntar la foto del recibo');return;}
  pinCallback=registrarEntrada; abrirPin();
}

async function registrarEntrada() {
  const qty=Number(document.getElementById('ent-qty').value);
  const nuevoStock=Number(productoEntrada.stock)+qty;
  const unit=document.getElementById('ent-unit').value;
  let fotoUrl=null;
  try { const ext=fotoEntrada.name.split('.').pop(); fotoUrl=await API.subirFoto(`entrada/${new Date().toISOString().split('T')[0]}/${crypto.randomUUID()}.${ext}`,fotoEntrada); }
  catch{toast('Error al subir foto');return;}
  const mov={tipo:'entrada',id_producto:productoEntrada.id,nombre:productoEntrada.nombre,cantidad:qty,unidad:unit,usuario_id:currentUser.id,usuario_nombre:currentProfile?.nombre||currentUser.email,destino:document.getElementById('ent-prov').value,lote:document.getElementById('ent-lote').value,caducidad_lote:document.getElementById('ent-cad').value,nota:document.getElementById('ent-nota').value,stock_resultante:nuevoStock,foto_evidencia:fotoUrl,almacen_id:almacenActivo?.id,created_at:new Date().toISOString()};
  try {
    await Promise.all([API.addMovimiento(mov),API.updateStock(productoEntrada.id,nuevoStock)]);
    await API.addAuditoria({tipo:'movimiento',descripcion:`Entrada de ${qty} ${unit} de ${productoEntrada.nombre}`,usuario_id:currentUser.id,usuario_nombre:currentProfile?.nombre||currentUser.email,metadata:{producto:productoEntrada.id,cantidad:qty,tipo:'entrada',nuevo_stock:nuevoStock}});
    toast(`✓ Entrada registrada — nuevo stock: ${nuevoStock} ${unit}`);
    iniciarEntradas(); todosProductos=[];
  } catch{toast('Error al guardar');}
}

function cancelarEntrada(){document.getElementById('ent-form-card').classList.add('hidden');productoEntrada=null;fotoEntrada=null;}

// ── SALIDAS ───────────────────────────────────────────
function iniciarSalidas() {
  productoSalida=null;fotoSalida=null;
  document.getElementById('sal-buscar').value='';
  document.getElementById('sal-resultados').innerHTML='';
  document.getElementById('sal-form-card').classList.add('hidden');
}

async function buscarProductoSalida(q) {
  if(q.length<2){document.getElementById('sal-resultados').innerHTML='';return;}
  if(!todosProductos.length)todosProductos=await API.getProductos(almacenActivo?.id);
  const f=todosProductos.filter(p=>p.nombre.toLowerCase().includes(q.toLowerCase())||p.id.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('sal-resultados').innerHTML=f.length
    ?f.map(p=>`<div class="search-result-item" onclick="seleccionarProductoSalida('${p.id}')">
        <div class="search-result-name">${p.nombre} ${p.peligrosidad&&p.peligrosidad!=='ninguno'?`<span style="color:var(--red);font-size:11px">⚠ ${p.peligrosidad}</span>`:''}</div>
        <div class="search-result-meta">${p.id} · Stock: <strong>${p.stock} ${p.unidad||''}</strong>${Number(p.stock)<=Number(p.min)?' <span style="color:var(--red)">⚠ Stock bajo</span>':''}${p.ubicacion?' · 📍 '+p.ubicacion:''}</div>
      </div>`).join('')
    :'<div class="empty" style="padding:12px">Sin resultados</div>';
}

async function seleccionarProductoSalida(id) {
  productoSalida=await API.getProducto(id);if(!productoSalida)return;
  document.getElementById('sal-resultados').innerHTML='';
  document.getElementById('sal-buscar').value=productoSalida.nombre;
  document.getElementById('sal-prod-nombre').textContent=productoSalida.nombre;
  document.getElementById('sal-prod-id').textContent=productoSalida.id;
  document.getElementById('sal-prod-stock').textContent=productoSalida.stock+' '+(productoSalida.unidad||'');
  const banner=document.getElementById('sal-sds-banner');
  if(productoSalida.peligrosidad&&productoSalida.peligrosidad!=='ninguno'){
    banner.innerHTML=`<div class="sds-banner ${productoSalida.peligrosidad}">⚠ Producto de peligrosidad <strong>${productoSalida.peligrosidad}</strong> <button class="btn btn-sm" onclick="verSDS(productoSalida)">Ver SDS</button></div>`;
  }else{banner.innerHTML='';}
  if(productoSalida.unidad){const sel=document.getElementById('sal-unit');[...sel.options].forEach(o=>{if(o.value===productoSalida.unidad)sel.value=o.value;});}
  document.getElementById('sal-qty').value='';document.getElementById('sal-dest').value='';document.getElementById('sal-nota').value='';
  resetFotoSalida();
  document.getElementById('sal-form-card').classList.remove('hidden');
  document.getElementById('sal-form-card').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function resetFotoSalida(){fotoSalida=null;const prev=document.getElementById('sal-foto-preview');const inp=document.getElementById('sal-foto-input');if(prev){prev.src='';prev.classList.add('hidden');}if(inp)inp.value='';const st=document.getElementById('sal-foto-status');if(st){st.textContent='Sin foto';st.className='foto-status sin-foto';}}

function onFotoSalida(input){const file=input.files[0];if(!file)return;if(!file.type.startsWith('image/')){toast('Solo imágenes');return;}if(file.size>5*1024*1024){toast('Máximo 5MB');return;}fotoSalida=file;const r=new FileReader();r.onload=e=>{const p=document.getElementById('sal-foto-preview');p.src=e.target.result;p.classList.remove('hidden');};r.readAsDataURL(file);const st=document.getElementById('sal-foto-status');st.textContent='✓ Foto lista';st.className='foto-status con-foto';}

function solicitarPinSalida(){if(!productoSalida){toast('Selecciona un producto');return;}const qty=Number(document.getElementById('sal-qty').value);if(!qty||qty<=0){toast('Ingresa una cantidad válida');return;}if(qty>Number(productoSalida.stock)){toast(`Stock insuficiente. Solo hay ${productoSalida.stock} ${productoSalida.unidad||''}`);return;}if(!fotoSalida){toast('⚠ Debes adjuntar la foto del vale de entrega');return;}pinCallback=registrarSalida;abrirPin();}

async function registrarSalida(){
  const qty=Number(document.getElementById('sal-qty').value);const nuevoStock=Number(productoSalida.stock)-qty;const unit=document.getElementById('sal-unit').value;
  let fotoUrl=null;
  try{const ext=fotoSalida.name.split('.').pop();fotoUrl=await API.subirFoto(`salida/${new Date().toISOString().split('T')[0]}/${crypto.randomUUID()}.${ext}`,fotoSalida);}
  catch{toast('Error al subir foto');return;}
  const mov={tipo:'salida',id_producto:productoSalida.id,nombre:productoSalida.nombre,cantidad:qty,unidad:unit,usuario_id:currentUser.id,usuario_nombre:currentProfile?.nombre||currentUser.email,destino:document.getElementById('sal-dest').value,lote:productoSalida.lote,caducidad_lote:productoSalida.caducidad,nota:document.getElementById('sal-nota').value,stock_resultante:nuevoStock,foto_evidencia:fotoUrl,almacen_id:almacenActivo?.id,created_at:new Date().toISOString()};
  try{await Promise.all([API.addMovimiento(mov),API.updateStock(productoSalida.id,nuevoStock)]);await API.addAuditoria({tipo:'movimiento',descripcion:`Salida de ${qty} ${unit} de ${productoSalida.nombre}`,usuario_id:currentUser.id,usuario_nombre:currentProfile?.nombre||currentUser.email,metadata:{producto:productoSalida.id,cantidad:qty,tipo:'salida',nuevo_stock:nuevoStock}});toast(`✓ Salida registrada — nuevo stock: ${nuevoStock} ${unit}`);iniciarSalidas();todosProductos=[];}
  catch{toast('Error al guardar');}
}

function cancelarSalida(){document.getElementById('sal-form-card').classList.add('hidden');productoSalida=null;fotoSalida=null;}

// ── PIN MODAL ─────────────────────────────────────────
function abrirPin(){document.getElementById('pin-pass').value='';document.getElementById('pin-error').textContent='';document.getElementById('pin-modal').classList.remove('hidden');document.getElementById('pin-pass').focus();}
function cancelPin(){document.getElementById('pin-modal').classList.add('hidden');pinCallback=null;}
async function confirmPin(){
  const pass=document.getElementById('pin-pass').value;
  if(!pass){document.getElementById('pin-error').textContent='Ingresa tu contraseña';return;}
  document.getElementById('pin-error').textContent='Verificando...';
  const ok=await API.verificarPassword(pass);
  if(!ok){document.getElementById('pin-error').textContent='Contraseña incorrecta';return;}
  document.getElementById('pin-modal').classList.add('hidden');
  if(pinCallback){const cb=pinCallback;pinCallback=null;await cb();}
}

// ── INVENTARIO ────────────────────────────────────────
async function cargarInventario(){
  document.getElementById('inv-lista').innerHTML='<div class="loading">Cargando...</div>';
  try{todosProductos=await API.getProductos(almacenActivo?.id);renderInventario(todosProductos);}
  catch{document.getElementById('inv-lista').innerHTML='<div class="empty">Error al cargar</div>';}
}

function renderInventario(lista) {
  const hoy = new Date();
  const esAdmin = currentProfile?.rol==='admin' || (typeof tienePermiso==='function' && tienePermiso('inventario_edit'));
  const valorTotal = lista.reduce((s,p)=>s+(Number(p.stock)*Number(p.precio_unitario||0)),0);
  const header = `<div style="font-size:12px;color:var(--text2);margin-bottom:10px;padding:8px 10px;background:var(--bg);border-radius:var(--radius-sm);display:flex;justify-content:space-between"><span>💰 $${valorTotal.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}</span><span>${lista.length} producto(s)</span></div>`;
  if (!lista.length) { document.getElementById('inv-lista').innerHTML=header+'<div class="empty">Sin productos registrados</div>'; return; }
  document.getElementById('inv-lista').innerHTML = header + lista.map(p=>{
    const sN=Number(p.stock),mN=Number(p.min);
    const dias=p.caducidad?Math.floor((new Date(p.caducidad)-hoy)/86400000):null;
    let badge='badge-ok',bt='OK';
    if(sN<=mN&&mN>0){badge='badge-danger';bt='Stock bajo';}
    else if(dias!==null&&dias<90){badge='badge-warn';bt=dias<0?'Caducado':'Por caducar';}
    const peligroBadge=p.peligrosidad&&p.peligrosidad!=='ninguno'?`<span class="badge badge-danger" style="font-size:10px">⚠ ${p.peligrosidad}</span>`:'';
    const safeNombre=(p.nombre||'').replace(/'/g,"\'").replace(/"/g,'&quot;');
    const prodJson=JSON.stringify(p).replace(/"/g,'&quot;');
    return `<div class="inv-card">
      <div style="display:flex;align-items:flex-start;padding:12px;gap:8px">
        <div style="flex:1;min-width:0;cursor:pointer" onclick="toggleProductoInfo('${p.id}')">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="inv-name">${p.nombre}</span>${peligroBadge}<span class="badge ${badge}">${bt}</span>
          </div>
          <div class="inv-sub" style="margin-top:2px">
            ${p.ingrediente_activo?`<span style="color:var(--blue);font-size:11px">● ${p.ingrediente_activo}</span> · `:''}${p.id}${p.ubicacion?' · 📍 '+p.ubicacion:''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <div style="text-align:right;cursor:pointer" onclick="toggleProductoInfo('${p.id}')">
            <div style="font-size:18px;font-weight:700;color:${sN<=mN&&mN>0?'var(--red)':'var(--navy)'}">${p.stock} <small style="font-size:12px;color:var(--text2);font-weight:400">${p.unidad||''}</small></div>
            <div style="font-size:10px;color:var(--text3)">mín: ${p.min} ${p.unidad||''}</div>
          </div>
          ${p.sds_link?`<a href="${p.sds_link}" target="_blank" class="btn btn-sm btn-primary" style="text-decoration:none;padding:4px 8px" title="Ver ficha técnica">📋</a>`:''}
          <span id="icon-${p.id}" style="color:var(--text3);font-size:12px;cursor:pointer" onclick="toggleProductoInfo('${p.id}')">▶</span>
        </div>
      </div>
      <div class="prod-info-panel hidden" id="info-${p.id}">
        <div class="prod-info-grid">
          ${p.descripcion?`<div class="prod-info-item full"><span class="prod-info-label">Descripción</span><span>${p.descripcion}</span></div>`:''}
          ${p.ingrediente_activo?`<div class="prod-info-item"><span class="prod-info-label">Ingrediente activo</span><span>${p.ingrediente_activo}</span></div>`:''}
          ${p.proveedor?`<div class="prod-info-item"><span class="prod-info-label">Proveedor</span><span>${p.proveedor}</span></div>`:''}
          ${p.lote?`<div class="prod-info-item"><span class="prod-info-label">Lote</span><span>${p.lote}</span></div>`:''}
          ${p.caducidad?`<div class="prod-info-item"><span class="prod-info-label">Caducidad</span><span style="color:${dias!==null&&dias<90?'var(--red)':'inherit'}">${p.caducidad}${dias!==null?' ('+dias+'d)':''}</span></div>`:''}
          ${p.precio_unitario?`<div class="prod-info-item"><span class="prod-info-label">Precio unitario</span><span>$${Number(p.precio_unitario).toFixed(2)}</span></div>`:''}
          ${p.precio_unitario?`<div class="prod-info-item"><span class="prod-info-label">Valor en inventario</span><span>$${(sN*Number(p.precio_unitario)).toFixed(2)}</span></div>`:''}
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          ${esAdmin?`<button class="btn btn-sm btn-primary" onclick="editarProducto('${p.id}')">✏ Editar</button>`:''}
          ${esAdmin?`<button class="btn btn-sm" onclick="mostrarAjuste('${p.id}','${safeNombre}',${p.stock},'${p.unidad||''}')">⚖ Ajustar</button>`:''}
          ${esAdmin?`<button class="btn btn-sm" onclick="mostrarEtiquetaQR(${prodJson})">🏷 QR</button>`:''}
          ${esAdmin?`<button class="btn btn-sm" style="color:var(--red)" onclick="eliminarProducto('${p.id}','${safeNombre}')">🗑</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleProductoInfo(id) {
  const el = document.getElementById('info-'+id);
  const icon = document.getElementById('icon-'+id);
  if (!el) return;
  const hidden = el.classList.contains('hidden');
  document.querySelectorAll('.prod-info-panel').forEach(p=>p.classList.add('hidden'));
  document.querySelectorAll('.prod-toggle-icon,[id^=icon-]').forEach(i=>i.textContent='▶');
  if (hidden) { el.classList.remove('hidden'); if(icon) icon.textContent='▼'; }
}


function mostrarFormProducto(){const f=document.getElementById('form-producto');f.classList.remove('hidden');f.scrollIntoView({behavior:'smooth'});}


function mostrarAjuste(id,nombre,stockActual,unidad){
  const nuevoStock=prompt(`Ajustar stock de "${nombre}"\nStock actual: ${stockActual} ${unidad}\n\nIngresa el nuevo stock total:`);
  if(nuevoStock===null)return;const n=Number(nuevoStock);if(isNaN(n)||n<0){toast('Número inválido');return;}
  pinCallback=async()=>{
    try{
      await API.updateStock(id,n);
      const diff=n-stockActual;
      if(Math.abs(diff)>0){const mov={tipo:diff>=0?'entrada':'salida',id_producto:id,nombre,cantidad:Math.abs(diff),unidad,usuario_id:currentUser.id,usuario_nombre:currentProfile?.nombre||currentUser.email,destino:'Ajuste de inventario',nota:`Ajuste manual: ${stockActual} → ${n} ${unidad}`,stock_resultante:n,almacen_id:almacenActivo?.id,created_at:new Date().toISOString()};await API.addMovimiento(mov);}
      await API.addAuditoria({tipo:'ajuste',descripcion:`Ajuste de stock: ${nombre} ${stockActual}→${n} ${unidad}`,usuario_id:currentUser.id,usuario_nombre:currentProfile?.nombre||currentUser.email});
      toast(`✓ Stock ajustado a ${n} ${unidad}`);todosProductos=[];cargarInventario();cargarDashboard();
    }catch(e){toast('Error: '+e.message);}
  };
  abrirPin();
}

// ── SCANNER helpers ───────────────────────────────────
function abrirQRDesdeScanner(){if(typeof productoEscaneado!=='undefined'&&productoEscaneado)mostrarEtiquetaQR(productoEscaneado);}
function abrirSDSDesdeScanner(){if(typeof productoEscaneado!=='undefined'&&productoEscaneado)verSDS(productoEscaneado);}

// ── MOVIMIENTOS ───────────────────────────────────────
async function cargarMovimientos(){
  document.getElementById('mov-lista').innerHTML='<div class="loading">Cargando...</div>';
  try{todosMovimientos=await API.getMovimientos(100,almacenActivo?.id);const users=[...new Set(todosMovimientos.map(m=>m.usuario_nombre).filter(Boolean))];const sel=document.getElementById('fil-user');sel.innerHTML='<option value="">Todos los usuarios</option>'+users.map(u=>`<option>${u}</option>`).join('');filtrarMov();}
  catch{document.getElementById('mov-lista').innerHTML='<div class="empty">Error al cargar</div>';}
}

function filtrarMov(){const tipo=document.getElementById('fil-tipo').value;const user=document.getElementById('fil-user').value;const f=todosMovimientos.filter(m=>(!tipo||m.tipo===tipo)&&(!user||m.usuario_nombre===user));document.getElementById('mov-lista').innerHTML=f.length?f.map(renderMovItem).join(''):'<div class="empty">Sin movimientos</div>';}

function renderMovItem(m){
  const signo=m.tipo==='entrada'?'+':'−';const fecha=m.created_at?new Date(m.created_at).toLocaleString('es-MX'):'—';const color=m.tipo==='entrada'?'entrada':'salida';
  const fotoHtml=m.foto_evidencia?`<div class="mov-foto"><a href="#" onclick="verFoto('${m.foto_evidencia}');return false;">📎 Ver ${m.tipo==='entrada'?'recibo':'vale'}</a></div>`:'';
  const esAdmin=currentProfile?.rol==='admin';
  const deleteBtn=esAdmin?`<button class="btn btn-sm" style="color:var(--red);padding:2px 6px;font-size:11px;margin-top:4px" onclick="eliminarMovimiento('${m.id}','${(m.nombre||'').replace(/'/g,"\\'")}')">🗑 Eliminar</button>`:'';
  return`<div class="mov-item"><div class="mov-dot ${color}">${m.tipo==='entrada'?'↓':m.tipo==='ajuste'?'⚙':'↑'}</div><div class="mov-body"><div class="mov-name">${m.nombre}</div><div class="mov-meta">${fecha} · ${m.usuario_nombre||'—'}${m.destino?' · '+m.destino:''}</div>${fotoHtml}${deleteBtn}</div><div class="mov-qty ${color}">${m.tipo==='ajuste'?'':signo}${m.cantidad} ${m.unidad||''}</div></div>`;
}

function verFoto(url){const modal=document.getElementById('foto-modal');const img=document.getElementById('foto-modal-img');if(!modal||!img)return;img.src=url;modal.classList.remove('hidden');}
function cerrarFotoModal(){document.getElementById('foto-modal')?.classList.add('hidden');const img=document.getElementById('foto-modal-img');if(img)img.src='';}

// ── PEDIDOS ───────────────────────────────────────────
async function cargarPedidos(){
  document.getElementById('ped-lista').innerHTML='<div class="loading">Cargando...</div>';
  try{const peds=await API.getPedidos();document.getElementById('ped-lista').innerHTML=peds.length?peds.map(p=>{let prods=[];try{prods=JSON.parse(p.productos_json||'[]');}catch{}const prodsHtml=prods.length?`<div class="pedido-detalle">${prods.map(pr=>`<div class="pedido-detalle-item">• ${pr.nombre} — ${pr.qty}</div>`).join('')}</div>`:`<div class="pedido-detalle"><div class="pedido-detalle-item">• ${p.producto||'—'} — ${p.cantidad||'—'}</div></div>`;return`<div class="pedido-item"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="pedido-name">${p.num||'PED'} — ${p.proveedor}</div><div class="pedido-meta">Estimado: ${p.fecha_estimada||'—'}${p.fecha_entrega_real?' · Entregado: '+p.fecha_entrega_real:''}</div>${prodsHtml}${p.nota?`<div class="pedido-meta">Nota: ${p.nota}</div>`:''}</div><span class="badge ${p.estado==='Entregado'?'badge-ok':p.estado==='En tránsito'?'badge-info':'badge-warn'}">${p.estado}</span></div>${p.estado!=='Entregado'?`<button class="btn btn-sm btn-green" style="margin-top:8px" onclick="marcarEntregado('${p.id}')">✓ Marcar entregado</button>`:''+`<button class="btn btn-sm" style="color:var(--red);margin-top:4px" onclick="eliminarPedido('${p.id}','${p.num||'PED'}')">🗑 Eliminar pedido</button>`}</div>`;}).join(''):'<div class="empty">Sin pedidos</div>';}
  catch{document.getElementById('ped-lista').innerHTML='<div class="empty">Error</div>';}
}

function mostrarFormPedido(){pedidoProductos=[];renderListaPedidoProductos();const f=document.getElementById('form-pedido');f.classList.remove('hidden');f.scrollIntoView({behavior:'smooth'});}

function agregarProductoPedido(){const nombre=document.getElementById('pp-prod-nombre').value.trim();const qty=document.getElementById('pp-prod-qty').value.trim();if(!nombre||!qty){toast('Ingresa nombre y cantidad');return;}pedidoProductos.push({nombre,qty});document.getElementById('pp-prod-nombre').value='';document.getElementById('pp-prod-qty').value='';renderListaPedidoProductos();toast('Producto agregado');}

function renderListaPedidoProductos(){const lista=document.getElementById('pp-productos-lista');if(!lista)return;lista.innerHTML=pedidoProductos.length?pedidoProductos.map((p,i)=>`<div class="pedido-prod-item"><div class="pedido-prod-item-name">${p.nombre}</div><div class="pedido-prod-item-qty">${p.qty}</div><button class="pedido-prod-remove" onclick="pedidoProductos.splice(${i},1);renderListaPedidoProductos()">✕</button></div>`).join(''):'<div style="font-size:12px;color:var(--text3);padding:8px 0">Agrega al menos un producto</div>';}

async function guardarPedido(){
  const proveedor=document.getElementById('pp-prov').value.trim();if(!proveedor){toast('Ingresa el proveedor');return;}if(!pedidoProductos.length){toast('Agrega al menos un producto');return;}
  const peds=await API.getPedidos();const num='PED-'+String(peds.length+1).padStart(3,'0');
  const ped={num,proveedor,producto:pedidoProductos.map(p=>p.nombre).join(', '),cantidad:pedidoProductos.map(p=>p.qty).join(', '),productos_json:JSON.stringify(pedidoProductos),fecha_estimada:document.getElementById('pp-fecha').value,nota:document.getElementById('pp-nota').value.trim(),estado:'Confirmado',creado_por:currentProfile?.nombre||currentUser?.email};
  try{await API.addPedido(ped);toast('Pedido '+num+' creado con '+pedidoProductos.length+' producto(s)');document.getElementById('form-pedido').classList.add('hidden');pedidoProductos=[];cargarPedidos();}
  catch(e){toast('Error: '+e.message);}
}

async function marcarEntregado(id){
  const fechaReal=prompt('¿Cuál fue la fecha real de entrega? (AAAA-MM-DD)\nEjemplo: '+new Date().toISOString().split('T')[0]);
  if(fechaReal===null)return;
  try{await API.updateFechaEntrega(id,fechaReal||new Date().toISOString().split('T')[0]);toast('Pedido marcado como entregado');cargarPedidos();}
  catch{toast('Error al actualizar');}
}

// ── USUARIOS ──────────────────────────────────────────
async function cargarUsuarios(expandirId) {
  if(currentProfile?.rol!=='admin')return;
  document.getElementById('users-lista').innerHTML='<div class="loading">Cargando...</div>';
  try {
    const users = await API.getUsuarios();
    if (!users.length) { document.getElementById('users-lista').innerHTML='<div class="empty">Sin usuarios</div>'; return; }
    document.getElementById('users-lista').innerHTML = users.map(u => {
      const permsActivos = typeof MODULOS !== 'undefined'
        ? MODULOS.filter(m => u.permisos?.[m.key]).map(m => m.label) : [];
      const esAdmin = u.rol === 'admin';
      return `<div id="user-item-${u.id}">
        <div class="user-item">
          <div class="user-item-avatar">${(u.nombre||'?').substring(0,2).toUpperCase()}</div>
          <div class="user-item-body">
            <div class="user-item-name">${u.nombre||'—'} ${esAdmin?'<span class="badge badge-admin">Admin</span>':''}</div>
            <div class="user-item-email">${u.email||'—'}</div>
            ${!esAdmin?`<div class="permisos-resumen">${permsActivos.length?permsActivos.slice(0,4).map(p=>'<span class="perm-chip">'+p+'</span>').join('')+(permsActivos.length>4?'<span class="perm-chip">+'+( permsActivos.length-4)+' más</span>':''):'<span class="perm-chip off">Sin permisos asignados</span>'}</div>`:'<div style="font-size:11px;color:var(--text3)">Acceso total al sistema</div>'}
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            ${!esAdmin?`<button class="btn btn-sm btn-primary" onclick="togglePermisosPanel('${u.id}')">⚙ Permisos</button>`:''}
            ${u.id!==currentUser.id&&!esAdmin?`<button class="btn btn-sm" onclick="hacerAdmin('${u.id}','${(u.nombre||'').replace(/'/g,"\\'")}')">↑ Admin</button>`:''}
          </div>
        </div>
        <div id="panel-permisos-${u.id}" class="hidden"></div>
      </div>`;
    }).join('');
    if (expandirId) togglePermisosPanel(expandirId);
  } catch { document.getElementById('users-lista').innerHTML='<div class="empty">Error</div>'; }
}

function togglePermisosPanel(userId) {
  const panel = document.getElementById('panel-permisos-' + userId);
  if (!panel) return;
  if (!panel.classList.contains('hidden') && panel.innerHTML) {
    panel.classList.add('hidden'); panel.innerHTML = ''; return;
  }
  API.getProfile(userId).then(usuario => {
    panel.innerHTML = renderPanelPermisos(usuario);
    panel.classList.remove('hidden');
    panel.scrollIntoView({behavior:'smooth', block:'nearest'});
  });
}

async function hacerAdmin(userId, nombre) {
  if (!confirm('¿Convertir a "'+nombre+'" en administrador? Tendrá acceso total.')) return;
  try {
    await API.updateRol(userId, 'admin');
    await API.addAuditoria({tipo:'rol_cambio', descripcion:nombre+' promovido a administrador', usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email});
    toast('✓ '+nombre+' ahora es administrador'); cargarUsuarios();
  } catch(e) { toast('Error: '+e.message); }
}



async function cambiarRol(userId,nuevoRol,nombre){
  try{await API.updateRol(userId,nuevoRol);await API.addAuditoria({tipo:'rol_cambio',descripcion:`Rol de ${nombre} cambiado a ${nuevoRol}`,usuario_id:currentUser.id,usuario_nombre:currentProfile?.nombre||currentUser.email,metadata:{usuario_afectado:userId,nuevo_rol:nuevoRol}});toast('Rol actualizado a: '+nuevoRol);cargarUsuarios();}
  catch(e){toast('Error: '+e.message);}
}

function mostrarFormUsuario(){const f=document.getElementById('form-usuario');f.classList.remove('hidden');f.scrollIntoView({behavior:'smooth'});}

async function crearUsuario(){
  const nombre=document.getElementById('nu-nombre').value.trim();
  const email=document.getElementById('nu-email').value.trim().toLowerCase();
  const pass=document.getElementById('nu-pass').value;
  if(!nombre||!email||!pass){toast('Completa todos los campos');return;}
  if(pass.length<8){toast('Contraseña mínimo 8 caracteres');return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Correo inválido');return;}
  const btn=document.querySelector('#form-usuario .btn-primary');
  if(btn){btn.disabled=true;btn.textContent='Creando...';}
  try{
    await API.crearUsuario(email,pass,nombre,'operador');
    toast('✓ Usuario creado: '+nombre+'. Asígnale permisos en la lista.');
    document.getElementById('form-usuario').classList.add('hidden');
    ['nu-nombre','nu-email','nu-pass'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    cargarUsuarios();
  }catch(e){
    toast('Error: '+(e.message||'Verifica que el correo no esté registrado'));
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Crear usuario';}
  }
}

// ── AUDITORÍA ─────────────────────────────────────────
async function cargarAuditoria(){
  document.getElementById('aud-lista').innerHTML='<div class="loading">Cargando...</div>';
  try{todaAuditoria=await API.getAuditoria();const users=[...new Set(todaAuditoria.map(a=>a.usuario_nombre).filter(Boolean))];const sel=document.getElementById('aud-user');sel.innerHTML='<option value="">Todos los usuarios</option>'+users.map(u=>`<option>${u}</option>`).join('');filtrarAuditoria();}
  catch{document.getElementById('aud-lista').innerHTML='<div class="empty">Sin registros</div>';}
}

function filtrarAuditoria(){const tipo=document.getElementById('aud-tipo').value;const user=document.getElementById('aud-user').value;const f=todaAuditoria.filter(a=>(!tipo||a.tipo===tipo)&&(!user||a.usuario_nombre===user));const icons={login:'🔑',rol_cambio:'👤',producto_nuevo:'📦',movimiento:'🔄',ajuste:'⚙'};const clases={login:'login',rol_cambio:'rol',producto_nuevo:'prod',movimiento:'mov',ajuste:'mov'};document.getElementById('aud-lista').innerHTML=f.length?f.map(a=>`<div class="aud-item"><div class="aud-icon ${clases[a.tipo]||'mov'}">${icons[a.tipo]||'📋'}</div><div><div class="aud-name">${a.descripcion||a.tipo}</div><div class="aud-meta">${a.usuario_nombre||'—'} · ${a.created_at?new Date(a.created_at).toLocaleString('es-MX'):'—'}</div></div></div>`).join(''):'<div class="empty">Sin registros</div>';}

// ── ALERTAS ───────────────────────────────────────────
async function cargarAlertas(){
  document.getElementById('alertas-lista').innerHTML='<div class="loading">Cargando...</div>';
  try{const prods=await API.getProductos(almacenActivo?.id);const hoy=new Date();const alertas=[];prods.forEach(p=>{if(Number(p.stock)<=Number(p.min))alertas.push({tipo:'danger',icon:'⚠',nombre:p.nombre,detalle:`Stock bajo: ${p.stock} ${p.unidad||''} (mínimo: ${p.min})`});if(p.caducidad){const dias=Math.floor((new Date(p.caducidad)-hoy)/86400000);if(dias<90)alertas.push({tipo:'warn',icon:'⏰',nombre:p.nombre,detalle:`Caduca en ${dias} días (${p.caducidad})`});}});document.getElementById('alertas-lista').innerHTML=alertas.length?alertas.map(a=>`<div class="alert-item"><div class="alert-icon ${a.tipo}">${a.icon}</div><div><div class="alert-name">${a.nombre}</div><div class="alert-detail">${a.detalle}</div></div></div>`).join(''):'<div class="empty">✓ Sin alertas activas</div>';}
  catch{document.getElementById('alertas-lista').innerHTML='<div class="empty">Error</div>';}
}

// ── TOAST ─────────────────────────────────────────────
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.add('hidden'),3200);}

// ── EVENTOS ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('l-pass')?.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
  document.getElementById('pin-pass')?.addEventListener('keydown',e=>{if(e.key==='Enter')confirmPin();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){cerrarFotoModal();cerrarSDS();cerrarQR();}});
});

// ── ELIMINAR REGISTROS ────────────────────────────────
async function eliminarProducto(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}"?\n\nEsto eliminará el producto del inventario. Los movimientos registrados se conservan.`)) return;
  try {
    await API.eliminarProducto(id);
    await API.addAuditoria({ tipo:'ajuste', descripcion:`Producto eliminado: ${nombre} (${id})`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
    toast('✓ Producto eliminado: ' + nombre);
    todosProductos = [];
    await cargarInventario();
    cargarDashboard();
    await cargarDashboard(); // Actualizar contadores
  } catch(e) { toast('Error al eliminar: ' + e.message); }
}

async function eliminarMovimiento(id, nombre) {
  if (!confirm(`¿Eliminar este movimiento de "${nombre}"?\n\nNota: El stock NO se revertirá automáticamente.`)) return;
  try {
    await API.eliminarMovimiento(id);
    await API.addAuditoria({ tipo:'ajuste', descripcion:`Movimiento eliminado: ${nombre}`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
    toast('✓ Movimiento eliminado');
    cargarMovimientos();
  } catch(e) { toast('Error al eliminar: ' + e.message); }
}

async function eliminarPedido(id, num) {
  if (!confirm(`¿Eliminar el pedido ${num}?`)) return;
  try {
    await API.eliminarPedido(id);
    toast('✓ Pedido eliminado');
    cargarPedidos();
  } catch(e) { toast('Error al eliminar: ' + e.message); }
}

async function eliminarUsuarioSistema(userId, nombre) {
  if (userId === currentUser.id) { toast('No puedes eliminarte a ti mismo'); return; }
  if (!confirm(`¿Eliminar al usuario "${nombre}"?\n\nSus movimientos y registros se conservan.`)) return;
  try {
    await API.eliminarUsuario(userId);
    await API.addAuditoria({ tipo:'rol_cambio', descripcion:`Usuario eliminado: ${nombre}`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
    toast('✓ Usuario eliminado: ' + nombre);
    cargarUsuarios();
  } catch(e) { toast('Error al eliminar: ' + e.message); }
}

// ── ENTRADAS/SALIDAS UNIFICADO ────────────────────────
function switchMovStock(tipo) {
  // Las secciones de entrada/salida están dentro de tab-movstock
  const entSec = document.getElementById('movstock-entrada');
  const salSec = document.getElementById('movstock-salida');
  const btnEnt = document.getElementById('ms-tab-ent');
  const btnSal = document.getElementById('ms-tab-sal');

  if (tipo === 'entrada') {
    entSec?.classList.remove('hidden');
    salSec?.classList.add('hidden');
    btnEnt?.classList.add('active');
    btnSal?.classList.remove('active');
    // Limpiar formulario de entrada de forma segura
    carritoEntrada = []; fotoEntrada = null;
    document.getElementById('ent-resultados')?.replaceChildren?.();
    const buscarEl = document.getElementById('ent-buscar');
    if (buscarEl) buscarEl.value = '';
    document.getElementById('ent-carrito-card')?.classList.add('hidden');
    document.getElementById('ent-form-general')?.classList.add('hidden');
  } else {
    salSec?.classList.remove('hidden');
    entSec?.classList.add('hidden');
    btnSal?.classList.add('active');
    btnEnt?.classList.remove('active');
    // Limpiar formulario de salida de forma segura
    carritoSalida = []; fotoSalida = null;
    document.getElementById('sal-resultados')?.replaceChildren?.();
    const buscarSal = document.getElementById('sal-buscar');
    if (buscarSal) buscarSal.value = '';
    document.getElementById('sal-carrito-card')?.classList.add('hidden');
    document.getElementById('sal-form-general')?.classList.add('hidden');
  }
}

// ── DASHBOARD UNIFICADO ───────────────────────────────
async function cargarDashboardUnificado() {
  await cargarDashboard();
  const inlineDiv = document.getElementById('dir-content-inline');
  if (!inlineDiv) return;
  if (currentProfile?.rol === 'admin' || tienePermiso('dir')) {
    inlineDiv.innerHTML = '<div class="loading" style="margin-top:12px">Cargando resumen ejecutivo...</div>';
    try {
      // Llamar directamente a la función y capturar el HTML resultante
      await cargarDashboardDirInline(inlineDiv);
    } catch(e) {
      inlineDiv.innerHTML = '';
    }
  } else {
    inlineDiv.innerHTML = '';
  }
}

// ── ELIMINAR USUARIO ──────────────────────────────────
// (ya definido arriba como eliminarUsuarioSistema)

// ── SCANNER INTEGRADO EN ENTRADAS ─────────────────────
let scannerEnt = null, scannerSal = null;

function startScannerEnt() {
  const el = document.getElementById('reader-ent');
  if (!el) return;
  el.style.display = 'block';
  if (scannerEnt) return;
  scannerEnt = new Html5Qrcode('reader-ent');
  scannerEnt.start({ facingMode:'environment' }, { fps:10, qrbox:{width:240,height:120} },
    (code) => { stopScannerEnt(); document.getElementById('ent-buscar').value = code.trim(); buscarProductoEntrada(code.trim()); },
    () => {}
  ).catch(() => toast('No se pudo acceder a la cámara'));
}

function stopScannerEnt() {
  if (scannerEnt) { scannerEnt.stop().catch(()=>{}); scannerEnt = null; }
  const el = document.getElementById('reader-ent'); if(el) el.style.display = 'none';
}

function startScannerSal() {
  const el = document.getElementById('reader-sal');
  if (!el) return;
  el.style.display = 'block';
  if (scannerSal) return;
  scannerSal = new Html5Qrcode('reader-sal');
  scannerSal.start({ facingMode:'environment' }, { fps:10, qrbox:{width:240,height:120} },
    (code) => { stopScannerSal(); document.getElementById('sal-buscar').value = code.trim(); buscarProductoSalida(code.trim()); },
    () => {}
  ).catch(() => toast('No se pudo acceder a la cámara'));
}

function stopScannerSal() {
  if (scannerSal) { scannerSal.stop().catch(()=>{}); scannerSal = null; }
  const el = document.getElementById('reader-sal'); if(el) el.style.display = 'none';
}

// ── FILTRAR PEDIDOS CLIENTES ──────────────────────────
let todosPedidosClientes = [];

async function cargarPedidosClientesCompleto() {
  document.getElementById('pc-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try {
    todosPedidosClientes = await API.getPedidosClientes();
    filtrarPedidosClientes();
  } catch { document.getElementById('pc-lista').innerHTML = '<div class="empty">Error al cargar</div>'; }
}

function filtrarPedidosClientes() {
  const estado = document.getElementById('pc-filtro-estado')?.value || '';
  const prior  = document.getElementById('pc-filtro-prioridad')?.value || '';
  const f = todosPedidosClientes.filter(p =>
    (!estado || p.estado === estado) && (!prior || p.prioridad === prior)
  );
  renderPedidosClientes(f);
}

// ── ELIMINAR ALMACÉN ──────────────────────────────────
async function eliminarAlmacen(id, nombre) {
  if (almacenActivo?.id === id) { toast('No puedes eliminar el almacén activo'); return; }
  if (!confirm(`¿Eliminar el almacén "${nombre}"?\n\nLos productos asociados no se eliminarán.`)) return;
  try {
    await API.eliminarAlmacen(id);
    toast('✓ Almacén eliminado: ' + nombre);
    cargarAlmacenes();
    iniciarAlmacenes();
  } catch(e) { toast('Error: ' + e.message); }
}

// ── REFRESCAR DASHBOARD ───────────────────────────────
async function refrescarDashboard(btn) {
  if (btn) { btn.textContent = '↻ Cargando...'; btn.disabled = true; }
  todosProductos = []; // Limpiar caché para forzar recarga
  await cargarDashboardUnificado();
  if (btn) { btn.textContent = '↻ Actualizar'; btn.disabled = false; }
  toast('Dashboard actualizado');
}


// ── EDIT PRODUCTO ─────────────────────────────────────
function editarProducto(id) {
  const prod = todosProductos.find(p=>p.id===id);
  if (!prod) return;
  const modal = document.getElementById('modal-editar-prod');
  if (!modal) return;
  ['ep-id','ep-nombre','ep-stock','ep-min','ep-precio','ep-unidad','ep-prov','ep-lote',
   'ep-cad','ep-ubicacion','ep-peligro','ep-ghs','ep-ingrediente','ep-descripcion','ep-sds-link'
  ].forEach(fid => {
    const el = document.getElementById(fid);
    if (!el) return;
    const key = fid.replace('ep-','').replace('-','_');
    const map = {'id':'id','nombre':'nombre','stock':'stock','min':'min','precio':'precio_unitario',
                 'unidad':'unidad','prov':'proveedor','lote':'lote','cad':'caducidad',
                 'ubicacion':'ubicacion','peligro':'peligrosidad','ghs':'clase_ghs',
                 'ingrediente':'ingrediente_activo','descripcion':'descripcion','sds_link':'sds_link'};
    el.value = prod[map[fid.replace('ep-','')] || key] || '';
  });
  modal.classList.remove('hidden');
}

function cerrarEditarProducto() { document.getElementById('modal-editar-prod')?.classList.add('hidden'); }

async function guardarEdicionProducto() {
  const id = document.getElementById('ep-id')?.value;
  if (!id) return;
  const datos = {
    nombre:           document.getElementById('ep-nombre')?.value.trim(),
    stock:            Number(document.getElementById('ep-stock')?.value)||0,
    min:              Number(document.getElementById('ep-min')?.value)||0,
    precio_unitario:  Number(document.getElementById('ep-precio')?.value)||0,
    unidad:           document.getElementById('ep-unidad')?.value||'',
    proveedor:        document.getElementById('ep-prov')?.value.trim()||'',
    lote:             document.getElementById('ep-lote')?.value.trim()||'',
    caducidad:        document.getElementById('ep-cad')?.value||null,
    ubicacion:        document.getElementById('ep-ubicacion')?.value.trim()||'',
    peligrosidad:     document.getElementById('ep-peligro')?.value||'',
    clase_ghs:        document.getElementById('ep-ghs')?.value.trim()||'',
    ingrediente_activo: document.getElementById('ep-ingrediente')?.value.trim()||'',
    descripcion:      document.getElementById('ep-descripcion')?.value.trim()||'',
    sds_link:         document.getElementById('ep-sds-link')?.value.trim()||'',
  };
  if (!datos.nombre) { toast('El nombre es obligatorio'); return; }
  try {
    await API.updateProducto(id, datos);
    await API.addAuditoria({tipo:'ajuste',descripcion:`Producto editado: ${datos.nombre}`,usuario_id:currentUser.id,usuario_nombre:currentProfile?.nombre||currentUser.email});
    toast('✓ Producto actualizado');
    cerrarEditarProducto();
    todosProductos=[];
    cargarInventario();
  } catch(e) { toast('Error: '+e.message); }
}

// ── GUARDAR PRODUCTO NUEVO ────────────────────────────
async function guardarProducto() {
  const nombre = document.getElementById('np-nombre')?.value.trim();
  if (!nombre) { toast('El nombre es obligatorio'); return; }
  let cod = document.getElementById('np-id')?.value.trim();
  if (!cod) cod = 'QM-' + Date.now().toString().slice(-6);
  const prod = {
    id: cod, nombre, activo: true,
    stock:            Number(document.getElementById('np-stock')?.value)||0,
    min:              Number(document.getElementById('np-min')?.value)||0,
    unidad:           document.getElementById('np-unit')?.value||'piezas',
    proveedor:        document.getElementById('np-prov')?.value.trim()||'',
    lote:             document.getElementById('np-lote')?.value.trim()||'',
    caducidad:        document.getElementById('np-cad')?.value||null,
    ubicacion:        document.getElementById('np-ubicacion')?.value.trim()||'',
    precio_unitario:  Number(document.getElementById('np-precio')?.value)||0,
    peligrosidad:     document.getElementById('np-peligro')?.value||'',
    clase_ghs:        document.getElementById('np-ghs')?.value.trim()||'',
    ingrediente_activo: document.getElementById('np-ingrediente')?.value.trim()||'',
    descripcion:      document.getElementById('np-descripcion')?.value.trim()||'',
    sds_link:         document.getElementById('np-sds-link')?.value.trim()||'',
    almacen_id:       typeof almacenActivo!=='undefined'?almacenActivo?.id:null,
  };
  if (!prod.caducidad) prod.caducidad = null;
  try {
    await API.addProducto(prod);
    await API.addAuditoria({tipo:'producto_nuevo',descripcion:`Producto: ${prod.nombre} (${prod.id})`,usuario_id:currentUser.id,usuario_nombre:currentProfile?.nombre||currentUser.email});
    toast(`✓ Guardado: ${prod.nombre} — Código: ${prod.id}`);
    document.getElementById('form-producto')?.classList.add('hidden');
    todosProductos=[];
    cargarInventario();
  } catch(e) { toast('Error: '+e.message); }
}

// ── FILTRAR INVENTARIO ────────────────────────────────
function filtrarInv(q) {
  renderInventario(q ? todosProductos.filter(p=>
    p.nombre.toLowerCase().includes(q.toLowerCase())||
    p.id.toLowerCase().includes(q.toLowerCase())||
    (p.ubicacion||'').toLowerCase().includes(q.toLowerCase())||
    (p.ingrediente_activo||'').toLowerCase().includes(q.toLowerCase())
  ) : todosProductos);
}

// ── CSS CLASSES for new panels ────────────────────────

// ── PEDIDOS UNIFICADO ─────────────────────────────────
async function cargarPedidosUnificado() {
  // Load both views
  await Promise.all([cargarPedidosClientes(), cargarPedidos()]);
}

function switchPedidos(vista) {
  const recView  = document.getElementById('ped-recibidos-view');
  const provView = document.getElementById('ped-proveedores-view');
  const tabRec   = document.getElementById('ped-tab-rec');
  const tabProv  = document.getElementById('ped-tab-prov');
  if (vista === 'recibidos') {
    recView?.classList.remove('hidden');  provView?.classList.add('hidden');
    tabRec?.classList.add('active');      tabProv?.classList.remove('active');
    cargarPedidosClientes();
  } else {
    provView?.classList.remove('hidden'); recView?.classList.add('hidden');
    tabProv?.classList.add('active');     tabRec?.classList.remove('active');
    cargarPedidos();
  }
}
