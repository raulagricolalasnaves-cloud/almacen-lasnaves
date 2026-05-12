// =====================================================
//  PERMISOS v11 — Control individual por módulo
//  Solo el admin puede modificar permisos
// =====================================================

// Todos los módulos disponibles con su etiqueta
const MODULOS = [
  { key:'dashboard',       label:'Dashboard operativo',     desc:'Ver métricas y últimos movimientos' },
  { key:'dir',             label:'Dashboard dirección',     desc:'KPIs ejecutivos y valor del inventario' },
  { key:'entradas',        label:'Registrar entradas',      desc:'Agregar stock con foto del recibo' },
  { key:'salidas',         label:'Registrar salidas',       desc:'Descontar stock con foto del vale' },
  { key:'scanner',         label:'Escáner de códigos',      desc:'Escanear productos con la cámara' },
  { key:'inventario',      label:'Ver inventario',          desc:'Consultar stock actual de productos' },
  { key:'inventario_edit', label:'Editar inventario',       desc:'Agregar productos y ajustar stock' },
  { key:'conteo',          label:'Inventario físico',       desc:'Realizar conteos cíclicos' },
  { key:'movimientos',     label:'Ver movimientos',         desc:'Historial de entradas y salidas' },
  { key:'reportes',        label:'Reportes',                desc:'Exportar Excel y PDF' },
  { key:'pedidos',         label:'Gestión de pedidos',      desc:'Crear y seguir pedidos a proveedores' },
  { key:'proveedores',     label:'Proveedores',             desc:'Directorio y evaluaciones' },
  { key:'alertas',         label:'Ver alertas',             desc:'Stock bajo y caducidades' },
  { key:'notificaciones',  label:'Notificaciones',          desc:'Configurar reportes automáticos' },
  { key:'respaldo',        label:'Respaldo de datos',       desc:'Descargar respaldo en Excel' },
  { key:'auditoria',       label:'Auditoría',               desc:'Historial completo de cambios' },
  { key:'almacenes',       label:'Gestión de almacenes',    desc:'Crear y cambiar entre almacenes' },
];

// Permisos predeterminados para nuevos usuarios (ninguno)
const PERMISOS_VACIOS = Object.fromEntries(MODULOS.map(m => [m.key, false]));

// Plantillas rápidas
const PLANTILLAS = {
  'Solo consulta':    { dashboard:true, inventario:true, movimientos:true, alertas:true },
  'Operador básico':  { dashboard:true, entradas:true, salidas:true, scanner:true, inventario:true, alertas:true },
  'Supervisor':       { dashboard:true, entradas:true, salidas:true, scanner:true, inventario:true, inventario_edit:true, movimientos:true, pedidos:true, proveedores:true, alertas:true, conteo:true, reportes:true },
  'Acceso total':     Object.fromEntries(MODULOS.map(m => [m.key, true])),
};

// ── VERIFICAR PERMISO ─────────────────────────────────
function tienePermiso(modulo) {
  if (!currentProfile) return false;
  // El admin siempre tiene acceso total
  if (currentProfile.rol === 'admin') return true;
  const perms = currentProfile.permisos || {};
  return perms[modulo] === true;
}

// ── APLICAR PERMISOS EN EL MENÚ ───────────────────────
function aplicarPermisosMenu() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const modulo = btn.getAttribute('data-modulo');
    if (!modulo) { btn.style.display = 'none'; return; }
    btn.style.display = tienePermiso(modulo) ? '' : 'none';
  });

  // Panel de edición de inventario
  const invPanel = document.getElementById('inv-admin-panel');
  if (invPanel) {
    invPanel.classList.toggle('hidden', !tienePermiso('inventario_edit'));
  }
}

