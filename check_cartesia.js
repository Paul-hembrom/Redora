"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cartesia_js_1 = require("@cartesia/cartesia-js");
const cartesia = new cartesia_js_1.Cartesia({ apiKey: 'test' });
const ws = cartesia.tts.websocket();
const context = ws.context({ model_id: 'sonic-3.5', voice: { mode: 'id', id: 'test' } });
context.send({ transcript: 'test', continue: true });
