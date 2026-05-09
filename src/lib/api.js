// =====================================================
//  API — Supabase (con RLS y Zero Trust)
// =====================================================

const API = {

  // ── AUTH ──────────────────────────────────────────
  async signIn(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await db.auth.signOut();
  },

  async getSession() {
    const { data } = await db.auth.getSession();
    return data.session;
  },

  async getProfile(userId) {
    const { data, error } = await db
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  // ── USUARIOS (solo admin) ─────────────────────────
  async getUsuarios() {
    const { data, error } = await db
      .from('perfiles')
      .select('*')
      .order('nombre');
    if (error) throw error;
    return data;
  },

  async updateRol(userId, nuevoRol) {
    const { error } = await db
      .from('perfiles')
      .update({ rol: nuevoRol })
      .eq('id', userId);
    if (error) throw error;
  },

  async crearUsuario(email, password, nombre, rol) {
    // Llama a la Edge Function para crear usuario desde admin
    const { data, error } = await db.functions.invoke('crear-usuario', {
      body: { email, password, nombre, rol }
    });
    if (error) throw error;
    return data;
  },

  // ── PRODUCTOS ─────────────────────────────────────
  async getProductos() {
    const { data, error } = await db
      .from('productos')
      .select('*')
      .order('nombre');
    if (error) throw error;
    return data;
  },

  async getProducto(id) {
    const { data, error } = await db
      .from('productos')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  async addProducto(prod) {
    const { error } = await db.from('productos').insert(prod);
    if (error) throw error;
  },

  async updateStock(id, nuevoStock) {
    const { error } = await db
      .from('productos')
      .update({ stock: nuevoStock })
      .eq('id', id);
    if (error) throw error;
  },

  // ── MOVIMIENTOS ───────────────────────────────────
  async getMovimientos(limit = 50) {
    const { data, error } = await db
      .from('movimientos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async addMovimiento(mov) {
    const { error } = await db.from('movimientos').insert(mov);
    if (error) throw error;
  },

  // ── PEDIDOS ───────────────────────────────────────
  async getPedidos() {
    const { data, error } = await db
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async addPedido(ped) {
    const { error } = await db.from('pedidos').insert(ped);
    if (error) throw error;
  },

  async updatePedidoEstado(id, estado) {
    const { error } = await db
      .from('pedidos')
      .update({ estado })
      .eq('id', id);
    if (error) throw error;
  },

  // ── VERIFICAR CONTRASEÑA (Zero Trust en scanner) ──
  async verificarPassword(password) {
    // Re-autentica con las credenciales del usuario actual para Zero Trust
    const session = await this.getSession();
    if (!session) return false;
    try {
      await db.auth.signInWithPassword({
        email: session.user.email,
        password
      });
      return true;
    } catch {
      return false;
    }
  }
};
