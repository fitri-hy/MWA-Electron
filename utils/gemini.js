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
    console.log('[INFO] API key updated:', newKey);
  }
});

let conversationHistory = [];

async function generateText(model, prompt) {
  conversationHistory.push({ role: "user", parts: [{ text: prompt }] });

  const result = await ai.models.generateContent({
    model,
    contents: conversationHistory,
    config: {
      maxOutputTokens: 500,
      temperature: 0.3,
    },
  });

  const reply = result.text.trim();
  conversationHistory.push({ role: "model", parts: [{ text: reply }] });

  return reply;
}

module.exports = {
  generateText,
};
