import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
let key = process.env.GEMINI_API_KEY;
if (!key) {
  const match = envFile.match(/GEMINI_API_KEY=(.+)/);
  if (match) key = match[1];
}

const ai = new GoogleGenAI({ apiKey: key });
async function run() {
  try {
    console.log("Testing gemini-2.5-flash-image...");
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: "draw a red apple",
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    console.log("Success gemini-2.5-flash-image:", res?.candidates?.[0]?.content?.parts?.[0]?.inlineData ? "Got image format" : "No image");
  } catch (e: any) {
    console.log("Error 2.5:", e.message, e.status);
  }

  try {
    console.log("Testing gemini-3.1-flash-image-preview...");
    const res2 = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: "draw a red apple",
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    console.log("Success gemini-3.1-flash-image-preview:", res2?.candidates?.[0]?.content?.parts?.[0]?.inlineData ? "Got image format" : "No image");
  } catch (e: any) {
    console.log("Error 3.1:", e.message, e.status);
  }
}
run();
