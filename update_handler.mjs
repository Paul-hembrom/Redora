import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');

const routeStart = "app.post('/api/curriculum/generate', authenticate, async (req: any, res) => {";
const routeEndStr = 'console.log(\'=== END ROUTES ===\');';

const startIdx = content.indexOf(routeStart);
const endIdx = content.indexOf(routeEndStr, startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.log("Could not find route boundaries");
    process.exit(1);
}

const originalRoute = content.substring(startIdx, endIdx);

// We want to replace the `for (const item of items) {` with our concurrent logic.
// Original structure:
// const results = [];
// for (const item of items) {
//   ...
//   results.push({ subtopic, status: "success" });
// } catch(err: any) {
//   ...
//   results.push({ subtopic, status: "error", error: err.message });
// }
// }
// res.json(results);

// We need to parse the inner block of `for (const item of items) {` and wrap it into `processItem(index)`

const forLoopStart = "const results = [];\n    \n    for (const item of items) {";
const forLoopEnd = "results.push({ subtopic, status: \"error\", error: err.message });\n      }\n    }\n    \n    res.json(results);";

const loopStartIdx = originalRoute.indexOf("const results = [];");
const loopEndIdx = originalRoute.indexOf("res.json(results);") + "res.json(results);".length;

const loopBlock = originalRoute.substring(loopStartIdx, loopEndIdx);

const newLogic = `const results = new Array(items.length);
    let currentIndex = 0;

    const processItem = async (index: number) => {
      const item = items[index];
      const { grade, subject, title, subtopic, generateQuestions } = item;
      
      try {` + loopBlock.substring(
        loopBlock.indexOf('try {', loopBlock.indexOf('const { grade')) + 5,
        loopBlock.indexOf('results.push({ subtopic, status: "success" });')
      ) + `results[index] = { subtopic, status: "success" };
      } catch(err: any) {
        console.error(\`Error generating curriculum for \${subtopic}:\`, err);
        results[index] = { subtopic, status: "error", error: err.message };
      }
    };

    const workers = [];
    const concurrency = 3;
    for (let i = 0; i < concurrency; i++) {
      workers.push((async () => {
        while (currentIndex < items.length) {
          const index = currentIndex++;
          await processItem(index);
        }
      })());
    }

    await Promise.all(workers);

    res.json(results);`;

let newRoute = originalRoute.replace(loopBlock, newLogic);

content = content.substring(0, startIdx) + newRoute + content.substring(endIdx);
fs.writeFileSync('server.ts', content);
console.log("Updated handler successfully");
