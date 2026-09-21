export type GenerationPhase = 'refining' | 'loading' | 'rendering' | 'saving'

export interface GenerationProgress {
  phase: GenerationPhase
  step?: number
  totalSteps?: number
}

export type ProgressListener = (progress: GenerationProgress) => void
