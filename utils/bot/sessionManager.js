const path = require('path');
const fs = require('fs');
const os = require('os');
const pino = require('pino');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const setupAutoReply = require('./autoReply');

const sessions = {};
const homeDir = os.homedir();
const authBasePath = path.join(homeDir, '.config', 'M-WA', 'auth');

async function startSession(sessionId, socket) {
  const sessionDir = path.join(authBasePath, sessionId);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sessions[sessionId] = sock;
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) socket.emit('qr', { sessionId, qr });

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        //console.log(`Reconnecting session ${sessionId}`);
        restartSession(sessionId, socket);
      } else {
        //console.log(`Session ${sessionId} logged out`);
        delete sessions[sessionId];
        socket.emit('session-status', { sessionId, status: 'not_connected' });
      }
    }

    if (connection === 'open') {
      //console.log(`Session ${sessionId} connected!`);
      socket.emit('connected', { sessionId });
      socket.emit('session-status', { sessionId, status: 'connected' });
    }
  });

  setupAutoReply(sock);

  return sock;
}

async function restartSession(sessionId, socket) {
  try {
    await startSession(sessionId, socket);
  } catch (e) {
    console.error('Failed to restart session', e);
    socket.emit('error', { message: 'Failed to restart session' });
  }
}

function getSessions() {
  const sessionFolders = fs.existsSync(authBasePath) ? fs.readdirSync(authBasePath) : [];
  return sessionFolders.map(sessionId => ({
    sessionId,
    status: sessions[sessionId] ? 'connected' : 'not_connected',
  }));
}

function deleteSession(sessionId, socket) {
  if (sessions[sessionId]) {
    sessions[sessionId].logout().catch(console.error);
    delete sessions[sessionId];
  }
  const sessionDir = path.join(authBasePath, sessionId);
  fs.rm(sessionDir, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error('Failed to delete session folder', err);
      socket.emit('error', { message: 'Gagal hapus folder session' });
    } else {
      socket.emit('session-deleted', sessionId);
    }
  });
}

function disconnectSession(sessionId, socket) {
  if (sessions[sessionId]) {
    sessions[sessionId].logout().catch(console.error);
    delete sessions[sessionId];
    socket.emit('session-status', { sessionId, status: 'not_connected' });
  }
}

module.exports = {
  startSession,
  restartSession,
  getSessions,
  deleteSession,
  disconnectSession,
};
