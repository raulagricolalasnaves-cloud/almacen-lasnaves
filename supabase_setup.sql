// =====================================================
//  OFFLINE — Modo sin conexión
//  Guarda movimientos localmente y sincroniza al volver
// =====================================================

const OFFLINE_KEY = 'lasnaves_offline_queue';
const CACHE_KEY   = 'lasnaves_productos_cache';

const Offline = {

  isOnline() { return navigator.onLine; },

  // Guardar movimiento en cola local
  encolar(mov) {
    const cola = this.getCola();
    cola.push({ ...mov, _offline: true, _ts: Date.now() });
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(cola));
  },

  getCola() {
    try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); } catch { return []; }
  },

  limpiarCola() { localStorage.setItem(OFFLINE_KEY, '[]'); },

  contarCola() { return this.getCola().length; },

  // Cache de productos para modo offline
  cacheProductos(prods) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: prods }));
  },

  getCacheProductos() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!c) return null;
      // Cache válido por 1 hora
      if (Date.now() - c.ts > 3600000) return null;
      return c.data;
    } catch { return null; }
  },

  // Sincronizar cola con Supabase
  async sincronizar() {
    const cola = this.getCola();
    if (!cola.length) { toast('No hay movimientos pendientes'); return; }
    if (!this.isOnline()) { toast('Aún sin conexión'); return; }

    let ok = 0, fail = 0;
    for (const mov of cola) {
      try {
        const { _offline, _ts, ...movLimpio } = mov;
        await API.addMovimiento(movLimpio);
        await API.updateStock(movLimpio.id_producto, movLimpio.stock_resultante);
        ok++;
      } catch { fail++; }
    }

    this.limpiarCola();
    actualizarBannerSync();
    toast(`Sincronizado: ${ok} movimientos guardados${fail ? `, ${fail} fallaron` : ''}`);
  }
};

function actualizarBannerSync() {
  const n   = Offline.contarCola();
  const ban = document.getElementById('sync-pending');
  const cnt = document.getElementById('sync-count');
  if (!ban) return;
  if (n > 0) { ban.classList.remove('hidden'); if (cnt) cnt.textContent = n; }
  else ban.classList.add('hidden');
}

function sincronizarOffline() { Offline.sincronizar(); }

// Detectar cambios de conexión
window.addEventListener('online', () => {
  document.getElementById('offline-dot')?.classList.add('hidden');
  document.getElementById('offline-banner')?.classList.add('hidden');
  toast('Conexión restaurada');
  actualizarBannerSync();
  if (Offline.contarCola() > 0) Offline.sincronizar();
});

window.addEventListener('offline', () => {
  document.getElementById('offline-dot')?.classList.remove('hidden');
  document.getElementById('offline-banner')?.classList.remove('hidden');
  toast('Sin conexión — modo offline activo');
});

window.addEventListener('DOMContentLoaded', () => {
  actualizarBannerSync();
  if (!navigator.onLine) {
    document.getElementById('offline-dot')?.classList.remove('hidden');
    document.getElementById('offline-banner')?.classList.remove('hidden');
  }
});
