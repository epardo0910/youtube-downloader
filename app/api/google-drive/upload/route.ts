import { NextRequest, NextResponse } from 'next/server'
import GoogleDriveManager from '@/lib/google-drive'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileName = formData.get('fileName') as string
    const mimeType = formData.get('mimeType') as string
    const title = formData.get('title') as string
    const author = formData.get('author') as string
    const type = formData.get('type') as 'video' | 'audio' | 'subtitle'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó archivo' },
        { status: 400 }
      )
    }

    // Convertir archivo a buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Subir a Google Drive
    const result = await GoogleDriveManager.uploadFile(
      buffer,
      fileName || file.name,
      mimeType || file.type,
      {
        title,
        author,
        type
      }
    )

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error uploading to Google Drive:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
