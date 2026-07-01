import { GoogleGenAI } from "@google/genai";

try {
  const ai = new GoogleGenAI({ 
    apiKey: '',
    httpOptions: {
      retryOptions: {
        attempts: 5
      }
    }
  });
  console.log("Created successfully");
} catch(e: any) {
  console.error("Failed to create", e.message);
}
