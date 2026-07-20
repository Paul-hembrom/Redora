const fs = require('fs');

async function test() {
    const res = await fetch('http://localhost:3000/api/tts/cartesia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: "Hello **world**, how are you?", highQuality: false })
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log(decoder.decode(value));
    }
}
test();
