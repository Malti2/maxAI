// Dictation via the browser's Web Speech API.
//
// Chrome, Edge and Safari expose it (behind the webkit prefix in Safari);
// Firefox does not. Everything is guarded so the mic button simply never
// appears where dictation is unavailable — no polyfill, no extra dependency.

interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getConstructor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isDictationSupported(): boolean {
  return getConstructor() !== null;
}

export interface Dictation {
  stop: () => void;
}

/**
 * Start dictating. `onTranscript` receives the full transcript of the current
 * session (interim results included) so the caller can replace, not append.
 * Returns null when the browser cannot dictate.
 */
export function startDictation(handlers: {
  onTranscript: (text: string) => void;
  onEnd?: () => void;
  lang?: string;
}): Dictation | null {
  const Ctor = getConstructor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = handlers.lang || navigator.language || 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalText = '';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? '';
      if (result.isFinal) finalText += transcript;
      else interim += transcript;
    }
    handlers.onTranscript((finalText + interim).trim());
  };

  const end = () => {
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    handlers.onEnd?.();
  };
  recognition.onerror = end;
  recognition.onend = end;

  recognition.start();
  return { stop: () => recognition.stop() };
}
