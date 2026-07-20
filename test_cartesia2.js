import CartesiaClient from "@cartesia/cartesia-js";
const client = new CartesiaClient({ apiKey: process.env.CARTESIA_API_KEY });
async function test() {
    const ws = await client.tts.websocket();
    ws.on('error', err => console.log('error', err));
    ws.on('open', async () => {
        const ctx = ws.context({
            model_id: 'sonic-english',
            voice: { mode: 'id', id: 'a0e99841-438c-4a64-b679-ae501e7d6091' },
            output_format: { container: 'raw', encoding: 'pcm_f32le', sample_rate: 44100 },
            add_timestamps: true
        });
        await ctx.send({ transcript: "Hello world!" });
        for await (const msg of ctx.receive()) {
            if (msg.word_timestamps) {
                console.log(msg.word_timestamps);
            }
        }
        ws.close();
    });
}
test();
