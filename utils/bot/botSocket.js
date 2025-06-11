const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  startSession,
  getSessions,
  deleteSession,
  disconnectSession
} = require('./sessionManager');

const homeDir = os.homedir();
const authBasePath = path.join(homeDir, '.config', 'M-WA', 'auth');

function initBotSocket(io) {
  const botNamespace = io.of('/bot');

  botNamespace.on('connection', (socket) => {
    //console.log('Client connected to /bot namespace');

    socket.on('get-sessions', () => {
      try {
        const sessionsList = getSessions();
        socket.emit('sessions-list', sessionsList);
      } catch (e) {
        console.error('Failed to list sessions', e);
        socket.emit('error', { message: 'Gagal mengambil daftar session' });
      }
    });

    socket.on('start-session', async ({ sessionId }) => {
      if (!sessionId) return socket.emit('error', { message: 'Session ID tidak boleh kosong' });

      try {
        await startSession(sessionId, socket);
      } catch (e) {
        console.error('Failed to start session', e);
        socket.emit('error', { message: 'Failed to start session' });
      }
    });

    socket.on('disconnect-session', ({ sessionId }) => disconnectSession(sessionId, socket));
    socket.on('delete-session', ({ sessionId }) => deleteSession(sessionId, socket));

    socket.on('disconnect', () => {
      //console.log('Client disconnected from /bot namespace');
	  return;
    });
  });
}

module.exports = initBotSocket;
