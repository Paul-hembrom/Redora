const apiKey = process.env.CARTESIA_API_KEY || process.env.VITE_CARTESIA_API_KEY;
fetch('https://api.cartesia.ai/tts/voices', {
  headers: { 'X-API-Key': apiKey, 'Cartesia-Version': '2024-01-01' }
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
});
