function getEnvSafe(key: string, getViteEnv: () => string | undefined): string {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  try {
    const val = getViteEnv();
    if (val) return val;
  } catch (e) {}
  return '';
}

export const MODELS = {
  text:   getEnvSafe('MODEL_TEXT', () => import.meta.env.VITE_MODEL_TEXT) || 'deepseek-v4-flash',
  vision: getEnvSafe('MODEL_VISION', () => import.meta.env.VITE_MODEL_VISION) || 'gemini-2.5-flash',
  memory: getEnvSafe('MODEL_MEMORY', () => import.meta.env.VITE_MODEL_MEMORY) || 'gemini-2.5-flash',
  tts:    getEnvSafe('MODEL_TTS', () => import.meta.env.VITE_MODEL_TTS) || 'gemini-3.1-flash-tts-preview',
  video:  getEnvSafe('MODEL_VIDEO', () => import.meta.env.VITE_MODEL_VIDEO) || 'veo-3.1-lite-generate-preview',
};
