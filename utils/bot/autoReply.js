const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = function setupAutoReply(sock) {
  const homeDir = os.homedir();
  const autoRepliesPath = path.join(homeDir, '.config', 'M-WA', 'auto-reply', 'autoReply.json');
  let autoReplies = [];
  const defaultReplies = [
    {
      id: 1,
      value: "!ping",
      response: "pong!"
    }
  ];

  function loadAutoReplies() {
    try {
      if (!fs.existsSync(autoRepliesPath)) {
        const dir = path.dirname(autoRepliesPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(autoRepliesPath, JSON.stringify(defaultReplies, null, 2), 'utf-8');
        autoReplies = defaultReplies;
      } else {
        const data = fs.readFileSync(autoRepliesPath, 'utf-8');
        autoReplies = JSON.parse(data);
      }
      //console.log('[AutoReply] Loaded autoReply.json with', autoReplies.length, 'entries');
    } catch (err) {
      console.error('[AutoReply] Failed to load autoReply.json:', err);
    }
  }

  loadAutoReplies();

  fs.watch(autoRepliesPath, (eventType) => {
    if (eventType === 'change') {
      //console.log('[AutoReply] autoReply.json changed, reloading...');
      loadAutoReplies();
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || m.type !== 'notify') return;

    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const trimmedMessage = messageContent.trim();

    const matched = autoReplies.find(r => r.value === trimmedMessage);
    if (matched) {
      try {
        await sock.sendMessage(msg.key.remoteJid, { text: matched.response });
      } catch (err) {
        console.error('Failed to send auto reply:', err);
      }
    }
  });
};
