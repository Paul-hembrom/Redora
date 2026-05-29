try {
  const val = import.meta.env.VITE_DEEPSEEK_API_KEY;
} catch (e) {
  console.log("caught", e);
}