// ── RENDER PANEL DE PERMISOS ──────────────────────────
function renderPanelPermisos(usuario) {
  const perms = { ...PERMISOS_VACIOS, ...(usuario.permisos || {}) };

  return `
    <div class="permisos-panel" id="permisos-${usuario.id}">
      <div class="permisos-header">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--navy)">${usuario.nombre}</div>
          <div style="font-size:12px;color:var(--text2)">${usuario.email}</div>
        </div>
        <button class="btn btn-sm" onclick="ocultarPermisos('${usuario.id}')">✕ Cerrar</button>
      </div>

      <div style="margin:12px 0 8px;font-size:12px;font-weight:600;color:var(--text2)">Plantillas rápidas:</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
        ${Object.keys(PLANTILLAS).map(p =>
          `<button class="btn btn-sm" onclick="aplicarPlantilla('${usuario.id}','${p}')">${p}</button>`
        ).join('')}
        <button class="btn btn-sm" style="color:var(--red)" onclick="quitarTodosPermisos('${usuario.id}')">Quitar todos</button>
      </div>

      <div class="permisos-grid">
        ${MODULOS.map(m => `
          <div class="permiso-item">
            <label class="permiso-toggle">
              <input type="checkbox" id="perm-${usuario.id}-${m.key}"
                ${perms[m.key]?'checked':''}
                onchange="actualizarPermiso('${usuario.id}','${m.key}',this.checked)">
              <span class="permiso-slider"></span>
            </label>
            <div class="permiso-info">
              <div class="permiso-label">${m.label}</div>
              <div class="permiso-desc">${m.desc}</div>
            </div>
          </div>`).join('')}
      </div>

      <button class="btn btn-primary btn-full" style="margin-top:12px"
        onclick="guardarPermisos('${usuario.id}')">
        ✓ Guardar permisos de ${usuario.nombre}
      </button>
    </div>
  `;
}

let permisosEditando = {};

function mostrarPermisos(userId) {
  // Ocultar cualquier panel abierto
  document.querySelectorAll('.permisos-panel').forEach(p => p.remove());

  const userEl = document.getElementById('user-item-' + userId);
  if (!userEl) return;

  // Buscar el usuario en la lista
  cargarUsuarios(userId);
}

function ocultarPermisos(userId) {
  document.getElementById('permisos-' + userId)?.remove();
  delete permisosEditando[userId];
}

function actualizarPermiso(userId, modulo, valor) {
  if (!permisosEditando[userId]) permisosEditando[userId] = {};
  permisosEditando[userId][modulo] = valor;
}

function aplicarPlantilla(userId, plantilla) {
  const perms = { ...PERMISOS_VACIOS, ...(PLANTILLAS[plantilla] || {}) };
  MODULOS.forEach(m => {
    const cb = document.getElementById(`perm-${userId}-${m.key}`);
    if (cb) { cb.checked = !!perms[m.key]; actualizarPermiso(userId, m.key, !!perms[m.key]); }
  });
  toast('Plantilla "' + plantilla + '" aplicada — guarda para confirmar');
}

function quitarTodosPermisos(userId) {
  MODULOS.forEach(m => {
    const cb = document.getElementById(`perm-${userId}-${m.key}`);
    if (cb) { cb.checked = false; actualizarPermiso(userId, m.key, false); }
  });
  toast('Todos los permisos quitados — guarda para confirmar');
}

async function guardarPermisos(userId) {
  const permsActuales = await API.getProfile(userId);
  const permsBase = { ...PERMISOS_VACIOS, ...(permsActuales.permisos || {}) };
  const permsNuevos = { ...permsBase, ...(permisosEditando[userId] || {}) };

  // Recoger estado actual de todos los checkboxes
  MODULOS.forEach(m => {
    const cb = document.getElementById(`perm-${userId}-${m.key}`);
    if (cb) permsNuevos[m.key] = cb.checked;
  });

  try {
    await API.updatePermisos(userId, permsNuevos);
    await API.addAuditoria({
      tipo: 'rol_cambio',
      descripcion: `Permisos actualizados para ${permsActuales.nombre}`,
      usuario_id: currentUser.id,
      usuario_nombre: currentProfile?.nombre || currentUser.email,
      metadata: { usuario_afectado: userId, permisos: permsNuevos }
    });
    toast('✓ Permisos guardados para ' + permsActuales.nombre);
    delete permisosEditando[userId];
    ocultarPermisos(userId);
    cargarUsuarios();
  } catch(e) { toast('Error: ' + e.message); }
}
