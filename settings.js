// Settings Page Logic

const DEFAULT_SETTINGS = {
  distractionSites: ['youtube.com', 'reddit.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'facebook.com'],
  workHours: {
    startTime: '09:00',
    endTime: '17:00'
  },
  nudgeDelay: 3,
  nudgeCooldown: 15,
  smartTiming: true,
  feedReplacement: {
    youtube: true,
    reddit: true,
    twitter: true
  },
  feedContent: {
    showTodos: true,
    showQuotes: true
  }
};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  attachEventListeners();
});

/* ========== LOAD SETTINGS ========== */

async function loadSettings() {
  try {
    const storage = await chrome.storage.local.get([
      'distractionSites',
      'workHours',
      'nudgeDelay',
      'nudgeCooldown',
      'smartTiming',
      'feedReplacement',
      'feedContent'
    ]);

    // Load distraction sites
    const sites = storage.distractionSites || DEFAULT_SETTINGS.distractionSites;
    renderSitesList(sites);

    // Load work hours
    const workHours = storage.workHours || DEFAULT_SETTINGS.workHours;
    const startTimeEl = document.getElementById('startTime');
    const endTimeEl = document.getElementById('endTime');
    if (startTimeEl) startTimeEl.value = workHours.startTime;
    if (endTimeEl) endTimeEl.value = workHours.endTime;

    // Load nudge settings
    const nudgeDelay = storage.nudgeDelay || DEFAULT_SETTINGS.nudgeDelay;
    const nudgeCooldown = storage.nudgeCooldown || DEFAULT_SETTINGS.nudgeCooldown;
    const nudgeDelayEl = document.getElementById('nudgeDelay');
    if (nudgeDelayEl) nudgeDelayEl.value = nudgeDelay;
    const nudgeDelayValEl = document.getElementById('nudgeDelayValue');
    if (nudgeDelayValEl) nudgeDelayValEl.textContent = nudgeDelay;
    const nudgeCooldownEl = document.getElementById('nudgeCooldown');
    if (nudgeCooldownEl) nudgeCooldownEl.value = nudgeCooldown;
    const nudgeCooldownValEl = document.getElementById('nudgeCooldownValue');
    if (nudgeCooldownValEl) nudgeCooldownValEl.textContent = nudgeCooldown;

    // Load smart timing
    const smartTiming = storage.smartTiming !== undefined ? storage.smartTiming : DEFAULT_SETTINGS.smartTiming;
    const smartTimingEl = document.getElementById('smartTiming');
    if (smartTimingEl) smartTimingEl.checked = smartTiming;

    // Load feed replacement settings
    const feedReplacement = storage.feedReplacement || DEFAULT_SETTINGS.feedReplacement;
    const feedYoutubeEl = document.getElementById('feedYoutube');
    if (feedYoutubeEl) feedYoutubeEl.checked = feedReplacement.youtube !== false;
    const feedRedditEl = document.getElementById('feedReddit');
    if (feedRedditEl) feedRedditEl.checked = feedReplacement.reddit !== false;
    const feedTwitterEl = document.getElementById('feedTwitter');
    if (feedTwitterEl) feedTwitterEl.checked = feedReplacement.twitter !== false;

    // Load feed content
    const feedContent = storage.feedContent || DEFAULT_SETTINGS.feedContent;
    const showTodoListEl = document.getElementById('showTodoList');
    if (showTodoListEl) showTodoListEl.checked = feedContent.showTodos !== false;
    const showQuoteEl = document.getElementById('showQuote');
    if (showQuoteEl) showQuoteEl.checked = feedContent.showQuotes !== false;

    console.log('[Zero Distract Settings] Settings loaded successfully');
  } catch (error) {
    console.error('[Zero Distract Settings] Error loading settings:', error);
  }
}

/* ========== RENDER SITES LIST ========== */

