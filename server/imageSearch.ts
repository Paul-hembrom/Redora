export async function searchImageForPrompt(query: string): Promise<string | null> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(`https://google.serper.dev/images?q=${encodeURIComponent(query)}&apiKey=${apiKey}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      return data.images[0].imageUrl || null;
    }
  } catch (e) {
    console.warn('searchImageForPrompt error:', e);
  }
  return null;
}
