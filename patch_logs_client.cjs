const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

code = code.replace(
    /const timeUpdateHandler = \(\) => \{/,
    `console.log("wordSpans computed:", wordSpans.length, "valid spans:", wordSpans.filter(Boolean).length);
        const timeUpdateHandler = () => {`
);

fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
console.log("patched client logs");
