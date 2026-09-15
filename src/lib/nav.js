// ═══════════════════════════════════════════════════════════════════
//  nav.js — el menú, reorganizado alrededor del trabajo
//
//  El menú tenía 18 botones con nombres de tablas de la base de datos:
//  Pedidos, Movimientos, Almacenes. El trabajo de Raúl no se llama
//  así. Su trabajo es un ciclo: llega la solicitud, reparte, pide,
//  espera, llega, entrega.
//
//  Quedan SIETE botones. Ninguna pantalla se borra: las que salen del
//  menú se vuelven pestañas dentro de la que les corresponde. Por
//  dentro no cambia nada — se siguen llamando las mismas funciones de
//  app.js, con los mismos ids de sección.
//
//  Se va una sola cosa: el módulo Pedidos, el formulario de 18 campos
//  con cero renglones en la base. Solicitudes lo reemplaza entero.
//  Los 559 renglones históricos NO se borran: alimentan "quién lo
//  pide" en la ficha de cada producto.
//
//  Este archivo no toca app.js. Reescribe el <nav>, mete una barra de
//  sub-pestañas, y envuelve goTo y aplicarPermisosMenu.
// ═══════════════════════════════════════════════════════════════════

const NAV_ICO = {
  hoy:   '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  sol:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  alm:   '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  fact:  '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  pagar: '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  prov:  '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/>',
  ajus:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

// Los siete. `mods` son los permisos: el botón se ve si el usuario
// tiene aunque sea uno de ellos.
const NAV_GRUPOS = [
  { k:'hoy', t:'Hoy', ico:'hoy', tab:'hoy', mods:['dashboard'], grupo:'Mi trabajo' },

  { k:'solicitudes', t:'Solicitudes', ico:'sol', tab:'solicitudes', mods:['pedidos'], grupo:'Mi trabajo' },

  { k:'almacen', t:'Almacén', ico:'alm', grupo:'Mi trabajo',
    mods:['inventario','conteo','entradas','salidas','movimientos','alertas'],
    subs:[
      { t:'Existencias',       tab:'inventario',  mod:'inventario' },
      { t:'Conteo',            tab:'conteo',      mod:'conteo' },
      { t:'Entradas y salidas',tab:'movstock',    mod:'entradas' },
      { t:'Movimientos',       tab:'movimientos', mod:'movimientos' },
      { t:'Alertas',           tab:'alertas',     mod:'alertas' },
      { t:'Evidencias',        tab:'evidencias',  mod:'movimientos' },
    ] },

  { k:'facturas', t:'Facturas', ico:'fact', tab:'compras', mods:['compras'], grupo:'El dinero' },

  { k:'pagar', t:'Por pagar', ico:'pagar', tab:'cxp', mods:['compras_pagos'], grupo:'El dinero' },

  { k:'proveedores', t:'Proveedores', ico:'prov', tab:'proveedores', mods:['proveedores'], grupo:'El dinero' },

  { k:'ajustes', t:'Ajustes', ico:'ajus', grupo:'Sistema',
    mods:['almacenes','usuarios_admin','reportes','notificaciones','respaldo','auditoria'],
    subs:[
      { t:'Almacenes',     tab:'almacenes',      mod:'almacenes' },
      { t:'Usuarios',      tab:'usuarios',       mod:'usuarios_admin' },
      { t:'Reportes',      tab:'reportes',       mod:'reportes' },
      { t:'Notificaciones',tab:'notificaciones', mod:'notificaciones' },
      { t:'Respaldo',      tab:'respaldo',       mod:'respaldo' },
      { t:'Auditoría',     tab:'auditoria',      mod:'auditoria' },
    ] },
];

let navActivo = 'hoy';

function navPuede(mod) {
  return (typeof tienePermiso === 'function') ? tienePermiso(mod) : true;
}
function navSubsVisibles(g) {
  return (g.subs || []).filter(s => navPuede(s.mod));
}
function navGrupoVisible(g) {
  return g.mods.some(navPuede);
}

// ── Construir el menú ──────────────────────────────────────────────

function navConstruir() {
  const nav = document.querySelector('nav.nav');
  if (!nav) return;

  let html = '', grupo = null;
  NAV_GRUPOS.forEach(g => {
    if (g.grupo !== grupo) {
      grupo = g.grupo;
      html += `<div class="nav-group-title" data-grupo="${grupo}">${grupo}</div>`;
    }
    html += `<button class="nav-btn" data-nav="${g.k}" data-modulo="${g.mods[0]}"
      onclick="navIr('${g.k}')"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.8">${NAV_ICO[g.ico]}</svg>${g.t}${
      g.k === 'hoy' ? '<span id="alert-count" class="alert-dot hidden">0</span>' : ''}</button>`;
  });
  nav.innerHTML = html;

  // La barra de sub-pestañas vive arriba de las secciones, fuera de
  // ellas, para que no se borre cuando goTo esconde una pestaña.
  const main = document.querySelector('main.main');
  if (main && !document.getElementById('subnav')) {
    const d = document.createElement('div');
    d.id = 'subnav'; d.className = 'subnav hidden';
    main.insertBefore(d, main.firstChild);
  }
}

function navSubnav(g, tabActual) {
  const el = document.getElementById('subnav');
  if (!el) return;
  const subs = navSubsVisibles(g);
  if (!g.subs || subs.length < 2) { el.className = 'subnav hidden'; el.innerHTML = ''; return; }
  el.className = 'subnav';
  el.innerHTML = subs.map(s =>
    `<button class="subnav-btn${s.tab === tabActual ? ' activo' : ''}"
       onclick="navIr('${g.k}','${s.tab}')">${s.t}</button>`).join('');
}

// ── Navegar ────────────────────────────────────────────────────────

function navIr(clave, tab) {
  const g = NAV_GRUPOS.find(x => x.k === clave);
  if (!g) return;
  navActivo = clave;

  let destino = tab;
  if (!destino) {
    if (g.tab) destino = g.tab;
    else { const s = navSubsVisibles(g)[0]; destino = s ? s.tab : null; }
  }
  if (!destino) return;

  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === clave));
  navSubnav(g, destino);

  if (typeof goTo === 'function') goTo(destino, null);
  // goTo quita 'active' de todos los botones; se vuelve a poner
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === clave));
}
window.navIr = navIr;

