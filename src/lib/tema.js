// ═══════════════════════════════════════════════════════════════════
//  tema.js — apoyo del rediseño de septiembre 2026
//
//  Tres cosas, todas chicas y todas necesarias para que el diseño
//  nuevo se comporte bien con lo que ya existía:
//
//  1. Los encabezados de grupo del menú ("Operación", "Compras"…) se
//     esconden solos cuando el usuario no tiene permiso para ninguno
//     de los botones de ese grupo. permisos.js oculta los botones uno
//     por uno; sin esto quedarían títulos sueltos sin nada debajo.
//
//  2. La banda toxicológica de la NOM-232 se pinta como franja en el
//     renglón del producto, leyendo el campo peligrosidad.
//
//  3. En escritorio, el botón activo del menú se desplaza a la vista
//     si el carril viene desplazado.
//
//  No reemplaza nada. Se engancha a lo que ya hay.
// ═══════════════════════════════════════════════════════════════════

// ── 1 · Encabezados de grupo que se esconden solos ─────────────────
function temaAjustarGrupos() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  let titulo = null, vivos = 0;

  const cerrar = () => { if (titulo) titulo.style.display = vivos ? '' : 'none'; };

  Array.from(nav.children).forEach(el => {
    if (el.classList.contains('nav-group-title')) {
      cerrar();
      titulo = el; vivos = 0;
    } else if (el.classList.contains('nav-btn')) {
      // display:'' significa visible; permisos.js pone 'none'
      if (el.style.display !== 'none') vivos++;
    }
  });
  cerrar();
}

// permisos.js decide qué botones se ven. Envolvemos su función para
// reajustar los títulos justo después, sin tocar ese archivo.
(function engancharPermisos() {
  const orig = window.aplicarPermisosMenu;
  if (typeof orig !== 'function') return;
  window.aplicarPermisosMenu = function () {
    const r = orig.apply(this, arguments);
    temaAjustarGrupos();
    return r;
  };
})();

// ── 2 · Banda toxicológica NOM-232-SSA1-2009 ───────────────────────
// Las cuatro bandas son las de la norma. El texto del campo
// peligrosidad viene escrito de varias formas según quién lo capturó,
// así que se normaliza antes de comparar.
const NOM_BANDAS = [
  { clase: 'roja',     patron: /roj|extremadamente|altamente\s*t[oó]xic|categor[ií]a\s*[12]\b|\bi\b/i,
    etiqueta: 'Banda roja' },
  { clase: 'amarilla', patron: /amarill|moderadamente\s*t[oó]xic|categor[ií]a\s*3\b|\bii\b/i,
    etiqueta: 'Banda amarilla' },
  { clase: 'azul',     patron: /azul|ligeramente\s*t[oó]xic|categor[ií]a\s*4\b|\biii\b/i,
    etiqueta: 'Banda azul' },
  { clase: 'verde',    patron: /verde|precauci[oó]n|ligeramente\s*peligros|\biv\b/i,
    etiqueta: 'Banda verde' },
];

// Devuelve {clase, etiqueta} o null si no se puede determinar.
// Importante: si no se sabe, NO se inventa una banda. Un producto sin
// banda conocida se queda gris, que es honesto; pintarlo verde sería
// decirle a la persona que es el menos tóxico.
function temaBanda(peligrosidad) {
  const t = String(peligrosidad || '').trim();
  if (!t) return null;
  for (const b of NOM_BANDAS) if (b.patron.test(t)) return b;
  return null;
}

// Marca un elemento con la franja de su banda.
function temaPintarBanda(el, peligrosidad) {
  if (!el) return;
  el.classList.remove('nom', 'nom-roja', 'nom-amarilla', 'nom-azul', 'nom-verde');
  const b = temaBanda(peligrosidad);
  if (!b) return;
  el.classList.add('nom', 'nom-' + b.clase);
  el.setAttribute('title', b.etiqueta + ' · NOM-232-SSA1-2009');
}

// Pastilla con el nombre de la banda, para usar dentro de una ficha.
function temaChipBanda(peligrosidad) {
  const b = temaBanda(peligrosidad);
  if (!b) return '';
  return `<span class="nom-chip ${b.clase}" title="NOM-232-SSA1-2009">${b.etiqueta}</span>`;
}

// Recorre los renglones ya pintados y les pone su franja. Se apoya en
// data-peligrosidad si el renglón lo trae; si no, no hace nada.
function temaAplicarBandas(raiz) {
  (raiz || document).querySelectorAll('[data-peligrosidad]').forEach(el => {
    temaPintarBanda(el, el.getAttribute('data-peligrosidad'));
  });
}

// ── 3 · Mantener el botón activo a la vista ────────────────────────
function temaCentrarActivo() {
  const b = document.querySelector('.nav-btn.active');
  if (!b) return;
  const nav = b.closest('.nav');
  if (!nav) return;
  const escritorio = window.matchMedia('(min-width: 1024px)').matches;
  const fuera = escritorio
    ? (b.offsetTop < nav.scrollTop || b.offsetTop > nav.scrollTop + nav.clientHeight - 40)
    : (b.offsetLeft < nav.scrollLeft || b.offsetLeft + b.offsetWidth > nav.scrollLeft + nav.clientWidth);
  if (fuera) b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

(function engancharGoTo() {
  const orig = window.goTo;
  if (typeof orig !== 'function') return;
  window.goTo = function () {
    const r = orig.apply(this, arguments);
    temaCentrarActivo();
    setTimeout(() => temaAplicarBandas(), 60);
    return r;
  };
})();

// ── Arranque ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  temaAjustarGrupos();
  temaAplicarBandas();
});
