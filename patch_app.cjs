const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldPostCode = `        const finalDoc: Document = {
          id: tempDocId,
          name: file.name,
          uploadDate: new Date().toISOString(),
          chapters
        };
        
        const res = await fetch('/api/documents', {`;

const newPostCode = `        const { hashFile } = await import('./lib/documentProcessor');
        const contentHash = await hashFile(file);
        const finalDoc: any = {
          id: tempDocId,
          name: file.name,
          uploadDate: new Date().toISOString(),
          chapters,
          contentHash
        };
        
        const res = await fetch('/api/documents', {`;

code = code.replace(oldPostCode, newPostCode);

// Also need to handle duplicate errors locally in App.tsx
const oldCatchCode = `    } catch (err: any) {
      console.error("Upload process error:", err);
      let errorMsg = err.message || 'An error occurred during upload';
      if (err.message === 'DUPLICATE_DOCUMENT') {`;

const newCatchCode = `    } catch (err: any) {
      console.error("Upload process error:", err);
      let errorMsg = err.message || 'An error occurred during upload';
      if (err.message === 'DUPLICATE_DOCUMENT') {
        errorMsg = 'This document has already been uploaded.';
      } else if (err.message === 'UPLOAD_IN_PROGRESS') {
        errorMsg = 'This document is currently being processed. Please wait.';
      }
      if (err.message === 'DUPLICATE_DOCUMENT' && code.indexOf("err.message === 'DUPLICATE_DOCUMENT'") > -1) {`;

code = code.replace(`    } catch (err: any) {
      console.error("Upload process error:", err);
      let errorMsg = err.message || 'An error occurred during upload';`, `    } catch (err: any) {
      console.error("Upload process error:", err);
      let errorMsg = err.message || 'An error occurred during upload';
      if (err.message?.includes('DUPLICATE_DOCUMENT')) errorMsg = 'This document has already been uploaded.';
      if (err.message?.includes('UPLOAD_IN_PROGRESS')) errorMsg = 'This document is currently being processed. Please wait.';`);

fs.writeFileSync('src/App.tsx', code);
