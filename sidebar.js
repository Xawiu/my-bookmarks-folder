let currentFolderId = null;

function defaultIcon() {
  return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23999'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'/></svg>";
}

async function loadBookmarks(folderId = null) {
  const container = document.getElementById('bookmark-list');
  if (!container) return;

  try {
    const data = await browser.storage.local.get('setting');
    const rootFolderId = (data.setting && data.setting.topId) ? data.setting.topId : 'toolbar_____';

    if (!folderId) folderId = rootFolderId;
    currentFolderId = folderId;

    const bookmarks = await browser.bookmarks.getChildren(folderId);
    container.innerHTML = '';

    if (folderId !== rootFolderId) {
      const parentInfo = await browser.bookmarks.get(folderId);
      const parentId = parentInfo[0].parentId;

      const backBtn = document.createElement('div');
      backBtn.className = 'bookmark back-button';
      backBtn.innerHTML = `
        <img class="favicon" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'><path d='M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'/></svg>">
        <span class="bookmark-text">... Wróć</span>
      `;
      backBtn.onclick = () => loadBookmarks(parentId);
      container.appendChild(backBtn);
    }

    bookmarks.forEach(bm => {
      const isFolder = !bm.url;
      const el = document.createElement(isFolder ? 'div' : 'a');
      el.className = 'bookmark' + (isFolder ? '' : ' is-link');
      
      const img = document.createElement('img');
      img.className = 'favicon';
      
      if (isFolder) {
        img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23f8d775"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
        el.onclick = () => loadBookmarks(bm.id);
      } else {
        // Block "Illegal URL"
        el.href = bm.url.startsWith('javascript:') ? "#" : bm.url;

        try {
          const urlObj = new URL(bm.url);
          img.src = urlObj.protocol.startsWith('http') ? `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico` : defaultIcon();
        } catch (e) {
          img.src = defaultIcon();
        }
        img.onerror = () => { img.src = defaultIcon(); };

        el.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (bm.url.startsWith('javascript:')) {
            const rawCode = bm.url.replace(/^javascript:/, '');
            const codeToRun = decodeURIComponent(rawCode);
            
            const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
              browser.scripting.executeScript({
                target: { tabId: tab.id },
                world: "MAIN",
                injectImmediately: true,
                func: (code) => {
                  const s = document.createElement('script');
                  s.textContent = code;
                  document.documentElement.appendChild(s);
                  s.remove();
                },
                args: [codeToRun]
              }).catch(err => console.error("Scripting error:", err));
            }
            return;
          }

          // NORMAL URL's
          if (e.shiftKey) {
            browser.windows.create({ url: bm.url });
          } else if (e.button === 1 || e.ctrlKey || e.metaKey) {
            browser.tabs.create({ url: bm.url });
          } else {
            const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
            if (tab) browser.tabs.update(tab.id, { url: bm.url });
          }
        });
      }

      const span = document.createElement('span');
      span.className = 'bookmark-text';
      span.textContent = bm.title || (isFolder ? "Folder" : "Bez tytułu");

      el.appendChild(img);
      el.appendChild(span);
      container.appendChild(el);
    });

  } catch (error) {
    container.innerHTML = `<div style="padding:10px; color: red;">Wybierz folder w ustawieniach.</div>`;
    console.error(error);
  }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  const settingsBtn = document.getElementById('open-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      browser.runtime.openOptionsPage();
    });
  }
  loadBookmarks();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.setting) loadBookmarks();
});
