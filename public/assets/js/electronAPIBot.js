// Dark Mode
window.addEventListener('DOMContentLoaded', () => {
  const darkModeOn = localStorage.getItem('darkMode') === 'true';

  if (darkModeOn) {
    document.documentElement.classList.add('dark');
    const modeText = document.getElementById('mode-text');
    if (modeText) modeText.innerText = 'Dark Mode ON';
  } else {
    document.documentElement.classList.remove('dark');
    const modeText = document.getElementById('mode-text');
    if (modeText) modeText.innerText = 'Dark Mode OFF';
  }

  window.electronAPI.sendDarkModePreference(darkModeOn);
});

window.electronAPI.onToggleDarkMode((event, darkModeOn) => {
  if (darkModeOn) {
    document.documentElement.classList.add('dark');
    const modeText = document.getElementById('mode-text');
    if (modeText) modeText.innerText = 'Dark Mode ON';
  } else {
    document.documentElement.classList.remove('dark');
    const modeText = document.getElementById('mode-text');
    if (modeText) modeText.innerText = 'Dark Mode OFF';
  }
  localStorage.setItem('darkMode', darkModeOn);
});

// Main
const socket = io('/bot');
const sessionsBody = document.getElementById('sessionsBody');
const qrList = document.getElementById('qrList');
const addSessionForm = document.getElementById('addSessionForm');
const newSessionIdInput = document.getElementById('newSessionId');
const qrInstances = {};

const sessionStatusMap = {};

function renderSessionRow(sessionId, status) {
	let row = document.getElementById(`row-${sessionId}`);
	if (!row) {
		row = document.createElement('tr');
        row.className = 'border-b border-gray-200 dark:border-gray-800';
        row.id = `row-${sessionId}`;

        const idCell = document.createElement('td');
        idCell.className = 'px-4 py-2 w-full whitespace-nowrap';
        idCell.textContent = sessionId;

        const statusCell = document.createElement('td');
        statusCell.className = 'px-4 py-2 whitespace-nowrap';

        const actionsCell = document.createElement('td');
        actionsCell.className = 'px-4 py-2 whitespace-nowrap';

        row.appendChild(idCell);
        row.appendChild(statusCell);
        row.appendChild(actionsCell);
        sessionsBody.appendChild(row);
	}

	row.children[1].textContent = status === 'connected' ? 'Connected' : 'Not Connected';

	const actionsCell = row.children[2];
	actionsCell.innerHTML = '';

	if (status === 'connected') {
        const btnDelete = document.createElement('button');
        btnDelete.textContent = 'Delete';
        btnDelete.className = 'px-2 py-1 rounded bg-rose-500 hover:bg-rose-600 dark:bg-rose-700 dark:hover:bg-rose-600 text-white hover:scale-105 hover:duration-300 transition-all';
        btnDelete.onclick = () => {
          if (confirm(`Delete session "${sessionId}"? Ini akan menghapus folder session.`)) {
            socket.emit('delete-session', { sessionId });
            clearQRCode(sessionId);
          }
        };
        actionsCell.appendChild(btnDelete);
	} else {
        const btnConnect = document.createElement('button');
        btnConnect.textContent = 'Connect';
        btnConnect.className = 'px-2 py-1 rounded bg-green-500 hover:bg-green-600 dark:bg-green-700 dark:hover:bg-green-600 text-white hover:scale-105 hover:duration-300 transition-all mr-2';
        btnConnect.onclick = () => {
          socket.emit('start-session', { sessionId });
        };
        actionsCell.appendChild(btnConnect);

        const btnDelete = document.createElement('button');
        btnDelete.textContent = 'Delete';
        btnDelete.className = 'px-2 py-1 rounded bg-rose-500 hover:bg-rose-600 dark:bg-rose-700 dark:hover:bg-rose-600 text-white hover:scale-105 hover:duration-300 transition-all';
        btnDelete.onclick = () => {
          if (confirm(`Delete session "${sessionId}"? This will delete the session folder.`)) {
            socket.emit('delete-session', { sessionId });
            clearQRCode(sessionId);
          }
        };
        actionsCell.appendChild(btnDelete);
	}
}

function clearQRCode(sessionId) {
	if (qrInstances[sessionId]) {
		qrInstances[sessionId].clear();
		delete qrInstances[sessionId];
	}
	const container = document.getElementById(`qr-${sessionId}`);
	if (container) container.remove();
}

function renderQRCode(sessionId, qr) {
	let container = document.getElementById(`qr-${sessionId}`);
	if (!container) {
        container = document.createElement('div');
        container.id = `qr-${sessionId}`;
        container.className = 'bg-white flex flex-col items-center p-4 w-full';
        qrList.appendChild(container);
	}
	container.innerHTML = `<h3 class="font-semibold mb-2 overflow-hidden line-clamp-1 text-black">ID-${sessionId}</h3><div id="qrcode-${sessionId}"></div><p class="mt-2 text-sm text-center text-gray-700">Scan QR using WhatsApp</p>`;

	if (qrInstances[sessionId]) {
        qrInstances[sessionId].clear();
	}
	qrInstances[sessionId] = new QRCode(document.getElementById(`qrcode-${sessionId}`), {
        text: qr,
        width: 180,
        height: 180,
	});
}

socket.on('connect', () => {
      socket.emit('get-sessions');
});

socket.on('sessions-list', (sessions) => {
	sessions.forEach(({ sessionId, status }) => {
        sessionStatusMap[sessionId] = status;
        renderSessionRow(sessionId, status);
	});
});

socket.on('session-status', ({ sessionId, status }) => {
	sessionStatusMap[sessionId] = status;
	renderSessionRow(sessionId, status);

	if (status === 'connected') {
        clearQRCode(sessionId);
	}
});

socket.on('session-deleted', (sessionId) => {
	const row = document.getElementById(`row-${sessionId}`);
	if (row) row.remove();
	clearQRCode(sessionId);
	delete sessionStatusMap[sessionId];
});

socket.on('qr', ({ sessionId, qr }) => {
	renderQRCode(sessionId, qr);
});

socket.on('error', ({ message }) => {
	alert('Error: ' + message);
});

addSessionForm.addEventListener('submit', (e) => {
	e.preventDefault();
	const newSessionId = newSessionIdInput.value.trim();
	if (newSessionId.length === 0) {
        alert('Session ID cannot be empty.');
        return;
	}
	if (sessionStatusMap[newSessionId]) {
		alert('Session ID already exists.');
		return;
	}
	sessionStatusMap[newSessionId] = 'not_connected';
	renderSessionRow(newSessionId, 'not_connected');
	newSessionIdInput.value = '';
});