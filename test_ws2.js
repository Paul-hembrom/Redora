import { Cartesia } from '@cartesia/cartesia-js';
const c = new Cartesia({ apiKey: 'test' });
console.log(Object.keys(c.tts));
