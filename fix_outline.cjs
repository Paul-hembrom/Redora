const fs = require('fs');
let content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const target1 = `  const processedText = preprocessText(sanitizedText, options);

  let finalChapters: Chapter[] = [];

  // --------------------------------------------------------------------------
  // Step B: Semantic AI Chapter Splitter (DeepSeek identifies chapter boundaries)
  // --------------------------------------------------------------------------`;

const replacement1 = `  const processedText = preprocessText(sanitizedText, options);

  let finalChapters: Chapter[] = [];
  let skippedStepsBandC = false;

  const USE_OUTLINE_SPLITTER = true; // Enabled per instruction

  if (USE_OUTLINE_SPLITTER) {
    onProgress('Detecting table of contents…');
    try {
      const outline = await generateOutline(processedText);
      if (outline.length > 1) {
        const byOutline = await extractByOutline(processedText, outline);
        if (byOutline.length > 1) {
          onProgress(\`Outline splitter produced \${byOutline.length} chapters.\`);
          finalChapters = byOutline;
          skippedStepsBandC = true;
        }
      }
    } catch (e) {
      console.warn('[documentProcessor] Outline splitter failed; using semantic splitter.', e);
    }
  }

  if (!skippedStepsBandC) {
  // --------------------------------------------------------------------------
  // Step B: Semantic AI Chapter Splitter (DeepSeek identifies chapter boundaries)
  // --------------------------------------------------------------------------`;

content = content.replace(target1, replacement1);

const target2 = `  finalChapters = chapterResults;

  // --------------------------------------------------------------------------
  // Post‑processing & Deep Metadata Generation (unchanged)
  // --------------------------------------------------------------------------`;

const replacement2 = `  finalChapters = chapterResults;
  } // end of if (!skippedStepsBandC)

  // --------------------------------------------------------------------------
  // Post‑processing & Deep Metadata Generation (unchanged)
  // --------------------------------------------------------------------------`;

content = content.replace(target2, replacement2);
fs.writeFileSync('src/lib/documentProcessor.ts', content);
console.log("Fixed outline");
