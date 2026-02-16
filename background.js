// Background service worker for Zero Distract extension

// ===== TIME TRACKING STATE =====
let currentDomain = null;
let trackingActive = false;

// Default distraction sites (these have static content_scripts in manifest.json)
const DEFAULT_DISTRACTION_SITES = [
  'twitter.com', 'x.com', 'reddit.com', 'youtube.com',
  'instagram.com', 'facebook.com', 'tiktok.com'
];

// ===== DYNAMIC CONTENT SCRIPT REGISTRATION =====

// Register content scripts for custom (non-default) distraction sites
async function registerCustomContentScripts(allSites) {
  const customSites = allSites.filter(site => !DEFAULT_DISTRACTION_SITES.includes(site));

  // Unregister previous dynamic scripts
  try {
    await chrome.scripting.unregisterContentScripts({ ids: ['custom-distraction-sites'] });
  } catch (e) {
    // No scripts to unregister
  }

  if (customSites.length === 0) return;

  const patterns = customSites.flatMap(site => [
    `https://${site}/*`,
    `https://www.${site}/*`
  ]);

  try {
    await chrome.scripting.registerContentScripts([{
      id: 'custom-distraction-sites',
      matches: patterns,
      js: ['content.js'],
      runAt: 'document_idle'
    }]);
  } catch (e) {
    // Permission may not be granted yet for these hosts
  }
}

// Re-register custom scripts when distraction sites change
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.distractionSites) {
    const newSites = changes.distractionSites.newValue || [];
    registerCustomContentScripts(newSites);
  }
});

// ===== HELPER FUNCTIONS =====

// Extract domain from URL
function extractDomain(url) {
  if (!url) return null;
  
  // Ignore chrome internal pages
  if (url.startsWith('chrome://') || 
      url.startsWith('chrome-extension://') || 
      url.startsWith('about:') ||
      url.startsWith('edge://') ||
      url.startsWith('file://')) {
    return null;
  }
  
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    
    // Strip "www." prefix
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    return hostname;
  } catch (e) {
    return null;
  }
}

// Get today's date string in YYYY-MM-DD format
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get current hour as zero-padded string (00-23)
function getCurrentHourString() {
  const now = new Date();
  return String(now.getHours()).padStart(2, '0');
}

// Add time to a domain for today (with hourly bucketing)
function addTimeToDay(domain, seconds) {
  if (!domain) return;
  
  try {
    const today = getTodayString();
    const hour = getCurrentHourString();
    
    chrome.storage.local.get(['timeData'], function(result) {
      try {
        if (chrome.runtime.lastError) {
          return;
        }
        
        let timeData = result.timeData || {};
        
        // Initialize today if it doesn't exist
        if (!timeData[today]) {
          timeData[today] = {};
        }
        
        // Initialize domain if it doesn't exist
        if (!timeData[today][domain]) {
          timeData[today][domain] = {};
        }
        
        // Initialize hour bucket if it doesn't exist
        if (!timeData[today][domain][hour]) {
          timeData[today][domain][hour] = 0;
        }
        
        // Add seconds to the hourly bucket
        timeData[today][domain][hour] += seconds;
        
        // Save back to storage
        chrome.storage.local.set({ timeData }, function() {
          if (chrome.runtime.lastError) {
          }
        });
      } catch (e) {
      }
    });
  } catch (e) {
  }
}

// Update the current active domain
function updateCurrentDomain(domain) {
  currentDomain = domain;
}

// Get the current active tab and start tracking it
async function trackCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const domain = extractDomain(tab.url);
      updateCurrentDomain(domain);
    }
  } catch (e) {
  }
}

// ===== TIME TRACKING ENGINE =====

// Set up alarm for tracking (ticks every 5 seconds)
function setupTrackingAlarm() {
  // Clear any existing alarm
  chrome.alarms.clear('timeTracker', function() {
    // Create new alarm that fires every 5 seconds
    chrome.alarms.create('timeTracker', {
      periodInMinutes: 5 / 60 // 5 seconds = 0.0833... minutes
    });
  });
}

// Set up daily alarm for pattern detection (11:59 PM)
function setupPatternDetectionAlarm() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 0, 0);
  
  const minutesUntilMidnight = Math.ceil((tomorrow - now) / 1000 / 60);
  
  chrome.alarms.clear('patternDetection', function() {
    chrome.alarms.create('patternDetection', {
      delayInMinutes: minutesUntilMidnight,
      periodInMinutes: 24 * 60 // Run daily
    });
  });
}

// Handle alarm tick - add time to current domain
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'timeTracker') {
    if (currentDomain) {
      addTimeToDay(currentDomain, 5); // Add 5 seconds
    }
  } else if (alarm.name === 'patternDetection') {
    detectPatterns();
  }
});

// Listen for tab activation (user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      const domain = extractDomain(tab.url);
      updateCurrentDomain(domain);
    }
  } catch (e) {
  }
});

