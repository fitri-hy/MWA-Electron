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

  tabs.forEach((tab, index) => {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'block border-b-2 flex items-center gap-1 p-1 hover:bg-gray-100 dark:hover:bg-neutral-900 cursor-pointer';
    tabDiv.dataset.tabId = tab.id;
    tabDiv.draggable = true;
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
	
	const titleText = tab.title.replace(/\(\d+\)/, '').trim();
    const unreadMatch = tab.title.match(/\((\d+)\)/);
    const unreadCount = unreadMatch ? unreadMatch[1] : null;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'whitespace-nowrap';
    titleSpan.textContent = titleText;
    tabDiv.appendChild(titleSpan);
	
    tabDiv.appendChild(titleSpan);
	
	if (unreadCount) {
      const unreadSpan = document.createElement('span');
      unreadSpan.className = 'bg-green-500 dark:bg-green-700 rounded-full text-white h-4 w-4 text-[8px] flex items-center justify-center';
      unreadSpan.textContent = `${unreadCount}`;
      tabDiv.appendChild(unreadSpan);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'block flex items-center justify-center rounded h-4 w-4 text-white bg-rose-400 hover:bg-rose-500 dark:bg-rose-700 dark:hover:bg-rose-600';
    closeBtn.setAttribute('aria-label', `Close tab ${tab.title}`);
    closeBtn.innerHTML = `
	  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-3 w-3">
	    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
	  </svg>
	`;

    tabDiv.appendChild(closeBtn);
    tabsContainer.appendChild(tabDiv);

    tabDiv.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      e.dataTransfer.effectAllowed = 'move';
    });

    tabDiv.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    tabDiv.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const targetIndex = index;
      if (draggedIndex === targetIndex) return;

      const movedTab = tabs.splice(draggedIndex, 1)[0];
      tabs.splice(targetIndex, 0, movedTab);

      renderTabs();
      saveTabs();
    });

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
  startUnreadCountWatcher(tab);
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

function saveTabs() {
  if (window.electronAPI && window.electronAPI.saveTabs) {
    window.electronAPI.saveTabs(tabs).then(result => {
      if (!result) {
        console.error('Gagal menyimpan tab.');
      }
    }).catch(err => {
      console.error('Error saat menyimpan tab:', err);
    });
  }
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

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault();
    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    activeTabId = tabs[nextIndex].id;
    renderTabs();
    updateWebviewVisibility();
  }
});

function startUnreadCountWatcher(tab) {
  const webview = document.getElementById('wv-' + tab.id);
  if (!webview) return;

  setInterval(() => {
    webview.executeJavaScript('document.title')
      .then(title => {
        const match = title.match(/^\((\d+)\)/);
        const unreadCount = match ? parseInt(match[1], 10) : 0;

        const tabIndex = tabs.findIndex(t => t.id === tab.id);
        if (tabIndex !== -1) {
          const baseTitle = tab.id.toUpperCase();

          tabs[tabIndex].title = unreadCount > 0 
            ? `${baseTitle} (${unreadCount})` 
            : baseTitle;

          renderTabs();
        }
      })
      .catch(err => {
        console.error('Gagal membaca title:', err);
      });
  }, 3000); 
}


// Floating
const btnItems = document.getElementById('btn-items');
const btnNotes = document.getElementById('btn-notes');
const dropdownItems = document.getElementById('dropdown-items');
const dropdownNotes = document.getElementById('dropdown-notes');

btnItems.addEventListener('click', () => {
    dropdownItems.classList.toggle('hidden');
    dropdownNotes.classList.add('hidden');
});

btnNotes.addEventListener('click', () => {
    dropdownNotes.classList.toggle('hidden');
    dropdownItems.classList.add('hidden');
});

document.addEventListener('click', (e) => {
    if (!btnItems.contains(e.target) && !dropdownItems.contains(e.target)) {
      dropdownItems.classList.add('hidden');
    }
    if (!btnNotes.contains(e.target) && !dropdownNotes.contains(e.target)) {
      dropdownNotes.classList.add('hidden');
    }
});

function getActiveWebview() {
  const webviews = document.querySelectorAll('webview');
  for (const wv of webviews) {
    const style = window.getComputedStyle(wv);
    if (style.display !== 'none') {
      return wv;
    }
  }
  return null;
}

function injectTextToWhatsappWeb(text) {
  const webview = getActiveWebview();
  if (!webview) {
    alert('No active tabs found. Make sure WhatsApp Web is open.!');
    return;
  }
  
  webview.executeJavaScript(`
    (function() {
      const inputs = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
      if (inputs.length < 2) return false;
      
      const input = inputs[1];
      input.focus();

      document.execCommand('insertText', false, \`${text}\`);

      const event = new InputEvent('input', { bubbles: true });
      input.dispatchEvent(event);

      return true;
    })()
  `).then(result => {
    if (!result) {
      alert('Please log in to chat first before sending a message!');
    }
  }).catch(() => {
    alert('An error occurred while sending the message. Please try again!');
  });
}

dropdownItems.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    const itemText = btn.getAttribute('data-item');
    const priceText = btn.getAttribute('data-price');
    if (itemText && priceText) {
      const combinedText = `${itemText} - Price: ${priceText}`;
      injectTextToWhatsappWeb(combinedText);
      dropdownItems.classList.add('hidden');
    }
  });
});

dropdownNotes.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    const noteText = btn.getAttribute('data-note');
    if (noteText) {
      injectTextToWhatsappWeb(noteText);
      dropdownNotes.classList.add('hidden');
    }
  });
});
