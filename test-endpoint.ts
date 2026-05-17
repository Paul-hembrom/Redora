import { GoogleGenAI } from '@google/genai';
import ytSearch from 'yt-search';
import { config } from 'dotenv';
config();

async function run() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const prompt = `
You are an expert Educational Video Retrieval Engine.
Your task is to find the best educational YouTube videos for a specific chapter context.

Chapter Title: Introduction to Photosynthesis
Summary: This chapter introduces the process of photosynthesis in plants.
Subject: Biology
Grade Level: High School
Key Concepts: Light-dependent reactions, Calvin cycle

Step 1: Extract the core learning intent from the chapter summary.
Step 2: Break down the learning intent into key concepts (especially visual ones).
Step 3: Generate 5-10 highly optimized YouTube search queries suitable for the specified grade level (e.g., "Photosynthesis animation middle school").
Step 4: Predict ideal videos and assign a "quality_score" out of 100 based on expected educational clarity, animation quality, and grade-level match.

Return ONLY valid JSON exactly matching this schema:
{
  "chapter": "string",
  "learning_intent": "string",
  "intent_quality_score": 100,
  "key_concepts": ["string"],
  "search_queries": ["string"],
  "recommended_videos": [
    {
      "title": "string",
      "channel": "string",
      "reason": "string",
      "search_query_used": "string",
      "video_id": "string",
      "embed_type": "string",
      "quality_score": 100
    }
  ]
}
Leave "video_id" empty if unsure, do not invent 11-char IDs.
`;

try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    let parsedData = JSON.parse(responseText.trim().replace(/^```json/, '').replace(/```$/, ''));
    
    const groundedVideos = [];
    for (const vid of parsedData.recommended_videos) {
      if (!vid.video_id || vid.video_id.length !== 11) {
        try {
          const searchResult = await ytSearch(vid.search_query_used || vid.title);
          if (searchResult && searchResult.videos.length > 0) {
            vid.video_id = searchResult.videos[0].videoId;
            vid.real_title = searchResult.videos[0].title;
            if (!vid.channel) vid.channel = searchResult.videos[0].author.name;
          }
        } catch (e) {
          console.error("YT Search Error:", e);
        }
      }
      
      if (vid.video_id && vid.video_id.length === 11) {
        groundedVideos.push(vid);
      }
    }
    console.log("Successfully parsed " + groundedVideos.length + " videos");
    
} catch (error) {
    console.error("Error!", error);
}
}
run();
