// =====================================================
//  SCANNER v5 — Con evidencia fotográfica
//  Entrada: foto del recibo del proveedor
//  Salida:  foto del vale de entrega
// =====================================================

let productoEscaneado  = null;
let accionSeleccionada = null;
let scanner = null;
let fotoEvidencia = null; // archivo de foto capturado

// ── CÁMARA ESCÁNER ────────────────────────────────────
function startScanner() {
  if (scanner) return;
  const el = document.getElementById('reader');
  if (el) el.innerHTML = '';
  scanner = new Html5Qrcode('reader');
  scanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 260, height: 140 } },
    (code) => { stopScanner(); procesarCodigo(code.trim()); },
    () => {}
  ).catch(() => toast('No se pudo acceder a la cámara. Verifica los permisos.'));
}

function stopScanner() {
  if (scanner) { scanner.stop().catch(() => {}); scanner = null; }
}

async function buscarManual() {
  const cod = document.getElementById('manual-code').value.trim();
  if (!cod) { toast('Ingresa un código'); return; }
  await procesarCodigo(cod);
}

// ── PROCESAR CÓDIGO ───────────────────────────────────
async function procesarCodigo(codigo) {
  toast('Buscando producto...');
  ocultarTodasLasVistas();
  const prod = await API.getProducto(codigo);
  if (prod) {
    productoEscaneado  = prod;
    accionSeleccionada = null;
    mostrarProductoEncontrado(prod);
  } else {
    mostrarFormularioAlta(codigo);
  }
}

function ocultarTodasLasVistas() {
  ['scan-result-card','scan-form-card','scan-alta-card'].forEach(id =>
    document.getElementById(id)?.classList.add('hidden')
  );
  fotoEvidencia = null;
}

