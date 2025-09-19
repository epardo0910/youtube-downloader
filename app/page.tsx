'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Play, Music, Loader2, AlertCircle, CheckCircle2, HardDrive, List, Video, PlayCircle, FileText, Sparkles, History, Cloud, Settings } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import DownloadHistory from '@/components/download-history'
import GoogleDriveSettings from '@/components/google-drive-settings'
import DownloadHistoryManager from '@/lib/download-history'
import GoogleDriveManager from '@/lib/google-drive'

interface VideoInfo {
  title: string
  thumbnail: string
  duration: string
  author: string
  formats: {
    video: Array<{ quality: string; format: string; size?: string }>
    audio: Array<{ quality: string; format: string; size?: string }>
    subtitles: Array<{ language: string; code: string; format: string }>
  }
}

interface PlaylistInfo {
  title: string
  description: string
  thumbnail: string
  uploader: string
  videoCount: number
  playlistId: string
  videos: Array<{
    id: string
    title: string
    duration: string
    thumbnail: string
    url: string
    uploader: string
    index: number
  }>
}

interface DownloadState {
  isDownloading: boolean
  progress: number
  completed: boolean
  error: string | null
  uploadingToDrive?: boolean
  driveUploadProgress?: number
  driveUploadCompleted?: boolean
  driveUploadError?: string
  driveFileLink?: string
}

interface PlaylistDownloadState {
  isDownloading: boolean
  downloadedCount: number
  totalVideos: number
  currentVideo: string
  progress: number
  globalProgress: number
  completed: boolean
  error: string | null
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('video')
  const [showHistory, setShowHistory] = useState(false)
  const [showGoogleDriveSettings, setShowGoogleDriveSettings] = useState(false)
  const [googleDriveEnabled, setGoogleDriveEnabled] = useState(false)
  
  // Estado de descarga individual para cada botón
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({})
  
  // Estado de descarga de playlist
  const [playlistDownloadState, setPlaylistDownloadState] = useState<PlaylistDownloadState>({
    isDownloading: false,
    downloadedCount: 0,
    totalVideos: 0,
    currentVideo: '',
    progress: 0,
    globalProgress: 0,
    completed: false,
    error: null
  })
  