function renderSitesList(sites) {
  const sitesList = document.getElementById('sitesList');
  sitesList.innerHTML = '';

  if (!sites || sites.length === 0) {
    sitesList.innerHTML = '<div class="sites-empty">No distraction sites added yet</div>';
    return;
  }

  sites.forEach(site => {
    const item = document.createElement('div');
    item.className = 'site-item';
    item.innerHTML = `
      <span class="site-name">${escapeHtml(site)}</span>
      <button class="site-remove-btn" data-site="${escapeHtml(site)}" title="Remove this site">×</button>
    `;
    sitesList.appendChild(item);
  });
}

/* ========== SAVE SETTINGS ========== */

async function saveSettings(updates) {
  try {
    await chrome.storage.local.set(updates);
    console.log('[Zero Distract Settings] Saved:', Object.keys(updates));
  } catch (error) {
    console.error('[Zero Distract Settings] Error saving settings:', error);
  }
}

/* ========== EVENT LISTENERS ========== */

function attachEventListeners() {
  // Close button
  document.querySelector('.close-btn').addEventListener('click', () => {
    window.close();
  });

  // ===== Distraction Sites =====
  document.getElementById('addSiteBtn').addEventListener('click', addSite);
  document.getElementById('siteInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSite();
  });

  // Site removal (delegated)
  document.getElementById('sitesList').addEventListener('click', (e) => {
    if (e.target.classList.contains('site-remove-btn')) {
      removeSite(e.target.getAttribute('data-site'));
    }
  });

  // ===== Work Hours =====
  const startTimeEl = document.getElementById('startTime');
  if (startTimeEl) startTimeEl.addEventListener('change', saveWorkHours);
  const endTimeEl = document.getElementById('endTime');
  if (endTimeEl) endTimeEl.addEventListener('change', saveWorkHours);

  // ===== Nudge Settings =====
  const nudgeDelayEl = document.getElementById('nudgeDelay');
  if (nudgeDelayEl) {
    nudgeDelayEl.addEventListener('input', (e) => {
      const val = document.getElementById('nudgeDelayValue');
      if (val) val.textContent = e.target.value;
      saveNudgeSettings();
    });
  }

  const nudgeCooldownEl = document.getElementById('nudgeCooldown');
  if (nudgeCooldownEl) {
    nudgeCooldownEl.addEventListener('input', (e) => {
      const val = document.getElementById('nudgeCooldownValue');
      if (val) val.textContent = e.target.value;
      saveNudgeSettings();
    });
  }

  const smartTimingEl = document.getElementById('smartTiming');
  if (smartTimingEl) smartTimingEl.addEventListener('change', saveSmartTiming);

  // ===== Feed Replacement =====
  const feedYoutubeEl = document.getElementById('feedYoutube');
  if (feedYoutubeEl) feedYoutubeEl.addEventListener('change', saveFeedReplacement);
  const feedRedditEl = document.getElementById('feedReddit');
  if (feedRedditEl) feedRedditEl.addEventListener('change', saveFeedReplacement);
  const feedTwitterEl = document.getElementById('feedTwitter');
  if (feedTwitterEl) feedTwitterEl.addEventListener('change', saveFeedReplacement);

  // ===== Feed Content =====
  const showTodoListEl = document.getElementById('showTodoList');
  if (showTodoListEl) showTodoListEl.addEventListener('change', saveFeedContent);
  const showQuoteEl = document.getElementById('showQuote');
  if (showQuoteEl) showQuoteEl.addEventListener('change', saveFeedContent);

  // ===== Data Management =====
  const exportEl = document.getElementById('exportBtn');
  if (exportEl) exportEl.addEventListener('click', exportData);
  const clearEl = document.getElementById('clearBtn');
  if (clearEl) clearEl.addEventListener('click', showClearConfirm);
  const resetEl = document.getElementById('resetBtn');
  if (resetEl) resetEl.addEventListener('click', showResetConfirm);

  // ===== Modal Controls =====
  const cancelBtn = document.getElementById('confirmCancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  const confirmBtn = document.getElementById('confirmConfirm');
  if (confirmBtn) confirmBtn.addEventListener('click', handleModalConfirm);
}

