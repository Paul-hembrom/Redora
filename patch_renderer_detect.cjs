const fs = require('fs');
let code = fs.readFileSync('server/videoPipeline.ts', 'utf-8');

const detectTarget = `export async function processSceneAssets(scene_id: string, org_id: string, visual_prompt: string, narration: string, duration: number, rendererOverride?: string) {
  let renderer = rendererOverride || 'veo';

  if (!rendererOverride) {
    const text = visual_prompt.toLowerCase(); // removed orgContext
    const manimKeywords = [
      'equation', 'formula', 'graph', 'vector', 'integral', 'derivative',
      'matrix', 'trig', 'algebra', 'calculus', 'physics', 'mechanics',
      'electromagnetic', 'wave function', 'ohm', 'newton', 'f = ma',
      'quantum', 'manim'
    ];
    const detectedKeywords = manimKeywords.filter(k => text.includes(k));
    if (detectedKeywords.length > 0) {
      renderer = 'manim';
    }
  }`;

const detectReplace = `function detectRendererFromPrompt(visualPrompt: string): 'manim' | 'veo' {
  const text = (visualPrompt || '').toLowerCase();
  const manimKeywords = [
    'equation','formula','graph','vector','integral','derivative','matrix','trig',
    'algebra','calculus','physics','mechanics','electromagnetic','wave function',
    'ohm','newton','f = ma','quantum','manim','theorem','proof','geometry','plot','axis',
  ];
  return manimKeywords.some(k => text.includes(k)) ? 'manim' : 'veo';
}

export async function processSceneAssets(scene_id: string, org_id: string, visual_prompt: string, narration: string, duration: number, rendererOverride?: string) {
  const kind = (rendererOverride || '').toLowerCase();
  let renderer: 'manim' | 'veo' =
      kind === 'manim' ? 'manim'
    : (kind === 'video' || kind === 'talking_head') ? 'veo'
    : detectRendererFromPrompt(visual_prompt);`;

code = code.replace(detectTarget, detectReplace);
fs.writeFileSync('server/videoPipeline.ts', code);
