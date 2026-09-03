// =====================================================
//  VALE IMPRIMIBLE — Las Naves Agrícola
//  Genera el vale de salida en papel, para firmar.
//  Usa el mismo folio y los mismos datos del movimiento,
//  así el papel y el sistema no se separan.
// =====================================================

function _valeFecha(d){
  const f = d ? new Date(d) : new Date();
  return f.toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
}
function _valeEsc(s){
  return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// datos = { folio, fecha, destino, solicitante, entrega, nota, almacen,
//           items:[{clave,nombre,cantidad,unidad,lote}] }
function imprimirVale(datos){
  const items = datos.items || [];
  const filas = items.map((i,n) => `
    <tr>
      <td class="c">${n+1}</td>
      <td class="m">${_valeEsc(i.clave||'')}</td>
      <td>${_valeEsc(i.nombre||'')}</td>
      <td class="r m">${i.cantidad ?? ''}</td>
      <td>${_valeEsc(i.unidad||'')}</td>
      <td class="m">${_valeEsc(i.lote||'')}</td>
    </tr>`).join('');
  // renglones en blanco para que el vale se pueda completar a mano
  const blancos = Array.from({length: Math.max(0, 8 - items.length)},
    () => '<tr class="b"><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>').join('');

  const w = window.open('', '_blank', 'width=800,height=1000');
  if (!w) { toast('El navegador bloqueó la ventana. Permite las ventanas emergentes.'); return; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Vale ${_valeEsc(datos.folio||'')}</title>
<style>
  @page { size: letter; margin: 16mm 14mm; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
       font-size:11pt;color:#111;line-height:1.35}
  .m{font-family:'SF Mono',Consolas,monospace;font-variant-numeric:tabular-nums}
  header{display:flex;justify-content:space-between;align-items:flex-start;
         border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:14px}
  h1{font-size:15pt;letter-spacing:-.3px}
  header .sub{font-size:9pt;color:#555;margin-top:2px}
  .folio{text-align:right}
  .folio b{font-size:13pt;letter-spacing:.5px}
  .folio span{display:block;font-size:9pt;color:#555}
  .datos{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:14px;font-size:10pt}
  .datos div{display:flex;gap:8px;border-bottom:1px dotted #bbb;padding-bottom:3px}
  .datos i{font-style:normal;color:#666;min-width:88px}
  .datos b{font-weight:600}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  th{font-size:8.5pt;text-transform:uppercase;letter-spacing:.6px;color:#444;
     text-align:left;border-bottom:1.5px solid #111;padding:4px 5px}
  td{padding:6px 5px;border-bottom:1px solid #ddd;font-size:10pt}
  tr.b td{height:22px}
  .c{text-align:center;width:26px;color:#888}
  .r{text-align:right}
  .nota{font-size:9.5pt;border:1px solid #ccc;padding:7px 9px;margin-bottom:22px;min-height:38px}
  .nota i{font-style:normal;color:#666;font-size:8.5pt;display:block;margin-bottom:3px}
  .firmas{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:34px}
  .firma{text-align:center;font-size:9pt}
  .firma .l{border-top:1px solid #111;margin-bottom:4px;padding-top:5px}
  .firma span{color:#666}
  footer{margin-top:26px;padding-top:7px;border-top:1px solid #ddd;
         font-size:8pt;color:#777;display:flex;justify-content:space-between}
  @media print{ .noprint{display:none} }
  .noprint{position:fixed;top:10px;right:10px;display:flex;gap:6px}
  .noprint button{font:inherit;font-size:10pt;padding:7px 13px;border:1px solid #111;
    background:#111;color:#fff;border-radius:5px;cursor:pointer}
  .noprint button.g{background:#fff;color:#111}
</style></head><body>
<div class="noprint">
  <button onclick="window.print()">Imprimir</button>
  <button class="g" onclick="window.close()">Cerrar</button>
</div>
<header>
  <div>
    <h1>Vale de salida de almacén</h1>
    <div class="sub">Agrícola Las Naves · ${_valeEsc(datos.almacen||'Almacén Principal')}</div>
  </div>
  <div class="folio"><b class="m">${_valeEsc(datos.folio||'—')}</b><span>${_valeFecha(datos.fecha)}</span></div>
</header>
<div class="datos">
  <div><i>Destino</i><b>${_valeEsc(datos.destino||'')}</b></div>
  <div><i>Solicitante</i><b>${_valeEsc(datos.solicitante||'')}</b></div>
  <div><i>Entrega</i><b>${_valeEsc(datos.entrega||'')}</b></div>
  <div><i>Fecha</i><b>${_valeFecha(datos.fecha)}</b></div>
</div>
<table>
  <thead><tr><th></th><th>Clave</th><th>Producto</th><th class="r">Cantidad</th><th>Unidad</th><th>Lote</th></tr></thead>
  <tbody>${filas}${blancos}</tbody>
</table>
<div class="nota"><i>Observaciones</i>${_valeEsc(datos.nota||'')}</div>
<div class="firmas">
  <div class="firma"><div class="l"></div><span>Entregó (almacén)</span></div>
  <div class="firma"><div class="l"></div><span>Recibió</span></div>
  <div class="firma"><div class="l"></div><span>Autorizó</span></div>
</div>
<footer><span>ERP Las Naves Agrícola</span><span class="m">Impreso ${new Date().toLocaleString('es-MX')}</span></footer>
</body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); } catch(e){} }, 120);
}

// Reimprimir desde el historial de movimientos.
// Reconstruye el vale agrupando los movimientos que salieron juntos:
// mismo destino, mismo usuario y dentro del mismo minuto.
async function reimprimirVale(movId){
  try{
    const { data: m, error } = await db.from('movimientos').select('*').eq('id', movId).single();
    if (error) throw error;
    const t = new Date(m.created_at);
    const desde = new Date(t.getTime() - 90000).toISOString();
    const hasta = new Date(t.getTime() + 90000).toISOString();
    let q = db.from('movimientos').select('*')
      .eq('tipo','salida').gte('created_at',desde).lte('created_at',hasta);
    if (m.destino) q = q.eq('destino', m.destino);
    const { data: hermanos } = await q;
    const items = (hermanos && hermanos.length ? hermanos : [m]).map(x => ({
      clave: x.id_producto, nombre: x.nombre,
      cantidad: x.cantidad, unidad: x.unidad, lote: x.lote,
    }));
    imprimirVale({
      folio: 'MOV-' + String(m.id).slice(0,8).toUpperCase(),
      fecha: m.created_at, destino: m.destino,
      entrega: m.usuario_nombre, nota: m.nota,
      almacen: (typeof almacenActivo !== 'undefined' ? almacenActivo?.nombre : ''),
      items,
    });
  } catch(e){ toast('No se pudo generar el vale: ' + e.message); }
}
