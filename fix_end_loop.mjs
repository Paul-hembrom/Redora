import fs from 'fs';
import { execSync } from 'child_process';

let originalContent = fs.readFileSync('server.ts', 'utf-8');
// remove anything after the last */
originalContent = originalContent.substring(0, originalContent.lastIndexOf('*/') + 2);

let suffixes = [
  "",
  "\n}",
  "\n}\n}",
  "\n}\n}\n}",
  "\n};\n",
  "\n};\n}\n",
  "\n};\n}\n}\n",
  "\n};\n};\n",
  "\n});\n",
  "\n});\n}\n",
  "\n});\n}\n}\n",
];

let success = false;
for (let suffix of suffixes) {
  console.log("Trying suffix: " + JSON.stringify(suffix));
  fs.writeFileSync('server.ts', originalContent + suffix);
  try {
    // just check with esbuild since it's much faster
    execSync("npx esbuild server.ts --bundle --platform=node > /dev/null 2>&1");
    console.log("SUCCESS!");
    success = true;
    break;
  } catch (e) {
    // try next
  }
}

if (!success) {
   // let's try up to 10 braces
   for(let i = 1; i <= 10; i++) {
      for (let j = 0; j <= 5; j++) {
         let s = originalContent + "\n" + "}".repeat(j) + "\n" + "});\n".repeat(i) + "}\n".repeat(5-j);
         fs.writeFileSync('server.ts', s);
         try {
           execSync("npx esbuild server.ts --bundle --platform=node > /dev/null 2>&1");
           console.log("SUCCESS with complex!");
           success = true;
           break;
         } catch (e) {}
      }
      if (success) break;
   }
}
