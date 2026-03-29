# Bora Bora · Gestión de Reservas

## Cómo publicar en Vercel (10 minutos)

### Paso 1 — Sube el código a GitHub
1. Ve a **github.com** → crea una cuenta gratis si no tienes
2. Clic en **"New repository"** → nómbralo `bora-bora-app` → **Create**
3. En la página del repo, clic en **"uploading an existing file"**
4. Arrastra TODA la carpeta `nocturno/` (o sube los archivos uno a uno)
5. Clic **"Commit changes"**

### Paso 2 — Publica en Vercel
1. Ve a **vercel.com** → crea cuenta con tu GitHub
2. Clic **"Add New Project"**
3. Selecciona el repo `bora-bora-app`
4. Vercel detecta automáticamente que es React → clic **"Deploy"**
5. En 2 minutos tendrás una URL tipo: `bora-bora-app.vercel.app`

### Paso 3 — Comparte
- Envía esa URL a tus promotores
- En iPhone: abrir la URL → compartir → **"Añadir a pantalla de inicio"** → queda como app

## Credenciales por defecto
- **Admin:** clave `admin123`
- **Host:** clave `host123`  
- **Carlos:** usuario `carlos` · clave `1111`
- **Daniela:** usuario `daniela` · clave `2222`
- **Mateo:** usuario `mateo` · clave `3333`

⚠️ Cambia las claves desde el panel Admin → Promotores → Editar

## Importante
Los datos se guardan en el dispositivo de cada usuario (localStorage).
Para sincronizar entre dispositivos necesitas conectar Supabase (próximo paso).
