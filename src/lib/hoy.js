// ═══════════════════════════════════════════════════════════════════
//  hoy.js — la primera pantalla: lo que me toca
//
//  Reemplaza al Dashboard. La diferencia no es de adorno: el dashboard
//  enseñaba métricas del almacén — cuántos productos, cuánto valen. Eso
//  no es una decisión, es un dato. Esta pantalla enseña las cosas que
//  están esperando a que Raúl haga algo, en el orden del ciclo:
//
//      llega → reparto → pido → espero → llega → entrego
//
//  Cada recuadro lleva al lugar donde eso se resuelve. Ninguno se
//  captura: todos salen de vistas que ya existen.
//
//  Aquí también se fundió Alertas, que era un botón aparte. Lo que
//  queda en Almacén → Alertas es la lista completa; aquí sólo está el
//  número y el camino para llegar.
// ═══════════════════════════════════════════════════════════════════

const hoyM0 = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const hoyEsc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function cargarHoy() {
  const cont = document.getElementById('hoy-cuerpo');
  if (!cont) return;
  cont.innerHTML = '<div class="loading">Cargando...</div>';

  const d = {
    solicitudes: 0, enCamino: 0, atrasados: 0, completos: [], bajo: 0,
    porPagar: 0, montoPagar: 0, sinContar: 0, vales: 0, err: null,
  };

  // Cada consulta va por su lado: si una vista todavía no existe
  // porque falta correr un SQL, las demás siguen saliendo.
  const q = async (fn, guardar) => { try { await fn(); } catch (e) { guardar && guardar(e); } };

  await Promise.all([
    q(async () => {
      const { data } = await db.from('solicitudes').select('id,folio,fecha').eq('estado', 'Abierta');
      d.solicitudes = (data || []).length; d.ultima = (data || [])[0] || null;
    }),
    q(async () => {
      const { data } = await db.from('v_en_camino').select('estado,atrasado,por_repartir,estado_oc');
      const v = (data || []).filter(r => r.estado_oc !== 'Cerrada');
      d.enCamino    = v.filter(r => r.estado === 'Pedido').length;
      d.atrasados   = v.filter(r => r.estado === 'Pedido' && r.atrasado).length;
      // llegó pero todavía no se reparte: es lo que se atora
      d.porRepartir = v.filter(r => r.por_repartir).length;
    }),
    q(async () => {
      const { data } = await db.from('v_rancho_listo')
        .select('rancho_nombre,renglones,listos,entregados,completo').eq('completo', true);
      d.completos = (data || []).filter(r => Number(r.entregados) < Number(r.renglones));
    }),
    q(async () => {
      const { data } = await db.from('v_producto_ficha')
        .select('producto_id,nombre,stock,unidad,minimo').eq('bajo_minimo', true);
      d.bajo = (data || []).length; d.bajoLista = (data || []).slice(0, 5);
    }),
    q(async () => {
      const { data } = await db.from('v_cuentas_por_pagar')
        .select('saldo,estado').in('estado', ['Vencida', 'Esta semana']);
      d.porPagar = (data || []).length;
      d.montoPagar = (data || []).reduce((s, r) => s + Number(r.saldo || 0), 0);
    }),
    q(async () => {
      const { count } = await db.from('productos').select('id', { count: 'exact', head: true })
        .eq('activo', true).eq('stock_verificado', false);
      d.sinContar = count || 0;
    }),
  ]);

  hoyRender(d);
}

function hoyTile(cls, k, v, s, ir, sub) {
  return `<button type="button" class="hoy-tile ${cls}" onclick="${ir}">
    <span class="k">${k}</span><span class="v${sub ? ' sm' : ''}">${v}</span>
    <span class="s">${s}</span></button>`;
}

