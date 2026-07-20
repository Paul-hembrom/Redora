import { Cartesia } from "@cartesia/cartesia-js";
const c = new Cartesia({apiKey: process.env.CARTESIA_API_KEY || "test"});
const ws = await c.tts.websocket();
console.log("ws has source?", !!ws.source);
console.log("ws has on?", !!ws.on);
ws.close();
