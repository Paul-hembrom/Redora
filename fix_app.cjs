const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/import \{ \$\{p1\}, Maximize2, Minimize2 \} from 'lucide-react';/, "import { Settings, PlayCircle, Library, Loader2, Sparkles, BookOpen, Clock, Trash2, ArrowRight, Menu, X, Share2, UploadCloud, FileText, CheckCircle2, ChevronRight, Video, FileQuestion, Search, Shield, Info, LogOut, PanelLeftClose, PanelLeftOpen, MessageSquare, Plus, FileImage, User as UserIcon, LogIn, Lock, Check, Zap, Globe, CloudOff, Target, Sun, Moon, RefreshCw, Smartphone, Maximize2, Minimize2 } from 'lucide-react';");

fs.writeFileSync('src/App.tsx', code);
