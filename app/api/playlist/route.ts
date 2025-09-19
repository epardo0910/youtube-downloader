import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    // Limpiar y validar URL de playlist
    const cleanUrl = cleanPlaylistUrl(url)
    
    if (!cleanUrl) {
      return NextResponse.json(
        { error: 'URL de playlist de YouTube inválida' },
        { status: 400 }
      )
    }

    console.log('Analyzing playlist:', cleanUrl)

    // Obtener información de la playlist
    let playlistInfo = null
    let success = false

    const strategies = [
      // Estrategia 1: Cliente web básico
      `yt-dlp --dump-json --flat-playlist --no-playlist --extractor-args "youtube:player_client=web" "${cleanUrl}"`,
      
      // Estrategia 2: Cliente móvil
      `yt-dlp --dump-json --flat-playlist --no-playlist --extractor-args "youtube:player_client=mweb" "${cleanUrl}"`,
      
      // Estrategia 3: Sin argumentos especiales
      `yt-dlp --dump-json --flat-playlist --no-playlist "${cleanUrl}"`
    ]

    for (const strategy of strategies) {
      try {
        console.log('Trying strategy for playlist info...')
        
        const { stdout } = await execAsync(strategy, {
          timeout: 30000,
          maxBuffer: 1024 * 1024 * 10
        })
        
        const lines = stdout.trim().split('\n')
        const jsonLines = lines.filter(line => line.startsWith('{') && line.endsWith('}'))
        
        if (jsonLines.length > 0) {
          playlistInfo = JSON.parse(jsonLines[0])
          success = true
          break
        }
        
      } catch (error) {
        console.log('Strategy failed:', error.message.substring(0, 100))
        continue
      }
    }

    if (!success || !playlistInfo) {
      throw new Error('No se pudo obtener información de la playlist')
    }

    // Obtener videos de la playlist
    console.log('Getting playlist videos...')
    const { stdout: videosOutput } = await execAsync(
      `yt-dlp --dump-json --flat-playlist --extractor-args "youtube:player_client=web" "${cleanUrl}"`, 
      {
        timeout: 45000,
        maxBuffer: 1024 * 1024 * 15
      }
    )

    const videoLines = videosOutput.trim().split('\n')
    const videos = videoLines
      .filter(line => line.startsWith('{') && line.endsWith('}'))
      .map((line, index) => {
        try {
          const video = JSON.parse(line)
          return {
            id: video.id || `video_${index}`,
            title: video.title || `Video ${index + 1}`,
            duration: formatDuration(video.duration || 0),
            thumbnail: video.thumbnail || video.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            uploader: video.uploader || video.channel || 'Canal desconocido',
            index: index + 1
          }
        } catch (error) {
          console.log('Error parsing video:', error)
          return null
        }
      })
      .filter(video => video !== null)
      .slice(0, 50) // Límite de 50 videos por playlist

    const response = {
      title: playlistInfo.title || 'Playlist de YouTube',
      description: playlistInfo.description || '',
      thumbnail: playlistInfo.thumbnail || playlistInfo.thumbnails?.[0]?.url || videos[0]?.thumbnail,
      uploader: playlistInfo.uploader || playlistInfo.channel || 'Canal de YouTube',
      videoCount: videos.length,
      videos: videos,
      playlistId: extractPlaylistId(cleanUrl)
    }

    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Error analyzing playlist:', error)
    
    let errorMessage = 'Error al analizar la playlist.'
    
    if (error.message.includes('timeout')) {
      errorMessage = 'El análisis de la playlist tardó demasiado. Intenta con una playlist más pequeña.'
    } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
      errorMessage = 'YouTube está limitando las peticiones. Intenta de nuevo en unos minutos.'
    } else if (error.message.includes('Private playlist')) {
      errorMessage = 'Esta playlist es privada y no se puede acceder.'
    } else if (error.message.includes('Playlist unavailable')) {
      errorMessage = 'La playlist no está disponible o ha sido eliminada.'
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

function cleanPlaylistUrl(url: string): string | null {
  if (!url) return null
  
  try {
    const playlistId = extractPlaylistId(url)
    if (!playlistId) return null
    
    return `https://www.youtube.com/playlist?list=${playlistId}`
  } catch (error) {
    console.error('Error cleaning playlist URL:', error)
    return null
  }
}

function extractPlaylistId(url: string): string | null {
  if (!url) return null
  
  try {
    // URL de playlist: https://www.youtube.com/playlist?list=PLAYLIST_ID
    const playlistMatch = url.match(/[?&]list=([^&]+)/)
    if (playlistMatch) {
      return playlistMatch[1]
    }
    
    // URL de video con playlist: https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID
    const videoPlaylistMatch = url.match(/[?&]list=([^&]+)/)
    if (videoPlaylistMatch) {
      return videoPlaylistMatch[1]
    }
    
    return null
  } catch (error) {
    console.error('Error extracting playlist ID:', error)
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
