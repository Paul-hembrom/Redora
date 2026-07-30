with open('src/components/ReadAloudButton.tsx', 'r') as f:
    content = f.read()

import re

ui_old = r'<div className="relative inline-flex items-center gap-1">\s*<button\s*ref=\{buttonRef\}\s*className=\{cn\(\s*"relative p-1\.5 bg-black/20 hover:bg-black/40 rounded text-white/50 hover:text-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center touch-manipulation z-10",\s*"before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:min-w-\[48px\] before:min-h-\[48px\] before:content-\['\''\]",\s*isPlaying && "text-cyan-400 bg-black/40",\s*className\s*\)\}\s*title=\{isPlaying \? "Stop Reading" : "Read Aloud"\}\s*disabled=\{isLoading\}\s*>\s*\{isLoading \? \(\s*<Loader2 className=\{cn\("animate-spin", iconSizeClasses\)\} />\s*\) : isPlaying \? \(\s*<div className="flex items-center gap-1">\s*<AudioLines className=\{cn\("animate-pulse text-cyan-400", iconSizeClasses\)\} />\s*<Square className="w-2\.5 h-2\.5 fill-current opacity-70" />\s*</div>\s*\) : \(\s*<Volume2 className=\{iconSizeClasses\} />\s*\)\}\s*</button>'

ui_new = """<div className="relative inline-flex items-center gap-1" ref={wrapperRef}>
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
            onClick={(e) => {
               // The useEffect already handles it, but we can call it if needed
            }}
            className={cn(
              "relative p-1.5 bg-black/20 hover:bg-black/40 rounded text-white/50 hover:text-cyan-400 disabled:opacity-50 transition-colors flex items-center justify-center touch-manipulation z-10 min-w-[48px] min-h-[48px]",
              className
            )}
            title="Read Aloud"
            disabled={isLoading}
         >
            {isLoading ? <Loader2 className={cn("animate-spin", iconSizeClasses)} /> : <Volume2 className={iconSizeClasses} />}
         </button>
      )}"""

content = re.sub(ui_old, ui_new, content, flags=re.MULTILINE)

with open('src/components/ReadAloudButton.tsx', 'w') as f:
    f.write(content)
