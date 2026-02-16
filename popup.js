// Popup script for Zero Distract extension

// DOM elements
let focusToggle;
let focusIcon;
let focusTitle;
let focusSubtitle;

// Default distraction sites
const DEFAULT_DISTRACTION_SITES = [
  'twitter.com',
  'x.com',
  'reddit.com',
  'youtube.com',
  'instagram.com',
  'facebook.com',
  'tiktok.com'
];

document.addEventListener('DOMContentLoaded', async function() {
  // Add fade-in animation
  document.body.classList.add('fade-in');
  
  // Get DOM elements
  focusToggle = document.getElementById('focusToggle');
  focusIcon = document.getElementById('focusIcon');
  focusTitle = document.getElementById('focusTitle');
  focusSubtitle = document.getElementById('focusSubtitle');
  
  try {
    // Check if first run
    const isFirstRun = await checkFirstRun();
    
    // Initialize distraction sites if not present
    initializeDistractionSites();
    
    // Load saved focus state
    loadFocusState();
    
    // Load time tracking data
    loadTimeData();
    
    // Redirect to onboarding on first run
    if (isFirstRun) {
      chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
      window.close();
      return;
    }
    // Add event listener for toggle
    if (focusToggle) {
      focusToggle.addEventListener('click', toggleFocusMode);
    }
    
    // Listen for storage changes to update UI in real-time
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.focusMode) {
        updateFocusUI(changes.focusMode.newValue);
      }
    });
    
    // Dashboard button handler
    const dashboardBtn = document.querySelector('.dashboard-button');
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', function() {
        try {
          const dashboardUrl = chrome.runtime.getURL('dashboard.html');
          chrome.tabs.create({ url: dashboardUrl });
        } catch (error) {
          console.error('[Zero Distract] Error opening dashboard:', error);
        }
      });
    }

    // Settings button handler
    const settingsBtn = document.getElementById('settingsButton');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', function() {
        try {
          const settingsUrl = chrome.runtime.getURL('settings.html');
          chrome.tabs.create({ url: settingsUrl });
        } catch (error) {
          console.error('[Zero Distract] Error opening settings:', error);
        }
      });
    }
  } catch (error) {
    console.error('[Zero Distract] Error during popup initialization:', error);
    if (focusSubtitle) {
      focusSubtitle.textContent = 'Error loading. Please reload.';
    }
  }
});

// Check if this is the first run
async function checkFirstRun() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['isFirstRun'], function(result) {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        const isFirstRun = result.isFirstRun !== false;
        if (isFirstRun) {
          chrome.storage.local.set({ isFirstRun: false });
        }
        resolve(isFirstRun);
      });
    } catch (error) {
      console.error('[Zero Distract] Error checking first run:', error);
      resolve(false);
    }
  });
}

// Initialize distraction sites list if not present
function initializeDistractionSites() {
  try {
    chrome.storage.local.get(['distractionSites'], function(result) {
      if (chrome.runtime.lastError) {
        console.error('[Zero Distract] Storage error:', chrome.runtime.lastError);
        return;
      }
      if (!result.distractionSites) {
        chrome.storage.local.set({ distractionSites: DEFAULT_DISTRACTION_SITES });
      }
    });
  } catch (error) {
    console.error('[Zero Distract] Error initializing distraction sites:', error);
  }
}

// Load focus state from storage
function loadFocusState() {
  try {
    chrome.storage.local.get(['focusMode'], function(result) {
      if (chrome.runtime.lastError) {
        console.error('[Zero Distract] Storage error:', chrome.runtime.lastError);
        updateFocusUI(false);
        return;
      }
      const isActive = result.focusMode || false;
      updateFocusUI(isActive);
    });
  } catch (error) {
    console.error('[Zero Distract] Error loading focus state:', error);
    updateFocusUI(false);
  }
}

// Toggle focus mode
function toggleFocusMode() {
  try {
    chrome.storage.local.get(['focusMode'], function(result) {
      if (chrome.runtime.lastError) {
        console.error('[Zero Distract] Storage error:', chrome.runtime.lastError);
        return;
      }
      const currentState = result.focusMode || false;
      const newState = !currentState;
      
      // Save new state with error handling
      chrome.storage.local.set({ focusMode: newState }, function() {
        if (chrome.runtime.lastError) {
          console.error('[Zero Distract] Storage error:', chrome.runtime.lastError);
          return;
        }
        updateFocusUI(newState);
        
        // Notify background script of state change
        try {
          chrome.runtime.sendMessage({ 
            action: 'focusModeChanged', 
            enabled: newState 
          });
        } catch (e) {
          console.error('[Zero Distract] Message error:', e);
        }
      });
    });
  } catch (error) {
    console.error('[Zero Distract] Error toggling focus mode:', error);
  }
}

// Update UI based on focus state
function updateFocusUI(isActive) {
  if (!focusToggle) return;
  
  // Add smooth transition
  focusToggle.style.transition = 'all 0.3s ease';
  
  if (isActive) {
    // Active state
    focusToggle.classList.add('active');
    focusIcon.textContent = '🟢';
    focusTitle.textContent = 'Focus Mode Active';
    focusSubtitle.textContent = 'Feeds hidden · Nudges on';
  } else {
    // Inactive state
    focusToggle.classList.remove('active');
    focusIcon.textContent = '⏸';
    focusTitle.textContent = 'Focus Mode Off';
    focusSubtitle.textContent = 'Tap to start focusing';
  }
}

// ===== TIME TRACKING DATA =====

// Get date string in YYYY-MM-DD format
function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get yesterday's date string
function getYesterdayString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateString(yesterday);
}

