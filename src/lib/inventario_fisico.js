// =====================================================
//  INVENTARIO FÍSICO v9
//  Conteo cíclico con registro de diferencias
// =====================================================

let conteoActual = [];

async function iniciarConteoFisico() {
  document.getElementById('conteo-lista').innerHTML = '<div class="loading">Cargando productos...</div>';
  document.getElementById('conteo-form').classList.remove('hidden');
  document.getElementById('conteo-resultado').classList.add('hidden');

  try {
    const prods = await API.getProductos(almacenActivo?.id);
    conteoActual = prods.map(p => ({ ...p, stock_fisico: '', diferencia: null }));
    renderConteo();
  } catch { document.getElementById('conteo-lista').innerHTML = '<div class="empty">Error al cargar</div>'; }
}

function renderConteo() {
  document.getElementById('conteo-lista').innerHTML = conteoActual.map((p, i) => `
    <div class="conteo-item">
      <div class="conteo-info">
        <div class="conteo-nombre">${p.nombre}</div>
        <div class="conteo-sub">${p.id} · Sistema: <strong>${p.stock} ${p.unidad||''}</strong>
          ${p.ubicacion ? ` · 📍 ${p.ubicacion}` : ''}
        </div>
      </div>
      <div class="conteo-input-wrap">
        <input class="input conteo-input" type="number" min="0"
          placeholder="Cantidad física"
          id="conteo-${i}"
          oninput="actualizarDiff(${i}, this.value)"
          value="${conteoActual[i].stock_fisico}">
        <span class="conteo-diff" id="diff-${i}"></span>
      </div>
    </div>`).join('');
}

function actualizarDiff(i, val) {
  conteoActual[i].stock_fisico = val;
  const diff = val === '' ? null : Number(val) - Number(conteoActual[i].stock);
  conteoActual[i].diferencia = diff;
  const el = document.getElementById('diff-' + i);
  if (diff === null) { el.textContent = ''; return; }
  el.textContent = (diff >= 0 ? '+' : '') + diff + ' ' + (conteoActual[i].unidad||'');
  el.className = 'conteo-diff ' + (diff === 0 ? 'diff-ok' : diff > 0 ? 'diff-pos' : 'diff-neg');
}

async function guardarConteoFisico() {
  const contados = conteoActual.filter(p => p.stock_fisico !== '');
  if (!contados.length) { toast('Ingresa al menos una cantidad'); return; }

  const btn = document.getElementById('btn-guardar-conteo');
  btn.disabled = true; btn.textContent = 'Guardando...';

  try {
    for (const p of contados) {
      const conteo = {
        almacen_id: almacenActivo?.id || null,
        producto_id: p.id,
        producto_nombre: p.nombre,
        stock_sistema: Number(p.stock),
        stock_fisico: Number(p.stock_fisico),
        diferencia: Number(p.stock_fisico) - Number(p.stock),
        usuario_nombre: currentProfile?.nombre || currentUser?.email,
        nota: document.getElementById('conteo-nota').value,
      };
      await API.addConteo(conteo);

      // Ajustar stock si hay diferencia
      if (conteo.diferencia !== 0) {
        await API.updateStock(p.id, Number(p.stock_fisico));
        const mov = {
          tipo: conteo.diferencia > 0 ? 'entrada' : 'salida',
          id_producto: p.id, nombre: p.nombre,
          cantidad: Math.abs(conteo.diferencia), unidad: p.unidad||'',
          usuario_id: currentUser.id, usuario_nombre: currentProfile?.nombre||currentUser.email,
          destino: 'Ajuste por inventario físico',
          nota: 'Conteo físico: sistema=' + conteo.stock_sistema + ', físico=' + conteo.stock_fisico,
          stock_resultante: Number(p.stock_fisico),
          created_at: new Date().toISOString(),
        };
        await API.addMovimiento(mov);
      }
    }

    await API.addAuditoria({ tipo:'ajuste', descripcion:`Inventario físico: ${contados.length} productos contados`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });

    // Mostrar resumen
    const diffs = contados.filter(p => p.diferencia !== 0 && p.diferencia !== null);
    document.getElementById('conteo-resumen').innerHTML = `
      <div class="metric-card"><div class="metric-icon green"><span style="font-size:18px">✓</span></div><div class="metric-body"><div class="metric-val">${contados.length}</div><div class="metric-label">Productos contados</div></div></div>
      <div class="metric-card"><div class="metric-icon ${diffs.length?'red':'green'}"><span style="font-size:18px">${diffs.length?'⚠':'✓'}</span></div><div class="metric-body"><div class="metric-val">${diffs.length}</div><div class="metric-label">Con diferencia</div></div></div>
    `;
    document.getElementById('conteo-diffs').innerHTML = diffs.length
      ? diffs.map(p => `<div class="mov-item">
          <div class="mov-dot ${p.diferencia>0?'entrada':'salida'}">${p.diferencia>0?'↑':'↓'}</div>
          <div class="mov-body"><div class="mov-name">${p.nombre}</div><div class="mov-meta">Sistema: ${p.stock} → Físico: ${p.stock_fisico} ${p.unidad||''}</div></div>
          <div class="mov-qty ${p.diferencia>0?'entrada':'salida'}">${p.diferencia>0?'+':''}${p.diferencia} ${p.unidad||''}</div>
        </div>`).join('')
      : '<div class="empty">✓ Sin diferencias — inventario exacto</div>';

    document.getElementById('conteo-form').classList.add('hidden');
    document.getElementById('conteo-resultado').classList.remove('hidden');
    toast('✓ Inventario físico guardado');
  } catch(e) { toast('Error: ' + e.message); }

  btn.disabled = false; btn.textContent = 'Guardar conteo y ajustar stock';
}

function cancelarConteo() {
  document.getElementById('conteo-form').classList.add('hidden');
  conteoActual = [];
}
