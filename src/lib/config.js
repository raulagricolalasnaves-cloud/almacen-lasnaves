// =====================================================
//  CONFIGURACIÓN — Las Naves Agrícola
//  Rellena estos valores después de crear tu proyecto
//  en Supabase (Paso 1 de las instrucciones)
// =====================================================

const CONFIG = {
  // Copia estos valores desde: supabase.com → tu proyecto → Settings → API
  SUPABASE_URL:  "https://cbodynilixkrczvukfdp.supabase.co",
  SUPABASE_ANON: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNib2R5bmlsaXhrcmN6dnVrZmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzExNDEsImV4cCI6MjA5Mzg0NzE0MX0.OCWtNN37OzewK_XuftTDDj_fC8O_lOsztEVsnLjVhsk",

  // Días antes de caducidad para generar alerta
  DIAS_ALERTA_CADUCIDAD: 90,
};

// Inicializar cliente Supabase
const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON);