// Convert seconds to readable format
function formatTime(seconds) {
  if (seconds < 60) {
    return '< 1m';
  }
  
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

// Load and display time tracking data
function loadTimeData() {
  try {
    const today = getDateString();
    const yesterday = getYesterdayString();
    
    chrome.storage.local.get(['timeData', 'distractionSites'], function(result) {
      if (chrome.runtime.lastError) {
        console.error('[Zero Distract] Storage error:', chrome.runtime.lastError);
        updateDistractionList([], 1);
        return;
      }
      
      const timeData = result.timeData || {};
      const todayData = timeData[today] || {};
      const yesterdayData = timeData[yesterday] || {};
      const distractionSites = result.distractionSites || DEFAULT_DISTRACTION_SITES;
    
      // Convert hourly data to domain totals
      const sites = Object.entries(todayData)
        .map(([domain, hourlyData]) => {
          // Sum all hours for this domain
          let totalTime = 0;
          if (typeof hourlyData === 'object') {
            totalTime = Object.values(hourlyData).reduce((sum, val) => sum + val, 0);
          } else {
            totalTime = hourlyData;
          }
          
          return {
            domain,
            seconds: totalTime,
            isDistraction: distractionSites.includes(domain)
          };
        })
        .filter(site => site.seconds > 0) // Only include sites with tracked time
        .sort((a, b) => b.seconds - a.seconds);
    
      // Get top 3
      const top3 = sites.slice(0, 3);
      
      // Calculate max time for percentage calculation
      const maxTime = top3.length > 0 ? top3[0].seconds : 1;
      
      // Update the distraction list
      updateDistractionList(top3, maxTime);
      
      // Calculate focus score
      calculateFocusScore(sites, yesterdayData, distractionSites);
    });
  } catch (error) {
    console.error('[Zero Distract] Error loading time data:', error);
    updateDistractionList([], 1);
  }
}

// Update the distraction list in the UI
function updateDistractionList(sites, maxTime) {
  const container = document.querySelector('.distraction-list');
  
  if (sites.length === 0) {
    // Show placeholder message
    container.innerHTML = '<div style="color: #71717A; font-size: 12px; text-align: center; padding: 20px;">No tracking data yet. Browse some sites!</div>';
    return;
  }
  
  // Clear existing items
  container.innerHTML = '';
  
  sites.forEach((site) => {
    const percentage = Math.round((site.seconds / maxTime) * 100);
    
    // Color based on whether it's a distraction site
    let colorClass;
    if (site.isDistraction) {
      // Red for top distraction, yellow for others
      colorClass = site.seconds === maxTime ? 'progress-danger' : 'progress-warning';
    } else {
      // Green for productive sites
      colorClass = 'progress-accent';
    }
    
    const itemHTML = `
      <div class="distraction-item">
        <div class="distraction-header">
          <span class="distraction-name">${site.domain}</span>
          <span class="distraction-time">${formatTime(site.seconds)}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${colorClass}" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', itemHTML);
  });
}

// Calculate and update focus score
function calculateFocusScore(sites, yesterdayData, distractionSites) {
  const scoreValueEl = document.querySelector('.score-value');
  const scoreChangeEl = document.querySelector('.score-change');
  
  if (sites.length === 0) {
    // No data yet
    scoreValueEl.innerHTML = `--<span class="score-total">/100</span>`;
    scoreChangeEl.textContent = '--';
    return;
  }
  
  // Calculate total time and distraction time (today)
  const totalTime = sites.reduce((sum, site) => sum + site.seconds, 0);
  const distractionTime = sites
    .filter(site => distractionSites.includes(site.domain))
    .reduce((sum, site) => sum + site.seconds, 0);
  
  // Score = 100 - (distraction percentage)
  const score = Math.round(100 - (distractionTime / totalTime) * 100);
  
  // Update score display
  scoreValueEl.innerHTML = `${score}<span class="score-total">/100</span>`;
  
  // Calculate yesterday's score for comparison
  if (!yesterdayData || Object.keys(yesterdayData).length === 0) {
    // No yesterday data
    scoreChangeEl.textContent = '--';
    return;
  }
  
  // Sum yesterday's data (convert hourly to totals per domain)
  const yesterdayTotalTime = Object.entries(yesterdayData).reduce((sum, [, hourlyData]) => {
    if (typeof hourlyData === 'object') {
      return sum + Object.values(hourlyData).reduce((s, v) => s + v, 0);
    }
    return sum + hourlyData;
  }, 0);
  
  const yesterdayDistractionTime = Object.entries(yesterdayData)
    .filter(([domain]) => distractionSites.includes(domain))
    .reduce((sum, [, hourlyData]) => {
      if (typeof hourlyData === 'object') {
        return sum + Object.values(hourlyData).reduce((s, v) => s + v, 0);
      }
      return sum + hourlyData;
    }, 0);
  
  if (yesterdayTotalTime === 0) {
    scoreChangeEl.textContent = '--';
    return;
  }
  
  const yesterdayScore = Math.round(100 - (yesterdayDistractionTime / yesterdayTotalTime) * 100);
  
  // Calculate difference
  const difference = score - yesterdayScore;
  const arrow = difference >= 0 ? '↑' : '↓';
  const absChange = Math.abs(difference);
  
  scoreChangeEl.textContent = `${arrow} ${absChange}%`;
  
  // Update color based on trend
  if (difference >= 0) {
    scoreChangeEl.style.color = 'var(--accent)'; // Green for improvement
  } else {
    scoreChangeEl.style.color = 'var(--danger)'; // Red for decline
  }
}
