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
const AddNoteButton = document.getElementById('AddNoteButton');
const CloseNotesButton = document.getElementById('CloseNotesButton');
const AddNotesModal = document.getElementById('AddNotesModal');
AddNoteButton.addEventListener('click', () => AddNotesModal.classList.remove('hidden'));
CloseNotesButton.addEventListener('click', () => AddNotesModal.classList.add('hidden'));

// Edit Modal
const EditNoteButton = document.querySelectorAll('.EditNoteButton');
const EditNotesModal = document.getElementById('EditNotesModal');
const editIdInput = document.getElementById('editIdInput');
const editTitleInput = document.getElementById('editTitleInput');
const editNoteTextarea = document.getElementById('editNoteTextarea');
const CloseENotesButton = document.getElementById('CloseENotesButton');

EditNoteButton.forEach(button => {
  button.addEventListener('click', () => {
    const id = button.dataset.id;
    const title = button.dataset.title;
    const note = button.dataset.note;

    editIdInput.value = id;
    editTitleInput.value = title;
    editNoteTextarea.value = note;

    EditNotesModal.classList.remove('hidden');
  });
});

CloseENotesButton.addEventListener('click', () => {
  EditNotesModal.classList.add('hidden');
});

// Copy
function copyNote(button) {
  const title = button.getAttribute('data-title');
  const note = button.getAttribute('data-note');
  const textToCopy = `*${title}*\n\n${note}`;

  navigator.clipboard.writeText(textToCopy).then(() => {
    const toast = document.getElementById('copy-toast');
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}
