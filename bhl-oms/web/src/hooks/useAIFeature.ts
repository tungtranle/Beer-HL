'use client'

import { useFeatureFlags } from './useFeatureFlags'

export function useAIFeature(flagKey: string) {
  const { flags, loading, error } = useFeatureFlags()
  return {
    enabled: Boolean(flags[flagKey]),
    loading,
    error,
  }
}
