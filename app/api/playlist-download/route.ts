import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { createWriteStream, unlinkSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { playlistId, format, quality, videoRange } = await request.json()

    if (!playlistId || !format || !quality) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`
    
    // Configurar rango de videos
    let rangeArgs = ''
    if (videoRange && videoRange.start && videoRange.end) {
      rangeArgs = `--playlist-start ${videoRange.start} --playlist-end ${videoRange.end}`
    }

    console.log(`Starting playlist download: ${playlistId}, format: ${format}, quality: ${quality}`)

    // Configurar formato según el tipo
    let formatArgs = ''
    let outputTemplate = ''
    let fileExtension = ''

    if (format === 'video') {
      // Configuración para video
      const videoFormats = {
        '2160p': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
        '1440p': 'bestvideo[height<=1440]+bestaudio/best[height<=1440]',
        '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
        '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
        '360p': 'bestvideo[height<=360]+bestaudio/best[height<=360]'
      }
      
      formatArgs = `-f "${videoFormats[quality] || videoFormats['720p']}" --merge-output-format mp4`
      outputTemplate = '/tmp/playlist_%(playlist_index)s_%(title)s.%(ext)s'
      fileExtension = 'mp4'
      
    } else if (format === 'audio') {
      // Configuración para audio
      const audioBitrates = {
        '128kbps': '128',
        '96kbps': '96',
        '64kbps': '64'
      }
      
      const bitrate = audioBitrates[quality] || '128'
      formatArgs = `-f "bestaudio/best" --extract-audio --audio-format mp3 --audio-quality ${bitrate}K`
      outputTemplate = '/tmp/playlist_%(playlist_index)s_%(title)s.%(ext)s'
      fileExtension = 'mp3'
    }

    // Comando de descarga con progreso
    const downloadCommand = `yt-dlp ${formatArgs} ${rangeArgs} --no-playlist-reverse --output "${outputTemplate}" --extractor-args "youtube:player_client=web" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${playlistUrl}"`

    console.log('Download command:', downloadCommand)

    // Crear stream de respuesta para progreso en tiempo real
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      start(controller) {
        const child = exec(downloadCommand, {
          timeout: 1800000, // 30 minutos
          maxBuffer: 1024 * 1024 * 50 // 50MB buffer
        })

        let downloadedCount = 0
        let totalVideos = 0
        let currentVideo = ''
        let progress = 0

        child.stdout?.on('data', (data) => {
          const output = data.toString()
          console.log('yt-dlp output:', output)

          // Detectar total de videos
          const totalMatch = output.match(/\[download\] Downloading (\d+) videos/)
          if (totalMatch) {
            totalVideos = parseInt(totalMatch[1])
          }

          // Detectar video actual
          const videoMatch = output.match(/\[download\] Downloading video (\d+) of (\d+)/)
          if (videoMatch) {
            downloadedCount = parseInt(videoMatch[1])
            totalVideos = parseInt(videoMatch[2])
            currentVideo = `Video ${downloadedCount} de ${totalVideos}`
          }

          // Detectar progreso del video actual
          const progressMatch = output.match(/(\d+\.?\d*)%/)
          if (progressMatch) {
            progress = parseFloat(progressMatch[1])
          }

          // Enviar progreso
          const progressData = {
            type: 'progress',
            downloadedCount,
            totalVideos,
            currentVideo,
            progress,
            globalProgress: totalVideos > 0 ? Math.round(((downloadedCount - 1) / totalVideos * 100) + (progress / totalVideos)) : 0
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`))
        })

        child.stderr?.on('data', (data) => {
          const error = data.toString()
          console.error('yt-dlp error:', error)
          
          // Enviar errores no críticos
          if (!error.includes('WARNING')) {
            const errorData = {
              type: 'error',
              message: error
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
          }
        })

        child.on('close', (code) => {
          console.log(`Download process finished with code: ${code}`)
          
          if (code === 0) {
            const completeData = {
              type: 'complete',
              message: `Descarga completada: ${downloadedCount} videos descargados`,
              downloadedCount,
              totalVideos
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeData)}\n\n`))
          } else {
            const errorData = {
              type: 'error',
              message: `Error en la descarga (código: ${code})`
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
          }
          
          controller.close()
        })

        child.on('error', (error) => {
          console.error('Process error:', error)
          const errorData = {
            type: 'error',
            message: `Error del proceso: ${error.message}`
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
          controller.close()
        })
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('Error in playlist download:', error)
    
    let errorMessage = 'Error al descargar la playlist.'
    
    if (error.message.includes('timeout')) {
      errorMessage = 'La descarga tardó demasiado tiempo. Intenta con una playlist más pequeña.'
    } else if (error.message.includes('ENOSPC')) {
      errorMessage = 'No hay suficiente espacio en disco para completar la descarga.'
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
