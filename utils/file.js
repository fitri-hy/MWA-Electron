const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const basePath = path.join(homeDir, '.config', 'M-WA');
const firstMessagePath = path.join(basePath, 'auto-reply', 'firstMessage.json');

const defaultFirstMessage = {
  message: "Hello! Thank you for contacting me. How can I help you?",
  enabled: false
};

const pathsToEnsure = [
  path.join(basePath, 'setting', 'setting.json'),
  path.join(basePath, 'setting', 'gemini.json'),
  path.join(basePath, 'pos', 'add-stock-record.json'),
  path.join(basePath, 'pos', 'write-off-stock-record.json'),
  path.join(basePath, 'pos', 'customer.json'),
  path.join(basePath, 'pos', 'inventory.json'),
  path.join(basePath, 'pos', 'invoice.json'),
  path.join(basePath, 'pos', 'vendor.json'),
  path.join(basePath, 'notes', 'note.json'),
  path.join(basePath, 'auto-reply', 'autoReply.json'),
  firstMessagePath,
];

pathsToEnsure.forEach(ensureFileWithEmptyArrayOrObject);

function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

function writeJSON(filePath, data) {
  ensureDirExists(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function removeFile(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function ensureFileWithEmptyArrayOrObject(filePath) {
  ensureDirExists(filePath);
  if (!fs.existsSync(filePath)) {
    const isFirstMessage = filePath === firstMessagePath;
    const content = isFirstMessage
      ? JSON.stringify(defaultFirstMessage, null, 2)
      : '[]';
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

function resetAllData() {
  pathsToEnsure.forEach(filePath => {
    const isFirstMessage = filePath === firstMessagePath;
    writeJSON(filePath, isFirstMessage ? defaultFirstMessage : []);
  });
}

module.exports = {
  ensureDirExists,
  readJSON,
  writeJSON,
  removeFile,
  ensureFileWithEmptyArray: ensureFileWithEmptyArrayOrObject,
  resetAllData,
};
