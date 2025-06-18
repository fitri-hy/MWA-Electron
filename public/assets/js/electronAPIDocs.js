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