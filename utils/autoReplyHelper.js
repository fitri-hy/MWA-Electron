const fs = require('fs');
const os = require('os');
const path = require('path');

const autoRepliesPath = path.join(os.homedir(), '.config', 'M-WA', 'auto-reply', 'autoReply.json');

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
    fs.mkdir(path.dirname(autoRepliesPath), { recursive: true }, (err) => {
      if (err) return callback(err);
      fs.writeFile(autoRepliesPath, JSON.stringify(defaultData, null, 2), 'utf8', callback);
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

function saveAutoReplies(data, callback) {
  fs.writeFile(autoRepliesPath, JSON.stringify(data, null, 2), 'utf8', callback);
}

module.exports = {
  ensureAutoRepliesFile,
  readAutoReplies,
  saveAutoReplies
};
