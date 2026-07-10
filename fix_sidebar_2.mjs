import fs from 'fs';

let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

// Reverse the global replace first
content = content.replace(/!isDocStudent && \(/g, '!isStudent && (');
content = content.replace(/!isDocStudent && <button/g, '!isStudent && <button');

// Now explicitly replace ONLY inside the map
const targetMapStart = `        {sortedDocs.map(doc => {
          const isCurriculum = doc.id.startsWith('curr_');
          const isDocStudent = isStudent || isCurriculum;`;

const endIndex = content.indexOf(`{sortedDocs.length === 0 && !isUploading && (`);
const mapSection = content.substring(content.indexOf(targetMapStart), endIndex);

const fixedMapSection = mapSection
    .replace(/!isStudent && \(/g, '!isDocStudent && (')
    .replace(/!isStudent && <button/g, '!isDocStudent && <button');

content = content.substring(0, content.indexOf(targetMapStart)) + fixedMapSection + content.substring(endIndex);

fs.writeFileSync('src/components/Sidebar.tsx', content);
console.log('done');
