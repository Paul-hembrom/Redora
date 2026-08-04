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

// Number of discrete steps the sweep gradient is quantized into, per word.
// PERF: the old loop rewrote the gradient on EVERY animation frame. With
// `background-clip: text` that forces a full text repaint each time, and it
// was doing it for every word in the chunk, not just the active one. Twenty
// steps is still visually smooth (a word rarely lasts more than ~0.5s, so
// this is ~40 updates/sec at worst on ONE element) but cuts the paint work by
// more than an order of magnitude.
const PROGRESS_STEPS = 20;

// ---------------------------------------------------------------------------
// Low-end device detection (smartboards, cheap panels).
//
// Two things are far too expensive on a 4GB board:
//   1. `background-clip: text` with a gradient that changes every few frames.
//      Text repaints are already the priciest paint op, and at 3XL font sizes
//      the glyphs are enormous, so each repaint covers a huge area.
//   2. Holding whole passages of base64 WAV on the JS heap (see
//      dataUrlToObjectUrl below).
// On a detected low-end device we swap the sweep for a solid block highlight,
// which costs three style writes per WORD instead of per frame, and looks
// essentially the same from across a classroom.
// ---------------------------------------------------------------------------
const detectLowEndDevice = (): boolean => {
  try {
    const nav = navigator as any;
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true;
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return true;
  } catch (e) {}
  return false;
};

