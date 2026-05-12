// =====================================================
//  NOTIFICACIONES v10
//  Configuración de reportes automáticos por correo
//  + Respaldo manual a Excel / Google Drive
// =====================================================

const DIAS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
const HORAS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

// ── CARGAR CONFIGURACIONES ────────────────────────────
async function cargarNotificaciones() {
  document.getElementById('notif-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const configs = await API.getNotificaciones();
    renderNotificaciones(configs);
  } catch {
    document.getElementById('notif-lista').innerHTML = '<div class="empty">Error al cargar</div>';
  }
}

function renderNotificaciones(configs) {
  const lista = document.getElementById('notif-lista');
  if (!configs.length) {
    lista.innerHTML = '<div class="empty">Sin contactos configurados. Agrega el primero abajo.</div>';
    return;
  }
  lista.innerHTML = configs.map(c => `
    <div class="notif-card ${c.activo?'':'notif-inactivo'}">
      <div class="notif-header">
        <div>
          <div class="notif-nombre">${c.nombre}</div>
          <div class="notif-correo">✉ ${c.correo}</div>
          <div class="notif-horario">📅 Cada ${c.dia_envio} a las ${c.hora_envio}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <span class="badge ${c.activo?'badge-ok':'badge-warn'}">${c.activo?'Activo':'Pausado'}</span>
          <button class="btn btn-sm" onclick="toggleNotif('${c.id}',${!c.activo})">${c.activo?'Pausar':'Activar'}</button>
          <button class="btn btn-sm" style="color:var(--red)" onclick="eliminarNotif('${c.id}','${c.nombre}')">Eliminar</button>
        </div>
      </div>
      <div class="notif-reportes">
        <span class="notif-tag ${c.reporte_inventario?'active':''}">📦 Inventario</span>
        <span class="notif-tag ${c.reporte_movimientos?'active':''}">🔄 Movimientos</span>
        <span class="notif-tag ${c.reporte_alertas?'active':''}">⚠ Alertas</span>
      </div>
      <button class="btn btn-sm btn-primary" style="margin-top:8px;width:100%" onclick="enviarReporteManual('${c.id}','${c.correo}','${c.nombre}',${c.reporte_inventario},${c.reporte_movimientos},${c.reporte_alertas})">
        📤 Enviar reporte ahora
      </button>
    </div>
  `).join('');
}

