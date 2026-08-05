const fs = require('fs');
let code = fs.readFileSync('src/lib/documentProcessor.ts', 'utf8');

const oldProcessCode = `  } catch (error: any) {
    console.error('[documentProcessor] SPACE PIPELINE FAILED — falling back to local.', {`;

const newProcessCode = `  } catch (error: any) {
    // If it's a known duplicate or upload in progress, do NOT fallback
    if (error?.message?.includes('DUPLICATE_DOCUMENT') || error?.message?.includes('UPLOAD_IN_PROGRESS')) {
      throw error;
    }
    console.error('[documentProcessor] SPACE PIPELINE FAILED — falling back to local.', {`;

code = code.replace(oldProcessCode, newProcessCode);
fs.writeFileSync('src/lib/documentProcessor.ts', code);
