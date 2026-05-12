// =====================================================
//  ALMACENES v9 — Multi-almacén
// =====================================================

let almacenActivo = null;

async function iniciarAlmacenes() {
  try {
    const alms = await API.getAlmacenes();
    if (alms.length === 0) {
      // Crear almacén por defecto si no existe
      await API.addAlmacen({ nombre: 'Almacén Principal', responsable: currentProfile?.nombre || '' });
      return iniciarAlmacenes();
    }
    if (!almacenActivo) almacenActivo = alms[0];
    renderSelectorAlmacen(alms);
  } catch(e) { console.error('Error cargando almacenes:', e); }
}

function renderSelectorAlmacen(alms) {
  const sel = document.getElementById('almacen-selector');
  if (!sel) return;
  sel.innerHTML = alms.map(a =>
    `<option value="${a.id}" ${almacenActivo?.id===a.id?'selected':''}>${a.nombre}</option>`
  ).join('');
}

async function cambiarAlmacen(id) {
  const alms = await API.getAlmacenes();
  almacenActivo = alms.find(a => a.id === id) || alms[0];
  toast('Almacén: ' + almacenActivo.nombre);
  // Recargar pestaña activa
  const tabActivo = document.querySelector('.tab.active')?.id?.replace('tab-','');
  if (tabActivo === 'inventario') cargarInventario();
  if (tabActivo === 'dashboard') cargarDashboard();
}

async function cargarAlmacenes() {
  document.getElementById('alm-lista').innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const alms = await API.getAlmacenes();
    document.getElementById('alm-lista').innerHTML = alms.length
      ? alms.map(a => `
        <div class="inv-item">
          <div>
            <div class="inv-name">${a.nombre}</div>
            <div class="inv-sub">${a.responsable||'Sin responsable'}${a.direccion?' · '+a.direccion:''}</div>
          </div>
          <button class="btn btn-sm ${almacenActivo?.id===a.id?'btn-primary':''}" onclick="cambiarAlmacen('${a.id}')">
            ${almacenActivo?.id===a.id?'✓ Activo':'Seleccionar'}
          </button>
        </div>`).join('')
      : '<div class="empty">Sin almacenes</div>';
  } catch { document.getElementById('alm-lista').innerHTML = '<div class="empty">Error al cargar</div>'; }
}

async function guardarAlmacen() {
  const nombre = document.getElementById('alm-nombre').value.trim();
  if (!nombre) { toast('El nombre es obligatorio'); return; }
  try {
    await API.addAlmacen({
      nombre,
      direccion:    document.getElementById('alm-dir').value.trim(),
      responsable:  document.getElementById('alm-resp').value.trim(),
    });
    toast('✓ Almacén creado: ' + nombre);
    document.getElementById('form-almacen').classList.add('hidden');
    cargarAlmacenes();
    iniciarAlmacenes();
  } catch(e) { toast('Error: ' + e.message); }
}
