const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const configDir = path.join(homeDir, '.config', 'M-WA', 'notes');
const settingPath = path.join(configDir, 'note.json');

let notes = [];
let watching = false;

function ensureFileAndDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  if (!fs.existsSync(settingPath)) {
    fs.writeFileSync(settingPath, '[]', 'utf-8');
  }
}

function loadNotes() {
  try {
    const rawData = fs.readFileSync(settingPath, 'utf-8');
    notes = JSON.parse(rawData);
  } catch (err) {
    console.error('Failed to read or parse note.json:', err);
    notes = [];
  }
}

function saveNotes() {
  fs.writeFileSync(settingPath, JSON.stringify(notes, null, 2), 'utf-8');
}

function watchNotesFile() {
  if (watching) return;
  watching = true;
  fs.watchFile(settingPath, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      loadNotes();
    }
  });
}

function getNotes() {
  ensureFileAndDir();
  if (notes.length === 0) {
    loadNotes();
  }
  watchNotesFile();
  return notes;
}

function addNote(title, note) {
  ensureFileAndDir();
  loadNotes();

  let maxId = 0;
  for (const n of notes) {
    const currentId = parseInt(n.id, 10);
    if (currentId > maxId) maxId = currentId;
  }

  const cleanTitle = title.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const cleanNote = note.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const newNote = {
    id: (maxId + 1).toString(),
    title: cleanTitle,
    note: cleanNote,
  };

  notes.push(newNote);
  saveNotes();
  return newNote;
}

function editNote(id, updatedTitle, updatedNote) {
  ensureFileAndDir();
  loadNotes();
  const index = notes.findIndex(n => n.id === id);
  if (index !== -1) {
    notes[index].title = updatedTitle.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    notes[index].note = updatedNote.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    saveNotes();
    return notes[index];
  }
  return null;
}

function deleteNote(id) {
  ensureFileAndDir();
  loadNotes();

  const initialLength = notes.length;
  notes = notes.filter(note => note.id !== id);

  if (notes.length === initialLength) {
    return false;
  }

  saveNotes();
  return true;
}

module.exports = {
  getNotes,
  addNote,
  editNote,
  deleteNote,
};
