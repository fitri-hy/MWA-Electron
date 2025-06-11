const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = function setupAutoReply(sock) {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.config', 'M-WA', 'auto-reply');
  const autoRepliesPath = path.join(configDir, 'autoReply.json');
  const firstTimeUsersPath = path.join(configDir, 'firstTimeUsers.json');
  const firstMessagePath = path.join(configDir, 'firstMessage.json');

  let autoReplies = [];
  let firstTimeUsers = new Set();
  let firstTimeMessage = '';
  let firstMessageEnabled = true;

  const defaultReplies = [
    {
      id: 1,
      value: "!ping",
      response: "pong!"
    }
  ];

  const defaultFirstMessage = {
    message: "Hello! Thank you for contacting me. How can I help you?",
    enabled: false
  };

  function ensureDir() {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  function loadAutoReplies() {
    try {
      ensureDir();
      if (!fs.existsSync(autoRepliesPath)) {
        fs.writeFileSync(autoRepliesPath, JSON.stringify(defaultReplies, null, 2), 'utf-8');
        autoReplies = defaultReplies;
      } else {
        const data = fs.readFileSync(autoRepliesPath, 'utf-8');
        autoReplies = JSON.parse(data);
      }
    } catch (err) {
      console.error('[AutoReply] Failed to load autoReply.json:', err);
    }
  }

  function loadFirstMessage() {
    try {
      if (!fs.existsSync(firstMessagePath)) {
        fs.writeFileSync(firstMessagePath, JSON.stringify(defaultFirstMessage, null, 2), 'utf-8');
      }
      const data = fs.readFileSync(firstMessagePath, 'utf-8');
      const parsed = JSON.parse(data);
      firstTimeMessage = parsed.message || defaultFirstMessage.message;
      firstMessageEnabled = parsed.enabled !== false;
    } catch (err) {
      //console.error('[AutoReply] Failed to load firstMessage.json:', err);
      firstTimeMessage = defaultFirstMessage.message;
      firstMessageEnabled = defaultFirstMessage.enabled;
    }
  }

  function loadFirstTimeUsers() {
    try {
      if (fs.existsSync(firstTimeUsersPath)) {
        const data = fs.readFileSync(firstTimeUsersPath, 'utf-8');
        firstTimeUsers = new Set(JSON.parse(data));
      }
    } catch (err) {
      console.error('[AutoReply] Failed to load firstTimeUsers.json:', err);
    }
  }

  function saveFirstTimeUsers() {
    try {
      fs.writeFileSync(firstTimeUsersPath, JSON.stringify([...firstTimeUsers], null, 2), 'utf-8');
    } catch (err) {
      console.error('[AutoReply] Failed to save firstTimeUsers.json:', err);
    }
  }

  loadAutoReplies();
  loadFirstMessage();
  loadFirstTimeUsers();

  fs.watch(autoRepliesPath, (eventType) => {
    if (eventType === 'change') {
      loadAutoReplies();
    }
  });

  fs.watch(firstMessagePath, (eventType) => {
    if (eventType === 'change') {
      loadFirstMessage();
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || m.type !== 'notify') return;

    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    const isPrivateChat = !remoteJid.endsWith('@g.us');

    if (isPrivateChat && firstMessageEnabled && !firstTimeUsers.has(remoteJid)) {
	  try {
		await sock.sendMessage(remoteJid, { text: firstTimeMessage });
		firstTimeUsers.add(remoteJid);
		saveFirstTimeUsers();
	  } catch (err) {
		console.error('[AutoReply] Failed to send first-time reply:', err);
	  }
	}

    const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const trimmedMessage = messageContent.trim();

    const matched = autoReplies.find(r => r.value === trimmedMessage);
    if (matched) {
      try {
        await sock.sendMessage(remoteJid, { text: matched.response });
      } catch (err) {
        console.error('Failed to send auto reply:', err);
      }
    }
  });
};