// Listen for tab URL changes (navigation within same tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process when URL actually changes and tab is active
  if (changeInfo.url && tab.active) {
    const domain = extractDomain(changeInfo.url);
    updateCurrentDomain(domain);
  }
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus - stop tracking
    currentDomain = null;
  } else {
    // Browser gained focus - track current tab
    await trackCurrentTab();
  }
});

// ===== PATTERN DETECTION =====

// Helper: Get date string for N days ago
function getDateStringNDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Get day of week name from date
function getDayOfWeekName(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(`${year}-${month}-${day}`);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

// Detect patterns in user behavior
function detectPatterns() {
  chrome.storage.local.get(['timeData', 'distractionSites'], function(result) {
    const timeData = result.timeData || {};
    const distractionSites = result.distractionSites || [];
    
    // Get last 7 days and previous week
    const last7Days = [];
    const prev7Days = [];
    for (let i = 6; i >= 0; i--) {
      last7Days.unshift(getDateStringNDaysAgo(i));
    }
    for (let i = 13; i >= 7; i--) {
      prev7Days.unshift(getDateStringNDaysAgo(i));
    }
    
    // ===== RULE 1: Peak Distraction Window =====
    const hourlyDistraction = {};
    last7Days.forEach(dateStr => {
      const dayData = timeData[dateStr] || {};
      Object.entries(dayData).forEach(([site, hourlyData]) => {
        if (distractionSites.includes(site) && typeof hourlyData === 'object') {
          Object.entries(hourlyData).forEach(([hour, seconds]) => {
            if (!hourlyDistraction[hour]) hourlyDistraction[hour] = 0;
            hourlyDistraction[hour] += seconds;
          });
        }
      });
    });
    
    let peakDistractionWindow = null;
    let maxDistraction = 0;
    const hours = Object.keys(hourlyDistraction).sort();
    
    // Find 2-hour window with most distraction
    for (let i = 0; i < hours.length - 1; i++) {
      const hour1 = parseInt(hours[i]);
      const hour2 = parseInt(hours[i + 1] || hour1);
      const total = (hourlyDistraction[hours[i]] || 0) + (hourlyDistraction[hours[i + 1]] || 0);
      
      if (total > maxDistraction) {
        maxDistraction = total;
        const startStr = String(hour1).padStart(2, '0');
        const endStr = String((hour1 + 2) % 24).padStart(2, '0');
        peakDistractionWindow = `${hour1}:00-${(hour1 + 2) % 24}:00`;
      }
    }
    
    // ===== RULE 2: Recurring Drifts =====
    const recurringDrifts = [];
    const siteHourData = {};
    
    last7Days.forEach(dateStr => {
      const dayName = getDayOfWeekName(dateStr);
      const isWeekday = !['Sat', 'Sun'].includes(dayName);
      const dayData = timeData[dateStr] || {};
      
      Object.entries(dayData).forEach(([site, hourlyData]) => {
        if (distractionSites.includes(site) && typeof hourlyData === 'object') {
          const maxHour = Object.entries(hourlyData).reduce((max, [h, s]) => 
            s > (hourlyData[max] || 0) ? h : max, '00');
          
          if (!siteHourData[site]) {
            siteHourData[site] = {};
          }
          if (!siteHourData[site][maxHour]) {
            siteHourData[site][maxHour] = { count: 0, days: [] };
          }
          
          siteHourData[site][maxHour].count += isWeekday ? 1 : 0;
          if (isWeekday) siteHourData[site][maxHour].days.push(dayName);
        }
      });
    });
    
    // Find patterns with 3+ weekday occurrences
    Object.entries(siteHourData).forEach(([site, hours]) => {
      Object.entries(hours).forEach(([hour, data]) => {
        if (data.count >= 3) {
          recurringDrifts.push({
            site: site,
            typicalTime: `${hour}:00`,
            confidence: `${data.count}/5 days`,
            dayNames: [...new Set(data.days)]
          });
        }
      });
    });
    
    // ===== RULE 3: Trend (improving/declining/stable) =====
    const calculateWeekScore = (days) => {
      let totalScore = 0;
      let count = 0;
      
      days.forEach(dateStr => {
        const dayData = timeData[dateStr] || {};
        const distractionTime = Object.entries(dayData)
          .filter(([site]) => distractionSites.includes(site))
          .reduce((sum, [_, hourlyData]) => {
            if (typeof hourlyData === 'object') {
              return sum + Object.values(hourlyData).reduce((s, v) => s + v, 0);
            }
            return sum + hourlyData;
          }, 0);
        
        const totalTime = Object.entries(dayData).reduce((sum, [_, hourlyData]) => {
          if (typeof hourlyData === 'object') {
            return sum + Object.values(hourlyData).reduce((s, v) => s + v, 0);
          }
          return sum + hourlyData;
        }, 0);
        
        if (totalTime > 0) {
          const score = Math.max(0, 100 - (distractionTime / totalTime) * 100);
          totalScore += score;
          count++;
        }
      });
      
      return count > 0 ? Math.round(totalScore / count) : 0;
    };
    
    const thisWeekScore = calculateWeekScore(last7Days);
    const lastWeekScore = calculateWeekScore(prev7Days);
    let trend = 'stable';
    if (thisWeekScore > lastWeekScore + 5) trend = 'improving';
    else if (thisWeekScore < lastWeekScore - 5) trend = 'declining';
    
    // ===== RULE 4: Worst Day Pattern =====
    const dayScores = {};
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
      dayScores[day] = [];
    });
    
    last7Days.forEach(dateStr => {
      const dayName = getDayOfWeekName(dateStr);
      const dayData = timeData[dateStr] || {};
      
      const distractionTime = Object.entries(dayData)
        .filter(([site]) => distractionSites.includes(site))
        .reduce((sum, [_, hourlyData]) => {
          if (typeof hourlyData === 'object') {
            return sum + Object.values(hourlyData).reduce((s, v) => s + v, 0);
          }
          return sum + hourlyData;
        }, 0);
      
      const totalTime = Object.entries(dayData).reduce((sum, [_, hourlyData]) => {
        if (typeof hourlyData === 'object') {
          return sum + Object.values(hourlyData).reduce((s, v) => s + v, 0);
        }
        return sum + hourlyData;
      }, 0);
      
      if (totalTime > 0) {
        const score = Math.max(0, 100 - (distractionTime / totalTime) * 100);
        dayScores[dayName].push(score);
      }
    });
    
    let worstDay = null;
    let lowestScore = 100;
    Object.entries(dayScores).forEach(([day, scores]) => {
      if (scores.length > 0) {
        const avgScore = scores.reduce((a, b) => a + b) / scores.length;
        if (avgScore < lowestScore) {
          lowestScore = avgScore;
          worstDay = day;
        }
      }
    });
    
    // Store patterns in storage
    const patterns = {
      peakDistractionWindow,
      recurringDrifts,
      trend,
      worstDay,
      lastUpdated: Date.now()
    };
    
    chrome.storage.local.set({ patterns });
  });
}

