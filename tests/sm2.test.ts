import { describe, it, expect } from 'vitest'
import { sm2, updateStatus, type ConceptStatus } from '../src/sm2.js'

describe('SM-2 Algorithm', () => {
  const today = '2026-06-07'

  describe('sm2()', () => {
    it('A2: grade 4 on first review → interval=1, repetitions=1, ef≈2.5', () => {
      const result = sm2(4, 2.5, 0, 0, today)
      expect(result.interval).toBe(1)
      expect(result.repetitions).toBe(1)
      // grade 4: ef + (0.1 - 1*(0.08+0.02)) = ef + 0 = 2.5
      expect(result.ef).toBeCloseTo(2.5, 1)
      expect(result.nextReview).toBe('2026-06-08')
    })

    it('grade 5 (perfect) → interval=1, ef increases', () => {
      const result = sm2(5, 2.5, 0, 0, today)
      expect(result.interval).toBe(1)
      expect(result.repetitions).toBe(1)
      expect(result.ef).toBeGreaterThan(2.5)
    })

    it('grade 3 (barely passed) → interval=1, ef decreases slightly', () => {
      const result = sm2(3, 2.5, 0, 0, today)
      expect(result.interval).toBe(1)
      expect(result.repetitions).toBe(1)
      expect(result.ef).toBeLessThan(2.5)
      expect(result.ef).toBeGreaterThanOrEqual(1.3)
    })

    it('grade < 3 (failed) → resets to interval=1, repetitions=0', () => {
      const result = sm2(2, 2.5, 10, 5, today)
      expect(result.interval).toBe(1)
      expect(result.repetitions).toBe(0)
    })

    it('grade 0 (complete blank) → resets, ef drops significantly', () => {
      const result = sm2(0, 2.5, 10, 5, today)
      expect(result.interval).toBe(1)
      expect(result.repetitions).toBe(0)
      expect(result.ef).toBeLessThan(2.0)
    })

    it('second successful review → interval=6', () => {
      const result = sm2(4, 2.5, 1, 1, today)
      expect(result.interval).toBe(6)
      expect(result.repetitions).toBe(2)
      expect(result.nextReview).toBe('2026-06-13')
    })

    it('third+ successful review → interval = round(interval * ef)', () => {
      const result = sm2(4, 2.5, 6, 2, today)
      expect(result.interval).toBe(Math.round(6 * 2.5)) // 15
      expect(result.repetitions).toBe(3)
    })

    it('ef never drops below 1.3', () => {
      const result = sm2(0, 1.3, 1, 1, today)
      expect(result.ef).toBeGreaterThanOrEqual(1.3)
    })

    it('nextReview is calculated from today parameter', () => {
      const result = sm2(4, 2.5, 0, 0, '2026-01-01')
      expect(result.nextReview).toBe('2026-01-02')
    })
  })

  describe('updateStatus()', () => {
    it('unseen → learning on first interaction (any grade)', () => {
      expect(updateStatus('unseen', 0, 0, 0)).toBe('learning')
      expect(updateStatus('unseen', 3, 0, 0)).toBe('learning')
      expect(updateStatus('unseen', 5, 0, 0)).toBe('learning')
    })

    it('learning → reviewing after 2+ successful reviews', () => {
      expect(updateStatus('learning', 3, 2, 1)).toBe('reviewing')
      expect(updateStatus('learning', 4, 3, 6)).toBe('reviewing')
    })

    it('learning stays learning with < 2 successful reviews', () => {
      expect(updateStatus('learning', 3, 0, 1)).toBe('learning')
      expect(updateStatus('learning', 3, 1, 1)).toBe('learning')
    })

    it('learning stays learning on failed grade', () => {
      expect(updateStatus('learning', 2, 0, 1)).toBe('learning')
    })

    it('reviewing → mastered with 5+ consecutive passes AND interval > 21', () => {
      expect(updateStatus('reviewing', 4, 5, 22)).toBe('mastered')
      expect(updateStatus('reviewing', 5, 6, 30)).toBe('mastered')
    })

    it('reviewing stays reviewing with interval ≤ 21', () => {
      expect(updateStatus('reviewing', 4, 5, 21)).toBe('reviewing')
    })

    it('reviewing stays reviewing with < 5 repetitions', () => {
      expect(updateStatus('reviewing', 4, 4, 22)).toBe('reviewing')
    })

    it('reviewing/mastered → learning on grade 0-1', () => {
      expect(updateStatus('reviewing', 0, 5, 22)).toBe('learning')
      expect(updateStatus('reviewing', 1, 3, 10)).toBe('learning')
      expect(updateStatus('mastered', 0, 10, 50)).toBe('learning')
      expect(updateStatus('mastered', 1, 8, 40)).toBe('learning')
    })

    it('mastered stays mastered on good grade', () => {
      expect(updateStatus('mastered', 4, 10, 50)).toBe('mastered')
    })
  })
})
