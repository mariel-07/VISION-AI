import type { AnalysisRecord } from '../../core/domain/entities'

const STORAGE_KEY = 'vision-ai-analyses'
export class LocalAnalysisRepository {
  getAll(): AnalysisRecord[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as AnalysisRecord[] } catch { return [] }
  }
  save(record: AnalysisRecord): void {
    const records = this.getAll().filter(item => item.id !== record.id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...records]))
  }
}
