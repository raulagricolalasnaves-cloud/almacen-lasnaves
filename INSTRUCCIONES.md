# Las Naves Agrícola — Instrucciones de publicación
## Sistema de Almacén de Químicos con seguridad real

---

## Lo que necesitas (todo gratuito)
- Cuenta en **Supabase** → supabase.com
- Cuenta en **GitHub**   → github.com
- Cuenta de **Google**   (si quieres exportar datos a Sheets, opcional)

Tiempo estimado: **40 minutos**

---

## PASO 1 — Crear el proyecto en Supabase (10 min)

1. Ve a **supabase.com** → "Start your project" → crea cuenta con Google
2. Haz clic en **"New project"**
3. Escribe:
   - Nombre: `lasnaves-almacen`
   - Contraseña de base de datos: anótala en un lugar seguro
   - Región: `US East (N. Virginia)` (la más cercana a México)
4. Espera ~2 minutos a que el proyecto se cree

### 1a. Ejecutar el SQL de la base de datos
1. En el menú izquierdo haz clic en **"SQL Editor"**
2. Haz clic en **"New query"**
3. Abre el archivo `supabase_setup.sql` con el Bloc de Notas
4. Copia TODO su contenido y pégalo en el editor
5. Haz clic en **"Run"** (botón verde)
6. Debe decir "Success" en verde

### 1b. Obtener tus credenciales
1. Ve a **Settings → API** (menú izquierdo)
2. Copia estos dos valores:
   - **Project URL** → algo como `https://abcdefgh.supabase.co`
   - **anon public key** → una cadena larga de letras

---

## PASO 2 — Configurar el sistema (5 min)

1. Abre el archivo `src/lib/config.js` con el Bloc de Notas
2. Reemplaza los valores:
```javascript
SUPABASE_URL:  "https://TU_PROYECTO.supabase.co",   // ← tu Project URL
SUPABASE_ANON: "TU_ANON_KEY_AQUI",                  // ← tu anon public key
```
3. Guarda el archivo

---

## PASO 3 — Crear tu usuario administrador (5 min)

1. En Supabase, ve a **Authentication → Users**
2. Haz clic en **"Add user" → "Create new user"**
3. Escribe:
   - Email: tu correo (ej: admin@lasnaves.com)
   - Password: tu contraseña segura (mín. 8 caracteres)
4. Haz clic en **"Create user"**
5. Ve a **Table Editor → perfiles**
6. Busca tu usuario recién creado
7. Haz clic en el campo `rol` y cámbialo de `operador` a `admin`
8. Guarda el cambio

---

## PASO 4 — Publicar en GitHub Pages (10 min)

1. Ve a **github.com** → crea cuenta si no tienes
2. Haz clic en el botón verde **"New"** (nuevo repositorio)
3. Nombre del repositorio: `almacen-lasnaves`
4. Selecciona **"Public"**
5. Haz clic en **"Create repository"**
6. En la página del repositorio, haz clic en **"uploading an existing file"**
7. Arrastra **todos los archivos y carpetas** del ZIP:
   ```
   index.html
   public/
     logo.png
   src/
     styles/main.css
     lib/config.js
     lib/api.js
     lib/app.js
   ```
8. Escribe un mensaje: "Subir sistema almacén"
9. Haz clic en **"Commit changes"**
10. Ve a **Settings → Pages**
11. En "Source" elige **"Deploy from a branch"**
12. Branch: **"main"** → Save

En 1-2 minutos tu sistema estará en:
```
https://TU-USUARIO.github.io/almacen-lasnaves
```

---

## PASO 5 — Acceder desde el celular (2 min)

1. Abre la URL en Chrome (Android) o Safari (iPhone)
2. Para instalar como app:
   - **Android**: Menú (⋮) → "Agregar a pantalla de inicio"
   - **iPhone**: Compartir (□↑) → "Agregar a pantalla de inicio"

---

## PASO 6 — Agregar usuarios operadores (5 min)

Una vez que entres como administrador:
1. Ve a la pestaña **Usuarios** (solo visible para admin)
2. Haz clic en **"+ Agregar usuario"**
3. Llena nombre, correo y contraseña temporal
4. Selecciona el rol:
   - **Operador**: solo escanear y ver inventario
   - **Supervisor**: escanear + inventario + pedidos
   - **Administrador**: acceso total

Para cambiar el rol de un usuario existente, solo cambia el selector en la lista de usuarios.

---

## Niveles de acceso (Roles)

| Función                    | Operador | Supervisor | Admin |
|----------------------------|:--------:|:----------:|:-----:|
| Ver dashboard              | ✓        | ✓          | ✓     |
| Escanear (con pin)         | ✓        | ✓          | ✓     |
| Ver inventario             | ✓        | ✓          | ✓     |
| Agregar productos          |          | ✓          | ✓     |
| Ver movimientos            | ✓        | ✓          | ✓     |
| Gestionar pedidos          |          | ✓          | ✓     |
| Ver alertas                |          | ✓          | ✓     |
| Gestionar usuarios         |          |            | ✓     |

---

## Seguridad implementada

- **Supabase Auth**: login real con email y contraseña, tokens JWT
- **RLS (Row Level Security)**: la base de datos rechaza peticiones no autorizadas a nivel de fila, no solo en el frontend
- **Zero Trust en scanner**: cada movimiento requiere confirmar tu contraseña aunque ya estés logueado
- **Roles en base de datos**: los permisos se verifican en el servidor, no solo en pantalla

---

## ¿Algo salió mal?

| Problema | Solución |
|----------|----------|
| "Error al cargar" en dashboard | Verifica las URLs en `config.js` |
| No puedo iniciar sesión | Ve a Supabase → Authentication → confirma que el usuario existe |
| No aparece como admin | Ve a Table Editor → perfiles → cambia el rol a `admin` |
| Cámara no funciona | Acepta los permisos de cámara en el navegador |
| Producto no encontrado | El código escaneado debe coincidir exactamente con el campo `id` en la tabla `productos` |
