export type ReadAloudEvent =
  | { type: 'paused'; sentence: string; paragraph: string; wordIndex: number; chunkIndex: number }
  | { type: 'resumed' }
  | { type: 'stopped' };

type Listener = (e: ReadAloudEvent) => void;
const listeners = new Set<Listener>();

export function publishReadAloud(e: ReadAloudEvent) {
  listeners.forEach(l => {
    try {
      l(e);
    } catch (err) {
      console.error('[askBus]', err);
    }
  });
}

export function subscribeReadAloud(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
