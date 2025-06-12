const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const configDir = path.join(homeDir, '.config', 'M-WA', 'setting');
const settingPath = path.join(configDir, 'gemini.json');

if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

if (!fs.existsSync(settingPath)) {
  fs.writeFileSync(settingPath, JSON.stringify({ apikey: '' }, null, 2));
}

function readApiKey() {
  try {
    const data = JSON.parse(fs.readFileSync(settingPath, 'utf-8'));
    return data.apikey || '';
  } catch (err) {
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

async function generateText(model, prompt) {
  const systemInstruction = "Respond to messages briefly but clearly. Tailor your language to the question.";
  const fullPrompt = systemInstruction + "\n\n" + prompt;

  const response = await ai.models.generateContent({
    model,
    contents: fullPrompt,
    config: {
      maxOutputTokens: 500,
      temperature: 0.1,
    },
  });

  return response.text.trim();
}


module.exports = {
  generateText
};
