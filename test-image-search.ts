import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

async function run() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: "Find 3 direct image URLs about photosynthesis.",
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    console.log(response.text);
  } catch (e: any) {
    console.error(e.message, e.status, e.error);
  }
}
run();
