import { useState, useCallback, useRef } from 'react';

// Extend Window to support webkitSpeechRecognition for TS
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface UseVoiceSearchProps {
  onResult: (text: string) => void;
  lang: string;
}

export function useVoiceSearch({ onResult, lang }: UseVoiceSearchProps) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    setError(null);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('voiceError'); // This key will be translated
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    // Map locales to correct format
    const localeMap: Record<string, string> = {
      en: 'en-IN',
      kn: 'kn-IN',
      hi: 'hi-IN',
      ta: 'ta-IN'
    };
    
    recognitionRef.current.lang = localeMap[lang] || 'en-IN';
    
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  }, [lang, onResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return { isListening, startListening, stopListening, error, isSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition) };
}
