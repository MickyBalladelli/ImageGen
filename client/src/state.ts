import { signal } from '@mickyballadelli/matrix';

export const userPromptSignal = signal('');
export const enhancedPromptSignal = signal('');
export const imageUrlSignal = signal('');
export const isLoadingSignal = signal(false);
export const errorSignal = signal<string | null>(null);
