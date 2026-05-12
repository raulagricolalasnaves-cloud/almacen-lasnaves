// =====================================================
//  QR v9 — Generación de etiquetas con código QR
//  Usa la API gratuita de QR Server
// =====================================================

function generarURLqr(texto) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(texto)}`;
}

function mostrarEtiquetaQR(prod) {
  const qrUrl = generarURLqr(prod.id);
  const ghsClases = prod.clase_ghs ? prod.clase_ghs.split(',').map(g => g.trim()).filter(Boolean) : [];
  const ghsEmojis = { explosivo:'💥', inflamable:'🔥', oxidante:'⭕', gas_presion:'🔵', corrosivo:'⚗', toxico:'☠', irritante:'⚠', peligro_salud:'🫀', ambiental:'🌿' };
  const peligroColor = { alto:'#c0392b', medio:'#e67e22', bajo:'#f39c12', ninguno:'#27ae60' };

  document.getElementById('qr-modal-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-size:15px;font-weight:600;color:var(--navy)">Etiqueta de producto</div>
      <button class="btn btn-sm" onclick="cerrarQR()">✕</button>
    </div>

    <div id="etiqueta-imprimible" style="border:2px solid #0f2a5c;border-radius:10px;padding:16px;background:#fff;max-width:340px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;border-bottom:1px solid #e5e5e3;padding-bottom:10px">
        <img src="public/logo.png" style="width:40px;height:40px;object-fit:contain">
        <div>
          <div style="font-size:10px;color:#666;font-weight:500">LAS NAVES AGRÍCOLA</div>
          <div style="font-size:10px;color:#999">Almacén de Químicos</div>
        </div>
      </div>

      <div style="display:flex;gap:14px;align-items:flex-start">
        <img src="${qrUrl}" style="width:100px;height:100px;flex-shrink:0" alt="QR ${prod.id}">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:#0f2a5c;margin-bottom:4px;word-break:break-word">${prod.nombre}</div>
          <div style="font-size:11px;color:#666;font-family:monospace;margin-bottom:6px">${prod.id}</div>
          ${prod.peligrosidad ? `<div style="display:inline-block;background:${peligroColor[prod.peligrosidad]||'#999'};color:#fff;font-size:10px;padding:2px 8px;border-radius:20px;margin-bottom:4px">⚠ ${prod.peligrosidad.toUpperCase()}</div>` : ''}
          ${ghsClases.length ? `<div style="font-size:13px;margin-top:3px">${ghsClases.map(g=>ghsEmojis[g]||'').join(' ')}</div>` : ''}
          <div style="font-size:11px;color:#666;margin-top:6px">Stock mín: ${prod.min} ${prod.unidad||''}</div>
          ${prod.ubicacion ? `<div style="font-size:11px;color:#666">📍 ${prod.ubicacion}</div>` : ''}
          ${almacenActivo ? `<div style="font-size:11px;color:#666">🏭 ${almacenActivo.nombre}</div>` : ''}
        </div>
      </div>

      <div style="margin-top:10px;border-top:1px solid #e5e5e3;padding-top:8px;font-size:9px;color:#999;text-align:center">
        Escanea el QR para ver stock y movimientos · Las Naves Agrícola
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-primary" style="flex:1" onclick="imprimirEtiqueta()">🖨 Imprimir etiqueta</button>
      <button class="btn" style="flex:1" onclick="cerrarQR()">Cerrar</button>
    </div>
  `;
  document.getElementById('qr-modal').classList.remove('hidden');
}

function cerrarQR() { document.getElementById('qr-modal').classList.add('hidden'); }

function imprimirEtiqueta() {
  const contenido = document.getElementById('etiqueta-imprimible').innerHTML;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Etiqueta</title>
  <style>body{margin:0;padding:20px;font-family:Arial,sans-serif}@media print{body{padding:0}}</style>
  </head><body>${contenido}<script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
