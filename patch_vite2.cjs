const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

// Insert the plugin
const targetPlugin = `VitePWA({`;
const newPlugin = `{
        name: 'html-transform',
        transformIndexHtml(html) {
          return html.replace(
            /(<script type="module" crossorigin src="\/assets\/index-[^"]+\.js)("><\/script>)/,
            \`$1?v=\${Date.now()}$2\`
          );
        }
      },
      VitePWA({`;

code = code.replace(targetPlugin, newPlugin);
fs.writeFileSync('vite.config.ts', code);