// ===== INITIALIZATION =====

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First time installation - initialize default settings
    chrome.storage.local.set({
      focusMode: false,
      timeData: {},
      distractionSites: [
        'twitter.com',
        'x.com',
        'reddit.com',
        'youtube.com',
        'instagram.com',
        'facebook.com',
        'tiktok.com'
      ]
    });
    // Open onboarding page
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  } else if (details.reason === 'update') {
    // Extension updated
  }
  
  // Start tracking
  setupTrackingAlarm();
  setupPatternDetectionAlarm();
  trackCurrentTab();
});

// Start tracking when service worker starts
setupTrackingAlarm();
setupPatternDetectionAlarm();
trackCurrentTab();

// Register content scripts for any custom distraction sites
chrome.storage.local.get(['distractionSites'], function(result) {
  const sites = result.distractionSites || DEFAULT_DISTRACTION_SITES;
  registerCustomContentScripts(sites);
});

// ===== MESSAGE HANDLERS =====

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'focusModeChanged') {
    // Update extension UI to show focus mode status
    if (request.enabled) {
      // Show badge for focus mode
      chrome.action.setBadgeText({ text: '🟢' });
      chrome.action.setBadgeBackgroundColor({ color: '#16161A' });
      chrome.action.setTitle({ title: 'Zero Distract - Focus Mode ON' });
    } else {
      // Clear badge
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setTitle({ title: 'Zero Distract - Focus Mode OFF' });
    }
  }
  
  if (request.action === 'getTimeData') {
    // Return time data for a specific date (with daily totals summed from hourly data)
    const date = request.date || getTodayString();
    chrome.storage.local.get(['timeData'], function(result) {
      const timeData = result.timeData || {};
      const dayData = timeData[date] || {};
      
      // Convert hourly data to daily totals for compatibility
      const dailyTotals = {};
      for (const [domain, hourlyData] of Object.entries(dayData)) {
        if (typeof hourlyData === 'object' && hourlyData !== null) {
          // New format with hourly buckets
          dailyTotals[domain] = Object.values(hourlyData).reduce((sum, val) => sum + val, 0);
        } else {
          // Old format (fallback for compatibility)
          dailyTotals[domain] = hourlyData;
        }
      }
      
      sendResponse({ success: true, data: dailyTotals, date: date });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'getTimeForDomain') {
    // Return time for a specific domain today (sum across all hourly buckets)
    const domain = request.domain;
    const today = getTodayString();
    
    chrome.storage.local.get(['timeData'], function(result) {
      const timeData = result.timeData || {};
      const todayData = timeData[today] || {};
      const domainData = todayData[domain] || {};
      
      // Sum all hourly buckets for this domain today
      const seconds = Object.values(domainData).reduce((sum, val) => sum + val, 0);
      
      sendResponse({ success: true, seconds: seconds, domain: domain });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'closeCurrentTab') {
    // Close the tab that sent the message
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id);
    }
    return false;
  }
  
  return true; // Keep the message channel open for async responses
});
