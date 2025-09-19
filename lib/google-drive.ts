import { google } from 'googleapis'

export interface GoogleDriveConfig {
  enabled: boolean
  accessToken?: string
  refreshToken?: string
  folderId?: string
  autoUpload: boolean
  organizeFolders: boolean
}

export interface UploadResult {
  success: boolean
  fileId?: string
  fileName?: string
  webViewLink?: string
  error?: string
}

class GoogleDriveManager {
  private static readonly STORAGE_KEY = 'youtube-downloader-gdrive-config'
  private static readonly SCOPES = ['https://www.googleapis.com/auth/drive.file']
  
  // Configuración OAuth2 (en producción esto estaría en variables de entorno)
  private static readonly CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'demo-client-id'
  private static readonly CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'demo-client-secret'
  private static readonly REDIRECT_URI = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'

  static getConfig(): GoogleDriveConfig {
    if (typeof window === 'undefined') {
      return {
        enabled: false,
        autoUpload: false,
        organizeFolders: true
      }
    }
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) {
        return {
          enabled: false,
          autoUpload: false,
          organizeFolders: true
        }
      }
      
      return JSON.parse(stored) as GoogleDriveConfig
    } catch (error) {
      console.error('Error loading Google Drive config:', error)
      return {
        enabled: false,
        autoUpload: false,
        organizeFolders: true
      }
    }
  }

  static saveConfig(config: GoogleDriveConfig): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config))
    } catch (error) {
      console.error('Error saving Google Drive config:', error)
    }
  }

  static getAuthUrl(): string {
    const oauth2Client = new google.auth.OAuth2(
      this.CLIENT_ID,
      this.CLIENT_SECRET,
      this.REDIRECT_URI
    )

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent'
    })
  }

  static async exchangeCodeForTokens(code: string): Promise<{ success: boolean; error?: string }> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.CLIENT_ID,
        this.CLIENT_SECRET,
        this.REDIRECT_URI
      )

      const { tokens } = await oauth2Client.getToken(code)
      
      if (tokens.access_token && tokens.refresh_token) {
        const config = this.getConfig()
        config.accessToken = tokens.access_token
        config.refreshToken = tokens.refresh_token
        config.enabled = true
        this.saveConfig(config)
        
        return { success: true }
      } else {
        return { success: false, error: 'No se pudieron obtener los tokens' }
      }
    } catch (error) {
      console.error('Error exchanging code for tokens:', error)
      return { success: false, error: 'Error al intercambiar código por tokens' }
    }
  }

  static async refreshAccessToken(): Promise<boolean> {
    try {
      const config = this.getConfig()
      if (!config.refreshToken) return false

      const oauth2Client = new google.auth.OAuth2(
        this.CLIENT_ID,
        this.CLIENT_SECRET,
        this.REDIRECT_URI
      )

      oauth2Client.setCredentials({
        refresh_token: config.refreshToken
      })

      const { credentials } = await oauth2Client.refreshAccessToken()
      
      if (credentials.access_token) {
        config.accessToken = credentials.access_token
        this.saveConfig(config)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error refreshing access token:', error)
      return false
    }
  }

  static async createYouTubeDownloaderFolder(): Promise<string | null> {
    try {
      const config = this.getConfig()
      if (!config.accessToken) return null

      const oauth2Client = new google.auth.OAuth2()
      oauth2Client.setCredentials({ access_token: config.accessToken })

      const drive = google.drive({ version: 'v3', auth: oauth2Client })

      // Verificar si ya existe la carpeta
      const existingFolders = await drive.files.list({
        q: "name='YouTube Downloads' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)'
      })

      if (existingFolders.data.files && existingFolders.data.files.length > 0) {
        return existingFolders.data.files[0].id || null
      }

      // Crear nueva carpeta
      const folderMetadata = {
        name: 'YouTube Downloads',
        mimeType: 'application/vnd.google-apps.folder'
      }

      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id'
      })

      return folder.data.id || null
    } catch (error) {
      console.error('Error creating YouTube Downloads folder:', error)
      return null
    }
  }

  static async createSubFolder(parentFolderId: string, folderName: string): Promise<string | null> {
    try {
      const config = this.getConfig()
      if (!config.accessToken) return null

      const oauth2Client = new google.auth.OAuth2()
      oauth2Client.setCredentials({ access_token: config.accessToken })

      const drive = google.drive({ version: 'v3', auth: oauth2Client })

      // Verificar si ya existe la subcarpeta
      const existingFolders = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)'
      })

      if (existingFolders.data.files && existingFolders.data.files.length > 0) {
        return existingFolders.data.files[0].id || null
      }

      // Crear nueva subcarpeta
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      }

      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id'
      })

      return folder.data.id || null
    } catch (error) {
      console.error('Error creating subfolder:', error)
      return null
    }
  }

  static async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    metadata?: {
      title?: string
      author?: string
      type?: 'video' | 'audio' | 'subtitle'
    }
  ): Promise<UploadResult> {
    try {
      const config = this.getConfig()
      if (!config.enabled || !config.accessToken) {
        return { success: false, error: 'Google Drive no está configurado' }
      }

      const oauth2Client = new google.auth.OAuth2()
      oauth2Client.setCredentials({ access_token: config.accessToken })

      const drive = google.drive({ version: 'v3', auth: oauth2Client })

      // Obtener o crear carpeta principal
      let folderId = config.folderId
      if (!folderId) {
        folderId = await this.createYouTubeDownloaderFolder()
        if (folderId) {
          config.folderId = folderId
          this.saveConfig(config)
        }
      }

      // Organizar en subcarpetas si está habilitado
      let targetFolderId = folderId
      if (config.organizeFolders && folderId && metadata) {
        let subFolderName = 'Otros'
        
        if (metadata.type === 'video') {
          subFolderName = 'Videos'
        } else if (metadata.type === 'audio') {
          subFolderName = 'Audio'
        } else if (metadata.type === 'subtitle') {
          subFolderName = 'Subtítulos'
        }

        const subFolderId = await this.createSubFolder(folderId, subFolderName)
        if (subFolderId) {
          targetFolderId = subFolderId
        }
      }

      // Metadatos del archivo
      const fileMetadata: any = {
        name: fileName
      }

      if (targetFolderId) {
        fileMetadata.parents = [targetFolderId]
      }

      // Descripción con metadatos
      if (metadata) {
        const description = [
          metadata.title ? `Título: ${metadata.title}` : '',
          metadata.author ? `Canal: ${metadata.author}` : '',
          `Descargado: ${new Date().toLocaleString('es-ES')}`
        ].filter(Boolean).join('\n')
        
        fileMetadata.description = description
      }

      // Subir archivo
      const media = {
        mimeType: mimeType,
        body: Buffer.from(fileBuffer)
      }

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink'
      })

      return {
        success: true,
        fileId: file.data.id || undefined,
        fileName: file.data.name || undefined,
        webViewLink: file.data.webViewLink || undefined
      }

    } catch (error: any) {
      console.error('Error uploading to Google Drive:', error)
      
      // Si el token expiró, intentar renovarlo
      if (error.code === 401) {
        const refreshed = await this.refreshAccessToken()
        if (refreshed) {
          // Reintentar la subida
          return this.uploadFile(fileBuffer, fileName, mimeType, metadata)
        }
      }
      
      return {
        success: false,
        error: error.message || 'Error al subir archivo a Google Drive'
      }
    }
  }

  static async testConnection(): Promise<{ success: boolean; error?: string; userInfo?: any }> {
    try {
      const config = this.getConfig()
      if (!config.enabled || !config.accessToken) {
        return { success: false, error: 'Google Drive no está configurado' }
      }

      const oauth2Client = new google.auth.OAuth2()
      oauth2Client.setCredentials({ access_token: config.accessToken })

      const drive = google.drive({ version: 'v3', auth: oauth2Client })

      // Obtener información del usuario
      const about = await drive.about.get({
        fields: 'user(displayName, emailAddress), storageQuota(limit, usage)'
      })

      return {
        success: true,
        userInfo: {
          name: about.data.user?.displayName,
          email: about.data.user?.emailAddress,
          storageUsed: about.data.storageQuota?.usage,
          storageLimit: about.data.storageQuota?.limit
        }
      }
    } catch (error: any) {
      console.error('Error testing Google Drive connection:', error)
      
      if (error.code === 401) {
        const refreshed = await this.refreshAccessToken()
        if (refreshed) {
          return this.testConnection()
        }
      }
      
      return {
        success: false,
        error: error.message || 'Error al conectar con Google Drive'
      }
    }
  }

  static disconnect(): void {
    const config: GoogleDriveConfig = {
      enabled: false,
      autoUpload: false,
      organizeFolders: true
    }
    this.saveConfig(config)
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

export default GoogleDriveManager
