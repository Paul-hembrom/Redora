import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/server.js',
  format: 'esm',
  external: ['better-sqlite3', 'bcryptjs', 'express', 'cors', 'jsonwebtoken', 'cookie-parser', 'dotenv', 'vite'],
}).catch(() => process.exit(1));
