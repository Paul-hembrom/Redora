const fs = require('fs');
let code = fs.readFileSync('src/components/ReadAloudButton.tsx', 'utf8');

const regex = /      };\n      };\n      \n      \/\/ Start reading the stream/;
if (regex.test(code)) {
    code = code.replace(regex, '      };\n\n      // Start reading the stream');
    fs.writeFileSync('src/components/ReadAloudButton.tsx', code);
    console.log('fixed syntax 3');
} else {
    console.log('no match');
}