// Converts a `data:audio/...;base64,...` URL into a Blob object URL.
//
// WHY THIS MATTERS MORE THAN ANYTHING ELSE HERE: a 12s Kokoro sentence is
// ~563KB of PCM, which is ~750K base64 characters -- and because JS strings
// are UTF-16 in memory that is ~1.46MB of HEAP per chunk. A 20-chunk section
// sitting in audioQueueRef is therefore ~29MB of heap, on top of React, the
// markdown DOM at 3XL, and Chrome's own overhead. That is what pushes a 4GB
// board into an OOM kill ("Chrome isn't responding").
//
// Moving the bytes into a Blob gets them OFF the JS heap and into Chrome's
// blob storage, which is managed separately and can spill to disk. It also
// makes the memory reclaimable ON DEMAND via revokeObjectURL(), which a data:
// URL never is.
const dataUrlToObjectUrl = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return dataUrl;
  const meta = dataUrl.slice(5, comma);
  const mime = (meta.split(';')[0] || 'audio/wav');
  const b64 = dataUrl.slice(comma + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
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
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
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

  // Spans this component injected into the page, so they can be unwrapped
  // again. See unwrapSpans() for why leaving them behind was a problem.
  const activeSpansRef = useRef<HTMLElement[]>([]);

  // Every blob: URL we created, so none can leak if playback is interrupted.
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const isLowEndRef = useRef<boolean>(false);

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
    isLowEndRef.current = detectLowEndDevice();
    if (isLowEndRef.current) {
      logInfo('Low-end device detected: using solid highlight + reduced buffering.');
    }
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

  const revokeObjectUrl = (url?: string | null) => {
    if (!url || !url.startsWith('blob:')) return;
    try { URL.revokeObjectURL(url); } catch (e) {}
    objectUrlsRef.current.delete(url);
  };

  const revokeAllObjectUrls = () => {
    objectUrlsRef.current.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch (e) {}
    });
    objectUrlsRef.current.clear();
  };

  const clearSpanStyle = (span: HTMLElement | null | undefined) => {
    if (!span) return;
    span.style.background = '';
    span.style.webkitBackgroundClip = '';
    span.style.backgroundClip = '';
    span.style.color = '';
    span.style.backgroundColor = '';
    span.style.borderRadius = '';
    span.classList.remove('bg-amber-400/70');
  };

  // PERF / CORRECTNESS: previously the injected `.tts-word` spans were only
  // ever style-cleared, never removed. Every surroundContents() splits a text
  // node into three, so the spans accumulated for the whole session. In Focus
  // Mode several chunks share one paragraph container, so each new chunk's
  // createTreeWalker had to walk a steadily larger tree and rebuild its
  // offset map over more nodes -- the work per chunk grew as playback went on,
  // which is why the "page unresponsive" dialog appeared partway through
  // rather than immediately. Unwrapping restores the container to its original
  // shape so every chunk starts from the same (small) tree.
  const unwrapSpans = (spans: (HTMLElement | null)[]) => {
    const touchedParents = new Set<Node>();
    spans.forEach((span) => {
      if (!span || !span.parentNode) return;
      const parent = span.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      touchedParents.add(parent);
    });
    // normalize() merges the split text nodes back together. Doing it once per
    // parent instead of once per span keeps this cheap.
    touchedParents.forEach((p) => {
      try { (p as HTMLElement).normalize(); } catch (e) {}
    });
  };

  const clearAllHighlights = () => {
    if (activeSpansRef.current.length > 0) {
      unwrapSpans(activeSpansRef.current);
      activeSpansRef.current = [];
    }
    // Safety sweep for anything left behind by an earlier session.
    const stragglers = document.querySelectorAll('.tts-word');
    if (stragglers.length > 0) {
      unwrapSpans(Array.from(stragglers) as HTMLElement[]);
    }
  };

  const releaseAudioElement = (el: HTMLAudioElement | null) => {
    if (!el) return;
    try {
      el.pause();
      el.removeAttribute('src');
      el.src = '';
      // load() after clearing src tells the browser to drop the decoded
      // buffer. Without it a chunk's full base64 WAV can stay resident.
      el.load();
    } catch (e) {}
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

    releaseAudioElement(audioRef.current);
    releaseAudioElement(preloadAudioRef.current);
    revokeAllObjectUrls();

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
        body: JSON.stringify({ text, hq: highQuality, lowMemory: isLowEndRef.current })
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

        // Free the chunk we just finished with. Done here (rather than in
        // onended) so a pause/resume that replays the current chunk still has
        // its audio available.
        const previous = currentChunkRef.current;
        if (previous && previous !== chunk && previous.index !== chunk.index) {
          revokeObjectUrl(previous.audioUrl);
          previous.audioUrl = null;
        }

        currentChunkRef.current = chunk;

        // PERF: reuse ONE hidden <audio> for preloading instead of
        // constructing `new Audio()` per chunk. The old version created a new
        // element for every chunk and never released it, so each one held a
        // decoded base64 WAV for the lifetime of the session.
        // Preloading costs a SECOND decoded copy of a chunk in the media
        // stack. Worth it on a desktop, not on a 4GB board.
        if (!isLowEndRef.current && audioQueueRef.current.length > 0 && audioQueueRef.current[0].audioUrl) {
            if (!preloadAudioRef.current) {
                preloadAudioRef.current = new Audio();
                preloadAudioRef.current.preload = 'auto';
            }
            try { preloadAudioRef.current.src = audioQueueRef.current[0].audioUrl; } catch (e) {}
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
            const bubble = wrapperRef.current.closest('.group\\/bubble');
            if (bubble) {
                sentenceEl = bubble.querySelector('.prose') as HTMLElement | null;
            }
        }

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

        audio.onloadedmetadata = () => {
            if (resumeWordIndex !== undefined && chunk.timestamps && chunk.timestamps.length > resumeWordIndex) {
                const ts = chunk.timestamps[resumeWordIndex];
                const targetTime = ts.start_time !== undefined ? ts.start_time : ts.start;
                audio.currentTime = targetTime;
            }
        };

        // Remove the previous chunk's injected spans before wrapping this one.
        if (activeSpansRef.current.length > 0) {
            unwrapSpans(activeSpansRef.current);
            activeSpansRef.current = [];
        }

        const wordSpans: (HTMLElement | null)[] = new Array(chunk.timestamps ? chunk.timestamps.length : 0).fill(null);
        const shouldHighlight = !disableSync;

        const oldOverlay = document.getElementById('tts-highlight-overlay');
        if (oldOverlay) oldOverlay.remove();

        if (shouldHighlight && chunk.timestamps && chunk.timestamps.length > 0 && sentenceEl) {
            const walker = document.createTreeWalker(sentenceEl, NodeFilter.SHOW_TEXT, null);
            const textNodes: Node[] = [];
            let node;
            while ((node = walker.nextNode())) {
                textNodes.push(node);
            }

            // PERF: the old code built an indexMap with ONE OBJECT PER
            // CHARACTER of the container. For a Focus-Mode paragraph of a few
            // thousand characters that is thousands of allocations, rebuilt
            // for every chunk that shares the paragraph. This keeps one entry
            // per text node and binary-searches it instead: same answer,
            // orders of magnitude less allocation and GC pressure.
            const nodeSpans: { node: Node; start: number; end: number }[] = [];
            let fullText = "";
            let acc = 0;
            for (const tNode of textNodes) {
                const txt = tNode.nodeValue || "";
                nodeSpans.push({ node: tNode, start: acc, end: acc + txt.length });
                acc += txt.length;
                fullText += txt;
            }

            const locate = (globalOffset: number): { node: Node; offset: number } | null => {
                let lo = 0;
                let hi = nodeSpans.length - 1;
                while (lo <= hi) {
                    const mid = (lo + hi) >> 1;
                    const entry = nodeSpans[mid];
                    if (globalOffset < entry.start) hi = mid - 1;
                    else if (globalOffset >= entry.end) lo = mid + 1;
                    else return { node: entry.node, offset: globalOffset - entry.start };
                }
                return null;
            };

            let searchIndex = 0;
            let chunkOffset = fullText.indexOf(chunk.text);
            if (chunkOffset === -1) chunkOffset = fullText.toLowerCase().indexOf(chunk.text.toLowerCase());
            if (chunkOffset !== -1) {
                searchIndex = chunkOffset;
            }

            // Pass 1: locate every word match in the *original* (unmutated)
            // text first. We must not wrap-as-we-go here, because wrapping a
            // word splits its text node and invalidates the offsets already
            // computed for later words.
            type Match = { tsIndex: number; start: number; end: number };
            const matches: Match[] = [];
            for (let tsIdx = 0; tsIdx < chunk.timestamps.length; tsIdx++) {
                const ts = chunk.timestamps[tsIdx];
                const word = ts.word ? ts.word.trim() : "";
                if (!word) continue;

                const wordEscaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                let regexPattern = wordEscaped;
                if (/^\w/.test(word)) regexPattern = `\\b${regexPattern}`;
                if (/\w$/.test(word)) regexPattern = `${regexPattern}\\b`;

                let matchIdx = -1;

                // Exact case first: a set name "A" must not match the article "a".
                try {
                    const reSensitive = new RegExp(regexPattern, "g");
                    reSensitive.lastIndex = searchIndex;
                    const m = reSensitive.exec(fullText);
                    if (m) matchIdx = m.index;
                } catch (e) {}

                if (matchIdx === -1) {
                    try {
                        const reInsensitive = new RegExp(regexPattern, "gi");
                        reInsensitive.lastIndex = searchIndex;
                        const m = reInsensitive.exec(fullText);
                        if (m) matchIdx = m.index;
                    } catch (e) {}
                }

                if (matchIdx === -1) matchIdx = fullText.indexOf(word, searchIndex);
                if (matchIdx === -1) matchIdx = fullText.toLowerCase().indexOf(word.toLowerCase(), searchIndex);

                if (matchIdx !== -1) {
                    matches.push({ tsIndex: tsIdx, start: matchIdx, end: matchIdx + word.length - 1 });
                    searchIndex = matchIdx + word.length;
                }
            }

            // Pass 2: wrap in *descending* start offset so mutating a later
            // match never invalidates an earlier one.
            const orderedForWrapping = [...matches].sort((a, b) => b.start - a.start);
            const created: HTMLElement[] = [];

            for (const m of orderedForWrapping) {
                const startNodeInfo = locate(m.start);
                const endNodeInfo = locate(m.end);
                if (!startNodeInfo || !endNodeInfo) continue;

                const range = document.createRange();
                range.setStart(startNodeInfo.node, startNodeInfo.offset);
                range.setEnd(endNodeInfo.node, endNodeInfo.offset + 1);

                let span: HTMLElement | null = null;
                if (
                    startNodeInfo.node === endNodeInfo.node &&
                    startNodeInfo.node.parentElement &&
                    startNodeInfo.node.parentElement.classList.contains('tts-word')
                ) {
                    span = startNodeInfo.node.parentElement;
                } else {
                    span = document.createElement('span');
                    span.className = 'tts-word rounded';
                    span.id = `tts-word-${i}-${m.tsIndex}`;
                    try {
                        range.surroundContents(span);
                        created.push(span);
                    } catch (e) {
                        span = null;
                    }
                }
                wordSpans[m.tsIndex] = span;
            }

            activeSpansRef.current = created;
        }

        const removeHighlights = () => {
            wordSpans.forEach((span) => clearSpanStyle(span));
        };

        let hasScrolledInitial = false;

        // Incremental cursor into chunk.timestamps. Timestamps are sorted and
        // non-overlapping (the server guarantees monotonic spans), so the
        // active word can be found by nudging a pointer forward rather than
        // rescanning every word each frame.
        let cursor = 0;
        let activeIdx = -1;
        let lastBucket = -1;

        const tsStart = (ts: any) => (ts.start_time !== undefined ? ts.start_time : ts.start);
        const tsEnd = (ts: any) => (ts.end_time !== undefined ? ts.end_time : ts.end);

        const highlightLoop = () => {
            if (currentSessionId !== playSessionIdRef.current || audio.paused || audio.ended) return;

            const currentTime = audio.currentTime;

            if (currentTime > 0.05 && !hasScrolledInitial) {
               hasScrolledInitial = true;
               const scrollTarget: HTMLElement | null = wordSpans[0] || sentenceEl;
               if (scrollTarget && scrollTarget.isConnected) {
                 const rect = scrollTarget.getBoundingClientRect();
                 const margin = 80;
                 const alreadyVisible = rect.top >= margin && rect.bottom <= window.innerHeight - margin;
                 if (!alreadyVisible) {
                   scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 }
               }
            }

            const timestamps = chunk.timestamps;
            if (timestamps && timestamps.length > 0) {
                // Handle a backward seek (resume/scrub) by resetting the cursor.
                if (cursor > 0 && currentTime < tsStart(timestamps[cursor])) cursor = 0;
                while (cursor < timestamps.length - 1 && currentTime >= tsEnd(timestamps[cursor])) cursor++;

                const ts = timestamps[cursor];
                const start = tsStart(ts);
                const end = tsEnd(ts);
                const newActive = (currentTime >= start && currentTime < end) ? cursor : -1;

                if (newActive !== activeIdx) {
                    // Clear ONLY the word that was previously lit. The old loop
                    // reset four style properties on every word in the chunk on
                    // every frame; this touches at most one element per word
                    // transition.
                    clearSpanStyle(wordSpans[activeIdx]);
                    activeIdx = newActive;
                    lastBucket = -1;

                    const span = wordSpans[activeIdx];
                    if (span && span.isConnected) {
                        const rect = span.getBoundingClientRect();
                        const margin = 120; // generous for 3xl / smartboards
                        if (rect.bottom > window.innerHeight - margin || rect.top < margin) {
                            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                }

                // LOW-END PATH: solid block highlight, applied once per word.
                // Skips the per-frame gradient entirely -- no background-clip,
                // no repeated text repaint. Three style writes per word instead
                // of up to PROGRESS_STEPS x 4.
                if (isLowEndRef.current) {
                    if (activeIdx >= 0 && lastBucket !== 1) {
                        const span = wordSpans[activeIdx];
                        if (span && span.isConnected) {
                            span.style.backgroundColor = '#FBBF24';
                            span.style.color = '#111827';
                            span.style.borderRadius = '3px';
                        }
                        lastBucket = 1;
                    }
                    animationFrameIdRef.current = requestAnimationFrame(highlightLoop);
                    return;
                }

                if (activeIdx >= 0) {
                    const span = wordSpans[activeIdx];
                    if (span && span.isConnected) {
                        const duration = end - start;
                        const progress = duration > 0
                            ? Math.max(0, Math.min(1, (currentTime - start) / duration))
                            : 1;
                        const bucket = Math.round(progress * PROGRESS_STEPS);
                        if (bucket !== lastBucket) {
                            lastBucket = bucket;
                            const pct = (bucket / PROGRESS_STEPS) * 100;
                            span.style.background = `linear-gradient(to right, #FBBF24 ${pct}%, transparent ${pct}%)`;
                            span.style.webkitBackgroundClip = 'text';
                            span.style.backgroundClip = 'text';
                            span.style.color = 'transparent';
                        }
                    }
                }
            }

            animationFrameIdRef.current = requestAnimationFrame(highlightLoop);
        };

        audio.onplay = () => {
           logInfo(`Chunk ${i} started playing.`);
           if (!chunk.timestamps || currentSessionId !== playSessionIdRef.current) return;
           if (animationFrameIdRef.current !== null) cancelAnimationFrame(animationFrameIdRef.current);
           animationFrameIdRef.current = requestAnimationFrame(highlightLoop);
        };

        audio.onpause = () => {
           logInfo(`Chunk ${i} paused.`);
           if (animationFrameIdRef.current !== null) { cancelAnimationFrame(animationFrameIdRef.current); animationFrameIdRef.current = null; }
           removeHighlights();
        };

        audio.onended = () => {
           logInfo(`Chunk ${i} ended natively.`);
           if (animationFrameIdRef.current !== null) { cancelAnimationFrame(animationFrameIdRef.current); animationFrameIdRef.current = null; }
           removeHighlights();
           playNextChunk();
        };

        audio.onerror = () => {
          logError(`Chunk ${i} audio element error`, audio.error?.message);
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
                playedChunks++;
            }).catch(err => {
                logError(`Chunk ${i} audio play threw error`, err);
                setTimeout(async () => {
                    try {
                        await audio.play();
                        playedChunks++;
                    } catch (retryErr: any) {
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

      // Move each chunk's audio off the JS heap the moment it arrives. The
      // original base64 string becomes garbage immediately after this, so the
      // queue only ever holds short blob: URLs.
      const ingestChunk = (data: any) => {
        if (data && typeof data.audioUrl === 'string' && data.audioUrl.startsWith('data:')) {
          try {
            const objUrl = dataUrlToObjectUrl(data.audioUrl);
            objectUrlsRef.current.add(objUrl);
            data.audioUrl = objUrl;
          } catch (e) {
            logWarning(`Could not convert chunk ${data.index} to a blob URL; keeping data URL.`);
          }
        }
      };

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
                    const bubble = wrapperRef.current?.closest('.group\\/bubble');
                    if (!bubble) {
                        logWarning(`No DOM elements found matching ${idPrefix} or fallback. Disabling sync.`);
                        disableSync = true;
                    }
                  }
                } else if (data.index !== undefined) {
                  ingestChunk(data);
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
                ingestChunk(data);
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

  // Free everything when the component unmounts (route change, Focus Mode
  // toggle, etc). Without this the hidden <audio> stayed attached to body.
  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) cancelAnimationFrame(animationFrameIdRef.current);
      clearAllHighlights();
      releaseAudioElement(preloadAudioRef.current);
      releaseAudioElement(audioRef.current);
      revokeAllObjectUrls();
      if (audioRef.current && audioRef.current.parentNode) {
        audioRef.current.parentNode.removeChild(audioRef.current);
      }
      audioRef.current = null;
      preloadAudioRef.current = null;
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, []);


  const showError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMsg('');
    }, 3000);

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
            setHighQuality(!highQuality);
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