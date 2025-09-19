# YouTube Downloader

Una aplicación web completa para descargar videos y playlists de YouTube con múltiples formatos y calidades.

## 🚀 Características

- **Descarga de videos individuales** en múltiples formatos (MP4, WebM, MKV, AVI, MOV)
- **Descarga de playlists completas** con selección de rango
- **Audio en alta calidad** (MP3, AAC, FLAC, WAV, OGG)
- **Subtítulos automáticos** en múltiples idiomas
- **Integración con Google Drive** para almacenamiento automático
- **Historial de descargas** con estadísticas detalladas
- **Progreso en tiempo real** para todas las descargas
- **Interfaz moderna** con modo oscuro

## 🛠️ Tecnologías

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Node.js, yt-dlp
- **Almacenamiento**: Google Drive API
- **Iconos**: Lucide React

## 📋 Requisitos

- Node.js 18+ o Bun
- Python 3.8+
- yt-dlp
- ffmpeg

## 🔧 Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/epardo0910/youtube-downloader.git
cd youtube-downloader
```

2. **Instalar dependencias**
```bash
# Con npm
npm install

# Con bun (recomendado)
bun install
```

3. **Instalar yt-dlp y ffmpeg**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3-pip ffmpeg
pip3 install yt-dlp

# macOS
brew install yt-dlp ffmpeg

# Windows
# Descargar yt-dlp desde: https://github.com/yt-dlp/yt-dlp/releases
# Descargar ffmpeg desde: https://ffmpeg.org/download.html
```

4. **Configurar variables de entorno**
```bash
cp .env.example .env.local
```

Edita `.env.local` con tus configuraciones:
```env
# Google Drive API (opcional)
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Configuración de la aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. **Ejecutar la aplicación**
```bash
# Con npm
npm run dev

# Con bun
bun dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🎯 Uso

### Descarga de Videos Individuales

1. Pega la URL del video de YouTube
2. Haz clic en "Analizar"
3. Selecciona el formato y calidad deseados
4. Haz clic en el botón de descarga

### Descarga de Playlists

1. Cambia a la pestaña "Playlist Completa"
2. Pega la URL de la playlist
3. Selecciona los videos que quieres descargar
4. Elige el formato y calidad
5. Inicia la descarga masiva

### Integración con Google Drive

1. Ve a "Configurar Google Drive"
2. Conecta tu cuenta de Google
3. Configura la carpeta de destino
4. Habilita la subida automática

## 📁 Estructura del Proyecto

```
youtube-downloader/
├── app/                    # Páginas de Next.js
├── components/            # Componentes React
│   ├── ui/               # Componentes de shadcn/ui
│   ├── download-history.tsx
│   └── google-drive-settings.tsx
├── lib/                   # Utilidades y managers
│   ├── download-history.ts
│   └── google-drive.ts
├── public/               # Archivos estáticos
└── styles/              # Estilos CSS
```

## 🔒 Configuración de Google Drive

Para habilitar la integración con Google Drive:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la Google Drive API
4. Crea credenciales OAuth 2.0
5. Configura las URLs de redirección
6. Añade las credenciales a tu `.env.local`

## 🚀 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Despliega automáticamente

### Docker

```bash
# Construir imagen
docker build -t youtube-downloader .

# Ejecutar contenedor
docker run -p 3000:3000 youtube-downloader
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## ⚠️ Aviso Legal

Esta herramienta está destinada únicamente para uso personal y educativo. Respeta los términos de servicio de YouTube y las leyes de derechos de autor de tu país. El autor no se hace responsable del uso indebido de esta aplicación.

## 🐛 Reportar Problemas

Si encuentras algún problema, por favor [abre un issue](https://github.com/epardo0910/youtube-downloader/issues) con:

- Descripción detallada del problema
- Pasos para reproducirlo
- Información del sistema (OS, versión de Node.js, etc.)
- Logs de error si están disponibles

## 📞 Soporte

- **Email**: emanuel.pardoparra.py@gmail.com
- **GitHub**: [@epardo0910](https://github.com/epardo0910)

---

⭐ Si te gusta este proyecto, ¡dale una estrella en GitHub!
