const { GoogleGenAI, Modality } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const configDir = path.join(homeDir, '.config', 'M-WA', 'setting');
const settingPath = path.join(configDir, 'gemini.json');

const defaultConfig = {
  apikey: "",
  MaxHistory: 10,
  instruction: "Respond briefly to each question."
};

if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
if (!fs.existsSync(settingPath)) {
  fs.writeFileSync(settingPath, JSON.stringify(defaultConfig, null, 2));
}

let configData = { ...defaultConfig };

function readConfig() {
  try {
    const data = JSON.parse(fs.readFileSync(settingPath, 'utf-8'));
    configData = { ...defaultConfig, ...data };
  } catch (e) {
    configData = { ...defaultConfig };
  }
}

readConfig();

let ai = new GoogleGenAI({ apiKey: configData.apikey });

fs.watchFile(settingPath, { interval: 500 }, (curr, prev) => {
  if (curr.mtime.getTime() !== prev.mtime.getTime()) {
    readConfig();
    ai = new GoogleGenAI({ apiKey: configData.apikey });
    //console.log('[INFO] Config updated:', configData);
  }
});

let conversationHistory = [];
let MAX_HISTORY = configData.MaxHistory || 10;

async function generateText(model, newContents) {
  MAX_HISTORY = configData.MaxHistory || 10;

  const recentHistory = conversationHistory.slice(-MAX_HISTORY);
  const fullContents = [...recentHistory, ...newContents];

  const result = await ai.models.generateContent({
    model,
    contents: fullContents,
    config: {
      maxOutputTokens: 500,
      temperature: 0.3,
      systemInstruction: configData.instruction || "Respond briefly to each question.",
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

async function generateImage(prompt) {
  const userContent = { role: "user", parts: [{ text: prompt }] };
  conversationHistory.push(userContent);

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash-preview-image-generation",
    contents: [userContent],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const parts = result.candidates?.[0]?.content?.parts || [];

  let text = '';
  let imageBase64 = '';

  for (const part of parts) {
    if (part.text) text += part.text;
    else if (part.inlineData) imageBase64 = part.inlineData.data;
  }

  const assistantParts = [];
  if (text) assistantParts.push({ text });
  if (imageBase64) assistantParts.push({
    inlineData: {
      mimeType: "image/png",
      data: imageBase64
    }
  });

  conversationHistory.push({ role: "assistant", parts: assistantParts });

  MAX_HISTORY = configData.MaxHistory || 10;
  if (conversationHistory.length > MAX_HISTORY * 2) {
    conversationHistory = conversationHistory.slice(conversationHistory.length - MAX_HISTORY * 2);
  }

  return {
    text,
    imageBase64,
  };
}

module.exports = {
  generateText, generateImage,
};