  // Selección de videos en playlist
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set())
  const [videoRange, setVideoRange] = useState({ start: 1, end: 10 })

  useEffect(() => {
    // Verificar si Google Drive está habilitado
    const config = GoogleDriveManager.getConfig()
    setGoogleDriveEnabled(config.enabled)
  }, [])

  const analyzeContent = async () => {
    if (!url.trim()) {
      setError('Por favor, introduce una URL de YouTube válida')
      return
    }

    setLoading(true)
    setError('')
    setVideoInfo(null)
    setPlaylistInfo(null)
    setDownloadStates({}) // Limpiar estados de descarga anteriores
    setSelectedVideos(new Set())

    try {
      // Detectar si es playlist o video individual
      const isPlaylist = url.includes('playlist?list=') || url.includes('&list=')
      
      if (isPlaylist && activeTab === 'playlist') {
        // Analizar playlist
        const response = await fetch('/api/playlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
        })

        if (!response.ok) {
          throw new Error('Error al analizar la playlist')
        }

        const data = await response.json()
        setPlaylistInfo(data)
        
        // Seleccionar los primeros 10 videos por defecto
        const defaultSelection = new Set<number>()
        for (let i = 1; i <= Math.min(10, data.videos.length); i++) {
          defaultSelection.add(i)
        }
        setSelectedVideos(defaultSelection)
        setVideoRange({ start: 1, end: Math.min(10, data.videos.length) })
        
      } else {
        // Analizar video individual
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
        })

        if (!response.ok) {
          throw new Error('Error al analizar el video')
        }

        const data = await response.json()
        setVideoInfo(data)
      }
    } catch (err) {
      setError('Error al analizar el contenido. Verifica que la URL sea válida.')
    } finally {
      setLoading(false)
    }
  }

  const uploadToGoogleDrive = async (blob: Blob, fileName: string, metadata: any) => {
    try {
      const formData = new FormData()
      formData.append('file', blob, fileName)
      formData.append('fileName', fileName)
      formData.append('mimeType', blob.type)
      formData.append('title', metadata.title || '')
      formData.append('author', metadata.author || '')
      formData.append('type', metadata.type || '')

      const response = await fetch('/api/google-drive/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Error uploading to Google Drive:', error)
      return { success: false, error: 'Error al subir a Google Drive' }
    }
  }

  const downloadContent = async (type: 'video' | 'audio' | 'subtitle', quality: string, format?: string, subtitleLang?: string) => {
    if (!videoInfo) return

    const downloadKey = `${type}-${quality}-${format || 'default'}`
    const driveConfig = GoogleDriveManager.getConfig()
    
    // Registrar en historial como "en progreso"
    const historyId = Date.now().toString()
    DownloadHistoryManager.addToHistory({
      title: videoInfo.title,
      url: url,
      type: type,
      format: format || (type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'srt'),
      quality: quality,
      thumbnail: videoInfo.thumbnail,
      author: videoInfo.author,
      duration: videoInfo.duration,
      status: 'in-progress'
    })
    
    // Actualizar estado de descarga para este botón específico
    setDownloadStates(prev => ({
      ...prev,
      [downloadKey]: {
        isDownloading: true,
        progress: 0,
        completed: false,
        error: null,
        uploadingToDrive: false,
        driveUploadProgress: 0,
        driveUploadCompleted: false
      }
    }))

    try {
      // Simular progreso de descarga
      const progressInterval = setInterval(() => {
        setDownloadStates(prev => {
          const current = prev[downloadKey]
          if (current && current.progress < 90 && current.isDownloading) {
            return {
              ...prev,
              [downloadKey]: {
                ...current,
                progress: Math.min(current.progress + Math.random() * 15, 90)
              }
            }
          }
          return prev
        })
      }, 500)

      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, type, quality, format, subtitleLang }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error('Error al descargar')
      }

      // Completar progreso de descarga
      setDownloadStates(prev => ({
        ...prev,
        [downloadKey]: {
          ...prev[downloadKey],
          progress: 100,
          isDownloading: false,
          completed: true
        }
      }))

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      
      let extension = format || (type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'srt')
      const filename = `${videoInfo.title.replace(/[^\w\s.-]/gi, '').substring(0, 50)}.${extension}`
      a.download = filename
      
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)

      // Subir a Google Drive si está habilitado
      if (driveConfig.enabled && driveConfig.autoUpload) {
        setDownloadStates(prev => ({
          ...prev,
          [downloadKey]: {
            ...prev[downloadKey],
            uploadingToDrive: true,
            driveUploadProgress: 0
          }
        }))

        // Simular progreso de subida a Drive
        const driveProgressInterval = setInterval(() => {
          setDownloadStates(prev => {
            const current = prev[downloadKey]
            if (current && current.driveUploadProgress !== undefined && current.driveUploadProgress < 90) {
              return {
                ...prev,
                [downloadKey]: {
                  ...current,
                  driveUploadProgress: Math.min(current.driveUploadProgress + Math.random() * 20, 90)
                }
              }
            }
            return prev
          })
        }, 300)

        try {
          const driveResult = await uploadToGoogleDrive(blob, filename, {
            title: videoInfo.title,
            author: videoInfo.author,
            type: type
          })

          clearInterval(driveProgressInterval)

          if (driveResult.success) {
            setDownloadStates(prev => ({
              ...prev,
              [downloadKey]: {
                ...prev[downloadKey],
                uploadingToDrive: false,
                driveUploadProgress: 100,
                driveUploadCompleted: true,
                driveFileLink: driveResult.webViewLink
              }
            }))
          } else {
            setDownloadStates(prev => ({
              ...prev,
              [downloadKey]: {
                ...prev[downloadKey],
                uploadingToDrive: false,
                driveUploadError: driveResult.error || 'Error al subir a Google Drive'
              }
            }))
          }
        } catch (driveError) {
          clearInterval(driveProgressInterval)
          setDownloadStates(prev => ({
            ...prev,
            [downloadKey]: {
              ...prev[downloadKey],
              uploadingToDrive: false,
              driveUploadError: 'Error al subir a Google Drive'
            }
          }))
        }
      }

      // Actualizar historial como completado
      const history = DownloadHistoryManager.getHistory()
      const recentItem = history.find(item => 
        item.title === videoInfo.title && 
        item.type === type && 
        item.status === 'in-progress'
      )
      
      if (recentItem) {
        DownloadHistoryManager.updateHistoryItem(recentItem.id, {
          status: 'completed',
          size: getEstimatedSize(type, quality)
        })
      }

      // Limpiar estado después de 5 segundos
      setTimeout(() => {
        setDownloadStates(prev => {
          const newState = { ...prev }
          delete newState[downloadKey]
          return newState
        })
      }, 5000)

    } catch (err) {
      setDownloadStates(prev => ({
        ...prev,
        [downloadKey]: {
          isDownloading: false,
          progress: 0,
          completed: false,
          error: 'Error al descargar el contenido'
        }
      }))

      // Actualizar historial como fallido
      const history = DownloadHistoryManager.getHistory()
      const recentItem = history.find(item => 
        item.title === videoInfo.title && 
        item.type === type && 
        item.status === 'in-progress'
      )
      
      if (recentItem) {
        DownloadHistoryManager.updateHistoryItem(recentItem.id, {
          status: 'failed',
          error: 'Error al descargar el contenido'
        })
      }

      // Limpiar error después de 5 segundos
      setTimeout(() => {
        setDownloadStates(prev => {
          const newState = { ...prev }
          delete newState[downloadKey]
          return newState
        })
      }, 5000)
    }
  }

  const downloadPlaylist = async (format: 'video' | 'audio', quality: string) => {
    if (!playlistInfo || selectedVideos.size === 0) return

    // Registrar playlist en historial
    DownloadHistoryManager.addToHistory({
      title: playlistInfo.title,
      url: url,
      type: 'playlist',
      format: format === 'video' ? 'mp4' : 'mp3',
      quality: quality,
      thumbnail: playlistInfo.thumbnail,
      author: playlistInfo.uploader,
      status: 'in-progress',
      playlistInfo: {
        playlistTitle: playlistInfo.title,
        videoCount: selectedVideos.size,
        downloadedCount: 0
      }
    })

    setPlaylistDownloadState({
      isDownloading: true,
      downloadedCount: 0,
      totalVideos: selectedVideos.size,
      currentVideo: '',
      progress: 0,
      globalProgress: 0,
      completed: false,
      error: null
    })

    try {
      const response = await fetch('/api/playlist-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playlistId: playlistInfo.playlistId,
          format,
          quality,
          videoRange: {
            start: Math.min(...selectedVideos),
            end: Math.max(...selectedVideos)
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Error al iniciar descarga de playlist')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No se pudo leer la respuesta')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'progress') {
                setPlaylistDownloadState(prev => ({
                  ...prev,
                  downloadedCount: data.downloadedCount || prev.downloadedCount,
                  totalVideos: data.totalVideos || prev.totalVideos,
                  currentVideo: data.currentVideo || prev.currentVideo,
                  progress: data.progress || prev.progress,
                  globalProgress: data.globalProgress || prev.globalProgress
                }))
              } else if (data.type === 'complete') {
                setPlaylistDownloadState(prev => ({
                  ...prev,
                  isDownloading: false,
                  completed: true,
                  globalProgress: 100
                }))

                // Actualizar historial como completado
                const history = DownloadHistoryManager.getHistory()
                const recentItem = history.find(item => 
                  item.title === playlistInfo.title && 
                  item.type === 'playlist' && 
                  item.status === 'in-progress'
                )
                
                if (recentItem) {
                  DownloadHistoryManager.updateHistoryItem(recentItem.id, {
                    status: 'completed',
                    playlistInfo: {
                      ...recentItem.playlistInfo!,
                      downloadedCount: selectedVideos.size
                    }
                  })
                }

              } else if (data.type === 'error') {
                setPlaylistDownloadState(prev => ({
                  ...prev,
                  isDownloading: false,
                  error: data.message
                }))

                // Actualizar historial como fallido
                const history = DownloadHistoryManager.getHistory()
                const recentItem = history.find(item => 
                  item.title === playlistInfo.title && 
                  item.type === 'playlist' && 
                  item.status === 'in-progress'
                )
                
                if (recentItem) {
                  DownloadHistoryManager.updateHistoryItem(recentItem.id, {
                    status: 'failed',
                    error: data.message
                  })
                }
              }
            } catch (e) {
              console.log('Error parsing SSE data:', e)
            }
          }
        }
      }

    } catch (err) {
      setPlaylistDownloadState(prev => ({
        ...prev,
        isDownloading: false,
        error: 'Error al descargar la playlist'
      }))

      // Actualizar historial como fallido
      const history = DownloadHistoryManager.getHistory()
      const recentItem = history.find(item => 
        item.title === playlistInfo?.title && 
        item.type === 'playlist' && 
        item.status === 'in-progress'
      )
      
      if (recentItem) {
        DownloadHistoryManager.updateHistoryItem(recentItem.id, {
          status: 'failed',
          error: 'Error al descargar la playlist'
        })
      }
    }
  }

  const getEstimatedSize = (type: string, quality: string): string => {
    // Estimaciones basadas en calidad típica
    if (type === 'video') {
      switch (quality) {
        case '1080p': return '~50MB'
        case '720p': return '~30MB'
        case '480p': return '~20MB'
        case '360p': return '~15MB'
        default: return '~25MB'
      }
    } else if (type === 'audio') {
      switch (quality) {
        case '128kbps': return '~4MB'
        case '96kbps': return '~3MB'
        case '64kbps': return '~2MB'
        default: return '~3MB'
      }
    }
    return '~1MB'
  }

  const toggleVideoSelection = (index: number) => {
    const newSelection = new Set(selectedVideos)
    if (newSelection.has(index)) {
      newSelection.delete(index)
    } else {
      newSelection.add(index)
    }
    setSelectedVideos(newSelection)
  }

  const selectRange = () => {
    const newSelection = new Set<number>()
    for (let i = videoRange.start; i <= Math.min(videoRange.end, playlistInfo?.videos.length || 0); i++) {
      newSelection.add(i)
    }
    setSelectedVideos(newSelection)
  }

  const selectAll = () => {
    if (!playlistInfo) return
    const newSelection = new Set<number>()
    for (let i = 1; i <= playlistInfo.videos.length; i++) {
      newSelection.add(i)
    }
    setSelectedVideos(newSelection)
  }

  const clearSelection = () => {
    setSelectedVideos(new Set())
  }

  const getDownloadState = (type: 'video' | 'audio' | 'subtitle', quality: string, format?: string): DownloadState => {
    const downloadKey = `${type}-${quality}-${format || 'default'}`
    return downloadStates[downloadKey] || {
      isDownloading: false,
      progress: 0,
      completed: false,
      error: null
    }
  }

  const renderDownloadButton = (type: 'video' | 'audio' | 'subtitle', quality: string, format?: string, subtitleLang?: string) => {
    const state = getDownloadState(type, quality, format)
    
    if (state.driveUploadCompleted) {
      return (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="bg-green-50 border-green-200 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          {state.driveFileLink && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => window.open(state.driveFileLink, '_blank')}
              className="bg-blue-50 border-blue-200 text-blue-700"
            >
              <Cloud className="h-4 w-4" />
            </Button>
          )}
        </div>
      )
    }

    if (state.uploadingToDrive) {
      return (
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex-1">
            <div className="flex items-center gap-1 mb-1">
              <Cloud className="h-3 w-3 text-blue-600" />
              <span className="text-xs text-blue-600">Subiendo...</span>
            </div>
            <Progress value={state.driveUploadProgress || 0} className="h-2" />
            <div className="text-xs text-center mt-1 text-slate-600">
              {Math.round(state.driveUploadProgress || 0)}%
            </div>
          </div>
        </div>
      )
    }

    if (state.completed) {
      return (
        <Button size="sm" variant="outline" className="bg-green-50 border-green-200 text-green-700">
          <CheckCircle2 className="h-4 w-4" />
        </Button>
      )
    }

    if (state.error || state.driveUploadError) {
      return (
        <Button 
          size="sm" 
          variant="outline" 
          className="bg-red-50 border-red-200 text-red-700"
          onClick={() => downloadContent(type, quality, format, subtitleLang)}
        >
          <AlertCircle className="h-4 w-4" />
        </Button>
      )
    }

    if (state.isDownloading) {
      return (
        <div className="flex items-center gap-2 min-w-[100px]">
          <div className="flex-1">
            <Progress value={state.progress} className="h-2" />
            <div className="text-xs text-center mt-1 text-slate-600">
              {Math.round(state.progress)}%
            </div>
          </div>
        </div>
      )
    }

    return (
      <Button
        size="sm"
        onClick={() => downloadContent(type, quality, format, subtitleLang)}
        className="min-w-[40px]"
      >
        <Download className="h-4 w-4" />
      </Button>
    )
  }

  // Agrupar formatos por tipo
  const groupFormatsByType = (formats: Array<{ quality: string; format: string; size?: string; type: string }>) => {
    const grouped: Record<string, Array<{ quality: string; format: string; size?: string }>> = {}
    
    formats.forEach(format => {
      if (!grouped[format.format]) {
        grouped[format.format] = []
      }
      grouped[format.format].push(format)
    })
    
    return grouped
  }

  const getFormatIcon = (format: string) => {
    const icons = {
      'mp4': '🎬',
      'webm': '🌐',
      'mkv': '📹',
      'avi': '🎞️',
      'mov': '🎥',
      'mp3': '🎵',
      'aac': '🔊',
      'flac': '💎',
      'wav': '🎼',
      'ogg': '🎶',
      'srt': '📝',
      'vtt': '📄'
    }
    return icons[format] || '📁'
  }

  const getFormatDescription = (format: string) => {
    const descriptions = {
      'mp4': 'Estándar universal',
      'webm': 'Optimizado para web',
      'mkv': 'Alta calidad',
      'avi': 'Compatible clásico',
      'mov': 'Apple QuickTime',
      'mp3': 'Estándar universal',
      'aac': 'Alta eficiencia',
      'flac': 'Sin pérdida',
      'wav': 'Sin compresión',
      'ogg': 'Código abierto',
      'srt': 'Subtítulos estándar',
      'vtt': 'Subtítulos web'
    }
    return descriptions[format] || 'Formato compatible'
  }

  if (showGoogleDriveSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-6xl mx-auto py-8">
          <GoogleDriveSettings onClose={() => {
            setShowGoogleDriveSettings(false)
            // Actualizar estado de Google Drive
            const config = GoogleDriveManager.getConfig()
            setGoogleDriveEnabled(config.enabled)
          }} />
        </div>
      </div>
    )
  }

  if (showHistory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-6xl mx-auto py-8">
          <DownloadHistory onClose={() => setShowHistory(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            YouTube Downloader
          </h1>
          <p className="text-slate-600">
            Descarga videos individuales o playlists completas en múltiples formatos
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-slate-500">Ahora con más formatos: WebM, MKV, FLAC, WAV y subtítulos</span>
          </div>
          
          {/* Botones de navegación */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              Ver Historial de Descargas
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowGoogleDriveSettings(true)}
              className="flex items-center gap-2"
            >
              <Cloud className="h-4 w-4" />
              {googleDriveEnabled ? (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Google Drive
                </>
              ) : (
                'Configurar Google Drive'
              )}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Video Individual
            </TabsTrigger>
            <TabsTrigger value="playlist" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Playlist Completa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="video">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Introduce la URL del video
                </CardTitle>
                <CardDescription>
                  Pega aquí la URL del video de YouTube que quieres descargar
                  {googleDriveEnabled && (
                    <span className="flex items-center gap-1 mt-1 text-green-600">
                      <Cloud className="h-3 w-3" />
                      <span className="text-xs">Subida automática a Google Drive habilitada</span>
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1"
                    onKeyPress={(e) => e.key === 'Enter' && analyzeContent()}
                  />
                  <Button 
                    onClick={analyzeContent} 
                    disabled={loading}
                    className="px-6"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Analizar'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="playlist">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Introduce la URL de la playlist
                </CardTitle>
                <CardDescription>
                  Pega aquí la URL de la playlist de YouTube que quieres descargar
                  {googleDriveEnabled && (
                    <span className="flex items-center gap-1 mt-1 text-green-600">
                      <Cloud className="h-3 w-3" />
                      <span className="text-xs">Subida automática a Google Drive habilitada</span>
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://www.youtube.com/playlist?list=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1"
                    onKeyPress={(e) => e.key === 'Enter' && analyzeContent()}
                  />
                  <Button 
                    onClick={analyzeContent} 
                    disabled={loading}
                    className="px-6"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Analizar Playlist'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Video Individual */}
        {videoInfo && activeTab === 'video' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-full md:w-48 h-32 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      {videoInfo.title}
                    </h3>
                    <p className="text-slate-600 mb-2">
                      Canal: {videoInfo.author}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        Duración: {videoInfo.duration}
                      </Badge>
                      {googleDriveEnabled && (
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          <Cloud className="h-3 w-3 mr-1" />
                          Auto-subida
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Videos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Descargar Video
                  </CardTitle>
                  <CardDescription>
                    Múltiples formatos y calidades disponibles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(groupFormatsByType(videoInfo.formats.video)).map(([format, qualities]) => (
                      <div key={format} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">{getFormatIcon(format)}</span>
                          <div>
                            <Badge variant="outline" className="font-medium">
                              {format.toUpperCase()}
                            </Badge>
                            <p className="text-xs text-slate-500 mt-1">
                              {getFormatDescription(format)}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {qualities.map((quality, index) => {
                            const state = getDownloadState('video', quality.quality, format)
                            return (
                              <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{quality.quality}</span>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                      <HardDrive className="h-3 w-3" />
                                      <span>{quality.size || 'Calculando...'}</span>
                                    </div>
                                  </div>
                                  {(state.error || state.driveUploadError) && (
                                    <div className="text-xs text-red-600 mt-1">
                                      {state.error || state.driveUploadError}
                                    </div>
                                  )}
                                </div>
                                <div className="ml-2">
                                  {renderDownloadButton('video', quality.quality, format)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Audio */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Music className="h-5 w-5" />
                    Descargar Audio
                  </CardTitle>
                  <CardDescription>
                    Desde MP3 hasta FLAC sin pérdida
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(groupFormatsByType(videoInfo.formats.audio)).map(([format, qualities]) => (
                      <div key={format} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">{getFormatIcon(format)}</span>
                          <div>
                            <Badge variant="outline" className="font-medium">
                              {format.toUpperCase()}
                            </Badge>
                            <p className="text-xs text-slate-500 mt-1">
                              {getFormatDescription(format)}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {qualities.map((quality, index) => {
                            const state = getDownloadState('audio', quality.quality, format)
                            return (
                              <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{quality.quality}</span>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                      <HardDrive className="h-3 w-3" />
                                      <span>{quality.size || 'Calculando...'}</span>
                                    </div>
                                  </div>
                                  {(state.error || state.driveUploadError) && (
                                    <div className="text-xs text-red-600 mt-1">
                                      {state.error || state.driveUploadError}
                                    </div>
                                  )}
                                </div>
                                <div className="ml-2">
                                  {renderDownloadButton('audio', quality.quality, format)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Subtítulos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Descargar Subtítulos
                  </CardTitle>
                  <CardDescription>
                    Subtítulos automáticos en múltiples idiomas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {videoInfo.formats.subtitles && videoInfo.formats.subtitles.length > 0 ? (
                      videoInfo.formats.subtitles.slice(0, 10).map((subtitle, index) => {
                        const state = getDownloadState('subtitle', subtitle.code, subtitle.format)
                        return (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm">{getFormatIcon(subtitle.format)}</span>
                                <span className="font-medium text-sm">{subtitle.language}</span>
                                <Badge variant="outline" className="text-xs">
                                  {subtitle.format.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500">
                                Código: {subtitle.code}
                              </p>
                              {(state.error || state.driveUploadError) && (
                                <div className="text-xs text-red-600 mt-1">
                                  {state.error || state.driveUploadError}
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              {renderDownloadButton('subtitle', subtitle.code, subtitle.format, subtitle.code)}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No hay subtítulos disponibles para este video</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Playlist */}
        {playlistInfo && activeTab === 'playlist' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <img
                    src={playlistInfo.thumbnail}
                    alt={playlistInfo.title}
                    className="w-full md:w-48 h-32 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      {playlistInfo.title}
                    </h3>
                    <p className="text-slate-600 mb-2">
                      Canal: {playlistInfo.uploader}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {playlistInfo.videoCount} videos
                      </Badge>
                      {googleDriveEnabled && (
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          <Cloud className="h-3 w-3 mr-1" />
                          Auto-subida
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Controles de selección */}
            <Card>
              <CardHeader>
                <CardTitle>Seleccionar Videos</CardTitle>
                <CardDescription>
                  Elige qué videos descargar de la playlist
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="start">Desde:</Label>
                    <Input
                      id="start"
                      type="number"
                      min="1"
                      max={playlistInfo.videoCount}
                      value={videoRange.start}
                      onChange={(e) => setVideoRange(prev => ({ ...prev, start: parseInt(e.target.value) || 1 }))}
                      className="w-20"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="end">Hasta:</Label>
                    <Input
                      id="end"
                      type="number"
                      min="1"
                      max={playlistInfo.videoCount}
                      value={videoRange.end}
                      onChange={(e) => setVideoRange(prev => ({ ...prev, end: parseInt(e.target.value) || 1 }))}
                      className="w-20"
                    />
                  </div>
                  <Button onClick={selectRange} variant="outline" size="sm">
                    Seleccionar Rango
                  </Button>
                  <Button onClick={selectAll} variant="outline" size="sm">
                    Seleccionar Todo
                  </Button>
                  <Button onClick={clearSelection} variant="outline" size="sm">
                    Limpiar
                  </Button>
                </div>
                <p className="text-sm text-slate-600">
                  {selectedVideos.size} de {playlistInfo.videoCount} videos seleccionados
                </p>
              </CardContent>
            </Card>

            {/* Lista de videos */}
            <Card>
              <CardHeader>
                <CardTitle>Videos en la Playlist</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {playlistInfo.videos.map((video) => (
                    <div key={video.id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-slate-50">
                      <Checkbox
                        checked={selectedVideos.has(video.index)}
                        onCheckedChange={() => toggleVideoSelection(video.index)}
                      />
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-16 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{video.title}</p>
                        <p className="text-xs text-slate-500">{video.duration} • {video.uploader}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        #{video.index}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Controles de descarga de playlist */}
            {selectedVideos.size > 0 && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PlayCircle className="h-5 w-5" />
                      Descargar Videos (MP4)
                    </CardTitle>
                    <CardDescription>
                      Descargar {selectedVideos.size} videos seleccionados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {['1080p', '720p', '480p', '360p'].map((quality) => (
                        <div key={quality} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <span className="font-medium">{quality}</span>
                            <Badge variant="outline" className="ml-2 text-xs">MP4</Badge>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => downloadPlaylist('video', quality)}
                            disabled={playlistDownloadState.isDownloading}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Music className="h-5 w-5" />
                      Descargar Audio (MP3)
                    </CardTitle>
                    <CardDescription>
                      Descargar audio de {selectedVideos.size} videos seleccionados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {['128kbps', '96kbps', '64kbps'].map((quality) => (
                        <div key={quality} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <span className="font-medium">{quality}</span>
                            <Badge variant="outline" className="ml-2 text-xs">MP3</Badge>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => downloadPlaylist('audio', quality)}
                            disabled={playlistDownloadState.isDownloading}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Progreso de descarga de playlist */}
            {playlistDownloadState.isDownloading && (
              <Card>
                <CardHeader>
                  <CardTitle>Descargando Playlist</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progreso Global</span>
                        <span>{playlistDownloadState.globalProgress}%</span>
                      </div>
                      <Progress value={playlistDownloadState.globalProgress} className="h-3" />
                    </div>
                    <div className="text-sm text-slate-600">
                      <p>Videos descargados: {playlistDownloadState.downloadedCount} de {playlistDownloadState.totalVideos}</p>
                      {playlistDownloadState.currentVideo && (
                        <p>Descargando: {playlistDownloadState.currentVideo}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {playlistDownloadState.completed && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  ¡Descarga de playlist completada! Se descargaron {playlistDownloadState.downloadedCount} videos.
                </AlertDescription>
              </Alert>
            )}

            {playlistDownloadState.error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {playlistDownloadState.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
