const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Direktori konfigurasi dan API Key
const homeDir = os.homedir();
const configDir = path.join(homeDir, '.config', 'M-WA', 'setting');
const settingPath = path.join(configDir, 'gemini.json');

// Buat folder dan file default jika belum ada
if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
if (!fs.existsSync(settingPath)) {
  fs.writeFileSync(settingPath, JSON.stringify({ apikey: '' }, null, 2));
}

// Fungsi baca API key
function readApiKey() {
  try {
    const data = JSON.parse(fs.readFileSync(settingPath, 'utf-8'));
    return data.apikey || '';
  } catch {
    return '';
  }
}

let ai = new GoogleGenAI({ apiKey: readApiKey() });

// Watch perubahan API key
fs.watchFile(settingPath, { interval: 500 }, (curr, prev) => {
  if (curr.mtime.getTime() !== prev.mtime.getTime()) {
    const newKey = readApiKey();
    ai = new GoogleGenAI({ apiKey: newKey });
    console.log('[INFO] API key updated:', newKey);
  }
});

// Memory percakapan (sesi sementara)
let conversationHistory = [];

async function generateText(model, prompt) {
  // Tambahkan pertanyaan user
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

  // Tambahkan jawaban AI
  conversationHistory.push({ role: "model", parts: [{ text: reply }] });

  return reply;
}

// Reset memory sesi
function resetMemory() {
  conversationHistory = [];
}

module.exports = {
  generateText,
  resetMemory,
};
