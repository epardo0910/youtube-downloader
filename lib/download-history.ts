export interface DownloadHistoryItem {
  id: string
  title: string
  url: string
  type: 'video' | 'audio' | 'subtitle' | 'playlist'
  format: string
  quality: string
  size?: string
  thumbnail?: string
  author?: string
  duration?: string
  downloadDate: string
  status: 'completed' | 'failed' | 'in-progress'
  error?: string
  playlistInfo?: {
    playlistTitle: string
    videoCount: number
    downloadedCount: number
  }
}

class DownloadHistoryManager {
  private static readonly STORAGE_KEY = 'youtube-downloader-history'
  private static readonly MAX_ITEMS = 100

  static getHistory(): DownloadHistoryItem[] {
    if (typeof window === 'undefined') return []
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []
      
      const history = JSON.parse(stored) as DownloadHistoryItem[]
      return history.sort((a, b) => new Date(b.downloadDate).getTime() - new Date(a.downloadDate).getTime())
    } catch (error) {
      console.error('Error loading download history:', error)
      return []
    }
  }

  static addToHistory(item: Omit<DownloadHistoryItem, 'id' | 'downloadDate'>): void {
    if (typeof window === 'undefined') return

    try {
      const history = this.getHistory()
      const newItem: DownloadHistoryItem = {
        ...item,
        id: this.generateId(),
        downloadDate: new Date().toISOString()
      }

      history.unshift(newItem)
      
      // Mantener solo los últimos MAX_ITEMS elementos
      const trimmedHistory = history.slice(0, this.MAX_ITEMS)
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedHistory))
    } catch (error) {
      console.error('Error saving to download history:', error)
    }
  }

  static updateHistoryItem(id: string, updates: Partial<DownloadHistoryItem>): void {
    if (typeof window === 'undefined') return

    try {
      const history = this.getHistory()
      const index = history.findIndex(item => item.id === id)
      
      if (index !== -1) {
        history[index] = { ...history[index], ...updates }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history))
      }
    } catch (error) {
      console.error('Error updating download history:', error)
    }
  }

  static removeFromHistory(id: string): void {
    if (typeof window === 'undefined') return

    try {
      const history = this.getHistory()
      const filteredHistory = history.filter(item => item.id !== id)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredHistory))
    } catch (error) {
      console.error('Error removing from download history:', error)
    }
  }

  static clearHistory(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing download history:', error)
    }
  }

  static getHistoryStats() {
    const history = this.getHistory()
    const completed = history.filter(item => item.status === 'completed')
    const failed = history.filter(item => item.status === 'failed')
    
    const totalSize = completed.reduce((acc, item) => {
      if (item.size) {
        const sizeMatch = item.size.match(/(\d+(?:\.\d+)?)\s*(MB|GB|KB|MiB|GiB|KiB)/i)
        if (sizeMatch) {
          const value = parseFloat(sizeMatch[1])
          const unit = sizeMatch[2].toLowerCase()
          
          let bytes = 0
          switch (unit) {
            case 'kb':
            case 'kib':
              bytes = value * 1024
              break
            case 'mb':
            case 'mib':
              bytes = value * 1024 * 1024
              break
            case 'gb':
            case 'gib':
              bytes = value * 1024 * 1024 * 1024
              break
          }
          return acc + bytes
        }
      }
      return acc
    }, 0)

    return {
      totalDownloads: history.length,
      completedDownloads: completed.length,
      failedDownloads: failed.length,
      totalSizeBytes: totalSize,
      totalSizeFormatted: this.formatBytes(totalSize)
    }
  }

  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

export default DownloadHistoryManager
