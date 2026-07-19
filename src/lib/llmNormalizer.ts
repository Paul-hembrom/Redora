import { callLLM } from './gemini.js';

const ttsNormalizationCache = new Map<string, string>();

export async function normalizeTextWithLLM(text: string): Promise<string> {
    if (ttsNormalizationCache.has(text)) {
        return ttsNormalizationCache.get(text)!;
    }

    const prompt = `You are a text normalizer for a classroom text-to-speech system.
Rewrite the following passage so it can be spoken naturally by a voice engine.
Rules:
- Convert all LaTeX and mathematical symbols into spoken English (e.g., "x^2" → "x squared", "\\frac{a}{b}" → "a over b", "\\sqrt{4}" → "the square root of 4").
- Handle all advanced mathematical, scientific, and notation-heavy content (limits, integrals, matrices, set notation, trigonometric identities, etc.).
- Spell out abbreviations and technical terms the first time they appear.
- Insert commas and periods where natural pauses should occur (the voice engine will pause at punctuation).
- Keep the original meaning exactly. Do not summarize or omit anything.
- Return ONLY the rewritten text, no other text.

Text to normalize:
${text}`;

    try {
        const normalized = await callLLM(prompt);
        const result = normalized.trim();
        ttsNormalizationCache.set(text, result);
        return result;
    } catch (err) {
        console.error("normalizeTextWithLLM failed:", err);
        return text;
    }
}
