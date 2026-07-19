import { Cartesia } from '@cartesia/cartesia-js';
const cartesia = new Cartesia({ apiKey: 'test' });
const ws = cartesia.tts.websocket();
const context = ws.context({ model_id: 'sonic-3.5', voice: { mode: 'id', id: 'test' }});
context.send({ transcript: 'test', continue: true });
