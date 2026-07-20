import { Cartesia } from '@cartesia/cartesia-js';

async function test() {
    const apiKey = 'sk_car_QQB5ASjUmTtgTJjtChes2F';
    const cartesia = new Cartesia({ apiKey });
    const ws = await cartesia.tts.websocket();
    
    ws.on('error', (err) => console.error(err));
    await ws.connect();
    
    const context = ws.context({
        model_id: 'sonic-english', // wait, earlier I used sonic-3.5
        voice: {
            mode: 'id',
            id: 'a0e99841-438c-4a64-b679-ae501e7d6091'
        },
        output_format: {
            container: 'raw',
            encoding: 'pcm_f32le',
            sample_rate: 44100
        },
        add_timestamps: true
    });

    await context.send({ transcript: "Hello world, how are you today?" });
    
    for await (const message of context.receive()) {
        console.log("Message type:", message.type, Object.keys(message));
    }
    
    ws.close();
}

test().catch(console.error);
