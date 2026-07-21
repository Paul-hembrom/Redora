const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('useScrollSync')) {
    code = code.replace(
        "import { BookOpen,",
        "import { useScrollSync } from './hooks/useScrollSync';\nimport { BookOpen,"
    );
    
    code = code.replace(
        "export default function App() {",
        "export default function App() {\n  useScrollSync();"
    );
    
    fs.writeFileSync('src/App.tsx', code);
    console.log("Injected useScrollSync into App.tsx");
} else {
    console.log("useScrollSync already in App.tsx");
}
