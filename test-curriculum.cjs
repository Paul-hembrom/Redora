const fetch = require('node-fetch');

async function test() {
  const payload = [
    {
      grade: "Grade 5(Basic Level)",
      subject: "Science",
      title: "Scientific Learning Process",
      subtopic: "1.1 Scientific Learning",
      generateQuestions: true
    }
  ];

  try {
    const res = await fetch('http://localhost:3000/api/curriculum/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // 'Cookie': ... if needed, but the endpoint has 'authenticate' middleware which might block us
      },
      body: JSON.stringify(payload)
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
