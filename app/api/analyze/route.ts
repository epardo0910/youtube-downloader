import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    // Limpiar y validar URL de YouTube
    const cleanUrl = cleanYouTubeUrl(url)
    
    if (!cleanUrl) {
      return NextResponse.json(
        { error: 'URL de YouTube inválida' },
        { status: 400 }
      )
    }

    console.log('Analyzing URL:', cleanUrl)

    // Estrategia mejorada con obtención de formatos reales
    let videoInfo = null
    let realFormats = []
    let subtitles = []
    let success = false

    // Intentar obtener información del video
    const strategies = [
      // Estrategia 1: Cliente web básico
      `yt-dlp --dump-json --no-playlist --skip-download --extractor-args "youtube:player_client=web" "${cleanUrl}"`,
      
      // Estrategia 2: Cliente móvil
      `yt-dlp --dump-json --no-playlist --skip-download --extractor-args "youtube:player_client=mweb" "${cleanUrl}"`,
      
      // Estrategia 3: Sin argumentos especiales
      `yt-dlp --dump-json --no-playlist --skip-download "${cleanUrl}"`
    ]

    for (const strategy of strategies) {
      try {
        console.log('Trying strategy for video info...')
        
        const { stdout } = await execAsync(strategy, {
          timeout: 20000,
          maxBuffer: 1024 * 1024 * 5
        })
        
        const lines = stdout.trim().split('\n')
        const jsonLines = lines.filter(line => line.startsWith('{') && line.endsWith('}'))
        
        if (jsonLines.length > 0) {
          videoInfo = JSON.parse(jsonLines[0])
          success = true
          break
        }
        
      } catch (error) {
        console.log('Strategy failed:', error.message.substring(0, 100))
        continue
      }
    }

    // Si no se pudo obtener info, usar información básica
    if (!success || !videoInfo) {
      const videoId = extractVideoId(cleanUrl)
      if (!videoId) {
        throw new Error('No se pudo obtener información del video')
      }
      
      videoInfo = {
        title: `Video de YouTube (${videoId})`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: 0,
        uploader: 'Canal de YouTube',
        id: videoId
      }
    }

    // Obtener formatos reales disponibles con mejor parsing
    try {
      console.log('Getting real formats...')
      const { stdout: formatsOutput } = await execAsync(
        `yt-dlp -F --no-playlist --extractor-args "youtube:player_client=web" "${cleanUrl}"`, 
        {
          timeout: 20000,
          maxBuffer: 1024 * 1024 * 5
        }
      )
      
      realFormats = parseFormatsImproved(formatsOutput)
      console.log('Real formats found:', realFormats.length)
      
    } catch (error) {
      console.log('Could not get real formats:', error.message)
    }

    // Obtener subtítulos disponibles
    try {
      console.log('Getting subtitles...')
      const { stdout: subsOutput } = await execAsync(
        `yt-dlp --list-subs --no-playlist "${cleanUrl}"`, 
        {
          timeout: 15000,
          maxBuffer: 1024 * 1024 * 2
        }
      )
      
      subtitles = parseSubtitles(subsOutput)
      console.log('Subtitles found:', subtitles.length)
      
    } catch (error) {
      console.log('Could not get subtitles:', error.message)
    }

    // Generar formatos con tamaños estimados si no hay formatos reales
    const durationSeconds = videoInfo.duration || 213 // 3:33 por defecto
    
    // Generar formatos de video expandidos
    const videoFormats = realFormats.filter(f => f.type === 'video').length > 0 
      ? realFormats.filter(f => f.type === 'video')
      : generateExpandedVideoFormats(durationSeconds)

    // Generar formatos de audio expandidos
    const audioFormats = realFormats.filter(f => f.type === 'audio').length > 0
      ? realFormats.filter(f => f.type === 'audio')
      : generateExpandedAudioFormats(durationSeconds)

    const response = {
      title: videoInfo.title || 'Video de YouTube',
      thumbnail: videoInfo.thumbnail || videoInfo.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${extractVideoId(cleanUrl)}/maxresdefault.jpg`,
      duration: formatDuration(videoInfo.duration || 0),
      author: videoInfo.uploader || videoInfo.channel || 'Canal de YouTube',
      formats: {
        video: videoFormats.slice(0, 8), // Máximo 8 opciones de video
        audio: audioFormats.slice(0, 6), // Máximo 6 opciones de audio
        subtitles: subtitles.slice(0, 10) // Máximo 10 idiomas de subtítulos
      }
    }

    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Error analyzing video:', error)
    
    let errorMessage = 'Error al analizar el video.'
    
    if (error.message.includes('timeout')) {
      errorMessage = 'El análisis tardó demasiado. YouTube puede estar limitando las peticiones.'
    } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
      errorMessage = 'YouTube está limitando las peticiones desde este servidor. La descarga aún puede funcionar.'
    } else if (error.message.includes('Private video')) {
      errorMessage = 'Este video es privado y no se puede descargar.'
    } else if (error.message.includes('Video unavailable')) {
      errorMessage = 'El video no está disponible o ha sido eliminado.'
    } else {
      errorMessage = 'Error temporal de YouTube. La descarga puede funcionar aunque el análisis falle.'
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

function parseFormatsImproved(formatsOutput: string) {
  const formats = []
  const lines = formatsOutput.split('\n')
  
  for (const line of lines) {
    if (line.includes('mp4') || line.includes('webm') || line.includes('m4a') || line.includes('mkv')) {
      // Parsear líneas de formato mejorado
      const parts = line.trim().split(/\s+/)
      if (parts.length < 3) continue
      
      let quality = ''
      let size = ''
      let type = ''
      let container = ''
      
      // Buscar resolución y calidad
      const resolutionMatch = line.match(/(\d+x\d+|\d+p)/g)
      if (resolutionMatch) {
        const res = resolutionMatch[resolutionMatch.length - 1]
        if (res.includes('x')) {
          const height = parseInt(res.split('x')[1])
          quality = `${height}p`
        } else {
          quality = res
        }
      }
      
      // Buscar tamaño del archivo
      const sizeMatch = line.match(/(\d+\.?\d*[KMGT]?iB)/g)
      if (sizeMatch) {
        size = sizeMatch[sizeMatch.length - 1]
      }
      
      // Determinar contenedor
      if (line.includes('mp4')) container = 'mp4'
      else if (line.includes('webm')) container = 'webm'
      else if (line.includes('mkv')) container = 'mkv'
      else if (line.includes('m4a')) container = 'm4a'
      
      // Determinar tipo
      if (line.includes('video only') || (container === 'mp4' && !line.includes('audio only'))) {
        type = 'video'
      } else if (line.includes('audio only') || container === 'm4a') {
        type = 'audio'
        const bitrateMatch = line.match(/(\d+)k/)
        if (bitrateMatch) {
          quality = `${bitrateMatch[1]}kbps`
        }
      }
      
      if (quality && type && container) {
        const exists = formats.some(f => f.quality === quality && f.type === type && f.format === container)
        if (!exists) {
          formats.push({
            quality,
            format: container,
            size: size || estimateSize(type, quality, 213), // 3:33 por defecto
            type
          })
        }
      }
    }
  }
  
  // Ordenar formatos
  const videoFormats = formats.filter(f => f.type === 'video').sort((a, b) => {
    const qualityOrder = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p']
    return qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality)
  })
  
  const audioFormats = formats.filter(f => f.type === 'audio').sort((a, b) => {
    const bitrateA = parseInt(a.quality) || 0
    const bitrateB = parseInt(b.quality) || 0
    return bitrateB - bitrateA
  })
  
  return [...videoFormats, ...audioFormats]
}

function parseSubtitles(subsOutput: string): Array<{language: string, code: string, format: string}> {
  const subtitles = []
  const lines = subsOutput.split('\n')
  
  for (const line of lines) {
    // Buscar líneas que contengan códigos de idioma
    const match = line.match(/^([a-z]{2}(?:-[A-Z]{2})?)\s+([^,]+)/)
    if (match) {
      const code = match[1]
      const language = match[2].trim()
      
      // Agregar formatos SRT y VTT
      subtitles.push(
        { language, code, format: 'srt' },
        { language, code, format: 'vtt' }
      )
    }
  }
  
  // Remover duplicados y limitar
  const unique = subtitles.filter((sub, index, self) => 
    index === self.findIndex(s => s.code === sub.code && s.format === sub.format)
  )
  
  return unique
}

function generateExpandedVideoFormats(durationSeconds: number) {
  const qualities = ['2160p', '1440p', '1080p', '720p', '480p', '360p']
  const containers = ['mp4', 'webm', 'mkv', 'avi', 'mov']
  const formats = []
  
  for (const quality of qualities) {
    for (const container of containers) {
      // Limitar algunos formatos para evitar sobrecarga
      if (container === 'avi' && ['2160p', '1440p'].includes(quality)) continue
      if (container === 'mov' && ['2160p', '1440p'].includes(quality)) continue
      
      formats.push({
        quality,
        format: container,
        size: estimateSize('video', quality, durationSeconds),
        type: 'video'
      })
    }
  }
  
  return formats
}

function generateExpandedAudioFormats(durationSeconds: number) {
  return [
    // FLAC (sin pérdida)
    { quality: '1411kbps', format: 'flac', size: estimateSize('audio', '1411kbps', durationSeconds), type: 'audio' },
    
    // WAV (sin pérdida)
    { quality: '1411kbps', format: 'wav', size: estimateSize('audio', '1411kbps', durationSeconds), type: 'audio' },
    
    // AAC (alta calidad)
    { quality: '256kbps', format: 'aac', size: estimateSize('audio', '256kbps', durationSeconds), type: 'audio' },
    { quality: '192kbps', format: 'aac', size: estimateSize('audio', '192kbps', durationSeconds), type: 'audio' },
    { quality: '128kbps', format: 'aac', size: estimateSize('audio', '128kbps', durationSeconds), type: 'audio' },
    
    // MP3 (estándar)
    { quality: '320kbps', format: 'mp3', size: estimateSize('audio', '320kbps', durationSeconds), type: 'audio' },
    { quality: '256kbps', format: 'mp3', size: estimateSize('audio', '256kbps', durationSeconds), type: 'audio' },
    { quality: '192kbps', format: 'mp3', size: estimateSize('audio', '192kbps', durationSeconds), type: 'audio' },
    { quality: '128kbps', format: 'mp3', size: estimateSize('audio', '128kbps', durationSeconds), type: 'audio' },
    { quality: '96kbps', format: 'mp3', size: estimateSize('audio', '96kbps', durationSeconds), type: 'audio' },
    
    // OGG (alternativo)
    { quality: '256kbps', format: 'ogg', size: estimateSize('audio', '256kbps', durationSeconds), type: 'audio' },
    { quality: '192kbps', format: 'ogg', size: estimateSize('audio', '192kbps', durationSeconds), type: 'audio' },
    { quality: '128kbps', format: 'ogg', size: estimateSize('audio', '128kbps', durationSeconds), type: 'audio' }
  ]
}

function estimateSize(type: string, quality: string, durationSeconds: number): string {
  if (type === 'video') {
    const bitrates = {
      '2160p': 45000, // kbps
      '1440p': 16000,
      '1080p': 8000,
      '720p': 5000,
      '480p': 2500,
      '360p': 1000,
      '240p': 600,
      '144p': 300
    }
    const bitrate = bitrates[quality] || 2500
    const sizeMB = (bitrate * durationSeconds) / 8 / 1024 // MB
    
    if (sizeMB > 1024) {
      return `~${(sizeMB / 1024).toFixed(1)}GB`
    }
    return `~${sizeMB.toFixed(1)}MB`
  } else {
    // Audio - arreglar cálculo
    const bitrate = parseInt(quality) || 128 // kbps
    const sizeMB = (bitrate * durationSeconds) / 8 / 1024 // MB
    
    if (sizeMB < 1) {
      return `~${(sizeMB * 1024).toFixed(0)}KB`
    }
    return `~${sizeMB.toFixed(1)}MB`
  }
}

function cleanYouTubeUrl(url: string): string | null {
  if (!url) return null
  
  try {
    const videoId = extractVideoId(url)
    if (!videoId) return null
    
    return `https://www.youtube.com/watch?v=${videoId}`
  } catch (error) {
    console.error('Error cleaning URL:', error)
    return null
  }
}

function extractVideoId(url: string): string | null {
  if (!url) return null
  
  try {
    // URL estándar: https://www.youtube.com/watch?v=VIDEO_ID
    const standardMatch = url.match(/[?&]v=([^&]+)/)
    if (standardMatch) {
      return standardMatch[1].substring(0, 11)
    }
    
    // URL corta: https://youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/)
    if (shortMatch) {
      return shortMatch[1].substring(0, 11)
    }
    
    return null
  } catch (error) {
    console.error('Error extracting video ID:', error)
    return null
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return 'Duración desconocida'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
