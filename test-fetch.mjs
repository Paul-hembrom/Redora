try {
  const res = await fetch('/api/tts/elevenlabs');
  console.log('Success');
} catch (e) {
  console.error(e.message);
}
