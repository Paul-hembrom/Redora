import fs from 'fs';

async function run() {
  const env = fs.readFileSync('.env', 'utf8');
  const key = env.match(/ELEVENLABS_API_KEY=(.*)/)[1].trim();

  // generate tiny audio
  const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/JwEIvMzFlLwrArLvqeM5?output_format=mp3_22050_32`;
  const ttsRes = await fetch(ttsUrl, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: "Hello world.", model_id: "eleven_flash_v2_5" })
  });
  const audioBuffer = await ttsRes.arrayBuffer();
  console.log("TTS audio size:", audioBuffer.byteLength);

  const fd = new FormData();
  fd.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3');
  fd.append('model_id', 'scribe_v1');
  fd.append('timestamps_granularity', 'word'); 

  const scribeRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: fd
  });
  console.log(scribeRes.status);
  console.log(await scribeRes.text());
}
run();
