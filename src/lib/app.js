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
let scannerEnt       = null;
let scannerSal       = null;
let carritoEntrada   = [];
let carritoSalida    = [];

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


async function cargarPerfil() {
  try { currentProfile = await API.getProfile(currentUser.id); mostrarApp(); }
  catch { toast('Error al cargar perfil'); await API.signOut(); }
}


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


function goTo(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  btn.classList.add('active');
  if (typeof stopScanner === 'function') stopScanner();
  stopScannerEnt();
  stopScannerSal();
  const loaders = {
    dashboard: cargarDashboardUnificado, inventario: cargarInventario,
    movimientos: cargarMovimientos, pedidos: cargarPedidos,
    usuarios: cargarUsuarios, alertas: cargarAlertas,
    auditoria: cargarAuditoria, proveedores: cargarProveedores,
    almacenes: cargarAlmacenes, dir: cargarDashboardDir,
    movstock: () => switchMovStock('entrada'),
    entradas: iniciarEntradas, salidas: iniciarSalidas,
    scanner: () => {}, // scanner integrado en entradas/salidas
    conteo: cargarConteo,
    kpis: () => { goTo('dashboard', document.querySelector('.nav-btn')); cargarKPIs(); },
    'pedidos-clientes': cargarPedidosClientesCompleto,
    notificaciones: cargarNotificaciones,
    respaldo: () => {},
  };
  loaders[tab]?.();
}


