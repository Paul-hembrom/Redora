const https = require('https');
const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;

if (!apiKey) {
    console.log("No API key");
    process.exit(0);
}

const req = https.request('https://api.elevenlabs.io/v1/text-to-speech/JwEIvMzFlLwrArLvqeM5/stream?with_timestamps=true', {
    method: 'POST',
    headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => {
        data += chunk;
        console.log("CHUNK:", chunk.toString().slice(0, 50) + "...");
    });
    res.on('end', () => {
        console.log("END");
    });
});

req.write(JSON.stringify({
    text: "Hello, this is a test.",
    model_id: "eleven_flash_v2_5"
}));
req.end();
