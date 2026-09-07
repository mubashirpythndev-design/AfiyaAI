"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Language } from "./types";
import { transcribeAudio } from "./api";

interface SpeechRecognitionResultItem {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export interface UseSpeechRecognitionOptions {
  language?: Language;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onEnd?: (finalTranscript: string) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition({
  language = "en",
  onResult,
  onEnd,
  onError,
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    const win = window as unknown as SpeechRecognitionWindow;
    return Boolean(
      win.SpeechRecognition ||
      win.webkitSpeechRecognition ||
      (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia)
    );
  });

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const interimTranscriptRef = useRef<string>("");
  const prefersMediaRecorderRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (localStorage.getItem("afiya_voice_engine") === "gemini") {
          prefersMediaRecorderRef.current = true;
        }
      } catch {}
    }
  }, []);

  const getSpeechLang = useCallback((lang: Language): string => {
    switch (lang) {
      case "ur":
      case "roman_ur":
        return "ur-PK";
      case "en":
      default:
        return "en-US";
    }
  }, []);

  const stopAudioVisualizer = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const startAudioVisualizer = useCallback((stream: MediaStream) => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 85) * 100));
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      animFrameRef.current = requestAnimationFrame(updateVolume);
    } catch (err) {
      console.warn("Audio visualizer setup skipped:", err);
    }
  }, []);

  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
  }, []);

  const startMediaRecorderFallback = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const msg = "Audio recording is not supported on this device.";
      setError(msg);
      onError?.(msg);
      setIsListening(false);
      return;
    }

    try {
      prefersMediaRecorderRef.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      startAudioVisualizer(stream);
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        stopAudioVisualizer();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const recordedBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });

        if (recordedBlob.size < 400) {
          return;
        }

        setIsTranscribing(true);
        try {
          const res = await transcribeAudio(recordedBlob, language);
          const recognized = res.transcript?.trim() || "";
          if (recognized) {
            setTranscript(recognized);
            finalTranscriptRef.current = recognized;
            onEnd?.(recognized);
          } else if (res.error && (res.error.includes("429") || res.error.includes("quota") || res.error.includes("Quota"))) {
            const quotaMsg =
              language === "ur"
                ? "روزانہ مفت API کوٹہ مکمل ہو گیا ہے، برائے مہربانی کل کوشش کریں۔"
                : language === "roman_ur"
                ? "Daily free API quota mukammal ho gaya hai, kal dobara try karein."
                : "Gemini API daily free quota reached (resets tomorrow).";
            setError(quotaMsg);
            onError?.(quotaMsg);
          } else {
            const noSpeechMsg =
              language === "ur"
                ? "کوئی واضح آواز سنائی نہیں دی، دوبارہ بولیں۔"
                : language === "roman_ur"
                ? "Awaz theek se suni nahi gayi, dobara bolein."
                : "No clear speech detected, please try speaking again.";
            setError(noSpeechMsg);
            onError?.(noSpeechMsg);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Audio transcription failed.";
          setError(errMsg);
          onError?.(errMsg);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(200);
      setIsListening(true);
      setError(null);
    } catch (err) {
      console.error("Microphone recording error:", err);
      const deniedMsg = "Microphone access was denied. Please allow microphone permissions.";
      setError(deniedMsg);
      onError?.(deniedMsg);
      setIsListening(false);
    }
  }, [language, onResult, onEnd, onError, startAudioVisualizer, stopAudioVisualizer]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }
    stopMediaRecorder();
    stopAudioVisualizer();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, [stopMediaRecorder, stopAudioVisualizer]);

  const startListening = useCallback(
    async (customLang?: string) => {
      if (typeof window === "undefined") return;

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      setError(null);
      setTranscript("");
      setInterimTranscript("");
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";

      const win = window as unknown as SpeechRecognitionWindow;
      const SpeechConstructor = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (prefersMediaRecorderRef.current || !SpeechConstructor) {
        await startMediaRecorderFallback();
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      try {
        const recognition = new SpeechConstructor();
        // Keep listening continuously so sentences and pauses are never cut off
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = customLang || getSpeechLang(language);

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let completeFinal = "";
          let completeInterim = "";

          for (let i = 0; i < event.results.length; ++i) {
            const res = event.results[i];
            const text = res[0]?.transcript || "";
            if (res.isFinal) {
              completeFinal += (completeFinal ? " " : "") + text.trim();
            } else {
              completeInterim += (completeInterim ? " " : "") + text.trim();
            }
          }

          finalTranscriptRef.current = completeFinal.trim();
          interimTranscriptRef.current = completeInterim.trim();

          const combined = (completeFinal + " " + completeInterim).trim();
          if (combined) {
            setTranscript(combined);
            setInterimTranscript(completeInterim.trim());
            onResult?.(combined, false);

            // Auto-stop countdown after 2.4s of complete silence following speech
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }
            silenceTimerRef.current = setTimeout(() => {
              stopListening();
            }, 2400);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error === "network") {
            console.warn("Web Speech API network error on this connection. Upgrading to Gemini audio engine.");
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("afiya_voice_engine", "gemini");
              } catch {}
            }
            prefersMediaRecorderRef.current = true;
            recognition.onend = null;
            recognition.onerror = null;
            try {
              recognition.abort();
            } catch {}
            recognitionRef.current = null;
            setIsListening(false);

            const promptMsg =
              language === "ur"
                ? "مائیکروفون AI انجن پر فعال ہو گیا ہے۔ براہ کرم دوبارہ کلک کر کے بولیں۔"
                : language === "roman_ur"
                ? "AI audio engine activate ho gaya. Mic click kar ke dobara bolein."
                : "Switched to AI audio engine. Tap the mic to speak now.";
            setError(promptMsg);
            onError?.(promptMsg);
            return;
          }

          // Non-blocking no-speech event when listening continuously
          if (event.error === "no-speech") {
            return;
          }

          let errorMsg = "Voice recognition error.";
          switch (event.error) {
            case "not-allowed":
            case "permission-denied":
              errorMsg = "Microphone permission was denied. Please allow microphone access in browser settings.";
              break;
            case "audio-capture":
              errorMsg = "No microphone was found on this device.";
              break;
            default:
              errorMsg = "Voice recognition error: " + event.error;
          }
          setError(errorMsg);
          onError?.(errorMsg);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }

          // Crucial fallback: preserve interim transcript if final is empty
          const recognized = finalTranscriptRef.current.trim() || interimTranscriptRef.current.trim();
          if (recognized) {
            onEnd?.(recognized);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn("Failed to start Web Speech API, using MediaRecorder fallback:", err);
        await startMediaRecorderFallback();
      }
    },
    [
      language,
      getSpeechLang,
      startMediaRecorderFallback,
      startAudioVisualizer,
      stopListening,
      onResult,
      onEnd,
      onError,
    ]
  );

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      stopMediaRecorder();
      stopAudioVisualizer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [stopMediaRecorder, stopAudioVisualizer]);

  return {
    isListening,
    isTranscribing,
    transcript,
    interimTranscript,
    audioLevel,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
