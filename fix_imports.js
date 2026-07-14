import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "import { BookOpen, LogOut, User as UserIcon, Menu, X, Search, UploadCloud, Sun, Moon, Lock, RefreshCw } from 'lucide-react';",
  "import { BookOpen, LogOut, User as UserIcon, Menu, X, Search, UploadCloud, Sun, Moon, Lock, RefreshCw, Loader2 } from 'lucide-react';"
);

fs.writeFileSync('src/App.tsx', code);
