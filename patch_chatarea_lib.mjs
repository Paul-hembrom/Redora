import fs from 'fs';

let chatAreaTsx = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
chatAreaTsx = chatAreaTsx.replace(/lib\.cacheWholeTopic/g, "cacheWholeTopic");

if (!chatAreaTsx.includes("cacheWholeTopic")) {
  console.log("No cacheWholeTopic found!");
}

if (!chatAreaTsx.includes("import { cacheWholeTopic }") && chatAreaTsx.includes("cacheWholeTopic")) {
    chatAreaTsx = chatAreaTsx.replace(
        /import \{([^}]+)\} from '\.\.\/lib\/offline';/, 
        "import { $1, cacheWholeTopic } from '../lib/offline';"
    );
}

fs.writeFileSync('src/components/ChatArea.tsx', chatAreaTsx);
console.log('Patched ChatArea lib!');
