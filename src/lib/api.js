// =====================================================
//  API v5 — Supabase con Storage para fotos
// =====================================================

const API = {

  async signIn(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() { await db.auth.signOut(); },

  async getSession() {
    const { data } = await db.auth.getSession();
    return data.session;
  },

  async getProfile(userId) {
    const { data, error } = await db.from('perfiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data;
  },

  async getUsuarios() {
    const { data, error } = await db.from('perfiles').select('*').order('nombre');
    if (error) throw error;
    return data;
  },

  async updateRol(userId, nuevoRol) {
    const { error } = await db.from('perfiles').update({ rol: nuevoRol }).eq('id', userId);
    if (error) throw error;
  },

  async crearUsuario(email, password, nombre, rol) {
    const { data, error } = await db.functions.invoke('crear-usuario', { body: { email, password, nombre, rol } });
    if (error) throw error;
    return data;
  },

  async getProductos() {
    const { data, error } = await db.from('productos').select('*').order('nombre');
    if (error) throw error;
    if (typeof Offline !== 'undefined') Offline.cacheProductos(data);
    return data;
  },

  async getProducto(id) {
    if (typeof Offline !== 'undefined' && !Offline.isOnline()) {
      const cache = Offline.getCacheProductos();
      if (cache) return cache.find(p => p.id === id) || null;
    }
    const { data, error } = await db.from('productos').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async addProducto(prod) {
    const { error } = await db.from('productos').insert(prod);
    if (error) throw error;
  },

  async updateStock(id, nuevoStock) {
    const { error } = await db.from('productos').update({ stock: nuevoStock }).eq('id', id);
    if (error) throw error;
  },

  async getMovimientos(limit = 50) {
    const { data, error } = await db.from('movimientos').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },

  async addMovimiento(mov) {
    if (typeof Offline !== 'undefined' && !Offline.isOnline()) { Offline.encolar(mov); return; }
    const { error } = await db.from('movimientos').insert(mov);
    if (error) throw error;
  },

  async getPedidos() {
    const { data, error } = await db.from('pedidos').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async addPedido(ped) {
    const { error } = await db.from('pedidos').insert(ped);
    if (error) throw error;
  },

  async updatePedidoEstado(id, estado) {
    const { error } = await db.from('pedidos').update({ estado }).eq('id', id);
    if (error) throw error;
  },

  async getAuditoria(limit = 100) {
    const { data, error } = await db.from('auditoria').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },

  async addAuditoria(evento) {
    try { await db.from('auditoria').insert(evento); } catch {}
  },

  // ── STORAGE: subir foto de evidencia ──────────────
  async subirFoto(ruta, archivo) {
    const { data, error } = await db.storage
      .from('evidencias')
      .upload(ruta, archivo, { cacheControl: '3600', upsert: false });
    if (error) throw error;

    // Obtener URL firmada (válida 1 año)
    const { data: urlData } = await db.storage
      .from('evidencias')
      .createSignedUrl(data.path, 365 * 24 * 60 * 60);

    return urlData?.signedUrl || data.path;
  },

  // ── STORAGE: obtener URL firmada de foto ──────────
  async getFotoUrl(path) {
    if (!path || path.startsWith('http')) return path;
    const { data } = await db.storage
      .from('evidencias')
      .createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  },

  async verificarPassword(password) {
    const session = await this.getSession();
    if (!session) return false;
    try {
      await db.auth.signInWithPassword({ email: session.user.email, password });
      return true;
    } catch { return false; }
  }
};