/* ========== DISTRACTION SITES ========== */

async function addSite() {
  const input = document.getElementById('siteInput');
  let domain = input.value.toLowerCase().trim();

  // Validate input
  if (!domain) {
    showNotification('Please enter a domain', 'error');
    return;
  }

  // Normalize domain: remove www. and protocol if present
  domain = domain
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/$/, '');

  if (!domain || domain.length < 3) {
    showNotification('Please enter a valid domain', 'error');
    return;
  }

  // Get current sites
  const storage = await chrome.storage.local.get('distractionSites');
  const sites = storage.distractionSites || DEFAULT_SETTINGS.distractionSites;

  // Check for duplicates
  if (sites.some(s => s.toLowerCase() === domain)) {
    showNotification(`${domain} is already in your list`, 'error');
    input.value = '';
    return;
  }

  // Add new site
  sites.push(domain);
  await saveSettings({ distractionSites: sites });
  renderSitesList(sites);
  input.value = '';
  showNotification(`Added ${domain} to distraction sites`, 'success');
  console.log('[Zero Distract Settings] Added site:', domain);
}

async function removeSite(site) {
  const storage = await chrome.storage.local.get('distractionSites');
  let sites = storage.distractionSites || DEFAULT_SETTINGS.distractionSites;

  sites = sites.filter(s => s !== site);
  await saveSettings({ distractionSites: sites });
  renderSitesList(sites);
  console.log('[Zero Distract Settings] Removed site:', site);
}

/* ========== WORK HOURS ========== */

async function saveWorkHours() {
  const startTimeEl = document.getElementById('startTime');
  const endTimeEl = document.getElementById('endTime');
  
  if (!startTimeEl || !endTimeEl) {
    showNotification('Please select both start and end times', 'error');
    return;
  }
  
  const startTime = startTimeEl.value;
  const endTime = endTimeEl.value;

  if (!startTime || !endTime) {
    showNotification('Please select both start and end times', 'error');
    return;
  }

  // Validate that end time is after start time
  if (startTime >= endTime) {
    showNotification('End time must be after start time', 'error');
    return;
  }

  await saveSettings({
    workHours: { startTime, endTime }
  });
  console.log('[Zero Distract Settings] Work hours updated:', { startTime, endTime });
}

/* ========== NUDGE SETTINGS ========== */

async function saveNudgeSettings() {
  const nudgeDelayEl = document.getElementById('nudgeDelay');
  const nudgeCooldownEl = document.getElementById('nudgeCooldown');
  
  if (!nudgeDelayEl || !nudgeCooldownEl) {
    console.error('[Zero Distract Settings] Nudge elements not found');
    return;
  }
  
  const delay = parseInt(nudgeDelayEl.value);
  const cooldown = parseInt(nudgeCooldownEl.value);

  await saveSettings({
    nudgeDelay: delay,
    nudgeCooldown: cooldown
  });
  console.log('[Zero Distract Settings] Nudge settings updated:', { delay, cooldown });
}

async function saveSmartTiming() {
  const enabled = document.getElementById('smartTimingToggle').checked;
  await saveSettings({ smartTiming: enabled });
  console.log('[Zero Distract Settings] Smart timing:', enabled ? 'enabled' : 'disabled');
}

/* ========== FEED REPLACEMENT ========== */

async function saveFeedReplacement() {
  const youtubeEl = document.getElementById('feedYoutube');
  const redditEl = document.getElementById('feedReddit');
  const twitterEl = document.getElementById('feedTwitter');
  
  if (!youtubeEl || !redditEl || !twitterEl) {
    console.error('[Zero Distract Settings] Feed elements not found');
    return;
  }
  
  const youtube = youtubeEl.checked;
  const reddit = redditEl.checked;
  const twitter = twitterEl.checked;

  await saveSettings({
    feedReplacement: { youtube, reddit, twitter }
  });
  console.log('[Zero Distract Settings] Feed replacement updated:', { youtube, reddit, twitter });
}

