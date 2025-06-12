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

// Tabs
const tabsContainer = document.getElementById('tabs-container');
const webviewsContainer = document.getElementById('webviews-container');
const addTabBtn = document.getElementById('add-tab-btn');

let tabs = [
  { id: 'wa-1', title: 'WA-1', url: 'https://web.whatsapp.com' }
];
let activeTabId = 'wa-1';

function generateNewId() {
  let maxIdNum = 0;
  tabs.forEach(tab => {
    const match = tab.id.match(/wa-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxIdNum) maxIdNum = num;
    }
  });
  return `wa-${maxIdNum + 1}`;
}

function renderTabs() {
  tabsContainer.innerHTML = '';

  tabs.forEach(tab => {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'block border-b-2 flex items-center gap-2 p-1 hover:bg-gray-100 dark:hover:bg-neutral-900 cursor-pointer';
    tabDiv.dataset.tabId = tab.id;
    if (tab.id === activeTabId) {
      tabDiv.classList.add('border-green-500');
      tabDiv.classList.remove('border-gray-300');
    } else {
      tabDiv.classList.add('border-gray-300');
      tabDiv.classList.remove('border-green-500');
    }
    tabDiv.setAttribute('role', 'tab');
    tabDiv.setAttribute('aria-selected', tab.id === activeTabId ? 'true' : 'false');
    tabDiv.setAttribute('tabindex', tab.id === activeTabId ? '0' : '-1');

    const titleSpan = document.createElement('span');
    titleSpan.className = 'whitespace-nowrap';
    titleSpan.textContent = tab.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'block text-rose-400 hover:text-rose-500 dark:text-rose-600 dark:hover:text-rose-500';
    closeBtn.setAttribute('aria-label', `Close tab ${tab.title}`);
    closeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2s10 4.477 10 10M8.97 8.97a.75.75 0 0 1 1.06 0L12 10.94l1.97-1.97a.75.75 0 0 1 1.06 1.06L13.06 12l1.97 1.97a.75.75 0 0 1-1.06 1.06L12 13.06l-1.97 1.97a.75.75 0 0 1-1.06-1.06L10.94 12l-1.97-1.97a.75.75 0 0 1 0-1.06" />
      </svg>
    `;

    tabDiv.appendChild(titleSpan);
    tabDiv.appendChild(closeBtn);
    tabsContainer.appendChild(tabDiv);

    tabDiv.addEventListener('click', e => {
      if (e.target === closeBtn || closeBtn.contains(e.target)) return;
      activeTabId = tab.id;
      updateWebviewVisibility();
      renderTabs();
    });

    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (tabs.length === 1) {
        alert('There must be at least 1 tab');
        return;
      }

      const closingTabId = tab.id;

      tabs = tabs.filter(t => t.id !== closingTabId);

      const webviewToRemove = document.getElementById('wv-' + closingTabId);
      if (webviewToRemove) {
        webviewToRemove.remove();
      }

      if (activeTabId === closingTabId) {
        activeTabId = tabs[0].id;
      }

      renderTabs();
      updateWebviewVisibility();
      saveTabs();
    });

  });
}

function createWebview(tab) {
  const webview = document.createElement('webview');
  webview.src = tab.url;
  webview.setAttribute('partition', `persist:${tab.id}`);
  webview.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
  webview.id = 'wv-' + tab.id;
  webview.style.width = '100%';
  webview.style.height = 'calc(100vh - 28px)';
  webview.style.position = 'absolute';
  webview.style.top = '28px';
  webview.style.left = '0';
  webview.style.right = '0';
  webview.style.bottom = '0';
  webview.style.display = 'none';

  webviewsContainer.appendChild(webview);
}

function updateWebviewVisibility() {
  tabs.forEach(tab => {
    const webview = document.getElementById('wv-' + tab.id);
    if (!webview) {
      createWebview(tab);
    }
  });

  tabs.forEach(tab => {
    const webview = document.getElementById('wv-' + tab.id);
    if (tab.id === activeTabId) {
      webview.style.display = 'flex';
    } else {
      webview.style.display = 'none';
    }
  });
}

addTabBtn.addEventListener('click', () => {
  const newId = generateNewId();
  tabs.push({ id: newId, title: newId.toUpperCase(), url: 'https://web.whatsapp.com' });
  activeTabId = newId;
  renderTabs();
  updateWebviewVisibility();
  saveTabs();
});

async function loadTabs() {
  if (window.electronAPI && window.electronAPI.loadTabs) {
    const savedTabs = await window.electronAPI.loadTabs();
    if (savedTabs && savedTabs.length) {
      tabs = savedTabs;
      activeTabId = tabs[0].id;
    }
  }
  renderTabs();
  updateWebviewVisibility();
}

window.addEventListener('DOMContentLoaded', () => {
  loadTabs();

  if (window.electronAPI && window.electronAPI.onToggleDarkMode) {
    window.electronAPI.onToggleDarkMode((event, isDark) => {
      document.documentElement.classList.toggle('dark', isDark);
    });
  }
});

// Internet Checks
const mwaModal = document.getElementById('mwa-connection-modal');
const mwaMessage = document.getElementById('mwa-connection-message');
let mwaTimeoutId = null;

function mwaShowModal(text, bgColor, autoHide = false) {
  mwaMessage.textContent = text;
  mwaModal.classList.remove('hidden');
  mwaModal.classList.remove('bg-red-600', 'bg-green-600');

  if (bgColor === 'red') {
    mwaModal.classList.add('bg-red-600');
  } else if (bgColor === 'green') {
    mwaModal.classList.add('bg-green-600');
  }

  if (mwaTimeoutId) {
    clearTimeout(mwaTimeoutId);
    mwaTimeoutId = null;
  }

  if (autoHide) {
    mwaTimeoutId = setTimeout(() => {
      mwaModal.classList.add('hidden');
      if (bgColor === 'green') {
        location.reload();
      }
    }, 3000);
  }
}

function mwaHideModal() {
  mwaModal.classList.add('hidden');
  if (mwaTimeoutId) {
    clearTimeout(mwaTimeoutId);
    mwaTimeoutId = null;
  }
}

window.electronAPI.onOnlineStatusChange((isOnline) => {
  if (isOnline) {
    mwaShowModal('You are reconnected !!', 'green', true);
  } else {
    mwaShowModal('Internet is not connected. Please check your connection.', 'red', false);
  }
});

if (!navigator.onLine) {
  mwaShowModal('Internet is not connected. Please check your connection.', 'red', false);
}
