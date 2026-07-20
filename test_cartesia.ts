import { Cartesia } from '@cartesia/cartesia-js';

async function test() {
    const cartesia = new Cartesia({ apiKey: process.env.CARTESIA_API_KEY });
    const ws = await cartesia.tts.websocket();
    
    ws.on('error', (err) => console.error(err));
    await ws.connect();
    
    const context = ws.context({
        model_id: 'sonic',
        voice: {
            mode: 'id',
            id: '79a125e8-cd45-4c13-8a67-188112f4dd22'
        },
        output_format: {
            container: 'raw',
            encoding: 'pcm_f32le',
            sample_rate: 44100
        }
    });

    await context.send({ transcript: "Hello world, how are you today?" });
    
    for await (const message of context.receive()) {
        console.log("Message type:", message.type, Object.keys(message));
    }
    
    ws.close();
}

test().catch(console.error);
