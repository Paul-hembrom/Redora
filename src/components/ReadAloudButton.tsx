import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Square, Loader2, AudioLines, Info, Pause, Play } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  playbackRate?: number;
  text: string;
  className?: string;
  iconSizeClasses?: string;
  containerRef?: React.RefObject<HTMLElement | null> | HTMLElement | null;
  idPrefix?: string;
}


const logInfo = (msg: string, data?: any) => {
  console.log('%c[SmartReadAloud]', 'color: #0ea5e9; font-weight: bold; background: #0ea5e91a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};

const logSuccess = (msg: string, data?: any) => {
  console.log('%c[SmartReadAloud]', 'color: #10b981; font-weight: bold; background: #10b9811a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};

const logWarning = (msg: string, data?: any) => {
  console.warn('%c[SmartReadAloud]', 'color: #f59e0b; font-weight: bold; background: #f59e0b1a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};

const logError = (msg: string, data?: any) => {
  console.error('%c[SmartReadAloud]', 'color: #ef4444; font-weight: bold; background: #ef44441a; padding: 2px 6px; border-radius: 4px;', msg, data || '');
};



const MATH_ALIASES: Record<string, string[]> = {
    // Basic Arithmetic and Algebra
    "squared": ["^2"],
    "cubed": ["^3"],
    "plus": ["+"],
    "minus": ["-"],
    "equals": ["="],
    "times": ["*", "\\times", "\\cdot"],
    "divided": ["/", "\\div"],
    "less": ["<", "≤", "\\leq"],
    "greater": [">", "≥", "\\geq"],
    "approximately": ["≈", "\\approx"],
    "equivalent": ["\\equiv"],
    "sub": ["_"],
    "root": ["\\sqrt"],
    "proportional": ["\\propto"],
    
    // Greek Letters
    "pi": ["π", "\\pi"],
    "alpha": ["\\alpha"],
    "beta": ["\\beta"],
    "gamma": ["\\gamma"],
    "theta": ["\\theta"],
    "mu": ["\\mu"],
    "sigma": ["\\sigma"],
    "omega": ["\\omega", "\\Omega"],
    "delta": ["\\Delta"],
    "lambda": ["\\lambda"],
    "rho": ["\\rho"],
    "phi": ["\\phi"],

    // Calculus and Advanced Math
    "infinity": ["∞", "\\infty"],
    "integral": ["\\int", "\\iint", "\\iiint", "\\oint"],
    "sum": ["\\sum"],
    "product": ["\\prod"],
    "limit": ["\\lim"],
    "approaches": ["\\to", "\\rightarrow"],
    "partial": ["\\partial"],
    "del": ["\\nabla"],
    "determinant": ["\\det"],

    // Trigonometry
    "sine": ["\\sin"],
    "cosine": ["\\cos"],
    "tangent": ["\\tan"],
    "cosecant": ["\\csc"],
    "secant": ["\\sec"],
    "cotangent": ["\\cot"],
    
    // Sets and Logic
    "union": ["\\cup"],
    "intersection": ["\\cap"],
    "subset": ["\\subset", "\\subseteq"],
    "superset": ["\\supset", "\\supseteq"],
    "element": ["\\in"],
    "empty": ["\\emptyset", "\\varnothing"],
    "implies": ["\\implies"],
    
    // Geometry
    "angle": ["\\angle"],
    "triangle": ["\\triangle"],
    "parallel": ["\\parallel"],
    "perpendicular": ["\\perp"],
    "degrees": ["°", "\\circ"],
    "similar": ["\\sim"],
    "congruent": ["\\cong"],
    
    // Number Systems
    "natural": ["\\mathbb{N}"],
    "integers": ["\\mathbb{Z}"],
    "rational": ["\\mathbb{Q}"],
    "real": ["\\mathbb{R}"],
    "complex": ["\\mathbb{C}"]
};

export function SmartReadAloudButton({ text, className, iconSizeClasses = "w-4 h-4", containerRef, idPrefix = "tts-sentence-", playbackRate = 0.8 }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [voicesAvailable, setVoicesAvailable] = useState(true);
  const [showPermissionWarning, setShowPermissionWarning] = useState(false);
  const [highQuality, setHighQuality] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const pausedStateRef = useRef<{ chunkIndex: number, wordIndex: number, currentTime: number } | null>(null);
  const resumeStateRef = useRef<{ chunkIndex: number, wordIndex: number } | null>(null);
  const currentChunkRef = useRef<any>(null);
  const playNextChunkRef = useRef<((chunkOverride?: any, wordIndexOverride?: number) => void) | null>(null);
  const audioQueueRef = useRef<any[]>([]);
  const chunksMapRef = useRef<Map<number, any>>(new Map());
  const animationFrameIdRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playSessionIdRef = useRef<number>(0);

  // Resolves the DOM root to search within. Falls back to `document` when no
  // containerRef is supplied, but scopes lookups to the given container/ref
  // when one is provided so multiple instances on the same page with
  // overlapping idPrefixes don't collide.
  const getScopeRoot = (): Document | HTMLElement => {
    if (!containerRef) return document;
    if (containerRef instanceof HTMLElement) return containerRef;
    return containerRef.current || document;
  };

  useEffect(() => {
    return () => stopPlaying();
  }, [text, idPrefix]);

  useEffect(() => {
    const checkVoices = () => {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();

        const logVoices = (vList: SpeechSynthesisVoice[]) => {
          logSuccess(`Found ${vList.length} voices loaded.`);
          if (vList.length > 0) {
            logInfo(`Available voice languages: ${Array.from(new Set(vList.map(v => v.lang))).join(', ')}`);
          }
        };

        if (voices.length === 0) {
          // Set the known state immediately instead of leaving it stuck at
          // the default `true` in case `voiceschanged` never fires.
          setVoicesAvailable(false);
          logInfo('No voices initially. Listening for voiceschanged event...');
          const handleVoicesChanged = () => {
            const updatedVoices = window.speechSynthesis.getVoices();
            logVoices(updatedVoices);
            setVoicesAvailable(updatedVoices.length > 0);
          };
          window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
          return () => window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        } else {
          logVoices(voices);
          setVoicesAvailable(true);
        }
      } else {
        logError('speechSynthesis API not found in this browser.');
        setVoicesAvailable(false);
      }
    };

    const cleanupVoices = checkVoices();

    const handleFocus = () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (cleanupVoices) cleanupVoices();
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    fetch('/api/tts/stream/prewarm', { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleInteraction = () => {
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    };
    window.addEventListener('touchstart', handleInteraction, { once: true, passive: true });
    window.addEventListener('click', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      const highlightOverlay = document.getElementById('tts-highlight-overlay');
      if (highlightOverlay) highlightOverlay.style.opacity = '0';
    };
  }, []);

  const clearAllHighlights = () => {
    document.querySelectorAll('.tts-word').forEach((el) => {
      const domSpan = el as HTMLElement;
      domSpan.style.background = '';
      domSpan.style.webkitBackgroundClip = '';
      domSpan.style.backgroundClip = '';
      domSpan.style.color = '';
      domSpan.classList.remove('bg-amber-400/70');
    });
  };

  const stopPlaying = () => {
    playSessionIdRef.current += 1;
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    clearAllHighlights();
    
    audioQueueRef.current = [];
    chunksMapRef.current.clear();
    
    const highlightOverlay = document.getElementById('tts-highlight-overlay');
    if (highlightOverlay) highlightOverlay.style.opacity = '0';
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
    pausedStateRef.current = null;
    resumeStateRef.current = null;
    currentChunkRef.current = null;
  };

  const handlePause = () => {
    if (!audioRef.current || !currentChunkRef.current) return;
    const currentTime = audioRef.current.currentTime;
    audioRef.current.pause();
    
    let lastSpokenWordIndex = -1;
    const timestamps = currentChunkRef.current.timestamps;
    
    if (timestamps && timestamps.length > 0) {
       for (let k = 0; k < timestamps.length; k++) {
          const start_time = timestamps[k].start_time !== undefined ? timestamps[k].start_time : timestamps[k].start;
          if (currentTime >= start_time) {
             lastSpokenWordIndex = k;
          } else {
             break;
          }
       }
    }
    
    let chunkIndex = currentChunkRef.current.index;
    if (timestamps && lastSpokenWordIndex === timestamps.length - 1) {
       const lastTs = timestamps[lastSpokenWordIndex];
       const lastEndTime = lastTs.end_time !== undefined ? lastTs.end_time : lastTs.end;
       if (lastEndTime === undefined || currentTime >= lastEndTime) {
          chunkIndex++;
          lastSpokenWordIndex = -1;
       }
    }

    pausedStateRef.current = { chunkIndex, wordIndex: lastSpokenWordIndex, currentTime };
    setIsPaused(true);
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  };

  const handleResume = () => {
    setIsPaused(false);
    if (pausedStateRef.current) {
       const { chunkIndex, wordIndex } = pausedStateRef.current;
       const targetWordIndex = wordIndex + 1;
       
       let targetChunk = null;
       if (currentChunkRef.current && currentChunkRef.current.index === chunkIndex) {
          targetChunk = currentChunkRef.current;
       } else {
          while (audioQueueRef.current.length > 0 && audioQueueRef.current[0].index < chunkIndex) {
             audioQueueRef.current.shift();
          }
          if (audioQueueRef.current.length > 0 && audioQueueRef.current[0].index === chunkIndex) {
             targetChunk = audioQueueRef.current.shift();
          }
       }
       
       if (targetChunk) {
          if (playNextChunkRef.current) {
             playNextChunkRef.current(targetChunk, targetWordIndex);
          }
       } else {
          resumeStateRef.current = { chunkIndex, wordIndex: targetWordIndex };
          if (playNextChunkRef.current) {
             playNextChunkRef.current();
          }
       }
       pausedStateRef.current = null;
    }
  };

  const tryCartesiaTTS = async () => {
    const currentSessionId = playSessionIdRef.current;
    logInfo('Triggered: Attempting Cartesia TTS API call...');
    try {
      setIsLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/tts/cartesia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, hq: highQuality })
      });
      if (!res.ok || !res.body) {
        throw new Error(`API returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let totalChunks = 0;
      audioQueueRef.current = [];
      chunksMapRef.current.clear();
      let isQueuePlaying = false;
      let expectedIndex = 0;

      let streamEnded = false;
      let disableSync = false;
      let failedChunks = 0;
      let playedChunks = 0;

      setIsLoading(false);
      setIsPlaying(true);

      const playNextChunk = async (chunkOverride?: any, wordIndexOverride?: number) => {
        if (currentSessionId !== playSessionIdRef.current) {
          setIsPlaying(false);
          isQueuePlaying = false;
          return;
        }

        let chunk;
        let resumeWordIndex = wordIndexOverride;

        if (chunkOverride) {
            chunk = chunkOverride;
            isQueuePlaying = true;
        } else {
            if (audioQueueRef.current.length === 0) {
              isQueuePlaying = false;
              if (streamEnded && expectedIndex >= totalChunks) {
                if (playedChunks === 0 && failedChunks > 0) {
                  showError('Audio unavailable for this content. Please try again later.');
                }
                setIsPlaying(false);
              }
              return;
            }
            isQueuePlaying = true;
            chunk = audioQueueRef.current.shift();
            
            if (resumeStateRef.current && resumeStateRef.current.chunkIndex === chunk.index) {
                resumeWordIndex = resumeStateRef.current.wordIndex;
                resumeStateRef.current = null;
            }
        }
        
        currentChunkRef.current = chunk;

        // Pre-load the next audio chunk while the current one is playing
        if (audioQueueRef.current.length > 0) {
            const nextAudio = new Audio();
            nextAudio.preload = 'auto';
            nextAudio.src = audioQueueRef.current[0].audioUrl;
        }

        const i = chunk.index;

        const domIndex = chunk.domIndex !== undefined ? chunk.domIndex : chunk.index;
        const scopeRoot = getScopeRoot();
        let sentenceEl = scopeRoot.querySelector(`[id="${idPrefix}${domIndex}"]`) as HTMLElement | null;
        if (!sentenceEl && idPrefix.startsWith("tts-explanation-")) {
            sentenceEl = scopeRoot.querySelector(`[id="${idPrefix}0"]`) as HTMLElement | null;
        }
        if (!sentenceEl) {
            sentenceEl = document.getElementById(`tts-sentence-${i}`) as HTMLElement | null;
        }
        if (!sentenceEl && wrapperRef.current) {
            // Fallback for ChatArea chat message bubbles
            const bubble = wrapperRef.current.closest('.group\\/bubble');
            if (bubble) {
                sentenceEl = bubble.querySelector('.prose') as HTMLElement | null;
            }
        }

        // Scrolling now happens in audio.onplay

        if (!chunk.audioUrl) {
          logWarning(`Chunk ${i} missing audioUrl.`);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
             isQueuePlaying = false;
             return;
          }
          playNextChunk();
          return;
        }

        
        if (i === 0) {
            console.log('[ReadAloud] Chunk 0 timestamps received:', chunk.timestamps?.length);
            if (chunk.timestamps?.length > 0) {
                console.log('[ReadAloud] First timestamp in chunk 0:', JSON.stringify(chunk.timestamps[0]));
            } else {
                console.warn('[ReadAloud] Missing or empty timestamps in chunk 0!');
            }
        }
        
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.style.display = 'none';
            document.body.appendChild(audioRef.current);
        }
        const audio = audioRef.current;
        audio.src = chunk.audioUrl;
        audio.playbackRate = playbackRate;
        audio.defaultPlaybackRate = playbackRate;

        console.log('[ReadAloud] Audio src length:', chunk.audioUrl?.length);
        console.log('[ReadAloud] Audio src starts with:', chunk.audioUrl?.substring(0, 50));

        audio.onloadedmetadata = () => {
            console.log('[ReadAloud] Audio duration:', audio.duration);
            if (resumeWordIndex !== undefined && chunk.timestamps && chunk.timestamps.length > resumeWordIndex) {
                const ts = chunk.timestamps[resumeWordIndex];
                const targetTime = ts.start_time !== undefined ? ts.start_time : ts.start;
                audio.currentTime = targetTime;
            }
        };

        

        const wordSpans: (HTMLElement | null)[] = new Array(chunk.timestamps ? chunk.timestamps.length : 0).fill(null);
        let shouldHighlight = !disableSync;

        // Remove old overlay if it exists
        const oldOverlay = document.getElementById('tts-highlight-overlay');
        if (oldOverlay) oldOverlay.remove();

        // Guard removed for markdown compatibility
        if (shouldHighlight && chunk.timestamps && chunk.timestamps.length > 0 && sentenceEl) {
            const walker = document.createTreeWalker(sentenceEl, NodeFilter.SHOW_TEXT, null);
            const textNodes = [];
            let node;
            while ((node = walker.nextNode())) {
                textNodes.push(node);
            }

            let fullText = "";
            const indexMap: {node: Node, offset: number}[] = [];
            for (const tNode of textNodes) {
                const txt = tNode.nodeValue || "";
                for (let k = 0; k < txt.length; k++) {
                    indexMap.push({ node: tNode, offset: k });
                }
                fullText += txt;
            }

            let searchIndex = 0;
            let chunkOffset = fullText.indexOf(chunk.text);
            if (chunkOffset === -1) chunkOffset = fullText.toLowerCase().indexOf(chunk.text.toLowerCase());
            if (chunkOffset !== -1) {
                searchIndex = chunkOffset;
            }

            // Pass 1: locate every word match in the *original* (unmutated)
            // text first. We must not wrap-as-we-go here, because wrapping
            // a word splits its text node and invalidates the node/offset
            // references we've already computed for later words.
            type Match = { tsIndex: number; start: number; end: number };
            const matches: Match[] = [];
            for (let tsIdx = 0; tsIdx < chunk.timestamps.length; tsIdx++) {
                const ts = chunk.timestamps[tsIdx];
                const word = ts.word ? ts.word.trim() : "";
                if (!word) continue;
                const wordEscaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                let regexPattern = wordEscaped;
                const aliases = MATH_ALIASES[word.toLowerCase()];
                if (aliases) {
                    const aliasPattern = aliases.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                    regexPattern = `(${regexPattern}|${aliasPattern})`;
                } else {
                    if (/^\w/.test(word)) regexPattern = `\\b${regexPattern}`;
                    if (/\w$/.test(word)) regexPattern = `${regexPattern}\\b`;
                }

                let matchIdx = -1;

                // FIX (word drift on repeated/short words -- e.g. math
                // content using single-letter set names A, B, C, D, E):
                // try an EXACT case-sensitive match first. Going straight to
                // a case-INSENSITIVE regex meant a timestamp word like "A"
                // (a set name) matched just as happily against the everyday
                // lowercase article "a" -- which shows up constantly in
                // ordinary sentences -- long before it ever reached the real
                // "A" being referred to. Since "a" is far more common than
                // "A" in this kind of content, that wrong-but-earlier match
                // is what dragged the search position backwards and caused
                // everything after it in the sentence to drift. Trying an
                // exact-case match first fixes that, while still falling
                // through to case-insensitive (and then plain substring
                // search) for legitimate case differences -- so nothing that
                // used to match stops matching, it's just no longer the
                // FIRST thing tried.
                try {
                    const regexCaseSensitive = new RegExp(regexPattern, "g");
                    regexCaseSensitive.lastIndex = searchIndex;
                    const match = regexCaseSensitive.exec(fullText);
                    if (match) {
                        matchIdx = match.index;
                    }
                } catch (e) {
                    // Ignore regex errors
                }

                if (matchIdx === -1) {
                    try {
                        const regexCaseInsensitive = new RegExp(regexPattern, "gi");
                        regexCaseInsensitive.lastIndex = searchIndex;
                        const match = regexCaseInsensitive.exec(fullText);
                        if (match) {
                            matchIdx = match.index;
                        }
                    } catch (e) {
                        // Ignore regex errors
                    }
                }

                if (matchIdx === -1) {
                    matchIdx = fullText.indexOf(word, searchIndex);
                }
                if (matchIdx === -1) {
                    matchIdx = fullText.toLowerCase().indexOf(word.toLowerCase(), searchIndex);
                }

                if (matchIdx !== -1) {
                    // Prevent word drift: if the match is too far ahead, it's likely a false positive
                    // from LLM normalization (e.g. LLM added "squared" and it matched a "squared" 100 chars later).
                    if (matchIdx - searchIndex > 80) {
                        matchIdx = -1; // Ignore this match, it's too far
                    } else {
                        matches.push({ tsIndex: tsIdx, start: matchIdx, end: matchIdx + word.length - 1 });
                        searchIndex = matchIdx + word.length;
                    }
                }
            }

            // Pass 2: wrap matches in *descending* start-offset order so
            // that mutating a later match's text node never invalidates the
            // node/offset references of matches earlier in the sentence
            // (splitting a node only ever affects the content after the
            // split point, never before it).
            const orderedForWrapping = [...matches].sort((a, b) => b.start - a.start);

            for (const m of orderedForWrapping) {
                const startNodeInfo = indexMap[m.start];
                const endNodeInfo = indexMap[m.end];
                if (!startNodeInfo || !endNodeInfo) continue;

                const range = document.createRange();
                range.setStart(startNodeInfo.node, startNodeInfo.offset);
                range.setEnd(endNodeInfo.node, endNodeInfo.offset + 1);

                let span: HTMLElement | null = null;
                // check if already wrapped
                if (startNodeInfo.node === endNodeInfo.node && startNodeInfo.node.parentElement && startNodeInfo.node.parentElement.classList.contains('tts-word')) {
                    span = startNodeInfo.node.parentElement;
                } else {
                    span = document.createElement('span');
                    span.className = 'tts-word transition-colors duration-100 ease-linear rounded';
                    span.id = `tts-word-${i}-${m.tsIndex}`;
                    try {
                        range.surroundContents(span);
                    } catch (e) {
                        span = null;
                    }
                }
                wordSpans[m.tsIndex] = span;
            }
        }

        const removeHighlights = () => {
            wordSpans.forEach((span, k) => {
                let domSpan = document.getElementById(`tts-word-${i}-${k}`);
                if (!domSpan) domSpan = span;
                if (domSpan) {
                    domSpan.classList.remove('bg-amber-400/70');
                    domSpan.style.background = '';
                    domSpan.style.webkitBackgroundClip = '';
                    domSpan.style.backgroundClip = '';
                    domSpan.style.color = '';
                }
            });
        };

        // 1. ADD THIS: Separate initial sentence scroll state from active word scroll state
        let hasScrolledInitial = false;
        let lastActiveSpan: HTMLElement | null = null;

        const highlightLoop = () => {
            if (currentSessionId !== playSessionIdRef.current || audio.paused || audio.ended) return;

            const currentTime = audio.currentTime;
            
            // 2. CHANGE THIS: Initial jump to ensure the start of the sentence is on screen
            if (currentTime > 0.05 && !hasScrolledInitial) {
               hasScrolledInitial = true;
               const scrollTarget: HTMLElement | null = wordSpans[0] || sentenceEl;
               if (scrollTarget) {
                 const rect = scrollTarget.getBoundingClientRect();
                 const margin = 80;
                 const alreadyVisible = rect.top >= margin && rect.bottom <= window.innerHeight - margin;
                 if (!alreadyVisible) {
                   scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 }
               }
            }

            if (chunk.timestamps && chunk.timestamps.length > 0) {
                chunk.timestamps.forEach((ts: any, k: number) => {
                    let span = document.getElementById(`tts-word-${i}-${k}`);
                    if (!span) span = wordSpans[k];
                    if (!span) return;

                    const start_time = ts.start_time !== undefined ? ts.start_time : ts.start;
                    const end_time = ts.end_time !== undefined ? ts.end_time : ts.end;

                    let startAdjusted = start_time;
                    let endAdjusted = end_time;

                    if (currentTime >= startAdjusted && currentTime < endAdjusted) {
                        const duration = endAdjusted - startAdjusted;
                        const progress = duration > 0 ? Math.max(0, Math.min(1, (currentTime - startAdjusted) / duration)) : 1;
                        span.style.background = `linear-gradient(to right, #FBBF24 ${progress * 100}%, transparent ${progress * 100}%)`;
                        span.style.webkitBackgroundClip = 'text';
                        span.style.backgroundClip = 'text';
                        span.style.color = 'transparent';
                        span.classList.remove('bg-amber-400/70');

                        // 3. ADD THIS: Active Tracking (The crucial fix for 3xl / Smartboards)
                        // If the word changes, check if it's falling off screen and recenter
                        if (span !== lastActiveSpan) {
                            lastActiveSpan = span;
                            const rect = span.getBoundingClientRect();
                            const margin = 120; // Generous margin for 3xl text
                            
                            // If the actively read word is too close to the top or bottom edges, recenter it dynamically
                            if (rect.bottom > window.innerHeight - margin || rect.top < margin) {
                                span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }

                    } else {
                        span.style.background = '';
                        span.style.webkitBackgroundClip = '';
                        span.style.backgroundClip = '';
                        span.style.color = '';
                        span.classList.remove('bg-amber-400/70');
                    }
                });
            }

            animationFrameIdRef.current = requestAnimationFrame(highlightLoop);
        };

        audio.onplay = () => {
           console.log('[ReadAloud] Audio onplay fired');
           logInfo(`Chunk ${i} started playing.`);
           
           if (!chunk.timestamps || currentSessionId !== playSessionIdRef.current) return;
           animationFrameIdRef.current = requestAnimationFrame(highlightLoop);
        };

        audio.onpause = () => {
           console.log('[ReadAloud] Audio onpause fired');
           logInfo(`Chunk ${i} paused.`);
           if (animationFrameIdRef.current !== null) { cancelAnimationFrame(animationFrameIdRef.current); animationFrameIdRef.current = null; }
           removeHighlights();
        };

        audio.onended = () => {
           console.log('[ReadAloud] Audio onended fired');
           logInfo(`Chunk ${i} ended natively.`);
           if (animationFrameIdRef.current !== null) { cancelAnimationFrame(animationFrameIdRef.current); animationFrameIdRef.current = null; }
           removeHighlights();

           playNextChunk();
        };

        audio.onerror = (e) => {
          console.error('[ReadAloud] Audio error:', audio.error?.code, audio.error?.message);
          logError(`Chunk ${i} audio element error`, e);
          failedChunks++;
          if (failedChunks > Math.max(1, totalChunks / 2)) {
             showError('Audio unavailable for this content. Please try again later.');
             setIsPlaying(false);
             isQueuePlaying = false;
          } else {
             playNextChunk();
          }
        };

        audio.playbackRate = playbackRate;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('[Frontend] Audio playbackRate after play:', audio.playbackRate, 'src length:', audio.src.length);
                console.log('[ReadAloud] Actual playbackRate:', audio.playbackRate);
                console.log('[ReadAloud] play() succeeded');
                playedChunks++;
            }).catch(err => {
                console.error('[ReadAloud] play() rejected:', err.name, err.message);
                logError(`Chunk ${i} audio play threw error`, err);
                
                // Retry logic
                setTimeout(async () => {
                    try {
                        await audio.play();
                        console.log('[ReadAloud] retry play() succeeded');
                        playedChunks++;
                    } catch (retryErr: any) {
                        console.error('[ReadAloud] retry play() rejected:', retryErr.message);
                        failedChunks++;
                        if (failedChunks > Math.max(1, totalChunks / 2)) {
                           showError('Audio unavailable for this content. Please try again later.');
                           setIsPlaying(false);
                           isQueuePlaying = false;
                        } else {
                           playNextChunk();
                        }
                    }
                }, 200);
            });
        }
      };

      // Start reading the stream
      playNextChunkRef.current = playNextChunk;
      (async () => {
        try {
          while (true) {
            if (currentSessionId !== playSessionIdRef.current) break;
            const { done, value } = await reader.read();
            if (done) {
              streamEnded = true;
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                const data = JSON.parse(line);
                if (data.totalChunks !== undefined) {
                  totalChunks = data.totalChunks;
                  logInfo(`Received totalChunks: ${totalChunks}`);
                  if (totalChunks === 0) {
                    throw new Error('No audio chunks returned');
                  }
                  const scopeRoot = getScopeRoot();
                  const expectedElements = scopeRoot.querySelectorAll(`[id^="${idPrefix}"]`).length;
                  const fallbackElements = document.querySelectorAll('[id^="tts-sentence-"]').length;
                  if (expectedElements === 0 && fallbackElements === 0 && !idPrefix.startsWith("tts-explanation-")) {
                    // Try to see if we have a fallback bubble
                    const bubble = wrapperRef.current?.closest('.group\\/bubble');
                    if (!bubble) {
                        logWarning(`No DOM elements found matching ${idPrefix} or fallback. Disabling sync.`);
                        disableSync = true;
                    }
                  }

                } else if (data.index !== undefined) {
                  const isValid = data.audioUrl && data.audioUrl.startsWith('data:audio/');
                  logInfo(`Received chunk ${data.index}. Audio URL valid: ${!!isValid}`);
                  if (data.timestamps && data.timestamps.length > 0) {
                      console.log(`[Frontend] Chunk ${data.index} – first timestamp:`, JSON.stringify(data.timestamps[0]), 'last timestamp:', JSON.stringify(data.timestamps[data.timestamps.length - 1]));
                  }
                  chunksMapRef.current.set(data.index, data);
                  
                  let addedToQueue = false;
                  while (chunksMapRef.current.has(expectedIndex)) {
                      audioQueueRef.current.push(chunksMapRef.current.get(expectedIndex));
                      chunksMapRef.current.delete(expectedIndex);
                      expectedIndex++;
                      addedToQueue = true;
                  }
                  
                  if (addedToQueue && !isQueuePlaying) {
                      playNextChunk();
                  }
                }
              }
            }
          }
          if (buffer.trim()) {
             const data = JSON.parse(buffer);
             if (data.index !== undefined) {
                if (data.timestamps && data.timestamps.length > 0) {
                    console.log(`[Frontend] Chunk ${data.index} – first timestamp:`, JSON.stringify(data.timestamps[0]), 'last timestamp:', JSON.stringify(data.timestamps[data.timestamps.length - 1]));
                }
                chunksMapRef.current.set(data.index, data);
                let addedToQueue = false;
                while (chunksMapRef.current.has(expectedIndex)) {
                    audioQueueRef.current.push(chunksMapRef.current.get(expectedIndex));
                    chunksMapRef.current.delete(expectedIndex);
                    expectedIndex++;
                    addedToQueue = true;
                }
                if (addedToQueue && !isQueuePlaying) {
                    playNextChunk();
                }
             }
          }
          if (!isQueuePlaying && audioQueueRef.current.length > 0) {
              playNextChunk();
          }
        } catch (err) {
          logError('Stream reading error:', err);
          if (!isQueuePlaying) {
            setIsPlaying(false);
            showError('Audio unavailable for this content. Please try again later.');
          }
        }
      })();

      logSuccess('Cartesia TTS API call successful, starting chunk playback.');
    } catch (err) {
      logError('Cartesia TTS API call failed:', err);
      setIsLoading(false);
      setIsPlaying(false);

      showError('Audio unavailable for this content. Please try again later.');
    }
  };


  const triggerSpeech = async () => {
    if (isPlaying || isLoading) {
      stopPlaying();
      return;
    }

    playSessionIdRef.current += 1;
    
    // Unlock audio context for mobile/safari
    if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
        if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.style.display = 'none';
        document.body.appendChild(audioRef.current);
    }
    try {
      audioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      audioRef.current.play().catch(e => console.log('[ReadAloud] Unlock play caught:', e));
    } catch (e) {
      console.log('[ReadAloud] Audio context unlock error:', e);
    }
    
    await tryCartesiaTTS();
  };

  useEffect(() => {
    const btn = actionButtonRef.current;
    if (!btn) return;

    const handleTouchStart = (e: TouchEvent) => {
      logInfo("Trigger Event: touchstart detected on ReadAloudButton");
      e.preventDefault();
      triggerSpeech();
    };

    const handleClick = (e: MouseEvent) => {
      logInfo("Trigger Event: click detected on ReadAloudButton");
      e.preventDefault();
      triggerSpeech();
    };

    btn.addEventListener('click', handleClick);
    btn.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      btn.removeEventListener('click', handleClick);
      btn.removeEventListener('touchstart', handleTouchStart);
    };
  }, [text, isPlaying, isLoading, voicesAvailable, highQuality]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.defaultPlaybackRate = playbackRate;
    }
  }, [playbackRate]);

  
  const showError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMsg('');
    }, 3000);

    // Surface the permission/voices hint only when it's actually relevant:
    // playback failed entirely AND the browser has no TTS voices available.
    if (!voicesAvailable) {
      setShowPermissionWarning(true);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = setTimeout(() => {
        setShowPermissionWarning(false);
      }, 5000);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1" ref={wrapperRef}>
      {isPlaying ? (
          <div className={cn("flex items-center rounded bg-black/40 text-cyan-400 z-10 min-h-[48px]", className)}>
             {isLoading ? (
                <button className="p-1.5 touch-manipulation min-w-[48px] flex items-center justify-center" disabled>
                   <Loader2 className={cn("animate-spin", iconSizeClasses)} />
                </button>
             ) : (
                <>
                    <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); isPaused ? handleResume() : handlePause(); }}
                        className="p-1.5 touch-manipulation min-w-[48px] flex items-center justify-center hover:bg-black/20 hover:text-cyan-300 transition-colors rounded-l"
                        title={isPaused ? "Resume" : "Pause"}
                    >
                        {isPaused ? <Play className={iconSizeClasses} /> : <Pause className={iconSizeClasses} />}
                    </button>
                    <div className="w-[1px] h-6 bg-white/10" />
                    <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); stopPlaying(); }}
                        className="p-1.5 touch-manipulation min-w-[48px] flex items-center justify-center hover:bg-black/20 hover:text-red-400 transition-colors rounded-r"
                        title="Stop"
                    >
                        <Square className="w-3.5 h-3.5 fill-current opacity-70" />
                    </button>
                </>
             )}
          </div>
      ) : (
         <button
            ref={actionButtonRef}
            className={cn(
              "relative p-1.5 bg-black/20 hover:bg-black/40 rounded text-white/50 hover:text-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center touch-manipulation z-10 min-w-[48px] min-h-[48px]",
              className
            )}
            title="Read Aloud"
            disabled={isLoading}
         >
            {isLoading ? <Loader2 className={cn("animate-spin", iconSizeClasses)} /> : <Volume2 className={iconSizeClasses} />}
         </button>
      )}

      {!isPlaying && !isLoading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const newHQ = !highQuality;
            console.log('HQ toggled – now: ' + newHQ);
            setHighQuality(newHQ);
          }}
          className={cn(
            "text-[10px] font-mono px-1 rounded transition-colors z-10 hidden sm:block",
            highQuality ? "bg-cyan-900/50 text-cyan-400" : "bg-black/20 text-white/30 hover:text-white/50"
          )}
          title="Toggle High Quality (Slower)"
        >
          HQ
        </button>
      )}

      {errorMsg && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-500 text-white text-xs px-2 py-1 rounded select-none pointer-events-none z-50 shadow-xl border border-red-400/30">
          {errorMsg}
        </div>
      )}

      {showPermissionWarning && (
        <div className="absolute bottom-full mb-3 right-0 w-[240px] bg-gray-800 text-gray-200 text-xs p-3 rounded-lg shadow-xl border border-white/10 flex items-start gap-2 z-50">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-medium text-white">No voices found.</span>
            <span className="text-[11px] text-gray-400 leading-tight">
              Check Chrome site sound settings (Settings → Site Settings → Sound → Allow).
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export { SmartReadAloudButton as ReadAloudButton };