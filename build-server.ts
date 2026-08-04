import * as esbuild from 'esbuild';
esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/server.cjs',
  format: 'cjs',
  packages: 'external',
}).catch(() => process.exit(1));
