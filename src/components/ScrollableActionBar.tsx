import React, { useRef, useState, useEffect, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

export function ScrollableActionBar({ children, className, innerClassName }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    
    // Setup observer to watch for content changes
    const observer = new ResizeObserver(() => checkScroll());
    if (scrollRef.current) observer.observe(scrollRef.current);
    
    return () => observer.disconnect();
  }, [children]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Allow vertical scroll if we can't scroll horizontally anymore
      if (e.deltaY !== 0) {
        // Find if we are scrolling vertically over the container
        const isScrollingDown = e.deltaY > 0;
        const isScrollingUp = e.deltaY < 0;
        
        const canScrollTheWheelWay = (isScrollingDown && canScrollRight) || (isScrollingUp && canScrollLeft);
        
        if (canScrollTheWheelWay) {
           e.preventDefault();
           el.scrollBy({
             left: e.deltaY > 0 ? 50 : -50,
             behavior: 'auto'
           });
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [canScrollLeft, canScrollRight]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth / 2;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className={cn("relative flex items-center min-w-0 max-w-full overflow-hidden", className)}>
      {canScrollLeft && (
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 h-full p-1 bg-gradient-to-r from-black via-black/80 to-transparent text-white/50 hover:text-white transition-colors flex items-center pr-6"
        >
          <ChevronLeft className="w-4 h-4 rounded-full bg-black/50" />
        </button>
      )}
      
      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className={cn("flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0", innerClassName)}
      >
        {children}
      </div>

      {canScrollRight && (
        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 h-full p-1 bg-gradient-to-l from-black via-black/80 to-transparent text-white/50 hover:text-white transition-colors flex items-center pl-6"
        >
          <ChevronRight className="w-4 h-4 rounded-full bg-black/50" />
        </button>
      )}
    </div>
  );
}