async function cargarDashboard() {
  try {
    const [prods, movs, peds] = await Promise.all([API.getProductos(almacenActivo?.id), API.getMovimientos(6), API.getPedidos()]);
    todosProductos = prods;
    const hoy  = new Date();
    const prodsActivos = prods.filter(p => Number(p.stock) > 0);
    const prodsBajo    = prods.filter(p => Number(p.stock) <= Number(p.min) && Number(p.min) > 0);
    const prodsCad     = prods.filter(p => p.caducidad && Math.floor((new Date(p.caducidad)-hoy)/86400000) >= 0 && Math.floor((new Date(p.caducidad)-hoy)/86400000) < 90);
    const prodsCad0    = prods.filter(p => p.caducidad && new Date(p.caducidad) < hoy);
    const bajo = prodsBajo.length;
    const cad  = prodsCad.length;
    const cad0 = prodsCad0.length;
    const act  = peds.filter(p => p.estado !== 'Entregado').length;
    const valTot = prods.reduce((s,p) => s+(Number(p.stock)*Number(p.precio_unitario||0)), 0);

    document.getElementById('m-prod').textContent = prodsActivos.length;
    document.getElementById('m-bajo').textContent = bajo;
    document.getElementById('m-cad').textContent  = cad;
    document.getElementById('m-ped').textContent  = act;
    const cnt = bajo + cad + cad0;
    const dot = document.getElementById('alert-count');
    if (dot) { dot.textContent = cnt; cnt > 0 ? dot.classList.remove('hidden') : dot.classList.add('hidden'); }

    document.getElementById('dash-movs').innerHTML = movs.length
      ? movs.map(renderMovItem).join('')
      : '<div class="empty">Sin movimientos aún</div>';

    const qkpis = document.getElementById('dash-kpis-quick');
    if (!qkpis) return;
    qkpis.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-bottom:12px">
        ${valTot>0?`<div class="kpi-main-card" style="border-left:3px solid var(--green)">
          <div class="kpi-icon" style="background:var(--green-bg);color:var(--green)">💰</div>
          <div><div class="kpi-label">Valor inventario</div><div class="kpi-val" style="color:var(--green);font-size:16px">$${valTot.toLocaleString('es-MX',{maximumFractionDigits:0})}</div></div>
        </div>`:''}
        <div class="kpi-main-card" style="border-left:3px solid var(--blue)">
          <div class="kpi-icon" style="background:var(--blue-bg);color:var(--blue)">📦</div>
          <div><div class="kpi-label">En stock</div><div class="kpi-val" style="color:var(--navy);font-size:20px">${prodsActivos.length}</div></div>
        </div>
        <div class="kpi-main-card" style="border-left:3px solid ${bajo>0?'var(--red)':'var(--green)'};cursor:pointer" onclick="toggleDashPanel('panel-bajo')">
          <div class="kpi-icon" style="background:${bajo>0?'var(--red-bg)':'var(--green-bg)'};color:${bajo>0?'var(--red)':'var(--green)'}">📉</div>
          <div><div class="kpi-label">Stock bajo ${bajo>0?'▼':''}</div><div class="kpi-val" style="color:${bajo>0?'var(--red)':'var(--green)'};font-size:20px">${bajo}</div></div>
        </div>
        <div class="kpi-main-card" style="border-left:3px solid ${cad>0?'var(--amber)':'var(--green)'};cursor:pointer" onclick="toggleDashPanel('panel-cad')">
          <div class="kpi-icon" style="background:${cad>0?'var(--amber-bg)':'var(--green-bg)'};color:${cad>0?'var(--amber)':'var(--green)'}">⏰</div>
          <div><div class="kpi-label">Por caducar ${cad>0?'▼':''}</div><div class="kpi-val" style="color:${cad>0?'var(--amber)':'var(--green)'};font-size:20px">${cad}</div></div>
        </div>
        <div class="kpi-main-card" style="border-left:3px solid ${cad0>0?'var(--red)':'var(--green)'};cursor:pointer" onclick="toggleDashPanel('panel-cad0')">
          <div class="kpi-icon" style="background:${cad0>0?'var(--red-bg)':'var(--green-bg)'};color:${cad0>0?'var(--red)':'var(--green)'}">🗑</div>
          <div><div class="kpi-label">Caducados ${cad0>0?'▼':''}</div><div class="kpi-val" style="color:${cad0>0?'var(--red)':'var(--green)'};font-size:20px">${cad0}</div></div>
        </div>
        <div class="kpi-main-card" style="border-left:3px solid ${act>0?'var(--blue)':'var(--green)'};cursor:pointer" onclick="goTo('pedidos-clientes',document.querySelector('[onclick*=pedidos-clientes]'))">
          <div class="kpi-icon" style="background:var(--blue-bg);color:var(--blue)">📋</div>
          <div><div class="kpi-label">Pedidos activos</div><div class="kpi-val" style="color:var(--blue);font-size:20px">${act}</div></div>
        </div>
      </div>

      <!-- PANEL STOCK BAJO -->
      <div id="panel-bajo" class="dash-panel ${bajo>0?'':'hidden'}">
        <div class="dash-panel-title">📉 Productos con stock bajo (${bajo})</div>
        ${prodsBajo.length ? prodsBajo.map(p=>`
          <div class="dash-panel-item">
            <div><div class="dash-panel-nombre">${p.nombre}</div><div class="dash-panel-sub">${p.id}${p.ubicacion?' · 📍 '+p.ubicacion:''}</div></div>
            <div style="text-align:right"><div style="font-size:15px;font-weight:700;color:var(--red)">${p.stock} ${p.unidad||''}</div><div style="font-size:11px;color:var(--text3)">mín: ${p.min} ${p.unidad||''}</div></div>
          </div>`).join('') : '<div class="empty">Sin productos</div>'}
      </div>

      <!-- PANEL POR CADUCAR -->
      <div id="panel-cad" class="dash-panel ${cad>0?'':'hidden'}">
        <div class="dash-panel-title">⏰ Por caducar — próximos 90 días (${cad})</div>
        ${prodsCad.length ? prodsCad.sort((a,b)=>new Date(a.caducidad)-new Date(b.caducidad)).map(p=>{
          const dias = Math.floor((new Date(p.caducidad)-hoy)/86400000);
          return `<div class="dash-panel-item">
            <div><div class="dash-panel-nombre">${p.nombre}</div><div class="dash-panel-sub">${p.caducidad} · Stock: ${p.stock} ${p.unidad||''}</div></div>
            <div style="text-align:right"><div style="font-size:13px;font-weight:700;color:${dias<30?'var(--red)':'var(--amber)'}">${dias===0?'HOY':dias+' días'}</div></div>
          </div>`;}).join('') : '<div class="empty">Sin productos</div>'}
      </div>

      <!-- PANEL CADUCADOS -->
      <div id="panel-cad0" class="dash-panel ${cad0>0?'':'hidden'}">
        <div class="dash-panel-title">🗑 Productos caducados (${cad0})</div>
        ${prodsCad0.length ? prodsCad0.map(p=>{
          const dias = Math.abs(Math.floor((new Date(p.caducidad)-hoy)/86400000));
          return `<div class="dash-panel-item">
            <div><div class="dash-panel-nombre">${p.nombre}</div><div class="dash-panel-sub">Caducó: ${p.caducidad} · Stock: ${p.stock} ${p.unidad||''}</div></div>
            <div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--red)">Hace ${dias}d</div></div>
          </div>`;}).join('') : '<div class="empty">Sin productos</div>'}
      </div>`;

  } catch(e) {
    const el = document.getElementById('dash-movs');
    if (el) el.innerHTML = '<div class="empty">Error al cargar: ' + e.message + '</div>';
  }
}


function iniciarEntradas() {
  carritoEntrada = []; fotoEntrada = null;
  document.getElementById('ent-buscar').value = '';
  document.getElementById('ent-resultados').innerHTML = '';
  const cc = document.getElementById('ent-carrito-card');
  const fg = document.getElementById('ent-form-general');
  if(cc) cc.classList.add('hidden');
  if(fg) fg.classList.add('hidden');
  resetFotoEntrada();
}


async function buscarProductoEntrada(q) {
  if (q.length < 2) { document.getElementById('ent-resultados').innerHTML = ''; return; }
  if (!todosProductos.length) todosProductos = await API.getProductos(almacenActivo?.id);
  const f = todosProductos.filter(p => p.nombre.toLowerCase().includes(q.toLowerCase()) || p.id.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('ent-resultados').innerHTML = f.length
    ? f.map(p => `<div class="search-result-item" onclick="agregarAlCarritoEntrada('${p.id}')">
        <div class="search-result-name">${p.nombre} ${p.peligrosidad&&p.peligrosidad!=='ninguno'?'<span style="color:var(--red);font-size:11px">⚠ '+p.peligrosidad+'</span>':''}</div>
        <div class="search-result-meta">${p.id} · Stock actual: ${p.stock} ${p.unidad||''}${p.ubicacion?' · 📍 '+p.ubicacion:''}</div>
      </div>`).join('')
    : '<div class="empty" style="padding:10px">Sin resultados</div>';
}


async function agregarAlCarritoEntrada(id) {
  // Verificar si ya está en el carrito
  if (carritoEntrada.find(i => i.producto.id === id)) {
    toast('Este producto ya está en la lista'); return;
  }
  const prod = await API.getProducto(id);
  if (!prod) return;
  carritoEntrada.push({ producto: prod, qty: '', unidad: prod.unidad||'L', lote: '', cad: '' });
  document.getElementById('ent-buscar').value = '';
  document.getElementById('ent-resultados').innerHTML = '';
  renderCarritoEntrada();
}


function renderCarritoEntrada() {
  const card = document.getElementById('ent-carrito-card');
  const formGen = document.getElementById('ent-form-general');
  if (!carritoEntrada.length) { card?.classList.add('hidden'); formGen?.classList.add('hidden'); return; }
  card?.classList.remove('hidden');
  formGen?.classList.remove('hidden');
  const count = document.getElementById('ent-carrito-count');
  if(count) count.textContent = carritoEntrada.length + ' producto(s)';
  document.getElementById('ent-carrito-lista').innerHTML = carritoEntrada.map((item, i) => `
    <div class="carrito-item" id="ci-ent-${i}">
      <div class="carrito-item-header">
        <div>
          <div class="carrito-item-nombre">${item.producto.nombre}</div>
          <div class="carrito-item-sub">Stock actual: ${item.producto.stock} ${item.unidad}</div>
        </div>
        <button class="btn btn-sm" style="color:var(--red)" onclick="quitarDeCarritoEntrada(${i})">✕</button>
      </div>
      <div class="form-row" style="margin-top:8px">
        <div class="form-group">
          <label>Cantidad *</label>
          <input class="input" type="number" min="0.01" step="0.01" placeholder="0"
            value="${item.qty}" oninput="carritoEntrada[${i}].qty=this.value">
        </div>
        <div class="form-group">
          <label>Unidad</label>
          <select class="input" onchange="carritoEntrada[${i}].unidad=this.value">
            ${['L','kg','piezas','tambos','cajas','mL','g'].map(u=>`<option ${item.unidad===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>N° lote</label>
          <input class="input" type="text" placeholder="L-2025-01"
            value="${item.lote}" oninput="carritoEntrada[${i}].lote=this.value">
        </div>
        <div class="form-group">
          <label>Caducidad</label>
          <input class="input" type="date"
            value="${item.cad}" oninput="carritoEntrada[${i}].cad=this.value">
        </div>
      </div>
    </div>`).join('');
}


function quitarDeCarritoEntrada(i) {
  carritoEntrada.splice(i, 1);
  renderCarritoEntrada();
}


function resetFotoEntrada() {
  fotoEntrada = null;
  const prev=document.getElementById('ent-foto-preview');
  const inp=document.getElementById('ent-foto-input');
  if(prev){prev.src='';prev.classList.add('hidden');}
  if(inp) inp.value='';
  const st=document.getElementById('ent-foto-status');
  if(st){st.textContent='Sin foto';st.className='foto-status sin-foto';}
}


function onFotoEntrada(input) {
  const file=input.files[0]; if(!file)return;
  if(!file.type.startsWith('image/')){toast('Solo imágenes');return;}
  if(file.size>5*1024*1024){toast('Máximo 5MB');return;}
  fotoEntrada=file;
  const r=new FileReader();
  r.onload=e=>{const p=document.getElementById('ent-foto-preview');p.src=e.target.result;p.classList.remove('hidden');};
  r.readAsDataURL(file);
  const st=document.getElementById('ent-foto-status');
  st.textContent='✓ Foto lista'; st.className='foto-status con-foto';
}


function solicitarPinEntrada() {
  if (!carritoEntrada.length) { toast('Agrega al menos un producto'); return; }
  const sinQty = carritoEntrada.filter(i => !i.qty || Number(i.qty) <= 0);
  if (sinQty.length) { toast(`Ingresa la cantidad de: ${sinQty[0].producto.nombre}`); return; }
  if (!fotoEntrada) { toast('⚠ Adjunta la foto del recibo'); return; }
  pinCallback = registrarEntrada;
  abrirPin();
}


async function registrarEntrada() {
  let fotoUrl = null;
  try {
    const ext = fotoEntrada.name.split('.').pop();
    fotoUrl = await API.subirFoto(`entrada/${new Date().toISOString().split('T')[0]}/${crypto.randomUUID()}.${ext}`, fotoEntrada);
  } catch { toast('Error al subir foto'); return; }

  let errores = 0;
  for (const item of carritoEntrada) {
    const qty = Number(item.qty);
    const nuevoStock = Number(item.producto.stock) + qty;
    try {
      await Promise.all([
        API.updateStock(item.producto.id, nuevoStock),
        API.addMovimiento({
          tipo:'entrada', id_producto:item.producto.id, nombre:item.producto.nombre,
          cantidad:qty, unidad:item.unidad,
          usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email,
          destino:document.getElementById('ent-prov')?.value||'',
          lote:item.lote, caducidad_lote:item.cad,
          nota:document.getElementById('ent-nota')?.value||'',
          stock_resultante:nuevoStock, foto_evidencia:fotoUrl,
          almacen_id:almacenActivo?.id, created_at:new Date().toISOString(),
        })
      ]);
    } catch { errores++; }
  }
  await API.addAuditoria({ tipo:'movimiento', descripcion:`Entrada de ${carritoEntrada.length} productos`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
  if (errores) toast(`⚠ ${errores} productos no se guardaron correctamente`);
  else toast(`✓ Entrada registrada — ${carritoEntrada.length} producto(s) actualizados`);
  iniciarEntradas();
  todosProductos = [];
  cargarDashboard();
}


function cancelarEntrada() { iniciarEntradas(); }


function iniciarSalidas() {
  carritoSalida = []; fotoSalida = null;
  document.getElementById('sal-buscar').value = '';
  document.getElementById('sal-resultados').innerHTML = '';
  const cc = document.getElementById('sal-carrito-card');
  const fg = document.getElementById('sal-form-general');
  if(cc) cc.classList.add('hidden');
  if(fg) fg.classList.add('hidden');
  resetFotoSalida();
}


async function buscarProductoSalida(q) {
  if (q.length < 2) { document.getElementById('sal-resultados').innerHTML = ''; return; }
  if (!todosProductos.length) todosProductos = await API.getProductos(almacenActivo?.id);
  const f = todosProductos.filter(p => p.nombre.toLowerCase().includes(q.toLowerCase()) || p.id.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('sal-resultados').innerHTML = f.length
    ? f.map(p => `<div class="search-result-item" onclick="agregarAlCarritoSalida('${p.id}')">
        <div class="search-result-name">${p.nombre} ${p.peligrosidad&&p.peligrosidad!=='ninguno'?'<span style="color:var(--red);font-size:11px">⚠ '+p.peligrosidad+'</span>':''}</div>
        <div class="search-result-meta">${p.id} · Stock: <strong>${p.stock} ${p.unidad||''}</strong>${Number(p.stock)<=Number(p.min)?' <span style="color:var(--red)">⚠ Stock bajo</span>':''}${p.ubicacion?' · 📍 '+p.ubicacion:''}</div>
      </div>`).join('')
    : '<div class="empty" style="padding:10px">Sin resultados</div>';
}


async function agregarAlCarritoSalida(id) {
  if (carritoSalida.find(i => i.producto.id === id)) {
    toast('Este producto ya está en la lista'); return;
  }
  const prod = await API.getProducto(id);
  if (!prod) return;
  if (Number(prod.stock) <= 0) { toast(`Sin stock disponible: ${prod.nombre}`); return; }
  carritoSalida.push({ producto: prod, qty: '', unidad: prod.unidad||'L' });
  document.getElementById('sal-buscar').value = '';
  document.getElementById('sal-resultados').innerHTML = '';
  renderCarritoSalida();
}


function renderCarritoSalida() {
  const card = document.getElementById('sal-carrito-card');
  const formGen = document.getElementById('sal-form-general');
  if (!carritoSalida.length) { card?.classList.add('hidden'); formGen?.classList.add('hidden'); return; }
  card?.classList.remove('hidden');
  formGen?.classList.remove('hidden');
  const count = document.getElementById('sal-carrito-count');
  if(count) count.textContent = carritoSalida.length + ' producto(s)';
  document.getElementById('sal-carrito-lista').innerHTML = carritoSalida.map((item, i) => `
    <div class="carrito-item">
      <div class="carrito-item-header">
        <div>
          <div class="carrito-item-nombre">${item.producto.nombre}</div>
          <div class="carrito-item-sub">Stock disponible: <strong>${item.producto.stock} ${item.unidad}</strong></div>
        </div>
        <button class="btn btn-sm" style="color:var(--red)" onclick="quitarDeCarritoSalida(${i})">✕</button>
      </div>
      <div class="form-row" style="margin-top:8px">
        <div class="form-group">
          <label>Cantidad *</label>
          <input class="input" type="number" min="0.01" step="0.01"
            max="${item.producto.stock}" placeholder="0"
            value="${item.qty}" oninput="carritoSalida[${i}].qty=this.value">
        </div>
        <div class="form-group">
          <label>Unidad</label>
          <select class="input" onchange="carritoSalida[${i}].unidad=this.value">
            ${['L','kg','piezas','tambos','cajas','mL','g'].map(u=>`<option ${item.unidad===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`).join('');
}


function quitarDeCarritoSalida(i) {
  carritoSalida.splice(i, 1);
  renderCarritoSalida();
}


function resetFotoSalida() {
  fotoSalida = null;
  const prev=document.getElementById('sal-foto-preview');
  const inp=document.getElementById('sal-foto-input');
  if(prev){prev.src='';prev.classList.add('hidden');}
  if(inp) inp.value='';
  const st=document.getElementById('sal-foto-status');
  if(st){st.textContent='Sin foto';st.className='foto-status sin-foto';}
}


function onFotoSalida(input) {
  const file=input.files[0]; if(!file)return;
  if(!file.type.startsWith('image/')){toast('Solo imágenes');return;}
  if(file.size>5*1024*1024){toast('Máximo 5MB');return;}
  fotoSalida=file;
  const r=new FileReader();
  r.onload=e=>{const p=document.getElementById('sal-foto-preview');p.src=e.target.result;p.classList.remove('hidden');};
  r.readAsDataURL(file);
  const st=document.getElementById('sal-foto-status');
  st.textContent='✓ Foto lista'; st.className='foto-status con-foto';
}


function solicitarPinSalida() {
  if (!carritoSalida.length) { toast('Agrega al menos un producto'); return; }
  const sinQty = carritoSalida.filter(i => !i.qty || Number(i.qty) <= 0);
  if (sinQty.length) { toast(`Ingresa la cantidad de: ${sinQty[0].producto.nombre}`); return; }
  const sinStock = carritoSalida.filter(i => Number(i.qty) > Number(i.producto.stock));
  if (sinStock.length) { toast(`Stock insuficiente: ${sinStock[0].producto.nombre} (disponible: ${sinStock[0].producto.stock})`); return; }
  if (!fotoSalida) { toast('⚠ Adjunta la foto del vale de entrega'); return; }
  pinCallback = registrarSalida;
  abrirPin();
}


async function registrarSalida() {
  let fotoUrl = null;
  try {
    const ext = fotoSalida.name.split('.').pop();
    fotoUrl = await API.subirFoto(`salida/${new Date().toISOString().split('T')[0]}/${crypto.randomUUID()}.${ext}`, fotoSalida);
  } catch { toast('Error al subir foto'); return; }

  let errores = 0;
  for (const item of carritoSalida) {
    const qty = Number(item.qty);
    const nuevoStock = Number(item.producto.stock) - qty;
    try {
      await Promise.all([
        API.updateStock(item.producto.id, nuevoStock),
        API.addMovimiento({
          tipo:'salida', id_producto:item.producto.id, nombre:item.producto.nombre,
          cantidad:qty, unidad:item.unidad,
          usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email,
          destino:document.getElementById('sal-dest')?.value||'',
          nota:document.getElementById('sal-nota')?.value||'',
          stock_resultante:nuevoStock, foto_evidencia:fotoUrl,
          almacen_id:almacenActivo?.id, created_at:new Date().toISOString(),
        })
      ]);
    } catch { errores++; }
  }
  await API.addAuditoria({ tipo:'movimiento', descripcion:`Salida de ${carritoSalida.length} productos`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
  if (errores) toast(`⚠ ${errores} productos no se guardaron`);
  else toast(`✓ Salida registrada — ${carritoSalida.length} producto(s) actualizados`);
  iniciarSalidas();
  todosProductos = [];
  cargarDashboard();
}


function cancelarSalida() { iniciarSalidas(); }


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


async function refrescarDashboard(btn) {
  if (btn) { btn.textContent = '↻ Cargando...'; btn.disabled = true; }
  todosProductos = [];
  await cargarDashboardUnificado();
  if (btn) { btn.textContent = '↻ Actualizar'; btn.disabled = false; }
  toast('Dashboard actualizado');
}


async function guardarProducto() {
  const nombre = document.getElementById('np-nombre').value.trim();
  if (!nombre) { toast('El nombre del producto es obligatorio'); return; }

  // Auto-generar código único usando timestamp
  let codInput = document.getElementById('np-id').value.trim();
  if (!codInput) codInput = 'QM-' + Date.now().toString().slice(-6);

  const prod = {
    id:               codInput,
    nombre,
    activo:           true,
    stock:            Number(document.getElementById('np-stock')?.value)          || 0,
    min:              Number(document.getElementById('np-min')?.value)            || 0,
    unidad:           document.getElementById('np-unit')?.value                   || 'piezas',
    proveedor:        document.getElementById('np-prov')?.value.trim()            || '',
    lote:             document.getElementById('np-lote')?.value.trim()            || '',
    caducidad:        document.getElementById('np-cad')?.value                    || null,
    ubicacion:        document.getElementById('np-ubicacion')?.value.trim()       || '',
    precio_unitario:  Number(document.getElementById('np-precio')?.value)         || 0,
    peligrosidad:     document.getElementById('np-peligro')?.value               || '',
    clase_ghs:        document.getElementById('np-ghs')?.value.trim()            || '',
    ingrediente_activo: document.getElementById('np-ingrediente')?.value.trim()  || '',
    descripcion:      document.getElementById('np-descripcion')?.value.trim()    || '',
    sds_link:         document.getElementById('np-sds-link')?.value.trim()       || '',
    almacen_id:       almacenActivo?.id || null,
  };
  if (!prod.caducidad) prod.caducidad = null;

  try {
    await API.addProducto(prod);
    await API.addAuditoria({ tipo:'producto_nuevo', descripcion:`Producto agregado: ${prod.nombre} (${prod.id})`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
    toast(`✓ Producto guardado: ${prod.nombre} — Código: ${prod.id}`);
    document.getElementById('form-producto').classList.add('hidden');
    // Reset form
    ['np-id','np-nombre','np-stock','np-min','np-prov','np-lote','np-cad','np-ubicacion','np-precio','np-ghs','np-ingrediente','np-descripcion','np-sds-link'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = '';
    });
    todosProductos = [];
    cargarInventario();
  } catch(e) { toast('Error: ' + e.message); }
}


function toggleProductoInfo(id) {
  const el = document.getElementById('info-' + id);
  if (!el) return;
  const isHidden = el.classList.contains('hidden');
  // Cerrar todos los demás
  document.querySelectorAll('.prod-info-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.prod-toggle-icon').forEach(i => i.textContent = '▶');
  if (isHidden) {
    el.classList.remove('hidden');
    const icon = document.getElementById('icon-' + id);
    if (icon) icon.textContent = '▼';
  }
}


function editarProducto(id) {
  const prod = todosProductos.find(p => p.id === id);
  if (!prod) return;

  // Verificar permiso
  if (currentProfile?.rol !== 'admin' && !tienePermiso('inventario_edit')) {
    toast('No tienes permiso para editar productos'); return;
  }

  const modal = document.getElementById('modal-editar-prod');
  if (!modal) return;

  document.getElementById('ep-id').value           = prod.id;
  document.getElementById('ep-nombre').value        = prod.nombre || '';
  document.getElementById('ep-stock').value         = prod.stock || 0;
  document.getElementById('ep-min').value           = prod.min || 0;
  document.getElementById('ep-precio').value        = prod.precio_unitario || '';
  document.getElementById('ep-unidad').value        = prod.unidad || 'L';
  document.getElementById('ep-prov').value          = prod.proveedor || '';
  document.getElementById('ep-lote').value          = prod.lote || '';
  document.getElementById('ep-cad').value           = prod.caducidad || '';
  document.getElementById('ep-ubicacion').value     = prod.ubicacion || '';
  document.getElementById('ep-peligro').value       = prod.peligrosidad || '';
  document.getElementById('ep-ghs').value           = prod.clase_ghs || '';
  document.getElementById('ep-ingrediente').value   = prod.ingrediente_activo || '';
  document.getElementById('ep-descripcion').value   = prod.descripcion || '';
  document.getElementById('ep-sds-link').value      = prod.sds_link || '';
  modal.classList.remove('hidden');
}


function cerrarEditarProducto() {
  document.getElementById('modal-editar-prod')?.classList.add('hidden');
}


async function guardarEdicionProducto() {
  const id = document.getElementById('ep-id').value;
  if (!id) return;

  const datos = {
    nombre:           document.getElementById('ep-nombre').value.trim(),
    stock:            Number(document.getElementById('ep-stock').value) || 0,
    min:              Number(document.getElementById('ep-min').value) || 0,
    precio_unitario:  Number(document.getElementById('ep-precio').value) || 0,
    unidad:           document.getElementById('ep-unidad').value,
    proveedor:        document.getElementById('ep-prov').value.trim(),
    lote:             document.getElementById('ep-lote').value.trim(),
    caducidad:        document.getElementById('ep-cad').value || null,
    ubicacion:        document.getElementById('ep-ubicacion').value.trim(),
    peligrosidad:     document.getElementById('ep-peligro').value,
    clase_ghs:        document.getElementById('ep-ghs').value.trim(),
    ingrediente_activo: document.getElementById('ep-ingrediente').value.trim(),
    descripcion:      document.getElementById('ep-descripcion').value.trim(),
    sds_link:         document.getElementById('ep-sds-link').value.trim(),
  };
  if (!datos.nombre) { toast('El nombre es obligatorio'); return; }

  try {
    await API.updateProducto(id, datos);
    await API.addAuditoria({ tipo:'ajuste', descripcion:`Producto editado: ${datos.nombre} (${id})`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
    toast('✓ Producto actualizado: ' + datos.nombre);
    cerrarEditarProducto();
    todosProductos = [];
    cargarInventario();
  } catch(e) { toast('Error: ' + e.message); }
}


function mostrarFormProducto() {
  const f = document.getElementById('form-producto');
  if (!f) return;
  f.classList.remove('hidden');
  f.scrollIntoView({behavior:'smooth'});
}


function parseFecha(str) {
  if (!str) return null;
  str = str.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d,m,a] = str.split('/');
    return `${a}-${m}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
}


async function cargarDashboardUnificado() {
  await cargarDashboard();
  const inlineDiv = document.getElementById('dir-content-inline');
  if (!inlineDiv) return;
  if (currentProfile?.rol === 'admin' || (typeof tienePermiso === 'function' && tienePermiso('dir'))) {
    inlineDiv.innerHTML = '<div class="loading" style="margin-top:12px">Cargando resumen ejecutivo...</div>';
    try {
      await cargarDashboardDirInline(inlineDiv);
    } catch { inlineDiv.innerHTML = ''; }
  } else {
    inlineDiv.innerHTML = '';
  }
}


function filtrarInv(q) {
  renderInventario(
    q ? todosProductos.filter(p =>
      p.nombre.toLowerCase().includes(q.toLowerCase()) ||
      p.id.toLowerCase().includes(q.toLowerCase()) ||
      (p.ubicacion||'').toLowerCase().includes(q.toLowerCase()) ||
      (p.ingrediente_activo||'').toLowerCase().includes(q.toLowerCase())
    ) : todosProductos
  );
}


function switchMovStock(tipo) {
  const entTab = document.getElementById('tab-entradas');
  const salTab = document.getElementById('tab-salidas');
  const btnEnt = document.getElementById('ms-tab-ent');
  const btnSal = document.getElementById('ms-tab-sal');
  if (tipo === 'entrada') {
    entTab?.classList.remove('hidden'); salTab?.classList.add('hidden');
    btnEnt?.classList.add('active');   btnSal?.classList.remove('active');
    iniciarEntradas();
  } else {
    salTab?.classList.remove('hidden'); entTab?.classList.add('hidden');
    btnSal?.classList.add('active');    btnEnt?.classList.remove('active');
    iniciarSalidas();
  }
}


function cerrarFotoModal() {
  document.getElementById('foto-modal')?.classList.add('hidden');
  const img = document.getElementById('foto-modal-img');
  if (img) img.src = '';
}


function abrirQRDesdeScanner() {
  if (typeof productoEscaneado !== 'undefined' && productoEscaneado)
    mostrarEtiquetaQR(productoEscaneado);
}


function abrirSDSDesdeScanner() {
  if (typeof productoEscaneado !== 'undefined' && productoEscaneado)
    verSDS(productoEscaneado);
}


async function cargarInventario() {
  const el = document.getElementById('inv-lista');
  if (el) el.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    todosProductos = await API.getProductos(almacenActivo?.id);
    renderInventario(todosProductos);
  } catch { if (el) el.innerHTML = '<div class="empty">Error al cargar</div>'; }
}


function filtrarMov() {
  const tipo = document.getElementById('fil-tipo')?.value || '';
  const user = document.getElementById('fil-user')?.value || '';
  const f = todosMovimientos.filter(m =>
    (!tipo || m.tipo === tipo) && (!user || m.usuario_nombre === user)
  );
  document.getElementById('mov-lista').innerHTML =
    f.length ? f.map(renderMovItem).join('') : '<div class="empty">Sin movimientos</div>';
}


function filtrarAuditoria() {
  const tipo = document.getElementById('aud-tipo')?.value || '';
  const user = document.getElementById('aud-user')?.value || '';
  const f = todaAuditoria.filter(a =>
    (!tipo || a.tipo === tipo) && (!user || a.usuario_nombre === user)
  );
  const icons = { login:'🔑', rol_cambio:'👤', producto_nuevo:'📦', movimiento:'🔄', ajuste:'⚙' };
  const cls   = { login:'login', rol_cambio:'rol', producto_nuevo:'prod', movimiento:'mov', ajuste:'mov' };
  document.getElementById('aud-lista').innerHTML = f.length
    ? f.map(a => `<div class="aud-item">
        <div class="aud-icon ${cls[a.tipo]||'mov'}">${icons[a.tipo]||'📋'}</div>
        <div>
          <div class="aud-name">${a.descripcion||a.tipo}</div>
          <div class="aud-meta">${a.usuario_nombre||'—'} · ${a.created_at?new Date(a.created_at).toLocaleString('es-MX'):'—'}</div>
        </div>
      </div>`).join('')
    : '<div class="empty">Sin registros</div>';
}


function mostrarFormUsuario() {
  const f = document.getElementById('form-usuario');
  if (!f) return;
  f.classList.remove('hidden');
  f.scrollIntoView({ behavior: 'smooth' });
}


async function crearUsuario() {
  const nombre = document.getElementById('nu-nombre')?.value.trim();
  const email  = document.getElementById('nu-email')?.value.trim().toLowerCase();
  const pass   = document.getElementById('nu-pass')?.value;
  if (!nombre || !email || !pass) { toast('Completa todos los campos'); return; }
  if (pass.length < 8) { toast('Contraseña mínimo 8 caracteres'); return; }
  const btn = document.getElementById('btn-crear-usuario');
  if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }
  try {
    await API.crearUsuario(email, pass, nombre, 'operador');
    toast('✓ Usuario creado: ' + nombre);
    document.getElementById('form-usuario')?.classList.add('hidden');
    ['nu-nombre','nu-email','nu-pass'].forEach(id => {
      const e = document.getElementById(id); if (e) e.value = '';
    });
    cargarUsuarios();
  } catch(e) {
    toast('Error: ' + (e.message || 'Verifica que el correo no esté registrado'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Crear usuario'; }
  }
}


function agregarProductoPedido() {
  const nombre = document.getElementById('pp-prod-nombre')?.value.trim();
  const qty    = document.getElementById('pp-prod-qty')?.value.trim();
  if (!nombre || !qty) { toast('Ingresa nombre y cantidad'); return; }
  if (typeof pedidoProductos === 'undefined') window.pedidoProductos = [];
  pedidoProductos.push({ nombre, qty });
  const el1 = document.getElementById('pp-prod-nombre');
  const el2 = document.getElementById('pp-prod-qty');
  if (el1) el1.value = '';
  if (el2) el2.value = '';
  renderListaPedidoProductos();
  toast('Producto agregado al pedido');
}


function renderListaPedidoProductos() {
  const lista = document.getElementById('pp-productos-lista');
  if (!lista) return;
  if (typeof pedidoProductos === 'undefined') window.pedidoProductos = [];
  lista.innerHTML = pedidoProductos.length
    ? pedidoProductos.map((p,i) => `
        <div class="pedido-prod-item">
          <div class="pedido-prod-item-name">${p.nombre}</div>
          <div class="pedido-prod-item-qty">${p.qty}</div>
          <button class="pedido-prod-remove" onclick="pedidoProductos.splice(${i},1);renderListaPedidoProductos()">✕</button>
        </div>`).join('')
    : '<div style="font-size:12px;color:var(--text3);padding:8px 0">Agrega al menos un producto</div>';
}


function mostrarFormPedido() {
  if (typeof pedidoProductos === 'undefined') window.pedidoProductos = [];
  pedidoProductos = [];
  renderListaPedidoProductos();
  const f = document.getElementById('form-pedido');
  if (!f) return;
  f.classList.remove('hidden');
  f.scrollIntoView({ behavior: 'smooth' });
}


async function guardarPedido() {
  const proveedor = document.getElementById('pp-prov')?.value.trim();
  if (!proveedor) { toast('Ingresa el proveedor'); return; }
  if (typeof pedidoProductos === 'undefined' || !pedidoProductos.length) {
    toast('Agrega al menos un producto'); return;
  }
  const peds = await API.getPedidos();
  const num  = 'PED-' + String(peds.length + 1).padStart(3, '0');
  const ped  = {
    num, proveedor,
    producto:        pedidoProductos.map(p => p.nombre).join(', '),
    cantidad:        pedidoProductos.map(p => p.qty).join(', '),
    productos_json:  JSON.stringify(pedidoProductos),
    fecha_estimada:  document.getElementById('pp-fecha')?.value || '',
    nota:            document.getElementById('pp-nota')?.value.trim() || '',
    estado:          'Confirmado',
    creado_por:      currentProfile?.nombre || currentUser?.email,
  };
  try {
    await API.addPedido(ped);
    toast('Pedido ' + num + ' creado con ' + pedidoProductos.length + ' producto(s)');
    document.getElementById('form-pedido')?.classList.add('hidden');
    pedidoProductos = [];
    cargarPedidos();
  } catch(e) { toast('Error: ' + e.message); }
}


async function cargarPedidos() {
  const el = document.getElementById('ped-lista');
  if (!el) return;
  el.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const peds = await API.getPedidos();
    if (!peds.length) { el.innerHTML = '<div class="empty">Sin pedidos registrados</div>'; return; }
    el.innerHTML = peds.map(p => {
      let prods = [];
      try { prods = JSON.parse(p.productos_json || '[]'); } catch {}
      const prodsHtml = prods.length
        ? `<div class="pedido-detalle">${prods.map(pr=>`<div class="pedido-detalle-item">• ${pr.nombre} — ${pr.qty}</div>`).join('')}</div>`
        : `<div class="pedido-detalle"><div class="pedido-detalle-item">• ${p.producto||'—'} — ${p.cantidad||'—'}</div></div>`;
      return `<div class="pedido-item">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="pedido-name">${p.num||'PED'} — ${p.proveedor}</div>
            <div class="pedido-meta">Est: ${p.fecha_estimada||'—'}${p.fecha_entrega_real?' · Real: '+p.fecha_entrega_real:''}</div>
            ${prodsHtml}
            ${p.nota?`<div class="pedido-meta">Nota: ${p.nota}</div>`:''}
          </div>
          <span class="badge ${p.estado==='Entregado'?'badge-ok':p.estado==='En tránsito'?'badge-info':'badge-warn'}">${p.estado}</span>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          ${p.estado!=='Entregado'?`<button class="btn btn-sm btn-green" onclick="marcarEntregado('${p.id}')">✓ Entregado</button>`:''}
          <button class="btn btn-sm" style="color:var(--red)" onclick="eliminarPedido('${p.id}','${p.num||'PED'}')">🗑 Eliminar</button>
        </div>
      </div>`;
    }).join('');
  } catch { el.innerHTML = '<div class="empty">Error al cargar</div>'; }
}


function toggleDashPanel(id) {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.classList.toggle('hidden');
}

// ── RENDER INVENTARIO ─────────────────────────────────
function renderInventario(lista) {
  const hoy = new Date();
  const esAdmin = currentProfile?.rol === 'admin' || (typeof tienePermiso === 'function' && tienePermiso('inventario_edit'));
  const valorTotal = lista.reduce((s,p) => s+(Number(p.stock)*Number(p.precio_unitario||0)), 0);

  const header = `<div style="font-size:12px;color:var(--text2);margin-bottom:10px;padding:8px 10px;background:var(--bg);border-radius:var(--radius-sm);display:flex;justify-content:space-between">
    <span>💰 Valor: <strong>$${valorTotal.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></span>
    <span style="color:var(--text3)">${lista.length} producto(s)</span>
  </div>`;

  if (!lista.length) {
    document.getElementById('inv-lista').innerHTML = header + '<div class="empty">Sin productos registrados</div>';
    return;
  }

  document.getElementById('inv-lista').innerHTML = header + lista.map(p => {
    const sN = Number(p.stock), mN = Number(p.min);
    const dias = p.caducidad ? Math.floor((new Date(p.caducidad)-hoy)/86400000) : null;
    let badge='badge-ok', bt='OK';
    if (sN <= mN && mN > 0) { badge='badge-danger'; bt='Stock bajo'; }
    else if (dias !== null && dias < 90) { badge='badge-warn'; bt=dias<0?'Caducado':'Por caducar'; }
    const peligroBadge = p.peligrosidad && p.peligrosidad!=='ninguno'
      ? `<span class="badge badge-danger" style="font-size:10px">⚠ ${p.peligrosidad}</span>` : '';
    const safeNombre = (p.nombre||'').replace(/'/g,"\\'").replace(/"/g,'&quot;');
    const prodJson = JSON.stringify(p).replace(/"/g,'&quot;');

    return `<div class="inv-card">
      <!-- HEADER VISIBLE SIN CLIC -->
      <div style="display:flex;align-items:flex-start;padding:12px;gap:8px">
        <div style="flex:1;min-width:0;cursor:pointer" onclick="toggleProductoInfo('${p.id}')">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="inv-name">${p.nombre}</span>
            ${peligroBadge}
            <span class="badge ${badge}">${bt}</span>
          </div>
          <div class="inv-sub" style="margin-top:2px">
            ${p.ingrediente_activo?`<span style="color:var(--blue);font-size:11px">● ${p.ingrediente_activo}</span> · `:''}
            ${p.id}${p.ubicacion?' · 📍 '+p.ubicacion:''}
          </div>
        </div>
        <!-- STOCK + BOTÓN FICHA SIEMPRE VISIBLES -->
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <div style="text-align:right;cursor:pointer" onclick="toggleProductoInfo('${p.id}')">
            <div style="font-size:18px;font-weight:700;color:${sN<=mN&&mN>0?'var(--red)':'var(--navy)'}">${p.stock} <small style="font-size:12px;color:var(--text2);font-weight:400">${p.unidad||''}</small></div>
            <div style="font-size:10px;color:var(--text3)">mín: ${p.min} ${p.unidad||''}</div>
          </div>
          ${p.sds_link?`<a href="${p.sds_link}" target="_blank" class="btn btn-sm btn-primary" style="text-decoration:none" title="Ver ficha técnica">📋</a>`:''}
          <span id="icon-${p.id}" style="color:var(--text3);font-size:12px;cursor:pointer" onclick="toggleProductoInfo('${p.id}')">▶</span>
        </div>
      </div>

      <!-- FICHA DESPLEGABLE -->
      <div class="prod-info-panel hidden" id="info-${p.id}">
        <div class="prod-info-grid">
          ${p.descripcion?`<div class="prod-info-item full"><span class="prod-info-label">Descripción</span><span>${p.descripcion}</span></div>`:''}
          ${p.ingrediente_activo?`<div class="prod-info-item"><span class="prod-info-label">Ingrediente activo</span><span>${p.ingrediente_activo}</span></div>`:''}
          ${p.proveedor?`<div class="prod-info-item"><span class="prod-info-label">Proveedor</span><span>${p.proveedor}</span></div>`:''}
          ${p.lote?`<div class="prod-info-item"><span class="prod-info-label">Lote</span><span>${p.lote}</span></div>`:''}
          ${p.caducidad?`<div class="prod-info-item"><span class="prod-info-label">Caducidad</span><span style="color:${dias!==null&&dias<90?'var(--red)':'inherit'}">${p.caducidad}${dias!==null?' ('+dias+'d)':''}</span></div>`:''}
          ${p.precio_unitario?`<div class="prod-info-item"><span class="prod-info-label">Precio unitario</span><span>$${Number(p.precio_unitario).toFixed(2)}</span></div>`:''}
          ${p.precio_unitario?`<div class="prod-info-item"><span class="prod-info-label">Valor en inventario</span><span>$${(sN*Number(p.precio_unitario)).toFixed(2)}</span></div>`:''}
          ${p.peligrosidad?`<div class="prod-info-item"><span class="prod-info-label">Peligrosidad</span><span>${p.peligrosidad}</span></div>`:''}
          ${p.clase_ghs?`<div class="prod-info-item"><span class="prod-info-label">Clase GHS</span><span>${p.clase_ghs}</span></div>`:''}
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          ${esAdmin?`<button class="btn btn-sm btn-primary" onclick="editarProducto('${p.id}')">✏ Editar</button>`:''}
          ${esAdmin?`<button class="btn btn-sm" onclick="mostrarAjuste('${p.id}','${safeNombre}',${p.stock},'${p.unidad||''}')">⚖ Ajustar stock</button>`:''}
          ${esAdmin?`<button class="btn btn-sm" onclick="mostrarEtiquetaQR(${prodJson})">🏷 QR</button>`:''}
          ${esAdmin?`<button class="btn btn-sm" style="color:var(--red)" onclick="eliminarProducto('${p.id}','${safeNombre}')">🗑 Eliminar</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── INIT — arranque del sistema ───────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const d = new Date();
  const el = document.getElementById('dash-date');
  if (el) el.textContent = d.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });

  // Configurar eventos de teclado
  document.getElementById('l-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('pin-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') confirmPin(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { cerrarFotoModal(); if(typeof cerrarSDS==='function')cerrarSDS(); if(typeof cerrarQR==='function')cerrarQR(); } });

  // Verificar sesión activa
  const session = await API.getSession();
  if (session) { currentUser = session.user; await cargarPerfil(); }

  // Escuchar cambios de autenticación
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      await cargarPerfil();
      resetSessionTimer();
      API.addAuditoria({
        tipo: 'login',
        descripcion: 'Inicio de sesión exitoso',
        usuario_id: session.user.id,
        usuario_nombre: currentProfile?.nombre || session.user.email,
        metadata: { timestamp: new Date().toISOString() }
      });
    } else if (event === 'SIGNED_OUT') {
      clearTimeout(sessionTimer);
      currentUser = null;
      currentProfile = null;
      mostrarLogin();
    }
  });
});

// ── FUNCIONES RECUPERADAS (perdidas en limpieza) ───────

function verFoto(url) {
  const modal = document.getElementById('foto-modal');
  const img   = document.getElementById('foto-modal-img');
  if (!modal || !img) return;
  img.src = url;
  modal.classList.remove('hidden');
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

async function eliminarUsuarioSistema(userId, nombre) {
  if (userId === currentUser?.id) { toast('No puedes eliminarte a ti mismo'); return; }
  if (!confirm(`¿Eliminar al usuario "${nombre}"?\n\nSus movimientos y registros se conservan.`)) return;
  try {
    await API.eliminarUsuario(userId);
    await API.addAuditoria({ tipo:'rol_cambio', descripcion:`Usuario eliminado: ${nombre}`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
    toast('✓ Usuario eliminado: ' + nombre);
    cargarUsuarios();
  } catch(e) { toast('Error al eliminar: ' + e.message); }
}

async function hacerAdmin(userId, nombre) {
  if (!confirm(`¿Convertir a "${nombre}" en administrador? Tendrá acceso total al sistema.`)) return;
  try {
    await API.updateRol(userId, 'admin');
    await API.addAuditoria({ tipo:'rol_cambio', descripcion:`${nombre} promovido a administrador`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
    toast('✓ ' + nombre + ' ahora es administrador');
    cargarUsuarios();
  } catch(e) { toast('Error: ' + e.message); }
}

async function cambiarRol(userId, nuevoRol, nombre) {
  try {
    await API.updateRol(userId, nuevoRol);
    await API.addAuditoria({ tipo:'rol_cambio', descripcion:`Rol de ${nombre} cambiado a ${nuevoRol}`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
    toast('Rol actualizado a: ' + nuevoRol);
    cargarUsuarios();
  } catch(e) { toast('Error: ' + e.message); }
}

function togglePermisosPanel(userId) {
  const panel = document.getElementById('panel-permisos-' + userId);
  if (!panel) return;
  if (!panel.classList.contains('hidden') && panel.innerHTML) {
    panel.classList.add('hidden'); panel.innerHTML = ''; return;
  }
  API.getProfile(userId).then(usuario => {
    if (typeof renderPanelPermisos === 'function') {
      panel.innerHTML = renderPanelPermisos(usuario);
      panel.classList.remove('hidden');
      panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
  });
}

async function marcarEntregado(id) {
  const fechaReal = prompt('¿Cuál fue la fecha real de entrega? (AAAA-MM-DD)\nEjemplo: ' + new Date().toISOString().split('T')[0]);
  if (fechaReal === null) return;
  try {
    await API.updateFechaEntrega(id, fechaReal || new Date().toISOString().split('T')[0]);
    toast('Pedido marcado como entregado');
    cargarPedidos();
  } catch { toast('Error al actualizar'); }
}

async function seleccionarProductoEntrada(id) {
  const prod = await API.getProducto(id);
  if (!prod) return;
  agregarAlCarritoEntrada(id);
}

async function seleccionarProductoSalida(id) {
  const prod = await API.getProducto(id);
  if (!prod) return;
  agregarAlCarritoSalida(id);
}