// Si otra parte del sistema llama goTo directo (un botón adentro de
// una pantalla, por ejemplo), el menú se acomoda solo.
function navSincronizar(tab) {
  const g = NAV_GRUPOS.find(x => x.tab === tab || (x.subs || []).some(s => s.tab === tab));
  if (!g) { const el = document.getElementById('subnav'); if (el) el.className = 'subnav hidden'; return; }
  navActivo = g.k;
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === g.k));
  navSubnav(g, tab);
}

// ── Permisos: el grupo se ve si tiene aunque sea una pestaña ───────

function navAplicarPermisos() {
  NAV_GRUPOS.forEach(g => {
    const b = document.querySelector(`.nav-btn[data-nav="${g.k}"]`);
    if (b) b.style.display = navGrupoVisible(g) ? '' : 'none';
  });
  // los títulos de grupo sin botones visibles se esconden
  document.querySelectorAll('.nav-group-title').forEach(t => {
    let n = t.nextElementSibling, hay = false;
    while (n && n.classList.contains('nav-btn')) {
      if (n.style.display !== 'none') { hay = true; break; }
      n = n.nextElementSibling;
    }
    t.style.display = hay ? '' : 'none';
  });
}

// ── Arranque ───────────────────────────────────────────────────────

(function () {
  function arrancar() {
    navConstruir();
    navAplicarPermisos();

    // envolver goTo para mantener el menú sincronizado
    const g0 = window.goTo;
    if (typeof g0 === 'function' && !g0.__nav) {
      const env = function (tab) { const r = g0.apply(this, arguments); navSincronizar(tab); return r; };
      env.__nav = true;
      window.goTo = env;
    }
    // envolver los permisos para que el grupo use la regla de "alguna"
    const p0 = window.aplicarPermisosMenu;
    if (typeof p0 === 'function' && !p0.__nav) {
      const env = function () { const r = p0.apply(this, arguments); navAplicarPermisos(); return r; };
      env.__nav = true;
      window.aplicarPermisosMenu = env;
    }
    navIr('hoy');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
