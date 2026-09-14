import { describe, it, expect } from 'vitest'
import {
  TopicSchema,
  ConceptSchema,
  CapabilitySchema,
  SessionSchema,
  SyncedGapSchema,
  SyncedSignalSchema,
  ProblemSchema,
  AttemptSchema,
  InteractionPreferencesRowSchema,
  schemas,
} from '../src/db/types.js'

describe('Database Types (Zod Schemas)', () => {
  describe('TopicSchema', () => {
    it('parses a valid topic', () => {
      const topic = TopicSchema.parse({
        id: 'git-basics',
        name: 'Git Basics',
        goal: null,
        deadline: null,
        created_at: '2026-06-07',
        last_session: null,
      })
      expect(topic.id).toBe('git-basics')
      expect(topic.name).toBe('Git Basics')
    })

    it('applies defaults for optional fields', () => {
      const topic = TopicSchema.parse({ id: 'test', name: 'Test' })
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
      expect(concept.difficulty).toBe(1)
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

    it('applies current concept defaults', () => {
      const concept = ConceptSchema.parse({
        id: 'test',
        topic_id: 'topic',
        title: 'Test',
      })
      expect(concept.difficulty).toBe(1)
      expect(concept.prerequisites).toEqual([])
      expect(concept.tags).toEqual([])
    })
  })

  describe('SessionSchema', () => {
    it('applies current lifecycle defaults', () => {
      const session = SessionSchema.parse({
        id: 1,
        topic_id: 'git-basics',
        mode: 'learn',
      })
      expect(session.phase).toBe('idle')
      expect(session.pending_action).toBe('none')
      expect(session.reconstruction_status).toBe('not_required')
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
    it('registers only current learner-state schemas', () => {
      expect(schemas.topics).toBe(TopicSchema)
      expect(schemas.concepts).toBe(ConceptSchema)
      expect(schemas.capabilities).toBe(CapabilitySchema)
      expect(schemas.sessions).toBe(SessionSchema)
      expect(schemas.interaction_preferences).toBe(InteractionPreferencesRowSchema)
      expect('reviews' in schemas).toBe(false)
      expect(schemas.synced_gaps).toBe(SyncedGapSchema)
      expect(schemas.synced_signals).toBe(SyncedSignalSchema)
      expect(schemas.problems).toBe(ProblemSchema)
      expect(schemas.attempts).toBe(AttemptSchema)
    })
  })
})
