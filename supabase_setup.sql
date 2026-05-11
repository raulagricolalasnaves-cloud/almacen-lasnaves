-- =====================================================
--  Las Naves Agrícola — Base de datos Supabase
--  VERSIÓN CORREGIDA
--  Ejecuta este script completo en: Supabase → SQL Editor
-- =====================================================

-- PASO 0: Limpiar cualquier instalación anterior
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS movimientos;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS perfiles;

-- PASO 1: Crear tablas
CREATE TABLE perfiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  email      TEXT NOT NULL,
  rol        TEXT NOT NULL DEFAULT 'operador'
             CHECK (rol IN ('operador', 'supervisor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE productos (
  id         TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  stock      NUMERIC DEFAULT 0,
  min        NUMERIC DEFAULT 0,
  unidad     TEXT,
  proveedor  TEXT,
  lote       TEXT,
  caducidad  DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE movimientos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo             TEXT NOT NULL CHECK (tipo IN ('entrada','salida')),
  id_producto      TEXT REFERENCES productos(id),
  nombre           TEXT,
  cantidad         NUMERIC,
  unidad           TEXT,
  usuario_id       UUID REFERENCES auth.users(id),
  usuario_nombre   TEXT,
  destino          TEXT,
  lote             TEXT,
  caducidad_lote   DATE,
  nota             TEXT,
  stock_resultante NUMERIC,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pedidos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num            TEXT,
  proveedor      TEXT,
  producto       TEXT,
  cantidad       TEXT,
  fecha_estimada DATE,
  estado         TEXT DEFAULT 'Confirmado',
  creado_por     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- PASO 2: Habilitar RLS
ALTER TABLE perfiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos     ENABLE ROW LEVEL SECURITY;

-- PASO 3: Políticas RLS
CREATE POLICY "perfil_propio" ON perfiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "admin_ve_todos_perfiles" ON perfiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'admin')
  );

CREATE POLICY "autenticado_lee_productos" ON productos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "admin_supervisor_edita_productos" ON productos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('admin','supervisor'))
  );

CREATE POLICY "autenticado_inserta_mov" ON movimientos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "autenticado_lee_mov" ON movimientos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "sup_admin_pedidos" ON pedidos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol IN ('admin','supervisor'))
  );

-- PASO 4: Función y trigger corregidos
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles (id, nombre, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'operador')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
--  CREAR USUARIO ADMINISTRADOR
--  *** Reemplaza los 3 valores marcados con tus datos ***
-- =====================================================
INSERT INTO auth.users (
  id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, role
)
VALUES (
  gen_random_uuid(),
  'TU-CORREO@ejemplo.com',
  crypt('TU-CONTRASENA-AQUI', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"nombre":"Tu Nombre Completo","rol":"admin"}',
  false,
  'authenticated'
)
ON CONFLICT (email) DO NOTHING;

-- =====================================================
--  TABLA DE AUDITORÍA (agregar al SQL existente)
-- =====================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT NOT NULL,
  descripcion TEXT,
  usuario_id  UUID REFERENCES auth.users(id),
  usuario_nombre TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_ve_auditoria" ON auditoria
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'admin')
  );
CREATE POLICY "autenticado_inserta_auditoria" ON auditoria
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
--  AGREGAR COLUMNA DE FOTO (ejecutar por separado)
-- =====================================================
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS foto_evidencia TEXT;
