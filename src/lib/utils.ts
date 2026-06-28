import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function smartNormalizeText(text: string): string {
  if (!text) return text;
  // 1. Fix the corrupted 'y' bullet points.
  // Matches a "y " at the start of a line (with optional leading whitespace), and replaces it with "- "
  const fixedBullets = text.replace(/^[ \t]*y\s+/gm, '- ');

  // 2. Remove hard wraps (lines ending with a letter/number but NOT a period)
  const unwrapped = fixedBullets.replace(/([^\s\.])(\n)([^\s])/g, '$1 $3');

  // 3. Ensure lists and captions have space
  const spaced = unwrapped
    .replace(/(\n\s*[-*]\s)/g, '\n\n$1')
    .replace(/(\n\s*Fig:)/g, '\n\n$1');

  return spaced.trim();
}
