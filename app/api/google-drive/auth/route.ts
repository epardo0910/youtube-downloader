import { NextRequest, NextResponse } from 'next/server'
import GoogleDriveManager from '@/lib/google-drive'

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Código de autorización requerido' },
        { status: 400 }
      )
    }

    const result = await GoogleDriveManager.exchangeCodeForTokens(code)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in Google Drive auth:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const authUrl = GoogleDriveManager.getAuthUrl()
    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Error getting auth URL:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
