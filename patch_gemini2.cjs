const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const oldPromptRule1 = "1. DO NOT summarize, change, or omit ANY text. Copy the text verbatim. EVERY paragraph, every bullet point, every detail must be included in the content strings. THIS IS CRITICAL.";
const newPromptRule1 = "1. DO NOT summarize, change, or omit ANY text. Copy the text verbatim. EVERY paragraph, every bullet point, every detail must be included in the content strings. THIS IS CRITICAL.\nYou are an expert document processor. You must process the provided text and output the full contents verbatim. DO NOT summarize, paraphrase, omit, or change any text. Ensure all subsections and details are included. Output in valid JSON format.";
code = code.replace(oldPromptRule1, newPromptRule1);

const oldSignature = "export async function extractViaAI(text: string, estimatedChapterCount?: number): Promise<any[] | null> {";
const newSignature = "export async function extractViaAI(text: string, estimatedChapterCount?: number, docType?: string): Promise<any[] | null> {";
code = code.replace(oldSignature, newSignature);

const oldLog = "console.log(`[extractViaAI] Starting text extraction. Text length: ${cleanText.length}, expected chapters: ${estimatedChapterCount || 'unknown'}`);";
const newLog = "console.log(`[extractViaAI] [EXTENSIVE LOGGING] Starting text extraction. Document Type: ${docType || 'unknown'}, Text length: ${cleanText.length}, Expected chapters: ${estimatedChapterCount || 'unknown'}`);";
code = code.replace(oldLog, newLog);

const oldRepairLog = "console.log('[extractViaAI] jsonrepair succeeded!');";
const newRepairLog = "console.log('[extractViaAI] [EXTENSIVE LOGGING] [FLAG_JSON_REPAIR_TRIGGERED] jsonrepair succeeded!');";
code = code.replace(oldRepairLog, newRepairLog);

const oldProcessExtracted = `  const processExtracted = async (extracted: any[]) => {
    let arr = extracted;
    if (!Array.isArray(extracted) && extracted && typeof extracted === 'object') {
      const possibleArray = Object.values(extracted).find(val => Array.isArray(val));
      if (Array.isArray(possibleArray)) {
        arr = possibleArray;
      } else {
        console.error('[extractViaAI] Could not find chapters array in object:', Object.keys(extracted));
        // Fallback: maybe the object itself is the chapter array but malformed? Just return null.
        return null;
      }
    }
    
    if (!Array.isArray(arr)) return null;
    const mapped = mapToTopics(arr);
    
    console.log(\`[extractViaAI] processExtracted: Got \${mapped.length} chapters. Expected: \${estimatedChapterCount || 'unknown'}\`);

    // Temporarily disable split-retry logic to see if a single pass can process the whole book correctly
    /*
    if (estimatedChapterCount && mapped.length < estimatedChapterCount * 0.8) {
      console.warn(\`Completeness check failed: Got \${mapped.length} chapters, expected \${estimatedChapterCount}. Triggering split-retry...\`);
      
      const mid = Math.floor(cleanText.length / 2);
      const firstHalfText = cleanText.substring(0, mid);
      const secondHalfText = cleanText.substring(mid);
      
      const [firstHalf, secondHalf] = await Promise.all([
        extractViaAI(firstHalfText),
        extractViaAI(secondHalfText)
      ]);
      
      const combined = [];
      if (firstHalf) combined.push(...firstHalf);
      if (secondHalf) combined.push(...secondHalf);
      
      if (combined.length > 0) return combined;
      return null;
    }
    */

    return mapped;
  };`;

const newProcessExtracted = `  const processExtracted = async (extracted: any[]) => {
    let arr = extracted;
    if (!Array.isArray(extracted) && extracted && typeof extracted === 'object') {
      const possibleArray = Object.values(extracted).find(val => Array.isArray(val));
      if (Array.isArray(possibleArray)) {
        arr = possibleArray;
      } else {
        console.error('[extractViaAI] Could not find chapters array in object:', Object.keys(extracted));
        return null;
      }
    }
    
    if (!Array.isArray(arr)) return null;
    const mapped = mapToTopics(arr);
    
    console.log(\`[extractViaAI] [EXTENSIVE LOGGING] Processed chapter mapping. Expected chapter count: \${estimatedChapterCount || 'unknown'}, Actual returned chapters: \${mapped.length}\`);

    const ENABLE_SPLIT_RETRY = false;
    
    if (ENABLE_SPLIT_RETRY) {
      if (estimatedChapterCount && mapped.length < estimatedChapterCount * 0.8) {
        console.warn(\`[extractViaAI] Completeness check failed: Got \${mapped.length} chapters, expected \${estimatedChapterCount}. Triggering split-retry...\`);
        
        const mid = Math.floor(cleanText.length / 2);
        const firstHalfText = cleanText.substring(0, mid);
        const secondHalfText = cleanText.substring(mid);
        
        const [firstHalf, secondHalf] = await Promise.all([
          extractViaAI(firstHalfText, Math.floor(estimatedChapterCount / 2), docType),
          extractViaAI(secondHalfText, Math.ceil(estimatedChapterCount / 2), docType)
        ]);
        
        const combined = [];
        if (firstHalf) combined.push(...firstHalf);
        if (secondHalf) combined.push(...secondHalf);
        
        if (combined.length > 0) return combined;
        return null;
      }
    } else {
      console.log(\`[extractViaAI] [EXTENSIVE LOGGING] ENABLE_SPLIT_RETRY is false. Skipping split-retry despite potential chapter count mismatch.\`);
    }

    return mapped;
  };`;

code = code.replace(oldProcessExtracted, newProcessExtracted);

fs.writeFileSync('src/lib/gemini.ts', code);