async function saveFeedContent() {
  const showTodoListEl = document.getElementById('showTodoList');
  const showQuoteEl = document.getElementById('showQuote');
  
  if (!showTodoListEl || !showQuoteEl) {
    console.error('[Zero Distract Settings] Feed content elements not found');
    return;
  }
  
  const showTodos = showTodoListEl.checked;
  const showQuotes = showQuoteEl.checked;

  await saveSettings({
    feedContent: { showTodos, showQuotes }
  });
  console.log('[Zero Distract Settings] Feed content updated:', { showTodos, showQuotes });
}

/* ========== DATA MANAGEMENT ========== */

async function exportData() {
  try {
    const storage = await chrome.storage.local.get(null);
    const exportData = {
      exportDate: new Date().toISOString(),
      ...storage
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zero-distract-data-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    console.log('[Zero Distract Settings] Data exported successfully');
    showNotification('Data exported successfully', 'success');
  } catch (error) {
    console.error('[Zero Distract Settings] Error exporting data:', error);
    showNotification('Error exporting data', 'error');
  }
}

function showClearConfirm() {
  showModal(
    'Clear All Data?',
    'This will remove all tracked time data. Your settings will be preserved. This action cannot be undone.',
    'Clear Data',
    'clearData'
  );
}

function showResetConfirm() {
  showModal(
    'Reset to Defaults?',
    'This will reset all settings to their default values, including distraction sites, work hours, and nudge preferences. Tracked data will be preserved.',
    'Reset Settings',
    'resetDefaults'
  );
}

async function clearData() {
  try {
    // Keep settings, clear only time tracking data
    await chrome.storage.local.remove([
      'timeData',
      'patterns',
      'feedReplacementTodos',
      'lastNudgeTime',
      'lastFeedBypassTime'
    ]);

    closeModal();
    showNotification('All data cleared successfully', 'success');
    console.log('[Zero Distract Settings] Data cleared');
  } catch (error) {
    console.error('[Zero Distract Settings] Error clearing data:', error);
    showNotification('Error clearing data', 'error');
  }
}

async function resetDefaults() {
  try {
    await saveSettings(DEFAULT_SETTINGS);
    // Reload page to show updated settings
    loadSettings();
    closeModal();
    showNotification('Settings reset to defaults', 'success');
    console.log('[Zero Distract Settings] Settings reset to defaults');
  } catch (error) {
    console.error('[Zero Distract Settings] Error resetting settings:', error);
    showNotification('Error resetting settings', 'error');
  }
}

/* ========== MODAL HELPERS ========== */

let currentModalAction = null;

function showModal(title, message, confirmText, action) {
  const titleEl = document.getElementById('confirmTitle');
  const messageEl = document.getElementById('confirmMessage');
  const confirmBtn = document.getElementById('confirmConfirm');
  const modalEl = document.getElementById('confirmModal');
  
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (confirmBtn) confirmBtn.textContent = confirmText;
  
  currentModalAction = action;
  
  if (modalEl) {
    modalEl.classList.remove('hidden');
  }
}

function closeModal() {
  const modalEl = document.getElementById('confirmModal');
  if (modalEl) {
    modalEl.classList.add('hidden');
  }
  currentModalAction = null;
}

function handleModalConfirm() {
  if (currentModalAction === 'clearData') {
    clearData();
  } else if (currentModalAction === 'resetDefaults') {
    resetDefaults();
  }
}

/* ========== UTILITIES ========== */

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = 'info') {
  // For now, just log. In future, could add toast notifications
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  console.log(`[Zero Distract Settings] ${icon} ${message}`);
}

console.log('[Zero Distract Settings] Page loaded and ready');
