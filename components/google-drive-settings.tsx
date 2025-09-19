'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Cloud, 
  CloudOff, 
  Settings, 
  CheckCircle2, 
  AlertCircle, 
  HardDrive,
  FolderOpen,
  Upload,
  User,
  Mail,
  Loader2,
  ExternalLink,
  Shield
} from 'lucide-react'
import GoogleDriveManager, { GoogleDriveConfig } from '@/lib/google-drive'

interface GoogleDriveSettingsProps {
  onClose?: () => void
}

export default function GoogleDriveSettings({ onClose }: GoogleDriveSettingsProps) {
  const [config, setConfig] = useState<GoogleDriveConfig>({
    enabled: false,
    autoUpload: false,
    organizeFolders: true
  })
  const [userInfo, setUserInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected' | 'error'>('unknown')
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  useEffect(() => {
    loadConfig()
    testConnection()
  }, [])

  const loadConfig = () => {
    const savedConfig = GoogleDriveManager.getConfig()
    setConfig(savedConfig)
  }

  const saveConfig = (newConfig: GoogleDriveConfig) => {
    GoogleDriveManager.saveConfig(newConfig)
    setConfig(newConfig)
    setSuccess('Configuración guardada correctamente')
    setTimeout(() => setSuccess(''), 3000)
  }

  const testConnection = async () => {
    setTesting(true)
    setError('')
    
    try {
      const result = await GoogleDriveManager.testConnection()
      
      if (result.success) {
        setConnectionStatus('connected')
        setUserInfo(result.userInfo)
      } else {
        setConnectionStatus('disconnected')
        setUserInfo(null)
        if (result.error) {
          setError(result.error)
        }
      }
    } catch (err) {
      setConnectionStatus('error')
      setUserInfo(null)
      setError('Error al probar la conexión')
    } finally {
      setTesting(false)
    }
  }

  const connectToGoogleDrive = async () => {
    setLoading(true)
    setError('')
    
    try {
      // En un entorno real, esto abriría una ventana de OAuth
      // Por ahora, simularemos una conexión exitosa
      const authUrl = GoogleDriveManager.getAuthUrl()
      
      // Simular conexión exitosa para demo
      setTimeout(() => {
        const newConfig = { ...config, enabled: true, accessToken: 'demo-token', refreshToken: 'demo-refresh' }
        saveConfig(newConfig)
        setConnectionStatus('connected')
        setUserInfo({
          name: 'Usuario Demo',
          email: 'demo@example.com',
          storageUsed: '5368709120', // 5GB
          storageLimit: '16106127360' // 15GB
        })
        setLoading(false)
        setSuccess('¡Conectado a Google Drive exitosamente!')
      }, 2000)
      
      // En producción, esto sería:
      // window.open(authUrl, 'google-auth', 'width=500,height=600')
      
    } catch (err) {
      setError('Error al conectar con Google Drive')
      setLoading(false)
    }
  }

  const disconnectFromGoogleDrive = () => {
    GoogleDriveManager.disconnect()
    setConfig({ enabled: false, autoUpload: false, organizeFolders: true })
    setConnectionStatus('disconnected')
    setUserInfo(null)
    setSuccess('Desconectado de Google Drive')
    setTimeout(() => setSuccess(''), 3000)
  }

  const getStoragePercentage = () => {
    if (!userInfo?.storageUsed || !userInfo?.storageLimit) return 0
    return (parseInt(userInfo.storageUsed) / parseInt(userInfo.storageLimit)) * 100
  }

  const formatStorageSize = (bytes: string) => {
    return GoogleDriveManager.formatBytes(parseInt(bytes))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Integración con Google Drive</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testConnection}
            disabled={testing}
            className="flex items-center gap-2"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            Probar Conexión
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      </div>

      {/* Estado de conexión */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : connectionStatus === 'error' ? (
              <AlertCircle className="h-5 w-5 text-red-600" />
            ) : (
              <CloudOff className="h-5 w-5 text-gray-600" />
            )}
            Estado de Conexión
          </CardTitle>
          <CardDescription>
            {connectionStatus === 'connected' 
              ? 'Conectado y listo para subir archivos'
              : connectionStatus === 'error'
              ? 'Error en la conexión'
              : 'No conectado a Google Drive'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectionStatus === 'connected' && userInfo ? (
            <div className="space-y-4">
              {/* Información del usuario */}
              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{userInfo.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>{userInfo.email}</span>
                  </div>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  Conectado
                </Badge>
              </div>

              {/* Almacenamiento */}
              {userInfo.storageUsed && userInfo.storageLimit && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      <span>Almacenamiento usado</span>
                    </div>
                    <span>
                      {formatStorageSize(userInfo.storageUsed)} de {formatStorageSize(userInfo.storageLimit)}
                    </span>
                  </div>
                  <Progress value={getStoragePercentage()} className="h-2" />
                  <p className="text-xs text-gray-500">
                    {(100 - getStoragePercentage()).toFixed(1)}% disponible
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={disconnectFromGoogleDrive}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <CloudOff className="h-4 w-4 mr-2" />
                Desconectar Google Drive
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <Cloud className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Conectar con Google Drive
              </h3>
              <p className="text-gray-600 mb-4">
                Sube automáticamente tus descargas a Google Drive para tener un respaldo seguro en la nube
              </p>
              <Button
                onClick={connectToGoogleDrive}
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Cloud className="h-4 w-4" />
                )}
                {loading ? 'Conectando...' : 'Conectar con Google Drive'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuración */}
      {config.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración de Subida
            </CardTitle>
            <CardDescription>
              Personaliza cómo se suben tus archivos a Google Drive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Subida automática */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="font-medium">Subida Automática</span>
                </div>
                <p className="text-sm text-gray-600">
                  Sube automáticamente cada descarga a Google Drive
                </p>
              </div>
              <Switch
                checked={config.autoUpload}
                onCheckedChange={(checked) => {
                  const newConfig = { ...config, autoUpload: checked }
                  saveConfig(newConfig)
                }}
              />
            </div>

            {/* Organizar en carpetas */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  <span className="font-medium">Organizar en Carpetas</span>
                </div>
                <p className="text-sm text-gray-600">
                  Organiza archivos en subcarpetas (Videos, Audio, Subtítulos)
                </p>
              </div>
              <Switch
                checked={config.organizeFolders}
                onCheckedChange={(checked) => {
                  const newConfig = { ...config, organizeFolders: checked }
                  saveConfig(newConfig)
                }}
              />
            </div>

            {/* Información de carpetas */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <FolderOpen className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">Estructura de Carpetas</p>
                  <div className="text-blue-700 space-y-1">
                    <p>📁 YouTube Downloads/</p>
                    {config.organizeFolders && (
                      <>
                        <p className="ml-4">📁 Videos/</p>
                        <p className="ml-4">📁 Audio/</p>
                        <p className="ml-4">📁 Subtítulos/</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información de seguridad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Seguridad y Privacidad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>Solo tienes acceso a los archivos que subes, no a todo tu Google Drive</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>Los tokens de acceso se almacenan de forma segura en tu navegador</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>Puedes desconectar y revocar el acceso en cualquier momento</p>
            </div>
            <div className="flex items-start gap-2">
              <ExternalLink className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p>
                <a 
                  href="https://myaccount.google.com/permissions" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Gestionar permisos de aplicaciones en Google
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mensajes de estado */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {success}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
