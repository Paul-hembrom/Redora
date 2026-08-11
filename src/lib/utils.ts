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
  // NOTE: the trailing "_" was removed from the character class. Math is
  // replaced with ___MATH_BLOCK_n___ placeholders BEFORE this runs, and those
  // end in "_" -- so a line ending in math was being joined to the next line,
  // which destroyed any table that followed it.
  const unwrapped = fixedLiteralBullets.replace(
    /([a-zA-Z0-9,;:])\n(?!\s*\n|[-*+]\s|\d+\.\s|\||>|#|```|\[|!\[|\*|___MATH_BLOCK_)/g,
    '$1 '
  );

  // 2.5 Guarantee a blank line before and after every table block.
  //
  // GFM will not parse a table unless a blank line precedes it. Content
  // frequently arrives as:
  //     #### Match the following
  //     | Column A | Column B |
  // which renders as literal pipes. Same for a table directly after a prose
  // line or a math block.
  const tableSpaced = unwrapped
    // blank line BEFORE a table row that follows a non-blank, non-table line
    .replace(/([^\n|])\n(\|[^\n]*\|)/g, '$1\n\n$2')
    // blank line AFTER the last table row when followed by non-table content
    .replace(/(\|[^\n]*\|)\n(?!\s*$|\s*\||\s*\n)/g, '$1\n\n');

  // 3. Ensure captions have space, but DO NOT mess with lists to avoid extra spacing breaking the flow
  const spaced = tableSpaced
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
