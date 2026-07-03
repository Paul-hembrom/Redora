const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

// In callLLM, pass imageUrl ? 0 : 3 for maxRetries
code = code.replace(/try \{ return await callDeepSeek\(prompt, systemInstruction, responseFormat, maxTokens, 3, temperature \?\? 0\.2, imageUrl\); \} catch \(e\) \{ console\.warn\('DeepSeek failed, falling back to Gemini', e\); \}/, 
`try { 
      return await callDeepSeek(prompt, systemInstruction, responseFormat, maxTokens, imageUrl ? 0 : 3, temperature ?? 0.2, imageUrl); 
    } catch (e) { 
      console.warn('DeepSeek failed, falling back to Gemini', e); 
      if (imageUrl) throw e; 
    }`);

fs.writeFileSync('src/lib/gemini.ts', code);
