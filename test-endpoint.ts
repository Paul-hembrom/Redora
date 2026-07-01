async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/topics/test_id/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // we'll get 401 Unauthorized if we don't have a token.
      },
      body: JSON.stringify({
        title: "Photosynthesis",
        org_context: "demo" // to skip personal limit? Wait, org_id="demo" uses school? No, "demo" doesn't match uuidRegex.
      })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body:", text);
  } catch(e: any) {
    console.error(e.message);
  }
}
test();
