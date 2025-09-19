import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { createWriteStream, unlinkSync, existsSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { url, type, quality, format, subtitleLang } = await request.json()

    if (!url || !type || !quality) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    const cleanUrl = cleanYouTubeUrl(url)
    if (!cleanUrl) {
      return NextResponse.json(
        { error: 'URL de YouTube inválida' },
        { status: 400 }
      )
    }

    console.log(`Starting download: ${type}, quality: ${quality}, format: ${format || 'default'}`)

    // Generar nombre de archivo único
    const timestamp = Date.now()
    const videoId = extractVideoId(cleanUrl)
    let outputPath = ''
    let finalExtension = ''

    // Configurar formato según el tipo y formato solicitado
    let formatArgs = ''
    
    if (type === 'video') {
      finalExtension = format || 'mp4'
      outputPath = `/tmp/video_${videoId}_${timestamp}.${finalExtension}`
      
      // Configuración para diferentes formatos de video
      const videoFormats = {
        'mp4': {
          '2160p': 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160][ext=mp4]',
          '1440p': 'bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[height<=1440][ext=mp4]',
          '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]',
          '720p': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]',
          '480p': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]',
          '360p': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]'
        },
        'webm': {
          '2160p': 'bestvideo[height<=2160][ext=webm]+bestaudio[ext=webm]/best[height<=2160][ext=webm]',
          '1440p': 'bestvideo[height<=1440][ext=webm]+bestaudio[ext=webm]/best[height<=1440][ext=webm]',
          '1080p': 'bestvideo[height<=1080][ext=webm]+bestaudio[ext=webm]/best[height<=1080][ext=webm]',
          '720p': 'bestvideo[height<=720][ext=webm]+bestaudio[ext=webm]/best[height<=720][ext=webm]',
          '480p': 'bestvideo[height<=480][ext=webm]+bestaudio[ext=webm]/best[height<=480][ext=webm]',
          '360p': 'bestvideo[height<=360][ext=webm]+bestaudio[ext=webm]/best[height<=360][ext=webm]'
        },
        'mkv': {
          '2160p': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
          '1440p': 'bestvideo[height<=1440]+bestaudio/best[height<=1440]',
          '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
          '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
          '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
          '360p': 'bestvideo[height<=360]+bestaudio/best[height<=360]'
        },
        'avi': {
          '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
          '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
          '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
          '360p': 'bestvideo[height<=360]+bestaudio/best[height<=360]'
        },
        'mov': {
          '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
          '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
          '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
          '360p': 'bestvideo[height<=360]+bestaudio/best[height<=360]'
        }
      }
      
      const selectedFormat = videoFormats[finalExtension]?.[quality] || videoFormats['mp4'][quality] || videoFormats['mp4']['720p']
      
      if (finalExtension === 'mkv' || finalExtension === 'avi' || finalExtension === 'mov') {
        formatArgs = `-f "${selectedFormat}" --merge-output-format ${finalExtension}`
      } else {
        formatArgs = `-f "${selectedFormat}"`
      }
      
    } else if (type === 'audio') {
      finalExtension = format || 'mp3'
      outputPath = `/tmp/audio_${videoId}_${timestamp}.${finalExtension}`
      
      // Configuración para diferentes formatos de audio
      const audioBitrates = {
        '1411kbps': '1411', // Para FLAC/WAV
        '320kbps': '320',
        '256kbps': '256',
        '192kbps': '192',
        '128kbps': '128',
        '96kbps': '96',
        '64kbps': '64'
      }
      
      const bitrate = audioBitrates[quality] || '128'
      
      if (finalExtension === 'flac') {
        formatArgs = `-f "bestaudio/best" --extract-audio --audio-format flac`
      } else if (finalExtension === 'wav') {
        formatArgs = `-f "bestaudio/best" --extract-audio --audio-format wav`
      } else if (finalExtension === 'aac') {
        formatArgs = `-f "bestaudio/best" --extract-audio --audio-format aac --audio-quality ${bitrate}K`
      } else if (finalExtension === 'ogg') {
        formatArgs = `-f "bestaudio/best" --extract-audio --audio-format vorbis --audio-quality ${bitrate}K`
      } else {
        // MP3 por defecto
        formatArgs = `-f "bestaudio/best" --extract-audio --audio-format mp3 --audio-quality ${bitrate}K`
      }
      
    } else if (type === 'subtitle') {
      finalExtension = format || 'srt'
      outputPath = `/tmp/subtitle_${videoId}_${timestamp}.${finalExtension}`
      
      const subLang = subtitleLang || 'en'
      formatArgs = `--write-subs --sub-langs "${subLang}" --sub-format "${finalExtension}" --skip-download`
    }

    // Comando de descarga
    const downloadCommand = `yt-dlp ${formatArgs} --output "${outputPath}" --extractor-args "youtube:player_client=web" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${cleanUrl}"`

    console.log('Download command:', downloadCommand)

    // Ejecutar descarga
    const { stdout, stderr } = await execAsync(downloadCommand, {
      timeout: 120000, // 2 minutos
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    })

    console.log('Download completed:', stdout)

    // Verificar que el archivo existe
    if (!existsSync(outputPath)) {
      // Para subtítulos, el archivo puede tener un nombre diferente
      if (type === 'subtitle') {
        const possiblePaths = [
          outputPath.replace(`.${finalExtension}`, `.${subtitleLang || 'en'}.${finalExtension}`),
          outputPath.replace(`.${finalExtension}`, `.${finalExtension}`)
        ]
        
        for (const path of possiblePaths) {
          if (existsSync(path)) {
            outputPath = path
            break
          }
        }
      }
      
      if (!existsSync(outputPath)) {
        throw new Error('El archivo descargado no se encontró')
      }
    }

    // Leer el archivo y enviarlo como respuesta
    const fs = require('fs')
    const fileBuffer = fs.readFileSync(outputPath)

    // Limpiar archivo temporal
    try {
      unlinkSync(outputPath)
    } catch (cleanupError) {
      console.log('Could not cleanup file:', cleanupError)
    }

    // Determinar Content-Type
    const contentTypes = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mkv': 'video/x-matroska',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'mp3': 'audio/mpeg',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'srt': 'text/plain',
      'vtt': 'text/vtt'
    }

    const contentType = contentTypes[finalExtension] || 'application/octet-stream'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${videoId}_${quality}.${finalExtension}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('Error downloading:', error)
    
    let errorMessage = 'Error al descargar el contenido.'
    
    if (error.message.includes('timeout')) {
      errorMessage = 'La descarga tardó demasiado tiempo. Intenta con una calidad menor.'
    } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
      errorMessage = 'YouTube está limitando las descargas desde este servidor.'
    } else if (error.message.includes('ENOSPC')) {
      errorMessage = 'No hay suficiente espacio en disco para completar la descarga.'
    } else if (error.message.includes('No such file')) {
      errorMessage = 'El formato solicitado no está disponible para este video.'
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
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
