// =====================================================
//  API v9 — Las Naves Agrícola
//  Seguridad empresarial + todas las funciones nuevas
// =====================================================

const API = {

  // ── AUTH ──────────────────────────────────────────
  async signIn(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signOut() { await db.auth.signOut(); },
  async getSession() { const { data } = await db.auth.getSession(); return data.session; },
  async getProfile(userId) {
    const { data, error } = await db.from('perfiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data;
  },
  async verificarPassword(password) {
    const session = await this.getSession();
    if (!session) return false;
    try { await db.auth.signInWithPassword({ email: session.user.email, password }); return true; }
    catch { return false; }
  },

  // ── USUARIOS ──────────────────────────────────────
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
    // Usa función SQL directa (sin Edge Function)
    const { data, error } = await db.rpc('crear_usuario_sistema', {
      p_email: email,
      p_password: password,
      p_nombre: nombre,
      p_rol: rol
    });
    if (error) throw error;
    return data;
  },

  // ── ELIMINAR REGISTROS ─────────────────────────────
  async eliminarProducto(id) {
    // Soft delete: marcar como inactivo en lugar de borrar físicamente
    const { error } = await db.from('productos').update({ activo: false, stock: 0 }).eq('id', id);
    if (error) throw error;
  },
  async eliminarMovimiento(id) {
    const { error } = await db.from('movimientos').delete().eq('id', id);
    if (error) throw error;
  },
  async eliminarProveedor(id) {
    const { error } = await db.from('proveedores').update({ activo: false }).eq('id', id);
    if (error) throw error;
  },
  async eliminarPedido(id) {
    const { error } = await db.from('pedidos').delete().eq('id', id);
    if (error) throw error;
  },
  async eliminarUsuario(userId) {
    const { error } = await db.from('perfiles').delete().eq('id', userId);
    if (error) throw error;
  },

  // ── ALMACENES ─────────────────────────────────────
  async getAlmacenes() {
    const { data, error } = await db.from('almacenes').select('*').eq('activo', true).order('nombre');
    if (error) throw error;
    return data;
  },
  async addAlmacen(alm) {
    const { error } = await db.from('almacenes').insert(alm);
    if (error) throw error;
  },
  async updateAlmacen(id, datos) {
    const { error } = await db.from('almacenes').update(datos).eq('id', id);
    if (error) throw error;
  },

  // ── PRODUCTOS ─────────────────────────────────────
  async getProductos(almacenId) {
    let q = db.from('productos').select('*').eq('activo', true).order('nombre');
    if (almacenId && almacenId.length === 36) q = q.eq('almacen_id', almacenId);
    const { data, error } = await q;
    if (error) throw error;
    if (typeof Offline !== 'undefined') Offline.cacheProductos(data);
    return data;
  },
  async getProducto(id) {
    if (typeof Offline !== 'undefined' && !Offline.isOnline()) {
      const cache = Offline.getCacheProductos();
      if (cache) return cache.find(p => p.id === id && p.activo !== false) || null;
    }
    const { data, error } = await db.from('productos').select('*').eq('id', id).eq('activo', true).single();
    if (error) return null;
    return data;
  },
  async addProducto(prod) {
    const { error } = await db.from('productos').insert(prod);
    if (error) throw error;
  },
  async updateProducto(id, datos) {
    const { error } = await db.from('productos').update(datos).eq('id', id);
    if (error) throw error;
  },
  async updateStock(id, nuevoStock) {
    const { error } = await db.from('productos').update({ stock: nuevoStock }).eq('id', id);
    if (error) throw error;
  },

  // ── MOVIMIENTOS ───────────────────────────────────
  async getMovimientos(limit = 50, almacenId) {
    const { data, error } = await db
      .from('movimientos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },
  async addMovimiento(mov) {
    if (typeof Offline !== 'undefined' && !Offline.isOnline()) { Offline.encolar(mov); return; }
    const { error } = await db.from('movimientos').insert(mov);
    if (error) throw error;
  },

  // ── PEDIDOS ───────────────────────────────────────
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
  async updateFechaEntrega(id, fecha) {
    const { error } = await db.from('pedidos').update({ fecha_entrega_real: fecha, estado: 'Entregado' }).eq('id', id);
    if (error) throw error;
  },

  // ── AUDITORÍA ─────────────────────────────────────
  async getAuditoria(limit = 100) {
    const { data, error } = await db.from('auditoria').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },
  async addAuditoria(evento) {
    try { await db.from('auditoria').insert(evento); } catch {}
  },

  // ── PROVEEDORES ───────────────────────────────────
  async getProveedores() {
    const { data, error } = await db.from('proveedores').select('*').eq('activo', true).order('nombre');
    if (error) throw error;
    return data;
  },
  async getProveedor(id) {
    const { data, error } = await db.from('proveedores').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },
  async addProveedor(prov) {
    const { error } = await db.from('proveedores').insert(prov);
    if (error) throw error;
  },
  async getEvaluaciones(provId) {
    const { data, error } = await db.from('evaluaciones_proveedores').select('*').eq('proveedor_id', provId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async addEvaluacion(ev) {
    const { error } = await db.from('evaluaciones_proveedores').insert(ev);
    if (error) throw error;
  },
  async getPedidosByProveedor(provId) {
    const { data, error } = await db.from('pedidos').select('*').eq('proveedor_id', provId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // ── INVENTARIO FÍSICO ─────────────────────────────
  async getConteosActivos() {
    const { data, error } = await db.from('conteos_fisicos').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return data;
  },
  async addConteo(conteo) {
    const { error } = await db.from('conteos_fisicos').insert(conteo);
    if (error) throw error;
  },

  // ── STORAGE: SDS y evidencias ─────────────────────
  async subirArchivo(bucket, ruta, archivo) {
    const { data, error } = await db.storage.from(bucket).upload(ruta, archivo, { upsert: true, cacheControl: '3600' });
    if (error) throw error;
    const { data: urlData } = await db.storage.from(bucket).createSignedUrl(data.path, 365*24*60*60);
    return urlData?.signedUrl || data.path;
  },
  async subirFoto(ruta, archivo) { return this.subirArchivo('evidencias', ruta, archivo); },
  async subirSDS(productoId, archivo) {
    const ext = archivo.name.split('.').pop();
    return this.subirArchivo('sds', `${productoId}.${ext}`, archivo);
  },

  // ── NOTIFICACIONES ────────────────────────────────
  async getNotificaciones() {
    const { data, error } = await db.from('notificaciones_config').select('*').order('nombre');
    if (error) throw error;
    return data;
  },
  async addNotificacion(config) {
    const { error } = await db.from('notificaciones_config').insert(config);
    if (error) throw error;
  },
  async updateNotificacion(id, datos) {
    const { error } = await db.from('notificaciones_config').update(datos).eq('id', id);
    if (error) throw error;
  },
  async deleteNotificacion(id) {
    const { error } = await db.from('notificaciones_config').delete().eq('id', id);
    if (error) throw error;
  },
  async enviarReporte({ correo, nombre, contenido }) {
    // Usa Supabase Edge Function para enviar correo
    const { data, error } = await db.functions.invoke('enviar-reporte', {
      body: { correo, nombre, contenido, fecha: new Date().toLocaleDateString('es-MX') }
    });
    if (error) throw error;
    return data;
  },

  // ── PERMISOS INDIVIDUALES ─────────────────────────
  async updatePermisos(userId, permisos) {
    const { error } = await db.from('perfiles').update({ permisos }).eq('id', userId);
    if (error) throw error;
  },

  // ── PEDIDOS DE CLIENTES ───────────────────────────
  async getPedidosClientes() {
    const { data, error } = await db.from('pedidos_clientes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async addPedidoCliente(ped) {
    const { data, error } = await db.from('pedidos_clientes').insert(ped).select('id').single();
    if (error) throw error;
    return data.id;
  },
  async updateEstadoPedidoCliente(id, estado) {
    const { error } = await db.from('pedidos_clientes').update({ estado }).eq('id', id);
    if (error) throw error;
  },
  async updatePedidoClienteFechaReal(id, fecha) {
    const { error } = await db.from('pedidos_clientes').update({ fecha_entrega_real: fecha }).eq('id', id);
    if (error) throw error;
  },
  async getHistorialPedidoCliente(pedidoId) {
    const { data, error } = await db.from('pedidos_clientes_historial').select('*').eq('pedido_id', pedidoId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async addHistorialPedidoCliente(h) {
    const { error } = await db.from('pedidos_clientes_historial').insert(h);
    if (error) throw error;
  },
  async eliminarPedidoCliente(id) {
    const { error } = await db.from('pedidos_clientes').delete().eq('id', id);
    if (error) throw error;
  },
  // ── ELIMINAR ALMACÉN ──────────────────────────────
  async eliminarAlmacen(id) {
    const { error } = await db.from('almacenes').update({ activo: false }).eq('id', id);
    if (error) throw error;
  },
};