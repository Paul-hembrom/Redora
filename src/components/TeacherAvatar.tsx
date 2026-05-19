import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export type Emotion = 'neutral' | 'smiling' | 'thinking' | 'excited' | 'curious';

interface TeacherAvatarProps {
  emotion: Emotion;
  isSpeaking: boolean;
  className?: string;
}

export function TeacherAvatar({ emotion, isSpeaking, className = '' }: TeacherAvatarProps) {
  const [mouthOpen, setMouthOpen] = useState(false);

  useEffect(() => {
    if (!isSpeaking) {
      setMouthOpen(false);
      return;
    }

    // A simple interval to simulate talking mouth flapping
    const interval = setInterval(() => {
      setMouthOpen(prev => !prev);
    }, 150);

    return () => clearInterval(interval);
  }, [isSpeaking]);

  // SVG parameters based on emotion
  let eyebrowOffset = 0;
  let mouthShape = <path d="M 40 60 Q 50 60 60 60" stroke="#4A3B32" strokeWidth="2" fill="none" />; // neutral
  let eyeShape = <circle cx="40" cy="45" r="3" fill="#4A3B32" />; // Default left eye
  let rightEyeShape = <circle cx="60" cy="45" r="3" fill="#4A3B32" />; // Default right eye
  let headTilt = 0;
  
  if (emotion === 'smiling' || emotion === 'excited') {
    mouthShape = mouthOpen 
      ? <path d="M 40 60 Q 50 70 60 60 Z" fill="#4A3B32" /> 
      : <path d="M 40 60 Q 50 65 60 60" stroke="#4A3B32" strokeWidth="2" fill="none" />;
      
    if (emotion === 'excited') {
      eyebrowOffset = -3;
      headTilt = -5;
    }
  } else if (emotion === 'thinking') {
    mouthShape = mouthOpen 
      ? <circle cx="50" cy="62" r="3" fill="#4A3B32" />
      : <path d="M 45 62 L 55 62" stroke="#4A3B32" strokeWidth="2" fill="none" />;
    eyebrowOffset = 2; // furrowed
    headTilt = 10;
  } else if (emotion === 'curious') {
    mouthShape = mouthOpen
      ? <circle cx="50" cy="62" r="4" fill="#4A3B32" />
      : <path d="M 45 60 L 55 60" stroke="#4A3B32" strokeWidth="2" fill="none" />;
    eyebrowOffset = -5; // raised eyebrow (only one)
    headTilt = -5;
  } else {
    // neutral
    if (mouthOpen) {
       mouthShape = <path d="M 42 60 Q 50 65 58 60 Z" fill="#4A3B32" />;
    }
  }

  return (
    <motion.div 
      className={`relative ${className}`}
      animate={{ rotate: headTilt, y: [0, -3, 0] }}
      transition={{ rotate: { duration: 0.5 }, y: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
    >
      <svg width="120" height="120" viewBox="0 0 100 100" className="drop-shadow-xl overflow-visible">
        {/* Hair back */}
        <path d="M 30 30 Q 50 10 70 30 L 75 70 Q 50 90 25 70 Z" fill="#2D211B" />
        
        {/* Head */}
        <path d="M 30 40 Q 50 20 70 40 L 65 70 Q 50 85 35 70 Z" fill="#F5D0B5" />
        
        {/* Ears */}
        <circle cx="30" cy="50" r="4" fill="#E5C1A7" />
        <circle cx="70" cy="50" r="4" fill="#E5C1A7" />

        {/* Glasses */}
        <path d="M 32 45 h 15 v 1 h -15 z M 53 45 h 15 v 1 h -15 z" fill="#800" />
        <circle cx="40" cy="45" r="7" stroke="#800" strokeWidth="2" fill="none" />
        <circle cx="60" cy="45" r="7" stroke="#800" strokeWidth="2" fill="none" />
        <path d="M 47 45 Q 50 43 53 45" stroke="#800" strokeWidth="2" fill="none" />
        
        {/* Eyes */}
        {emotion === 'smiling' && !isSpeaking ? (
          <>
            <path d="M 37 45 Q 40 43 43 45" stroke="#4A3B32" strokeWidth="1.5" fill="none" />
            <path d="M 57 45 Q 60 43 63 45" stroke="#4A3B32" strokeWidth="1.5" fill="none" />
          </>
        ) : (
          <>
            {eyeShape}
            {rightEyeShape}
          </>
        )}

        {/* Eyebrows */}
        <motion.path 
          d="M 35 38 Q 40 36 45 38" 
          stroke="#2D211B" strokeWidth="2" fill="none" 
          animate={{ y: emotion === 'curious' ? eyebrowOffset : (emotion === 'thinking' ? 2 : eyebrowOffset) }}
        />
        <motion.path 
          d="M 55 38 Q 60 36 65 38" 
          stroke="#2D211B" strokeWidth="2" fill="none" 
          animate={{ y: emotion === 'thinking' ? 2 : eyebrowOffset }}
        />

        {/* Nose */}
        <path d="M 50 50 L 48 55 Q 50 56 52 55" stroke="#DCA27A" strokeWidth="1" fill="none" />

        {/* Mouth */}
        {mouthShape}

        {/* Body (Shoulders) */}
        <path d="M 25 85 Q 50 75 75 85 L 80 100 L 20 100 Z" fill="#0EA5E9" />
        
        {/* Collar */}
        <path d="M 35 70 L 50 80 L 65 70" stroke="#FFF" strokeWidth="2" fill="none" />

        {/* Thinking Hand (shows conditionally) */}
        <AnimatePresence>
          {emotion === 'thinking' && (
            <motion.g 
              initial={{ opacity: 0, y: 10, rotate: -20 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <ellipse cx="40" cy="75" rx="8" ry="12" fill="#F5D0B5" />
              {/* Fingers */}
              <line x1="36" y1="65" x2="40" y2="70" stroke="#DCA27A" strokeWidth="1" />
              <line x1="40" y1="63" x2="43" y2="70" stroke="#DCA27A" strokeWidth="1" />
              <line x1="44" y1="64" x2="46" y2="70" stroke="#DCA27A" strokeWidth="1" />
            </motion.g>
          )}
        </AnimatePresence>

      </svg>
    </motion.div>
  );
}
