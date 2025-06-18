const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const configDir = path.join(homeDir, '.config', 'M-WA', 'setting');
const settingPath = path.join(configDir, 'gemini.json');

if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
if (!fs.existsSync(settingPath)) {
  fs.writeFileSync(settingPath, JSON.stringify({ apikey: '' }, null, 2));
}

function readApiKey() {
  try {
    const data = JSON.parse(fs.readFileSync(settingPath, 'utf-8'));
    return data.apikey || '';
  } catch {
    return '';
  }
}

let ai = new GoogleGenAI({ apiKey: readApiKey() });

fs.watchFile(settingPath, { interval: 500 }, (curr, prev) => {
  if (curr.mtime.getTime() !== prev.mtime.getTime()) {
    const newKey = readApiKey();
    ai = new GoogleGenAI({ apiKey: newKey });
    //console.log('[INFO] API key updated:', newKey);
  }
});

let conversationHistory = [];
const MAX_HISTORY = 10;

async function generateText(model, newContents) {
  
  const recentHistory = conversationHistory.slice(-MAX_HISTORY);
  const fullContents = [...recentHistory, ...newContents];

  const result = await ai.models.generateContent({
    model,
    contents: fullContents,
    config: {
      maxOutputTokens: 500,
      temperature: 0.3,
      systemInstruction: "Respond briefly to each question.",
    },
  });

  const replyText = result.text.trim();

  newContents.forEach(content => {
    conversationHistory.push(content);
  });

  conversationHistory.push({ role: "assistant", parts: [{ text: replyText }] });

  if (conversationHistory.length > MAX_HISTORY * 2) {
    conversationHistory = conversationHistory.slice(conversationHistory.length - MAX_HISTORY * 2);
  }

  return replyText;
}

module.exports = {
  generateText,
};
