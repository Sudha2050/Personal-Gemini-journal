require('dotenv').config();
const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{role: "user", parts: [{text: "Hi"}]}]
    });
    console.log("SUCCESS:", res.text);
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
run();
