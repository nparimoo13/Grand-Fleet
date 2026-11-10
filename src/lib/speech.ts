/**
 * Speech-to-text boundary. The polish phase will provide a Web Speech API
 * implementation; a local Whisper engine can be added behind the same interface.
 * No text-to-speech.
 */
export interface SpeechToText {
  readonly available: boolean
  start(onResult: (text: string, isFinal: boolean) => void, onError: (error: Error) => void): void
  stop(): void
}

export const stubSpeechToText: SpeechToText = {
  available: false,
  start: (_onResult, onError) => onError(new Error('Voice input is not available yet.')),
  stop: () => undefined
}
