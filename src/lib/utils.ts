import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function smartNormalizeText(text: string): string {
  if (!text) return text;

  // Protect math blocks ($$...$$ and $...$) from text normalization
  const mathBlocks: string[] = [];
  const placeholderText = text.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g, (match) => {
    mathBlocks.push(match);
    return `___MATH_BLOCK_${mathBlocks.length - 1}___`;
  });

  // 1. Fix the corrupted 'y' bullet points.
  const fixedBullets = placeholderText.replace(/^[ \t]*y\s+/gm, '- ');

  // 1.5 Fix literal bullet points to use standard markdown syntax, and remove any weird leading newlines after them.
  // This ensures that "• \nText" becomes "- Text" instead of "- \nText" which might parse as a loose list or break.
  const fixedLiteralBullets = fixedBullets.replace(/^[ \t]*[•◦▪]\s*/gm, '- ');

  // 2. Remove hard wraps (lines ending with a letter/number but NOT a period)
  // We use a negative lookahead to preserve intentional markdown structures like tables, lists, headers, etc.
  const unwrapped = fixedLiteralBullets.replace(/([a-zA-Z0-9_,;:])\n(?!\s*\n|[-*+]\s|\d+\.\s|\||>|#|```|\[|!\[|\*)/g, '$1 ');

  // 3. Ensure captions have space, but DO NOT mess with lists to avoid extra spacing breaking the flow
  const spaced = unwrapped
    .replace(/(\n\s*Fig:)/g, '\n\n$1');

  // Restore math blocks
  const restored = spaced.replace(/___MATH_BLOCK_(\d+)___/g, (_, index) => {
    return mathBlocks[Number(index)] ?? '';
  });

  return restored.trim();
}

export function safeParseJSON(val: any): any[] {
  let result: any[] = [];
  if (Array.isArray(val)) result = val;
  else if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      result = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      /* ignore */
    }
  }

  // Handle double-stringified JSON items
  result = result.map((item) => {
    if (typeof item === 'string') {
      try {
        const parsed = JSON.parse(item);
        // It could be stringified object or array
        if (typeof parsed === 'object' && parsed !== null) {
           return parsed;
        }
      } catch (e) {
        return item;
      }
    }
    return item;
  });

  return result.filter((item) => item !== null && typeof item === 'object');
}
