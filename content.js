// Content script for Zero Distract extension
// Handles smart nudge notifications and feed replacement on distraction sites

(function() {
  'use strict';

  // ===== NUDGE SYSTEM STATE =====
  let nudgeContainer = null;
  let shadowRoot = null;
  let timeOnSite = 0;
  let timerInterval = null;
  let lastNudgeTime = 0;
  let nudgeShown = false;
  let currentDomain = null;
  let focusModeActive = false;

  // ===== FEED REPLACEMENT STATE =====
  let feedReplacementOverlay = null;
  let feedReplacementShadowRoot = null;
  let bypassCooldownActive = false;
  let feedReplacementTimeInterval = null;

  // ===== SETTINGS CACHE =====
  let workHours = { startTime: '09:00', endTime: '17:00' };
  let distractionSites = [];
  let patterns = {};
  let nudgeDelay = 180; // 3 minutes (in seconds)
  let nudgeCooldown = 15 * 60 * 1000; // 15 minutes (in ms)
  let feedReplacement = { youtube: true, reddit: true, twitter: true };
  let feedContent = { showTodos: true, showQuotes: true };
  let smartTiming = true;

  // ===== CONSTANTS =====
  const TIMER_TICK = 1000; // 1 second

  // Check if extension context is still valid
  function isContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }
  
  const FOCUS_QUOTES = [
    "Your focus is your superpower.",
    "Distraction is the enemy of progress.",
    "Deep work requires undivided attention.",
    "Every minute of focus compounds.",
    "You're more productive than you think when you focus.",
    "The feeds will be there later. What you build now won't.",
    "Success is the byproduct of long-term focus.",
    "Attention is your most valuable currency.",
    "Focused effort beats scattered busyness.",
    "The best time to focus was yesterday. The second best is now.",
    "Small focused actions create big results.",
    "Your future self will thank you for this focus.",
    "Depth beats doomscrolling every time.",
    "One focused hour beats ten distracted ones.",
    "Real value comes from sustained attention."
  ];

  // ===== INITIALIZATION =====

  function init() {
    // Prevent double initialization
    if (timerInterval) {
      return;
    }

    currentDomain = extractDomain(window.location.href);
    console.log('[Zero Distract] Content script loaded on:', currentDomain);
    
    loadSettings();
    startTimer();
    
    // Initialize feed replacement if on homepage
    setTimeout(() => {
      initFeedReplacement();
    }, 500);
  }

  // ===== UTILITY FUNCTIONS =====

  function extractDomain(url) {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      
      return hostname;
    } catch (e) {
      return null;
    }
  }

  function loadSettings() {
    if (!isContextValid()) return;
    chrome.storage.local.get(['focusMode', 'distractionSites', 'workHours', 'patterns', 'nudgeDelay', 'nudgeCooldown', 'feedReplacement', 'feedContent', 'smartTiming'], function(result) {
      focusModeActive = result.focusMode || false;
      distractionSites = result.distractionSites || [];
      workHours = result.workHours || { startTime: '09:00', endTime: '17:00' };
      patterns = result.patterns || {};
      nudgeDelay = (result.nudgeDelay || 3) * 60; // Convert minutes to seconds
      nudgeCooldown = (result.nudgeCooldown || 15) * 60 * 1000; // Convert minutes to milliseconds
      feedReplacement = result.feedReplacement || { youtube: true, reddit: true, twitter: true };
      feedContent = result.feedContent || { showTodos: true, showQuotes: true };
      smartTiming = result.smartTiming !== undefined ? result.smartTiming : true;
    });
  }

  // ===== NUDGE SYSTEM =====

  function startTimer() {
    // Don't restart if already running
    if (timerInterval) {
      return;
    }
    timerInterval = setInterval(() => {
      try {
        if (!isContextValid()) {
          clearInterval(timerInterval);
          timerInterval = null;
          return;
        }
        timeOnSite++;
        checkAndShowNudge();
      } catch (e) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }, TIMER_TICK);
  }

  // ===== WORK HOURS CHECK =====

  function isWithinWorkHours() {
    const now = new Date();
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const within = currentTime >= workHours.startTime && currentTime < workHours.endTime;
    return within;
  }

  function checkAndShowNudge() {
    if (nudgeShown) return;
    if (!isContextValid()) return;

    chrome.storage.local.get(['focusMode', 'distractionSites', 'lastNudgeTime', 'patterns', 'nudgeDelay', 'nudgeCooldown', 'smartTiming'], function(result) {
      const focusMode = result.focusMode || false;
      const distractionSites = result.distractionSites || [];
      const storedLastNudge = result.lastNudgeTime || 0;
      const patterns = result.patterns || {};
      const storedNudgeDelay = (result.nudgeDelay || 3) * 60;
      const storedSmartTiming = result.smartTiming !== undefined ? result.smartTiming : true;
      
      // Determine nudge delay: 60s for recurring drifts if smart timing is enabled
      let currentNudgeDelay = nudgeDelay;
      
      if (smartTiming && patterns.recurringDrifts && Array.isArray(patterns.recurringDrifts)) {
        const currentHour = String(new Date().getHours()).padStart(2, '0');
        const recurringDrift = patterns.recurringDrifts.find(drift => {
          if (drift.site !== currentDomain) return false;
          
          const typicalHourStr = drift.typicalTime.split(':')[0];
          const typicalHour = parseInt(typicalHourStr);
          const currentHourNum = parseInt(currentHour);
          const hourDiff = Math.abs(currentHourNum - typicalHour);
          
          if (hourDiff > 12) {
            return (24 - hourDiff) <= 1;
          }
          return hourDiff <= 1;
        });
        
        if (recurringDrift) {
          currentNudgeDelay = 60; // 1 minute for known patterns
        }
      }
      
      if (timeOnSite < currentNudgeDelay) {
        return;
      }
      
      if (!focusMode) {
        return;
      }
      
      if (!distractionSites.includes(currentDomain)) {
        return;
      }

      // Check if within work hours
      if (!isWithinWorkHours()) {
        return;
      }
      
      const now = Date.now();
      const lastTime = Math.max(lastNudgeTime, storedLastNudge);
      if (now - lastTime < nudgeCooldown) {
        return;
      }
      showNudge();
      lastNudgeTime = now;
      nudgeShown = true;
      chrome.storage.local.set({ lastNudgeTime: now });
    });
  }

  function getTimeSpentToday(callback) {
    chrome.runtime.sendMessage({
      action: 'getTimeForDomain',
      domain: currentDomain
    }, function(response) {
      if (response && response.success) {
        callback(response.seconds);
      } else {
        callback(0);
      }
    });
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return '< 1m';
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  }

  function showNudge() {
    if (nudgeContainer && document.body.contains(nudgeContainer)) {
      return;
    }

    getTimeSpentToday((timeSpent) => {
      createNudgeUI(timeSpent);
    });
  }

  function createNudgeUI(timeSpent) {
    nudgeContainer = document.createElement('div');
    nudgeContainer.id = 'zero-distract-nudge-container';
    nudgeContainer.style.cssText = 'all: initial; position: fixed; bottom: 20px; right: 20px; z-index: 2147483646;';

    shadowRoot = nudgeContainer.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      @keyframes slideUp {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .nudge-card {
        background: #16161A;
        border: 1px solid #2A2A32;
        border-radius: 12px;
        padding: 14px 16px;
        width: 280px;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        color: #E4E4E7;
        animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .nudge-content {
        display: flex;
        gap: 10px;
        align-items: flex-start;
      }

      .nudge-icon {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.05));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
      }

      .nudge-text {
        flex: 1;
      }

      .nudge-title {
        color: #E4E4E7;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 2px;
      }

      .nudge-subtitle {
        color: #71717A;
        font-size: 11px;
        line-height: 1.5;
      }

      .nudge-dismiss {
        background: none;
        border: none;
        color: #52525B;
        cursor: pointer;
        font-size: 14px;
        padding: 0;
        margin-left: auto;
        flex-shrink: 0;
      }

      .nudge-dismiss:hover {
        color: #E4E4E7;
      }

      .nudge-buttons {
        display: flex;
        gap: 6px;
        margin-top: 12px;
      }

      .btn {
        padding: 7px 10px;
        border: none;
        border-radius: 7px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-primary {
        flex: 1;
        background: linear-gradient(135deg, #6EE7B7, #34D399);
        color: #0D0D0F;
      }

      .btn-primary:hover {
        opacity: 0.9;
      }

      .btn-secondary {
        padding: 7px 12px;
        background: #1E1E24;
        color: #71717A;
        border: 1px solid #2A2A32;
      }

      .btn-secondary:hover {
        background: #2A2A32;
      }
    `;

    const html = document.createElement('template');
    html.innerHTML = `
      <div class="nudge-card">
        <div class="nudge-content">
          <div class="nudge-icon">\u26A1</div>
          <div class="nudge-text">
            <div class="nudge-title">You usually drift here around now</div>
            <div class="nudge-subtitle">${formatTime(timeSpent)} on ${currentDomain} today. Back on track?</div>
          </div>
          <button class="nudge-dismiss" id="dismissBtn">\u2715</button>
        </div>
        <div class="nudge-buttons">
          <button class="btn btn-primary" id="closeTabBtn">Back to work</button>
          <button class="btn btn-secondary" id="continueBtn">5 more min</button>
        </div>
      </div>
    `;

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(html.content.cloneNode(true));

    const continueBtn = shadowRoot.getElementById('continueBtn');
    const closeTabBtn = shadowRoot.getElementById('closeTabBtn');
    const dismissBtn = shadowRoot.getElementById('dismissBtn');

    continueBtn.addEventListener('click', dismissNudge);
    closeTabBtn.addEventListener('click', closeTab);
    dismissBtn.addEventListener('click', dismissNudge);

    document.body.appendChild(nudgeContainer);
  }

  function dismissNudge() {
    console.log('[Zero Distract] Dismissing nudge');
    if (nudgeContainer && document.body.contains(nudgeContainer)) {
      document.body.removeChild(nudgeContainer);
      nudgeContainer = null;
      shadowRoot = null;
    }
    nudgeShown = false;
  }

  function closeTab() {
    console.log('[Zero Distract] Closing tab - back to work');
    chrome.runtime.sendMessage({
      action: 'closeCurrentTab'
    });
    dismissNudge();
  }

  // ===== FEED REPLACEMENT SYSTEM =====

  function isHomepage() {
    const pathname = window.location.pathname;
    return pathname === '/' || pathname === '';
  }

  function initFeedReplacement() {
    if (!focusModeActive) return;
    if (bypassCooldownActive) return;
    if (!isHomepage()) return;
    if (!isWithinWorkHours()) return;

    // Check if this site's feed replacement is enabled
    const hostname = window.location.hostname.replace('www.', '');
    let shouldShowReplacement = false;
    
    if (hostname.includes('youtube')) {
      shouldShowReplacement = feedReplacement.youtube;
    } else if (hostname.includes('reddit')) {
      shouldShowReplacement = feedReplacement.reddit;
    } else if (hostname.includes('twitter') || hostname.includes('x.com')) {
      shouldShowReplacement = feedReplacement.twitter;
    }
    
    if (shouldShowReplacement) {
      showFeedReplacement();
    }
  }

  function showFeedReplacement() {
    if (feedReplacementOverlay && document.body.contains(feedReplacementOverlay)) {
      return;
    }

    feedReplacementOverlay = document.createElement('div');
    feedReplacementOverlay.id = 'zero-distract-feed-replacement';
    feedReplacementOverlay.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2147483646;';

    feedReplacementShadowRoot = feedReplacementOverlay.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      .feed-replacement {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #0D0D0F;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
        padding: 50px 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #E4E4E7;
      }

      .feed-replacement-content {
        max-width: 360px;
        width: 100%;
        text-align: center;
      }

      .logo-section {
        margin-bottom: 16px;
      }

      .logo {
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #6EE7B7, #34D399);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        color: #0D0D0F;
        font-size: 14px;
        margin: 0 auto;
      }

      .time-display {
        font-size: 42px;
        font-weight: 200;
        color: #E8EAED;
        letter-spacing: -0.04em;
        margin-bottom: 6px;
      }

      .message {
        color: #9AA0A6;
        font-size: 13px;
        margin-bottom: 28px;
      }

      .priorities-card {
        background: #16161A;
        border-radius: 14px;
        border: 1px solid #2A2A32;
        padding: 18px 22px;
        text-align: left;
        margin-bottom: 16px;
      }

      .priorities-header {
        color: #71717A;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 12px;
      }

      .todo-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid #2A2A32;
      }

      .todo-item:last-child {
        border-bottom: none;
      }

      .checkbox {
        width: 16px;
        height: 16px;
        border: 2px solid #2A2A32;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        color: #6EE7B7;
        flex-shrink: 0;
      }

      .checkbox.checked {
        border-color: #6EE7B7;
        background: rgba(110, 231, 183, 0.12);
      }

      .todo-input {
        flex: 1;
        background: transparent;
        border: none;
        color: #E4E4E7;
        font-size: 13px;
        outline: none;
      }

      .todo-input.completed {
        color: #52525B;
        text-decoration: line-through;
      }

      .continue-btn {
        margin-top: 16px;
        padding: 8px 16px;
        background: transparent;
        border: 1px solid #2A2A32;
        border-radius: 8px;
        cursor: pointer;
        color: #71717A;
        font-size: 11px;
        transition: all 0.2s;
      }

      .continue-btn:hover {
        background: #1E1E24;
        color: #E4E4E7;
      }
    `;

    const html = document.createElement('template');
    html.innerHTML = `
      <div class="feed-replacement">
        <div class="feed-replacement-content">
          <div class="logo-section">
            <div class="logo">Z</div>
          </div>

          <div class="time-display" id="focusTime">--:--</div>

          <div class="message">You opened ${currentDomain}. Here's what matters instead.</div>

          ${feedContent.showTodos ? `
          <div class="priorities-card">
            <div class="priorities-header">Your priorities</div>
            <div id="todoList"></div>
          </div>
          ` : ''}

          <button class="continue-btn" id="bypassBtn">Continue to ${currentDomain} anyway \u2192</button>
        </div>
      </div>
    `;

    feedReplacementShadowRoot.appendChild(style);
    feedReplacementShadowRoot.appendChild(html.content.cloneNode(true));

    if (feedContent.showTodos) {
      initTodoList(feedReplacementShadowRoot);
    }
    updateFeedReplacementTime(feedReplacementShadowRoot);

    const bypassBtn = feedReplacementShadowRoot.getElementById('bypassBtn');
    bypassBtn.addEventListener('click', bypassFeedReplacement);

    document.body.appendChild(feedReplacementOverlay);
  }

  function initTodoList(shadowRoot) {
    const todoList = shadowRoot.querySelector('#todoList');
    if (!todoList) return;

    chrome.storage.local.get(['feedReplacementTodos'], (result) => {
      const todos = result.feedReplacementTodos || ['', '', ''];

      todos.forEach((todo, index) => {
        const item = document.createElement('div');
        item.className = 'todo-item';
        item.innerHTML = `
          <div class="checkbox" data-index="${index}"></div>
          <input type="text" class="todo-input" data-index="${index}" placeholder="Add a priority..." value="${todo}">
        `;

        const checkbox = item.querySelector('.checkbox');
        const input = item.querySelector('.todo-input');

        checkbox.addEventListener('click', () => {
          const isChecked = checkbox.classList.toggle('checked');
          input.classList.toggle('completed');
          checkbox.textContent = isChecked ? '\u2713' : '';
        });

        input.addEventListener('input', () => {
          saveTodos(shadowRoot);
        });

        todoList.appendChild(item);
      });
    });
  }

  function saveTodos(shadowRoot) {
    const inputs = shadowRoot.querySelectorAll('.todo-input');
    const todos = Array.from(inputs).map(input => input.value);
    chrome.storage.local.set({ feedReplacementTodos: todos });
  }

  function updateFeedReplacementTime(shadowRoot) {
    const timeEl = shadowRoot.querySelector('#focusTime');
    if (!timeEl) return;

    feedReplacementTimeInterval = setInterval(() => {
      const now = new Date();
      const h = now.getHours();
      const mins = String(now.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 || 12;
      timeEl.textContent = `${displayHour}:${mins} ${ampm}`;
    }, 1000);
  }

  function dismissFeedReplacement() {
    if (feedReplacementOverlay && document.body.contains(feedReplacementOverlay)) {
      document.body.removeChild(feedReplacementOverlay);
      feedReplacementOverlay = null;
      feedReplacementShadowRoot = null;
    }
    if (feedReplacementTimeInterval) {
      clearInterval(feedReplacementTimeInterval);
      feedReplacementTimeInterval = null;
    }
  }

  function bypassFeedReplacement() {
    bypassCooldownActive = true;
    dismissFeedReplacement();

    setTimeout(() => {
      bypassCooldownActive = false;
      console.log('[Zero Distract] Bypass cooldown expired');
    }, 30 * 60 * 1000);
  }

  // ===== EVENT LISTENERS =====

  try {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      try {
        if (namespace === 'local') {
          if (changes.focusMode) {
            focusModeActive = changes.focusMode.newValue;

            if (!focusModeActive) {
              dismissNudge();
              dismissFeedReplacement();
            } else if (!bypassCooldownActive && isHomepage()) {
              initFeedReplacement();
            }
          }
          // Reload all settings if any change
          if (changes.nudgeDelay || changes.nudgeCooldown || changes.feedReplacement || changes.feedContent || changes.smartTiming || changes.workHours) {
            loadSettings();
          }
        }
      } catch (e) {
        // Extension context invalidated - silently ignore
      }
    });
  } catch (e) {
    // Extension context invalidated during listener registration
  }

  window.addEventListener('beforeunload', () => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
  });

  // ===== INITIALIZATION =====

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  setTimeout(() => {
    if (!timerInterval && !feedReplacementOverlay) {
      init();
    }
  }, 500);

})();
