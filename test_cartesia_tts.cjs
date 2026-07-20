async function test() {
    const res = await fetch('http://localhost:3000/api/tts/cartesia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: "Hello **world**, this is A.I.", highQuality: false })
    });
    const text = await res.text();
    console.log("Response:", text.substring(0, 500));
}
test();
