const fs = require('fs');
const path = require('path');

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

module.exports = {
  ensureDirExists,
  readJSON,
  writeJSON,
  removeFile,
};
