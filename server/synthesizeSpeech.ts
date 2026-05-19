import { GoogleGenAI, Modality } from "@google/genai";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";

// Returns a URL path to the generated audio
export async function synthesizeSpeech(text: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text }] }],
    config: {
      systemInstruction: "A friendly, approachable science teacher with a warm smile in their voice, occasionally playful when making jokes, always patient and clear during explanations.",
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("No audio data returned from Gemini TTS");
  }

  const pcmBuffer = Buffer.from(base64Audio, "base64");
  
  // Create WAV header for 24kHz, Mono, 16-bit PCM
  const numChannels = 1;
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  
  const wavHeader = Buffer.alloc(44);
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + dataSize, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16); // Subchunk1Size
  wavHeader.writeUInt16LE(1, 20);  // AudioFormat (PCM)
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  const buffer = Buffer.concat([wavHeader, pcmBuffer]);
  
  // Ensure public/audio directory exists
  const audioDir = path.join(process.cwd(), "public", "audio");
  await fs.mkdir(audioDir, { recursive: true });

  const fileName = `${uuidv4()}.wav`;
  const filePath = path.join(audioDir, fileName);

  await fs.writeFile(filePath, buffer);

  return `/audio/${fileName}`;
}
