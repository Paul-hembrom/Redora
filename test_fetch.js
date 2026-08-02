async function run() {
  const response = await fetch("https://paulhemb-redora.hf.space/");
  console.log(response.body.getReader ? "YES" : "NO");
}
run();
