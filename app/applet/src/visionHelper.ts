import { GoogleGenAI } from "@google/genai";

// Note: Recreating this function since the original workspace files were lost.
export async function extractTextViaGeminiVision(
  pages: HTMLCanvasElement[],
  geminiApiKey: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const pageTexts: string[] = [];
  const totalPages = pages.length;

  for (let j = 0; j < totalPages; j++) {
    console.log(`[Vision] Starting page ${j} of ${totalPages}`);

    const canvas = pages[j];
    // Ensure we strip the data:image/jpeg;base64, prefix
    const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    
    console.log(`[Vision] Page ${j}: image rendered, size = ${base64Image.length} chars`);
    console.log(`[Vision] Page ${j}: calling Gemini 2.5 Flash…`);

    try {
      // Ensure the model is strictly 'gemini-2.5-flash'
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
              { text: 'Extract all text from this page.' }
            ]
          }
        ]
      });

      console.log(`[Vision] Page ${j}: API response received`);
      console.log(`[Vision] Page ${j}: response candidates =`, response.candidates?.length);
      console.log(`[Vision] Page ${j}: parts =`, response.candidates?.[0]?.content?.parts?.length);

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      console.log(`[Vision] Page ${j}: extracted ${text.length} chars`);

      if (text.length === 0) {
        console.error(`[Vision] Page ${j}: EMPTY RESPONSE. Full response:`, JSON.stringify(response).substring(0, 500));
      }

      pageTexts.push(text);
    } catch (error) {
      console.error(`[Vision] Page ${j}: Error calling Gemini API:`, error);
    }
  }

  const finalText = pageTexts.filter(Boolean).join('\n');
  console.log(`[Vision] Final text length: ${finalText.length} chars`);
  
  if (finalText.length === 0) {
    console.error('[Vision] ALL pages returned empty text');
  }
  
  return finalText;
}
