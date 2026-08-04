const fs = require('fs');
let content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const returnOld = `            return texts.join('\\n');
    } catch (error: any) {
      console.error('[documentProcessor] PDF extraction failed:', error);
      throw new Error(error?.message || 'Could not extract text from PDF. It may be protected or the OCR fallback failed.');
    }
  }`;

const returnNew = `            return texts.join('\\n');
    } catch (error: any) {
      console.error('[documentProcessor] PDF extraction failed:', error);
      throw new Error(error?.message || 'Could not extract text from PDF. It may be protected or the OCR fallback failed.');
    } finally {
      await pdf.destroy();
    }
  }`;

content = content.replace(returnOld, returnNew);
fs.writeFileSync('src/lib/documentProcessor.ts', content);
console.log("Fixed PDF memory leak 2");
