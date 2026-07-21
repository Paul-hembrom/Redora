import { useEffect } from 'react';

export function useScrollSync() {
  useEffect(() => {
    let rafId: number;
    let lastHighlightedElement: HTMLElement | null = null;

    const syncScroll = () => {
      // Find the currently highlighted word
      const activeHighlight = document.querySelector('.bg-amber-400\\/70') as HTMLElement;
      
      if (activeHighlight && activeHighlight !== lastHighlightedElement) {
        lastHighlightedElement = activeHighlight;
        
        // Ensure the highlighted word remains in the comfortable reading zone
        const rect = activeHighlight.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // If the word is in the top 30% or bottom 30% of the viewport, scroll to center
        if (rect.top < viewportHeight * 0.3 || rect.bottom > viewportHeight * 0.7) {
          activeHighlight.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }
      
      rafId = requestAnimationFrame(syncScroll);
    };

    rafId = requestAnimationFrame(syncScroll);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);
}