function hoyRender(d) {
  const cont = document.getElementById('hoy-cuerpo');
  if (!cont) return;

  const tiles = [
    hoyTile(d.solicitudes ? 'warn' : '', 'Solicitudes abiertas', String(d.solicitudes),
      d.solicitudes ? 'sin terminar de repartir' : 'ninguna pendiente', "navIr('solicitudes')"),
    hoyTile(d.atrasados ? 'crit' : '', 'Viene en camino', String(d.enCamino),
      d.atrasados ? `${d.atrasados} con atraso` : 'nada atrasado', "navIr('solicitudes')"),
    hoyTile(d.porRepartir ? 'warn' : '', 'Llegó y falta repartir', String(d.porRepartir || 0),
      d.porRepartir ? 'esperando su vale' : 'nada atorado', "navIr('solicitudes')"),
    hoyTile(d.completos.length ? 'ok' : '', 'Ranchos completos', String(d.completos.length),
      d.completos.length ? 'listos para entregar' : 'ninguno por ahora', "navIr('solicitudes')"),
    hoyTile(d.bajo ? 'warn' : '', 'Bajo su consumo', String(d.bajo),
      'productos por reponer', "navIr('almacen','alertas')"),
    hoyTile(d.porPagar ? 'crit' : '', 'Por pagar ya', hoyM0(d.montoPagar),
      `${d.porPagar} factura(s) vencidas o de esta semana`, "navIr('pagar')", true),
    hoyTile('', 'Sin contar', String(d.sinContar),
      'el sistema no opina sobre ellos', "navIr('almacen','conteo')"),
  ].join('');

  // El ciclo, con lo que está esperando en cada paso. Sólo se muestran
  // los pasos que tienen algo; si no, sería una lista de ceros.
  const pasos = [];
  if (d.solicitudes) pasos.push(['warn', 'Reparte la solicitud',
    `${d.solicitudes} solicitud(es) abiertas. Verifica lo que hay y decide qué surtes y qué compras.`, "navIr('solicitudes')"]);
  if (d.atrasados) pasos.push(['crit', 'Hay pedidos con atraso',
    `${d.atrasados} de ${d.enCamino} pasaron la fecha en que los esperabas.`, "navIr('solicitudes')"]);
  if (d.porRepartir) pasos.push(['warn', 'Llegó y sigue en el almacén',
    `${d.porRepartir} compra(s) ya llegaron y todavía no salen al rancho.`, "navIr('solicitudes')"]);
  if (d.completos.length) pasos.push(['ok', 'Ranchos listos para entregar',
    d.completos.map(r => hoyEsc(r.rancho_nombre)).join(' · ') + ' — ya llegó todo lo suyo.', "navIr('solicitudes')"]);
  if (d.porPagar) pasos.push(['crit', 'Facturas que vencen',
    `${hoyM0(d.montoPagar)} en ${d.porPagar} factura(s). Puedes dar fe de las que sí pediste.`, "navIr('pagar')"]);
  if (d.bajo) pasos.push(['warn', 'Productos por debajo de su consumo',
    (d.bajoLista || []).map(p => hoyEsc(p.nombre)).join(' · ') + (d.bajo > 5 ? ` y ${d.bajo - 5} más.` : '.'), "navIr('almacen','alertas')"]);

  const lista = pasos.length
    ? `<ul class="hoy-lista">${pasos.map(([t, tit, des, ir]) => `
        <li><button type="button" onclick="${ir}">
          <span class="pt ${t}"></span>
          <span><span class="t">${tit}</span><span class="d">${des}</span></span></button></li>`).join('')}</ul>`
    : `<div class="empty">Nada pendiente por ahora.<br>
        <span class="sol-sub">Cuando llegue una solicitud o venza una factura, aparece aquí.</span></div>`;

  cont.innerHTML = `
    <div class="hoy-tiles">${tiles}</div>
    <div class="card-header" style="margin-top:16px">Lo que te toca</div>
    ${lista}`;
}

// ── Engancharse sin tocar app.js ───────────────────────────────────

(function () {
  const orig = window.goTo;
  if (typeof orig !== 'function') return;
  window.goTo = function (tab) {
    const r = orig.apply(this, arguments);
    if (tab === 'hoy') cargarHoy();
    return r;
  };
})();
