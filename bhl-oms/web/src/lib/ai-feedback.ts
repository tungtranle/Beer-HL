import { getToken } from '@/lib/api'

interface AIFeedbackInput {
  featureId: string
  recommendationId?: string
  reason: string
  metadata?: Record<string, unknown>
}

export function sendAIFeedback(input: AIFeedbackInput) {
  if (typeof window === 'undefined') return

  const token = getToken()
  const body = JSON.stringify({
    feature_id: input.featureId,
    recommendation_id: input.recommendationId,
    reason: input.reason,
    metadata: input.metadata || {},
  })

  fetch('/v1/ml/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    keepalive: true,
  }).catch(() => undefined)
}