// ── PRODUCTO ENCONTRADO ───────────────────────────────
function mostrarProductoEncontrado(p) {
  const hoy  = new Date();
  const dias  = p.caducidad ? Math.floor((new Date(p.caducidad) - hoy) / 86400000) : null;
  const bajo  = Number(p.stock) <= Number(p.min);

  document.getElementById('scan-info-rows').innerHTML = `
    <div class="scan-info-row"><span>Nombre</span><strong>${p.nombre}</strong></div>
    <div class="scan-info-row"><span>Código</span><span>${p.id}</span></div>
    <div class="scan-info-row"><span>Stock actual</span>
      <strong style="color:${bajo?'var(--red)':'inherit'}">${p.stock} ${p.unidad||''}</strong>
      ${bajo ? '<span class="badge badge-danger">Stock bajo</span>' : ''}
    </div>
    <div class="scan-info-row"><span>Stock mínimo</span><span>${p.min} ${p.unidad||''}</span></div>
    <div class="scan-info-row"><span>Lote</span><span>${p.lote||'—'}</span></div>
    <div class="scan-info-row"><span>Caducidad</span>
      <span>${p.caducidad||'—'}${dias!==null?` <span class="badge ${dias<30?'badge-danger':dias<90?'badge-warn':'badge-ok'}">${dias}d</span>`:''}</span>
    </div>
    <div class="scan-info-row"><span>Proveedor</span><span>${p.proveedor||'—'}</span></div>`;

  ['btn-agregar','btn-descontar'].forEach(id =>
    document.getElementById(id)?.classList.remove('selected-entrada','selected-salida')
  );
  document.getElementById('scan-form-card').classList.add('hidden');
  document.getElementById('scan-result-card').classList.remove('hidden');
  document.getElementById('scan-result-card').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ── SELECCIONAR ACCIÓN ────────────────────────────────
function selectAction(tipo) {
  accionSeleccionada = tipo;
  fotoEvidencia = null;

  document.getElementById('btn-agregar')?.classList.toggle('selected-entrada',  tipo === 'entrada');
  document.getElementById('btn-descontar')?.classList.toggle('selected-salida', tipo === 'salida');

  if (tipo === 'ver') {
    toast('Producto: ' + productoEscaneado.nombre + ' — Stock: ' + productoEscaneado.stock + ' ' + (productoEscaneado.unidad||''));
    return;
  }

  // Título del formulario
  document.getElementById('scan-form-title').textContent =
    tipo === 'entrada' ? '↓ Agregar stock al inventario' : '↑ Descontar del inventario';

  // Campos solo para entrada
  document.getElementById('f-entrada-extra').style.display = tipo === 'entrada' ? 'block' : 'none';

  // Sección de foto — etiqueta según tipo
  const fotoLabel = document.getElementById('foto-label');
  const fotoDesc  = document.getElementById('foto-desc');
  if (fotoLabel) fotoLabel.textContent = tipo === 'entrada' ? '📄 Foto del recibo del proveedor *' : '📋 Foto del vale de entrega *';
  if (fotoDesc)  fotoDesc.textContent  = tipo === 'entrada' ? 'Toma o selecciona la foto del recibo' : 'Toma o selecciona la foto del vale';

  // Limpiar foto anterior
  resetFoto();

  // Prellenar unidad
  const unitSel = document.getElementById('f-unit');
  if (unitSel && productoEscaneado.unidad) {
    [...unitSel.options].forEach(o => { if (o.value === productoEscaneado.unidad) unitSel.value = o.value; });
  }

  document.getElementById('scan-form-card').classList.remove('hidden');
  document.getElementById('scan-form-card').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ── MANEJO DE FOTO ────────────────────────────────────
function resetFoto() {
  fotoEvidencia = null;
  const prev = document.getElementById('foto-preview');
  const inp  = document.getElementById('foto-input');
  if (prev) { prev.src = ''; prev.classList.add('hidden'); }
  if (inp)  inp.value = '';
  const btn = document.getElementById('foto-status');
  if (btn) { btn.textContent = 'Sin foto'; btn.className = 'foto-status sin-foto'; }
}

function onFotoSeleccionada(input) {
  const file = input.files[0];
  if (!file) return;

  // Validar tipo y tamaño (máx 5MB)
  if (!file.type.startsWith('image/')) { toast('Solo se aceptan imágenes'); resetFoto(); return; }
  if (file.size > 5 * 1024 * 1024)    { toast('La imagen no debe superar 5MB'); resetFoto(); return; }

  fotoEvidencia = file;

  // Mostrar preview
  const reader = new FileReader();
  reader.onload = (e) => {
    const prev = document.getElementById('foto-preview');
    if (prev) { prev.src = e.target.result; prev.classList.remove('hidden'); }
  };
  reader.readAsDataURL(file);

  const btn = document.getElementById('foto-status');
  if (btn) { btn.textContent = '✓ Foto lista: ' + file.name; btn.className = 'foto-status con-foto'; }

  toast('✓ Foto capturada: ' + file.name);
}

// ── SOLICITAR PIN ─────────────────────────────────────
function solicitarPin() {
  if (!accionSeleccionada || accionSeleccionada === 'ver') return;

  const qty = Number(document.getElementById('f-qty').value);
  if (!qty || qty <= 0) { toast('Ingresa una cantidad válida'); return; }

  if (!fotoEvidencia) {
    const tipo = accionSeleccionada;
    toast('⚠ ' + (tipo === 'entrada' ? 'Debes adjuntar la foto del recibo del proveedor' : 'Debes adjuntar la foto del vale de entrega'));
    document.getElementById('foto-input')?.focus();
    return;
  }

  document.getElementById('pin-pass').value = '';
  document.getElementById('pin-error').textContent = '';
  document.getElementById('pin-modal').classList.remove('hidden');
  document.getElementById('pin-pass').focus();
}

function cancelPin() { document.getElementById('pin-modal').classList.add('hidden'); }

async function confirmPin() {
  const pass = document.getElementById('pin-pass').value;
  if (!pass) { document.getElementById('pin-error').textContent = 'Ingresa tu contraseña'; return; }
  document.getElementById('pin-error').textContent = 'Verificando...';
  const ok = await API.verificarPassword(pass);
  if (!ok) { document.getElementById('pin-error').textContent = 'Contraseña incorrecta'; return; }
  document.getElementById('pin-modal').classList.add('hidden');
  await registrarMovimiento();
}

// ── REGISTRAR MOVIMIENTO CON FOTO ─────────────────────
async function registrarMovimiento() {
  const qty         = Number(document.getElementById('f-qty').value);
  const tipo        = accionSeleccionada;
  const stockActual = Number(productoEscaneado.stock);

  if (tipo === 'salida' && qty > stockActual) {
    toast(`Stock insuficiente. Solo hay ${stockActual} ${productoEscaneado.unidad||''}`);
    return;
  }

  const btn = document.getElementById('btn-registrar');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const nuevoStock = tipo === 'entrada' ? stockActual + qty : stockActual - qty;
  const unit       = document.getElementById('f-unit').value;
  const movId      = crypto.randomUUID();
  const now        = new Date().toISOString();

  // 1. Subir foto a Supabase Storage
  let fotoUrl = null;
  try {
    const ext      = fotoEvidencia.name.split('.').pop();
    const rutaFoto = `${tipo}/${now.split('T')[0]}/${movId}.${ext}`;
    fotoUrl = await API.subirFoto(rutaFoto, fotoEvidencia);
  } catch {
    toast('Error al subir la foto. Intenta de nuevo.');
    btn.disabled = false; btn.textContent = '🔐 Confirmar con contraseña';
    return;
  }

  // 2. Guardar movimiento con URL de foto
  const mov = {
    id:              movId,
    tipo,
    id_producto:     productoEscaneado.id,
    nombre:          productoEscaneado.nombre,
    cantidad:        qty,
    unidad:          unit,
    usuario_id:      currentUser.id,
    usuario_nombre:  currentProfile?.nombre || currentUser.email,
    destino:         document.getElementById('f-dest').value,
    lote:            tipo === 'entrada' ? document.getElementById('f-lote').value : productoEscaneado.lote,
    caducidad_lote:  tipo === 'entrada' ? document.getElementById('f-cad').value  : productoEscaneado.caducidad,
    nota:            document.getElementById('f-nota').value,
    stock_resultante: nuevoStock,
    foto_evidencia:  fotoUrl,
    created_at:      now,
  };

  try {
    await Promise.all([API.addMovimiento(mov), API.updateStock(productoEscaneado.id, nuevoStock)]);
    await API.addAuditoria({
      tipo: 'movimiento',
      descripcion: `${tipo === 'entrada' ? 'Entrada' : 'Salida'} de ${qty} ${unit} de ${productoEscaneado.nombre} — con evidencia fotográfica`,
      usuario_id:    currentUser.id,
      usuario_nombre: currentProfile?.nombre || currentUser.email,
      metadata: { producto: productoEscaneado.id, cantidad: qty, tipo, nuevo_stock: nuevoStock, foto: fotoUrl }
    });

    toast(`✓ ${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada con foto — nuevo stock: ${nuevoStock} ${unit}`);
    limpiarScanner();
  } catch {
    toast('Error al guardar el movimiento. Intenta de nuevo.');
  }

  btn.disabled = false;
  btn.textContent = '🔐 Confirmar con contraseña';
}

// ── PRODUCTO NUEVO DESDE ESCÁNER ──────────────────────
function mostrarFormularioAlta(codigo) {
  ['alta-id','alta-nombre','alta-stock','alta-min','alta-prov','alta-lote'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
  const c = document.getElementById('alta-cad'); if (c) c.value = '';
  document.getElementById('alta-id').value = codigo;
  document.getElementById('scan-alta-card').classList.remove('hidden');
  document.getElementById('scan-alta-card').scrollIntoView({ behavior:'smooth', block:'nearest' });
  toast('Producto nuevo — llena los datos para darlo de alta');
}

async function guardarProductoDesdeScanner() {
  // Parsear fecha de caducidad (acepta DD/MM/AAAA o AAAA-MM-DD)
  let cadRaw = document.getElementById('alta-cad')?.value.trim() || '';
  let cadFinal = null;
  if (cadRaw && !document.getElementById('alta-sin-cad')?.checked) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(cadRaw)) {
      const [d,m,a] = cadRaw.split('/');
      cadFinal = `${a}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(cadRaw)) {
      cadFinal = cadRaw;
    }
  }
  const sinLote = document.getElementById('alta-sin-lote')?.checked;

  const prod = {
    id:               document.getElementById('alta-id').value.trim(),
    nombre:           document.getElementById('alta-nombre').value.trim(),
    activo:           true,
    stock:            Number(document.getElementById('alta-stock').value)      || 0,
    min:              Number(document.getElementById('alta-min').value)        || 0,
    unidad:           document.getElementById('alta-unit').value               || 'piezas',
    proveedor:        document.getElementById('alta-prov')?.value.trim()      || '',
    lote:             sinLote ? '' : (document.getElementById('alta-lote')?.value.trim() || ''),
    caducidad:        cadFinal,
    ubicacion:        document.getElementById('alta-ubicacion')?.value.trim() || '',
    precio_unitario:  Number(document.getElementById('alta-precio')?.value)    || 0,
    ingrediente_activo: document.getElementById('alta-ingrediente')?.value.trim() || '',
    descripcion:      document.getElementById('alta-descripcion')?.value.trim() || '',
    sds_link:         document.getElementById('alta-sds-link')?.value.trim()  || '',
    almacen_id:       typeof almacenActivo !== 'undefined' ? almacenActivo?.id : null,
  };
  if (!prod.nombre) { toast('El nombre del producto es obligatorio'); return; }
  // Auto-generar código si está vacío
  if (!prod.id) prod.id = 'QM-' + Date.now().toString().slice(-6);

  const btn = document.getElementById('btn-guardar-alta');
  btn.disabled = true; btn.textContent = 'Guardando...';

  try {
    await API.addProducto(prod);
    await API.addAuditoria({
      tipo: 'producto_nuevo',
      descripcion: `Alta desde escáner: ${prod.nombre} (${prod.id})`,
      usuario_id:    currentUser.id,
      usuario_nombre: currentProfile?.nombre || currentUser.email,
      metadata: { id: prod.id, stock: prod.stock }
    });
    toast('✓ Producto dado de alta: ' + prod.nombre);
    limpiarScanner();
  } catch(e) { toast('Error al guardar: ' + e.message); }

  btn.disabled = false; btn.textContent = '✓ Dar de alta producto';
}

// ── LIMPIAR ───────────────────────────────────────────
function limpiarScanner() {
  productoEscaneado  = null;
  accionSeleccionada = null;
  fotoEvidencia      = null;
  ocultarTodasLasVistas();
  document.getElementById('manual-code').value = '';
  ['f-qty','f-dest','f-lote','f-nota'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
  const c = document.getElementById('f-cad'); if (c) c.value = '';
  resetFoto();
}
