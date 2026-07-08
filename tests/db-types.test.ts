import { describe, it, expect } from 'vitest'
import {
  TopicSchema,
  ConceptSchema,
  SessionSchema,
  ReviewSchema,
  SyncedGapSchema,
  SyncedSignalSchema,
  ProblemSchema,
  AttemptSchema,
  schemas,
  type Topic,
  type Concept,
} from '../src/db/types.js'

describe('Database Types (Zod Schemas)', () => {
  describe('TopicSchema', () => {
    it('parses a valid topic', () => {
      const topic = TopicSchema.parse({
        id: 'git-basics',
        name: 'Git Basics',
        phase: 1,
        goal: null,
        deadline: null,
        created_at: '2026-06-07',
        last_session: null,
      })
      expect(topic.id).toBe('git-basics')
      expect(topic.phase).toBe(1)
    })

    it('applies defaults for optional fields', () => {
      const topic = TopicSchema.parse({ id: 'test', name: 'Test' })
      expect(topic.phase).toBe(1)
      expect(topic.goal).toBeNull()
      expect(topic.deadline).toBeNull()
    })
  })

  describe('ConceptSchema', () => {
    it('parses a valid concept with JSON string arrays', () => {
      const concept = ConceptSchema.parse({
        id: 'git-init',
        topic_id: 'git-basics',
        title: 'Initializing a Repository',
        prerequisites: '["git-commit"]',
        tags: '["core"]',
      })
      expect(concept.prerequisites).toEqual(['git-commit'])
      expect(concept.tags).toEqual(['core'])
      expect(concept.status).toBe('unseen')
      expect(concept.ef).toBe(2.5)
    })

    it('parses already-parsed arrays', () => {
      const concept = ConceptSchema.parse({
        id: 'test',
        topic_id: 'topic',
        title: 'Test',
        prerequisites: ['a', 'b'],
        tags: ['core'],
      })
      expect(concept.prerequisites).toEqual(['a', 'b'])
    })

    it('applies SM-2 defaults', () => {
      const concept = ConceptSchema.parse({
        id: 'test',
        topic_id: 'topic',
        title: 'Test',
      })
      expect(concept.ef).toBe(2.5)
      expect(concept.interval).toBe(0)
      expect(concept.repetitions).toBe(0)
      expect(concept.status).toBe('unseen')
    })
  })

  describe('SessionSchema', () => {
    it('parses a session with concepts_reviewed as JSON string', () => {
      const session = SessionSchema.parse({
        id: 1,
        topic_id: 'git-basics',
        mode: 'learn',
        concepts_reviewed: '["git-init", "git-commit"]',
      })
      expect(session.concepts_reviewed).toEqual(['git-init', 'git-commit'])
    })
  })

  describe('ProblemSchema', () => {
    it('parses a coding problem with test_cases', () => {
      const problem = ProblemSchema.parse({
        id: 'two-sum',
        type: 'coding',
        title: 'Two Sum',
        description: 'Find two numbers that add up to target',
        test_cases: '[{"input": "[2,7,11,15], 9", "output": "[0,1]"}]',
      })
      expect(problem.test_cases).toHaveLength(1)
      expect(problem.type).toBe('coding')
    })
  })

  describe('Schema registry', () => {
    it('has all 8 tables', () => {
      expect(Object.keys(schemas)).toHaveLength(8)
      expect(schemas.topics).toBe(TopicSchema)
      expect(schemas.concepts).toBe(ConceptSchema)
      expect(schemas.sessions).toBe(SessionSchema)
      expect(schemas.reviews).toBe(ReviewSchema)
      expect(schemas.synced_gaps).toBe(SyncedGapSchema)
      expect(schemas.synced_signals).toBe(SyncedSignalSchema)
      expect(schemas.problems).toBe(ProblemSchema)
      expect(schemas.attempts).toBe(AttemptSchema)
    })
  })
})
