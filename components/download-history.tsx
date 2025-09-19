'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  History, 
  Download, 
  Trash2, 
  Search, 
  Filter, 
  Calendar,
  Play,
  Music,
  FileText,
  List,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  HardDrive,
  RefreshCw
} from 'lucide-react'
import DownloadHistoryManager, { DownloadHistoryItem } from '@/lib/download-history'

interface DownloadHistoryProps {
  onClose?: () => void
}

export default function DownloadHistory({ onClose }: DownloadHistoryProps) {
  const [history, setHistory] = useState<DownloadHistoryItem[]>([])
  const [filteredHistory, setFilteredHistory] = useState<DownloadHistoryItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [stats, setStats] = useState({
    totalDownloads: 0,
    completedDownloads: 0,
    failedDownloads: 0,
    totalSizeFormatted: '0 Bytes'
  })

  useEffect(() => {
    loadHistory()
  }, [])

  useEffect(() => {
    filterHistory()
  }, [history, searchTerm, statusFilter, typeFilter])

  const loadHistory = () => {
    const historyData = DownloadHistoryManager.getHistory()
    const statsData = DownloadHistoryManager.getHistoryStats()
    setHistory(historyData)
    setStats(statsData)
  }

  const filterHistory = () => {
    let filtered = history

    // Filtrar por término de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.author?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter)
    }

    // Filtrar por tipo
    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === typeFilter)
    }

    setFilteredHistory(filtered)
  }

  const removeItem = (id: string) => {
    DownloadHistoryManager.removeFromHistory(id)
    loadHistory()
  }

  const clearAllHistory = () => {
    if (confirm('¿Estás seguro de que quieres borrar todo el historial?')) {
      DownloadHistoryManager.clearHistory()
      loadHistory()
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'in-progress':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Play className="h-4 w-4 text-blue-600" />
      case 'audio':
        return <Music className="h-4 w-4 text-purple-600" />
      case 'subtitle':
        return <FileText className="h-4 w-4 text-gray-600" />
      case 'playlist':
        return <List className="h-4 w-4 text-orange-600" />
      default:
        return <Download className="h-4 w-4 text-gray-600" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      return 'Hoy'
    } else if (diffDays === 2) {
      return 'Ayer'
    } else if (diffDays <= 7) {
      return `Hace ${diffDays - 1} días`
    } else {
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default'
      case 'failed':
        return 'destructive'
      case 'in-progress':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado'
      case 'failed':
        return 'Fallido'
      case 'in-progress':
        return 'En progreso'
      default:
        return 'Desconocido'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Historial de Descargas</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadHistory}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats.totalDownloads}</p>
                <p className="text-xs text-slate-600">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.completedDownloads}</p>
                <p className="text-xs text-slate-600">Completadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{stats.failedDownloads}</p>
                <p className="text-xs text-slate-600">Fallidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-sm">{stats.totalSizeFormatted}</p>
                <p className="text-xs text-slate-600">Descargado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por título o canal..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="completed">Completados</SelectItem>
                <SelectItem value="failed">Fallidos</SelectItem>
                <SelectItem value="in-progress">En progreso</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="subtitle">Subtítulos</SelectItem>
                <SelectItem value="playlist">Playlists</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              onClick={clearAllHistory}
              className="flex items-center gap-2 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Limpiar Todo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de historial */}
      <Card>
        <CardHeader>
          <CardTitle>Descargas Recientes</CardTitle>
          <CardDescription>
            {filteredHistory.length} de {history.length} descargas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {history.length === 0 ? 'No hay descargas aún' : 'No se encontraron resultados'}
              </h3>
              <p className="text-slate-600">
                {history.length === 0 
                  ? 'Tus descargas aparecerán aquí automáticamente'
                  : 'Intenta ajustar los filtros de búsqueda'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredHistory.map((item) => (
                <div key={item.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                  {/* Thumbnail */}
                  {item.thumbnail && (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-16 h-12 object-cover rounded flex-shrink-0"
                    />
                  )}
                  
                  {/* Contenido principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900 truncate">
                          {item.title}
                        </h4>
                        {item.author && (
                          <p className="text-sm text-slate-600 truncate">
                            {item.author}
                          </p>
                        )}
                        
                        {/* Información de playlist */}
                        {item.type === 'playlist' && item.playlistInfo && (
                          <p className="text-sm text-slate-600">
                            {item.playlistInfo.downloadedCount} de {item.playlistInfo.videoCount} videos
                          </p>
                        )}
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="text-red-600 hover:text-red-700 flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Metadatos */}
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        {getTypeIcon(item.type)}
                        <span className="capitalize">{item.type}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {item.format.toUpperCase()}
                        </Badge>
                        <span>{item.quality}</span>
                      </div>
                      
                      {item.size && (
                        <div className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          <span>{item.size}</span>
                        </div>
                      )}
                      
                      {item.duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{item.duration}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(item.downloadDate)}</span>
                      </div>
                    </div>
                    
                    {/* Estado y error */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(item.status)}
                        <Badge variant={getStatusBadgeVariant(item.status)} className="text-xs">
                          {getStatusText(item.status)}
                        </Badge>
                      </div>
                      
                      {item.error && (
                        <span className="text-xs text-red-600 truncate">
                          {item.error}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
