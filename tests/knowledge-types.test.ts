import { describe, it, expect } from 'vitest'
import {
  ConceptFrontmatterSchema,
  ManifestSchema,
  ConceptMapSchema,
} from '../src/knowledge/types.js'

describe('Knowledge Types', () => {
  describe('ConceptFrontmatterSchema', () => {
    it('parses valid frontmatter', () => {
      const fm = ConceptFrontmatterSchema.parse({
        id: 'git-init',
        title: 'Initializing a Repository',
        difficulty: 1,
        prerequisites: [],
        tags: ['core'],
      })
      expect(fm.id).toBe('git-init')
      expect(fm.difficulty).toBe(1)
    })

    it('defaults prerequisites and tags to empty arrays', () => {
      const fm = ConceptFrontmatterSchema.parse({
        id: 'test',
        title: 'Test',
        difficulty: 3,
      })
      expect(fm.prerequisites).toEqual([])
      expect(fm.tags).toEqual([])
    })

    it('rejects difficulty outside 1-5', () => {
      expect(() =>
        ConceptFrontmatterSchema.parse({
          id: 'test',
          title: 'Test',
          difficulty: 0,
        })
      ).toThrow()
      expect(() =>
        ConceptFrontmatterSchema.parse({
          id: 'test',
          title: 'Test',
          difficulty: 6,
        })
      ).toThrow()
    })
  })

  describe('ManifestSchema', () => {
    it('parses a valid manifest', () => {
      const manifest = ManifestSchema.parse({
        topic: 'git-basics',
        version: '1.0',
        description: 'Git fundamentals',
        concepts: [
          {
            id: 'git-init',
            title: 'Initializing a Repository',
            file: 'concepts/git-init.md',
            prerequisites: [],
            difficulty: 1,
            tags: ['core'],
          },
        ],
      })
      expect(manifest.concepts).toHaveLength(1)
      expect(manifest.topic).toBe('git-basics')
    })
  })

  describe('ConceptMapSchema', () => {
    it('parses a proposed decomposition', () => {
      const map = ConceptMapSchema.parse({
        topic: 'rag-systems',
        description: 'RAG system design',
        concepts: [
          {
            id: 'rag-basics',
            title: 'RAG Fundamentals',
            prerequisites: [],
            difficulty: 2,
            estimatedMinutes: 10,
            source: 'ai-feeds',
          },
        ],
      })
      expect(map.concepts).toHaveLength(1)
      expect(map.concepts[0].source).toBe('ai-feeds')
    })
  })
})
