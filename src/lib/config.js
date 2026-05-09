// =====================================================
//  CONFIGURACIÓN — Las Naves Agrícola
//  Rellena estos valores después de crear tu proyecto
//  en Supabase (Paso 1 de las instrucciones)
// =====================================================

const CONFIG = {
  // Copia estos valores desde: supabase.com → tu proyecto → Settings → API
  SUPABASE_URL:  "https://TU_PROYECTO.supabase.co",
  SUPABASE_ANON: "TU_ANON_KEY_AQUI",

  // Días antes de caducidad para generar alerta
  DIAS_ALERTA_CADUCIDAD: 90,
};

// Inicializar cliente Supabase
const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON);
