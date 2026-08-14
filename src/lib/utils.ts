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

export function formatUserFriendlyError(err: any, fallbackMessage = "Something went wrong. Please try again."): string {
  if (!err) return fallbackMessage;

  let rawMsg = typeof err === 'string' ? err : err.message || '';

  // If the message is a raw JSON string e.g. {"error":"..."}
  if (rawMsg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMsg);
      if (parsed.error && typeof parsed.error === 'string') {
        rawMsg = parsed.error;
      }
    } catch (e) {
      /* ignore */
    }
  }

  const lowerMsg = rawMsg.toLowerCase();

  // Check for duplicate document
  if (
    lowerMsg.includes('duplicate_document') ||
    lowerMsg.includes('duplicate document') ||
    lowerMsg.includes('duplicate')
  ) {
    return "This document has already been uploaded. Kindly check your library, or delete the existing version if you want to re-upload it.";
  }

  // Check for upload in progress / locked
  if (
    lowerMsg.includes('upload_in_progress') ||
    lowerMsg.includes('upload in progress') ||
    lowerMsg.includes('already being processed') ||
    lowerMsg.includes('upload_locks')
  ) {
    return "This document is already being uploaded or processed. Please wait a moment for it to complete.";
  }

  // Check for limit / quota / subscription errors
  if (
    lowerMsg.includes('limit reached') ||
    lowerMsg.includes('subscriptionlimit') ||
    lowerMsg.includes('monthly limit') ||
    lowerMsg.includes('quota exceeded') ||
    lowerMsg.includes('upgrade your plan') ||
    lowerMsg.includes('personal limit')
  ) {
    return "Your monthly upload limit has been reached. Please upgrade your plan or try again next month.";
  }

  // Detect internal database / server pipeline leakage
  if (
    lowerMsg.includes('database') ||
    lowerMsg.includes('column') ||
    lowerMsg.includes('relation') ||
    lowerMsg.includes('sql') ||
    lowerMsg.includes('postgres') ||
    lowerMsg.includes('syntax error') ||
    lowerMsg.includes('500') ||
    lowerMsg.includes('save failed (') ||
    lowerMsg.includes('process-ticket') ||
    lowerMsg.includes('process_ticket') ||
    lowerMsg.includes('process-url') ||
    lowerMsg.includes('internal server error') ||
    lowerMsg.includes('pipeline') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('fkey') ||
    lowerMsg.includes('supabase') ||
    lowerMsg.includes('bucket') ||
    lowerMsg.includes('content_hash')
  ) {
    return "We couldn't process your document right now. Please try again or contact support if the issue persists.";
  }

  if (lowerMsg.includes('504') || lowerMsg.includes('timeout')) {
    return "Saving took too long and timed out. Please try again.";
  }

  if (lowerMsg.includes('dynamically imported module')) {
    return "App version updated. Please refresh the page to continue.";
  }

  // Stripping internal technical prefixes
  let clean = rawMsg
    .replace(/^failed to save document:\s*/i, '')
    .replace(/^failed to process document:\s*/i, '')
    .replace(/^process-ticket failed.*:\s*/i, '')
    .replace(/^save failed \(\d+\):\s*/i, '')
    .replace(/^error:\s*/i, '')
    .trim();

  if (!clean || clean.length > 200 || clean.startsWith('{')) {
    return fallbackMessage;
  }

  return clean;
}
