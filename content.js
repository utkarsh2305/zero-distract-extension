// Content script for Zero Distract extension
// Handles smart nudge notifications and feed replacement on distraction sites

(function() {
  'use strict';

  console.log('[Zero Distract] IIFE started on domain:', window.location.hostname);

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
      timeOnSite++;
      checkAndShowNudge();
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
    if (nudgeShown) {

    }
    
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
    nudgeContainer.style.cssText = 'all: initial; position: fixed; top: 20px; right: 20px; z-index: 2147483646;';

    shadowRoot = nudgeContainer.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      .nudge-card {
        background: #16161A;
        border: 1px solid #2A2A32;
        border-radius: 12px;
        padding: 20px;
        width: 320px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        color: #E4E4E7;
      }

      .nudge-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .nudge-icon {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #6EE7B7, #34D399);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        color: #0D0D0F;
        font-size: 16px;
      }

      .nudge-title {
        font-size: 18px;
        font-weight: 600;
      }

      .nudge-subtitle {
        font-size: 13px;
        color: #A1A1A9;
        margin-bottom: 16px;
      }

      .time-info {
        background: #1E1E24;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 14px;
      }

      .time-label {
        color: #71717A;
        font-size: 12px;
      }

      .time-value {
        color: #F87171;
        font-weight: 600;
        font-size: 16px;
      }

      .quote {
        font-size: 13px;
        font-style: italic;
        color: #A1A1A9;
        margin-bottom: 16px;
        padding: 12px;
        border-left: 3px solid #6EE7B7;
      }

      .nudge-buttons {
        display: flex;
        gap: 10px;
      }

      .btn {
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-primary {
        background: #6EE7B7;
        color: #0D0D0F;
      }

      .btn-primary:hover {
        background: #34D399;
      }

      .btn-secondary {
        background: #2A2A32;
        color: #E4E4E7;
        border: 1px solid #3A3A42;
      }

      .btn-secondary:hover {
        background: #3A3A42;
      }
    `;

    const html = document.createElement('template');
    html.innerHTML = `
      <div class="nudge-card">
        <div class="nudge-header">
          <div class="nudge-icon">Z</div>
          <div class="nudge-title">Focus Check-in</div>
        </div>
        <div class="nudge-subtitle">You've been here for a while</div>
        <div class="time-info">
          <div class="time-label">Time spent on ${currentDomain}</div>
          <div class="time-value">${formatTime(timeSpent)}</div>
        </div>
        <div class="quote">"${FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)]}"</div>
        <div class="nudge-buttons">
          <button class="btn btn-secondary" id="continueBtn">Continue</button>
          <button class="btn btn-primary" id="closeTabBtn">Back to Work</button>
        </div>
      </div>
    `;

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(html.content.cloneNode(true));

    const continueBtn = shadowRoot.getElementById('continueBtn');
    const closeTabBtn = shadowRoot.getElementById('closeTabBtn');

    continueBtn.addEventListener('click', dismissNudge);
    closeTabBtn.addEventListener('click', closeTab);

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

    const randomQuote = FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)];

    const style = document.createElement('style');
    style.textContent = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .feed-replacement {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #0D0D0F;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
        padding: 40px 20px;
      }

      .feed-replacement-content {
        max-width: 480px;
        width: 100%;
      }

      .logo-section {
        text-align: center;
        margin-bottom: 32px;
      }

      .logo {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #6EE7B7, #34D399);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        color: #0D0D0F;
        font-size: 20px;
        margin: 0 auto;
      }

      .title {
        color: #E4E4E7;
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 12px;
      }

      .subtitle {
        color: #A1A1A9;
        font-size: 16px;
        margin-bottom: 16px;
      }

      .focus-time {
        background: linear-gradient(135deg, rgba(110, 231, 183, 0.1), rgba(52, 211, 153, 0.05));
        border: 1px solid rgba(110, 231, 183, 0.3);
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        margin-bottom: 24px;
      }

      .time-display {
        font-size: 48px;
        font-weight: 800;
        color: #6EE7B7;
        font-family: 'Monaco', monospace;
      }

      .time-label {
        color: #71717A;
        font-size: 12px;
        margin-top: 8px;
      }

      .todo-list {
        background: #16161A;
        border: 1px solid #2A2A32;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 24px;
      }

      .todo-header {
        color: #6EE7B7;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 12px;
      }

      .todo-item {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .todo-item:last-child {
        margin-bottom: 0;
      }

      .checkbox {
        width: 20px;
        height: 20px;
        border: 2px solid #2A2A32;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .checkbox.checked {
        background: #6EE7B7;
        border-color: #6EE7B7;
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
        color: #71717A;
        text-decoration: line-through;
      }

      .quote {
        color: #A1A1A9;
        font-style: italic;
        font-size: 14px;
        margin-bottom: 24px;
        padding: 16px;
        border-left: 3px solid #6EE7B7;
      }

      .button-group {
        display: flex;
        gap: 12px;
      }

      .btn {
        flex: 1;
        padding: 12px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-primary {
        background: #6EE7B7;
        color: #0D0D0F;
      }

      .btn-primary:hover {
        background: #34D399;
        transform: translateY(-1px);
      }

      .btn-secondary {
        background: #2A2A32;
        color: #E4E4E7;
        border: 1px solid #3A3A42;
      }

      .btn-secondary:hover {
        background: #3A3A42;
      }
    `;

    const html = document.createElement('template');
    html.innerHTML = `
      <div class="feed-replacement">
        <div class="feed-replacement-content">
          <div class="logo-section">
            <div class="logo">Z</div>
            <div class="title">Zero Distract</div>
            <div class="subtitle">Focus on what matters</div>
          </div>

          <div class="focus-time">
            <div class="time-display" id="focusTime">00:00</div>
            <div class="time-label">Time focused today</div>
          </div>

          ${feedContent.showTodos ? `
          <div class="todo-list">
            <div class="todo-header">Priority Tasks</div>
            <div id="todoList"></div>
          </div>
          ` : ''}

          ${feedContent.showQuotes ? `<div class="quote">"${randomQuote}"</div>` : ''}

          <div class="button-group">
            <button class="btn btn-secondary" id="bypassBtn">Take a break (30m)</button>
            <button class="btn btn-primary" id="focusStartBtn">Start Focusing</button>
          </div>
        </div>
      </div>
    `;

    feedReplacementShadowRoot.appendChild(style);
    feedReplacementShadowRoot.appendChild(html.content.cloneNode(true));

    if (feedContent.showTodos) {
      initTodoList(feedReplacementShadowRoot);
    }
    updateFeedReplacementTime(feedReplacementShadowRoot);

    const focusStartBtn = feedReplacementShadowRoot.getElementById('focusStartBtn');
    const bypassBtn = feedReplacementShadowRoot.getElementById('bypassBtn');

    focusStartBtn.addEventListener('click', dismissFeedReplacement);
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
          checkbox.classList.toggle('checked');
          input.classList.toggle('completed');
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
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      timeEl.textContent = `${hours}:${mins}`;
    });
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

  chrome.storage.onChanged.addListener((changes, namespace) => {
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
  });

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
