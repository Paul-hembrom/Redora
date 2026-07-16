import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function smartNormalizeText(text: string): string {
  if (!text) return text;
  // 1. Fix the corrupted 'y' bullet points.
  const fixedBullets = text.replace(/^[ \t]*y\s+/gm, '- ');

  // 1.5 Fix literal bullet points to use standard markdown syntax, and remove any weird leading newlines after them.
  // This ensures that "• \nText" becomes "- Text" instead of "- \nText" which might parse as a loose list or break.
  const fixedLiteralBullets = fixedBullets.replace(/^[ \t]*[•◦▪]\s*/gm, '- ');

  // 2. Remove hard wraps (lines ending with a letter/number but NOT a period)
  // We use a negative lookahead to preserve intentional markdown structures like tables, lists, headers, etc.
  const unwrapped = fixedLiteralBullets.replace(/([a-zA-Z0-9_,;:])\n(?!\s*\n|[-*+]\s|\d+\.\s|\||>|#|```|\[|!\[|\*)/g, '$1 ');

  // 3. Ensure captions have space, but DO NOT mess with lists to avoid extra spacing breaking the flow
  const spaced = unwrapped
    .replace(/(\n\s*Fig:)/g, '\n\n$1');

  return spaced.trim();
}
