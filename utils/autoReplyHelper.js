const fs = require('fs');
const os = require('os');
const path = require('path');

const configDir = path.join(os.homedir(), '.config', 'M-WA', 'auto-reply');
const autoRepliesPath = path.join(configDir, 'autoReply.json');
const firstMessagePath = path.join(configDir, 'firstMessage.json');
const firstTimeUsersPath = path.join(configDir, 'firstTimeUsers.json');

function ensureDir(callback) {
  fs.mkdir(configDir, { recursive: true }, callback);
}

function ensureAutoRepliesFile(callback) {
  fs.access(autoRepliesPath, fs.constants.F_OK, (err) => {
    if (!err) return callback(null);
    const defaultData = [
      {
        id: 1,
        value: "!ping",
        response: "pong!"
      }
    ];
    ensureDir((mkdirErr) => {
      if (mkdirErr) return callback(mkdirErr);
      fs.writeFile(autoRepliesPath, JSON.stringify(defaultData, null, 2), 'utf8', callback);
    });
  });
}

function ensureFirstMessageFile(callback) {
  fs.access(firstMessagePath, fs.constants.F_OK, (err) => {
    if (!err) return callback(null);
    const defaultMessage = {
      message: "Hello! Thank you for contacting me. How can I help you?",
      enabled: false
    };
    ensureDir((mkdirErr) => {
      if (mkdirErr) return callback(mkdirErr);
      fs.writeFile(firstMessagePath, JSON.stringify(defaultMessage, null, 2), 'utf8', callback);
    });
  });
}

function readAutoReplies(callback) {
  fs.readFile(autoRepliesPath, 'utf8', (err, data) => {
    if (err) return callback(err);
    try {
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) throw new Error('Invalid JSON format.');
      callback(null, parsed);
    } catch (e) {
      callback(e);
    }
  });
}

function readFirstMessage(callback) {
  fs.readFile(firstMessagePath, 'utf8', (err, data) => {
    if (err) return callback(err);
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed.message !== 'string' || typeof parsed.enabled !== 'boolean') {
        throw new Error('Invalid firstMessage format.');
      }
      callback(null, {
        message: parsed.message,
        enabled: parsed.enabled
      });
    } catch (e) {
      callback(e);
    }
  });
}

function saveAutoReplies(data, callback) {
  fs.writeFile(autoRepliesPath, JSON.stringify(data, null, 2), 'utf8', callback);
}

function saveFirstMessage(messageObj, callback) {
  fs.writeFile(firstMessagePath, JSON.stringify(messageObj, null, 2), 'utf8', callback);
}

function clearFirstTimeUsers(callback) {
  fs.writeFile(firstTimeUsersPath, JSON.stringify([], null, 2), 'utf8', callback);
}

module.exports = {
  ensureAutoRepliesFile,
  readAutoReplies,
  saveAutoReplies,
  ensureFirstMessageFile,
  readFirstMessage,
  saveFirstMessage,
  clearFirstTimeUsers
};
