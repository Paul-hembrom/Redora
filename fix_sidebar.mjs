import fs from 'fs';

let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

// Find where isStudent is defined/used, and add a check for curriculum doc.
content = content.replace(
`        {sortedDocs.length === 0 && !isUploading && (`,
`        {sortedDocs.length === 0 && !isUploading && (`);

// In the map function:
// const isDocStudent = isStudent || doc.id.startsWith('curr_');
const targetMapStart = `        {sortedDocs.map(doc => {`;
const replacementMapStart = `        {sortedDocs.map(doc => {
          const isCurriculum = doc.id.startsWith('curr_');
          const isDocStudent = isStudent || isCurriculum;`;

content = content.replace(targetMapStart, replacementMapStart);

// Replace isStudent with isDocStudent inside the map body
content = content.replace(/!isStudent && \(/g, '!isDocStudent && (');
content = content.replace(/!isStudent && <button/g, '!isDocStudent && <button');

fs.writeFileSync('src/components/Sidebar.tsx', content);
console.log('done');
