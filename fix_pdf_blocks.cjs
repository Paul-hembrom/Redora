const fs = require('fs');
let content = fs.readFileSync('src/lib/documentProcessor.ts', 'utf-8');

const regex = /try \{\s*const extractPdf = async \(\): Promise<\{ texts: string\[\], numPages: number \}> => \{/;
content = content.replace(regex, `const extractPdf = async (): Promise<{ texts: string[], numPages: number }> => {`);

const finallyRegex = /    \} catch \(error: any\) \{\n      console\.error\('\[documentProcessor\] PDF extraction failed:', error\);\n      throw new Error\(error\?\.message \|\| 'Could not extract text from PDF\. It may be protected or the OCR fallback failed\.'\);\n    \}\n  \}/;

const finallyReplacement = `    } catch (error: any) {
      console.error('[documentProcessor] PDF extraction failed:', error);
      throw new Error(error?.message || 'Could not extract text from PDF. It may be protected or the OCR fallback failed.');
    } finally {
      if (pdf && pdf.destroy) {
         try { await pdf.destroy(); } catch (e) {}
      }
    }
  }`;

content = content.replace(finallyRegex, finallyReplacement);
fs.writeFileSync('src/lib/documentProcessor.ts', content);
console.log("Fixed try block");