// ── AGREGAR CONTACTO ──────────────────────────────────
function mostrarFormNotif() {
  document.getElementById('form-notif').classList.remove('hidden');
  document.getElementById('form-notif').scrollIntoView({behavior:'smooth'});
  // Resetear form
  ['nn-nombre','nn-correo'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
  document.getElementById('nn-inv').checked = true;
  document.getElementById('nn-mov').checked = true;
  document.getElementById('nn-ale').checked = true;
  document.getElementById('nn-dia').value = 'lunes';
  document.getElementById('nn-hora').value = '08:00';
}

async function guardarNotifConfig() {
  const nombre = document.getElementById('nn-nombre').value.trim();
  const correo = document.getElementById('nn-correo').value.trim().toLowerCase();
  if (!nombre || !correo) { toast('Ingresa nombre y correo'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { toast('Correo inválido'); return; }

  const config = {
    nombre,
    correo,
    reporte_inventario:  document.getElementById('nn-inv').checked,
    reporte_movimientos: document.getElementById('nn-mov').checked,
    reporte_alertas:     document.getElementById('nn-ale').checked,
    dia_envio:  document.getElementById('nn-dia').value,
    hora_envio: document.getElementById('nn-hora').value,
    activo: true,
  };

  if (!config.reporte_inventario && !config.reporte_movimientos && !config.reporte_alertas) {
    toast('Selecciona al menos un tipo de reporte'); return;
  }

  try {
    await API.addNotificacion(config);
    toast('✓ Contacto configurado: ' + nombre);
    document.getElementById('form-notif').classList.add('hidden');
    cargarNotificaciones();
  } catch(e) { toast('Error: ' + e.message); }
}

async function toggleNotif(id, activo) {
  try {
    await API.updateNotificacion(id, { activo });
    toast(activo ? 'Notificación activada' : 'Notificación pausada');
    cargarNotificaciones();
  } catch(e) { toast('Error: ' + e.message); }
}

async function eliminarNotif(id, nombre) {
  if (!confirm(`¿Eliminar la configuración de "${nombre}"?`)) return;
  try {
    await API.deleteNotificacion(id);
    toast('Configuración eliminada');
    cargarNotificaciones();
  } catch(e) { toast('Error: ' + e.message); }
}

// ── ENVIAR REPORTE MANUAL ─────────────────────────────
async function enviarReporteManual(id, correo, nombre, inv, mov, ale) {
  toast('Preparando reporte para ' + correo + '...');
  try {
    const contenido = await generarContenidoReporte(inv, mov, ale);
    await API.enviarReporte({ correo, nombre, contenido });
    toast('✓ Reporte enviado a ' + correo);
  } catch(e) {
    toast('Error al enviar: ' + e.message);
  }
}

async function generarContenidoReporte(inv, mov, ale) {
  const hoy = new Date();
  const hace7 = new Date(); hace7.setDate(hace7.getDate()-7);
  let secciones = [];

  if (inv) {
    const prods = await API.getProductos();
    secciones.push({
      titulo: 'Inventario actual',
      datos: prods.map(p => ({ Código:p.id, Producto:p.nombre, Stock:p.stock, Unidad:p.unidad||'', 'Stock mín':p.min, Ubicación:p.ubicacion||'', Caducidad:p.caducidad||'' }))
    });
  }
  if (mov) {
    const movs = await API.getMovimientos(200);
    const recientes = movs.filter(m => new Date(m.created_at) >= hace7);
    secciones.push({
      titulo: 'Movimientos de la semana',
      datos: recientes.map(m => ({ Fecha:new Date(m.created_at).toLocaleString('es-MX'), Tipo:m.tipo, Producto:m.nombre, Cantidad:m.cantidad, Unidad:m.unidad||'', Usuario:m.usuario_nombre||'', Destino:m.destino||'' }))
    });
  }
  if (ale) {
    const prods = await API.getProductos();
    const alertas = prods.filter(p => Number(p.stock)<=Number(p.min) || (p.caducidad && Math.floor((new Date(p.caducidad)-hoy)/86400000)<90));
    secciones.push({
      titulo: 'Alertas activas',
      datos: alertas.map(p => ({ Producto:p.nombre, Stock:p.stock, Mínimo:p.min, Caducidad:p.caducidad||'', Motivo: Number(p.stock)<=Number(p.min)?'Stock bajo':'Por caducar' }))
    });
  }
  return secciones;
}

// ── RESPALDO EXCEL ────────────────────────────────────
async function descargarRespaldoExcel() {
  toast('Generando respaldo...');
  try {
    const [prods, movs, peds, provs] = await Promise.all([
      API.getProductos(), API.getMovimientos(1000), API.getPedidos(), API.getProveedores()
    ]);

    const wb = XLSX.utils.book_new();
    const fecha = new Date().toLocaleDateString('es-MX').replace(/\//g,'-');

    // Hoja 1: Inventario
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      prods.map(p=>({Código:p.id,Nombre:p.nombre,Stock:p.stock,Mínimo:p.min,Unidad:p.unidad||'',Proveedor:p.proveedor||'',Lote:p.lote||'',Caducidad:p.caducidad||'',Ubicación:p.ubicacion||'',PrecioUnitario:p.precio_unitario||0,Peligrosidad:p.peligrosidad||'',ClasesGHS:p.clase_ghs||''}))
    ), 'Inventario');

    // Hoja 2: Movimientos
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      movs.map(m=>({Fecha:new Date(m.created_at).toLocaleString('es-MX'),Tipo:m.tipo,Producto:m.nombre,Cantidad:m.cantidad,Unidad:m.unidad||'',Usuario:m.usuario_nombre||'',Destino:m.destino||'',Lote:m.lote||'',StockResultante:m.stock_resultante}))
    ), 'Movimientos');

    // Hoja 3: Pedidos
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      peds.map(p=>({Num:p.num,Proveedor:p.proveedor,Producto:p.producto,Cantidad:p.cantidad,FechaEstimada:p.fecha_estimada||'',FechaReal:p.fecha_entrega_real||'',Estado:p.estado,CreadoPor:p.creado_por||''}))
    ), 'Pedidos');

    // Hoja 4: Proveedores
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      provs.map(p=>({Nombre:p.nombre,RFC:p.rfc||'',Teléfono:p.telefono||'',Correo:p.correo||'',Dirección:p.direccion||'',Productos:p.productos||''}))
    ), 'Proveedores');

    XLSX.writeFile(wb, `LasNaves_Respaldo_${fecha}.xlsx`);
    toast('✓ Respaldo descargado: LasNaves_Respaldo_'+fecha+'.xlsx');

    // Registrar en auditoría
    await API.addAuditoria({ tipo:'ajuste', descripcion:'Respaldo de datos descargado en Excel', usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
  } catch(e) { toast('Error al generar respaldo: ' + e.message); }
}

// ── RESPALDO A GOOGLE DRIVE ───────────────────────────
function abrirGuardarEnDrive() {
  // Google Drive no permite subir directamente sin OAuth
  // Generamos el Excel y mostramos instrucciones
  descargarRespaldoExcel();
  setTimeout(() => {
    toast('El archivo se descargó. Súbelo a Google Drive manualmente o configura Google Drive Backup.');
  }, 2000);
}
