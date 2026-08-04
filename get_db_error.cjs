require('dotenv').config();
const { dbReady } = require('./dist/server.cjs');
// wait, requiring dist/server.cjs failed because of Vite config error!
