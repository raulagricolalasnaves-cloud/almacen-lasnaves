// =====================================================
//  SDS v9 — Fichas de Seguridad GHS / NOM-018-STPS
// =====================================================

const GHS = {
  explosivo:    { emoji:'💥', color:'#c0392b', label:'Explosivo' },
  inflamable:   { emoji:'🔥', color:'#e67e22', label:'Inflamable' },
  oxidante:     { emoji:'⭕', color:'#e67e22', label:'Oxidante' },
  gas_presion:  { emoji:'🔵', color:'#2980b9', label:'Gas a presión' },
  corrosivo:    { emoji:'⚗',  color:'#8e44ad', label:'Corrosivo' },
  toxico:       { emoji:'☠',  color:'#2c3e50', label:'Tóxico' },
  irritante:    { emoji:'⚠',  color:'#f39c12', label:'Irritante' },
  peligro_salud:{ emoji:'🫀', color:'#c0392b', label:'Peligro salud' },
  ambiental:    { emoji:'🌿', color:'#27ae60', label:'Peligro ambiental' },
};

function getPeligrosidadBadge(p) {
  if (!p) return '';
  const mapa = { alto:'badge-danger', medio:'badge-warn', bajo:'badge-ok', ninguno:'badge-info' };
  return `<span class="badge ${mapa[p]||'badge-info'}">⚠ ${p}</span>`;
}

function getGHSHtml(claseGhs) {
  if (!claseGhs) return '';
  return claseGhs.split(',').map(g => {
    const k = g.trim();
    const info = GHS[k];
    if (!info) return '';
    return `<span class="ghs-tag" style="background:${info.color}20;color:${info.color};border:1px solid ${info.color}40;font-size:11px;padding:2px 7px;border-radius:20px;display:inline-flex;align-items:center;gap:3px">${info.emoji} ${info.label}</span>`;
  }).join(' ');
}

// ── MODAL VER SDS ─────────────────────────────────────
function verSDS(prod) {
  const ghsHtml = getGHSHtml(prod.clase_ghs);
  document.getElementById('sds-modal-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
      <div>
        <div style="font-size:16px;font-weight:600;color:var(--navy)">${prod.nombre}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${prod.id}</div>
      </div>
      <button class="btn btn-sm" onclick="cerrarSDS()">✕ Cerrar</button>
    </div>

    ${prod.peligrosidad ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:#991b1b;margin-bottom:6px">⚠ Nivel de peligrosidad: ${prod.peligrosidad}</div>
      ${ghsHtml ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">${ghsHtml}</div>` : ''}
    </div>` : ''}

    ${prod.sds_url ? `
    <div style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">📄 Ficha de seguridad (SDS)</div>
      <a href="${prod.sds_url}" target="_blank" class="btn btn-primary btn-full" style="justify-content:center">
        Ver / Descargar SDS — ${prod.sds_nombre||'Ficha de seguridad'}
      </a>
    </div>` : '<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Sin ficha de seguridad adjunta</div>'}

    ${(currentProfile?.rol === 'admin' || currentProfile?.rol === 'supervisor') ? `
    <div style="border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">Actualizar información de seguridad</div>
      <div class="form-row">
        <div class="form-group">
          <label>Nivel de peligrosidad</label>
          <select class="input" id="sds-peligrosidad">
            <option value="">Sin clasificar</option>
            <option value="alto" ${prod.peligrosidad==='alto'?'selected':''}>Alto</option>
            <option value="medio" ${prod.peligrosidad==='medio'?'selected':''}>Medio</option>
            <option value="bajo" ${prod.peligrosidad==='bajo'?'selected':''}>Bajo</option>
            <option value="ninguno" ${prod.peligrosidad==='ninguno'?'selected':''}>Ninguno</option>
          </select>
        </div>
        <div class="form-group">
          <label>Clases GHS (separadas por coma)</label>
          <input class="input" type="text" id="sds-ghs" value="${prod.clase_ghs||''}" placeholder="ej: inflamable,corrosivo">
        </div>
      </div>
      <div class="form-group">
        <label>Subir ficha SDS (PDF o imagen, máx 10MB)</label>
        <input type="file" id="sds-file" accept=".pdf,image/*" class="input" style="padding:6px">
      </div>
      <button class="btn btn-primary btn-full" onclick="guardarSDS('${prod.id}')">Guardar cambios de seguridad</button>
    </div>` : ''}
  `;
  document.getElementById('sds-modal').classList.remove('hidden');
}

function cerrarSDS() { document.getElementById('sds-modal').classList.add('hidden'); }

async function guardarSDS(prodId) {
  const peligrosidad = document.getElementById('sds-peligrosidad').value;
  const claseGhs     = document.getElementById('sds-ghs').value.trim();
  const fileInput    = document.getElementById('sds-file');
  const datos        = { peligrosidad, clase_ghs: claseGhs };

  if (fileInput.files[0]) {
    try {
      toast('Subiendo ficha...');
      const url = await API.subirSDS(prodId, fileInput.files[0]);
      datos.sds_url    = url;
      datos.sds_nombre = fileInput.files[0].name;
    } catch(e) { toast('Error al subir: ' + e.message); return; }
  }

  try {
    await API.updateProducto(prodId, datos);
    await API.addAuditoria({ tipo:'producto_nuevo', descripcion:`SDS actualizada para producto ${prodId}`, usuario_id:currentUser.id, usuario_nombre:currentProfile?.nombre||currentUser.email });
    toast('✓ Información de seguridad guardada');
    cerrarSDS();
    if (typeof cargarInventario === 'function') cargarInventario();
  } catch(e) { toast('Error: ' + e.message); }
}
