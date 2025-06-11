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

// Add Modal
const addAutoReply = document.getElementById('addAutoReply');
const closeAutoReplyModal = document.getElementById('closeAutoReplyModal');
const addAutoReplyModal = document.getElementById('addAutoReplyModal');
addAutoReply.addEventListener('click', () => addAutoReplyModal.classList.remove('hidden'));
closeAutoReplyModal.addEventListener('click', () => addAutoReplyModal.classList.add('hidden'));

// Edit Modal
const editButtons = document.querySelectorAll('[id="editAutoReply"]');
const editAutoReplyModal = document.getElementById('editAutoReplyModal');
const closeEditAutoReplyModal = document.getElementById('closeEditAutoReplyModal');

const editId = document.getElementById('edit-id');
const editValue = document.getElementById('edit-value');
const editResponse = document.getElementById('edit-response');

editButtons.forEach(button => {
  button.addEventListener('click', () => {
    const id = button.getAttribute('data-id');
    const value = button.getAttribute('data-value');
    const response = button.getAttribute('data-response');

    editId.value = id;
    editValue.value = value;
    editResponse.value = response;

    editAutoReplyModal.classList.remove('hidden');
  });
});

closeEditAutoReplyModal.addEventListener('click', (e) => {
  e.preventDefault();
  editAutoReplyModal.classList.add('hidden');
});

// Flash
window.addEventListener('DOMContentLoaded', () => {
	const flash = document.getElementById('flash-message');
	if (flash) {
		setTimeout(() => {
			flash.style.transition = 'opacity 0.5s ease';
			flash.style.opacity = '0';
			setTimeout(() => flash.remove(), 500);
		}, 3000);
	}
});

// Edit Greeting Modal
const editBtn = document.getElementById('editFirstMessage');
const modal = document.getElementById('editFirstMessageModal');
const form = document.getElementById('editFirstMessageForm');
const cancelBtn = document.getElementById('cancelEdit');
const input = document.getElementById('firstMessageInput');

editBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
});

cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = input.value.trim();
  const enabled = form.querySelector('input[name="enabled"]:checked').value;

  const res = await fetch('/auto-reply/first-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, enabled })
  });

  if (res.ok) {
    location.reload();
  } else {
    alert('Gagal menyimpan pesan.');
  }
});