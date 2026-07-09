async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/curriculum?grade=Grade%205(Basic%20Level)&subject=Science');
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Result items:", data ? data.chapters?.length : "none");
    if (data && data.chapters) {
      console.log("First chapter:", data.chapters[0]);
    }
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
