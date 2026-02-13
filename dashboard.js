// Dashboard script for Zero Distract

const DEFAULT_DISTRACTION_SITES = [
  'twitter.com', 'x.com', 'reddit.com', 'youtube.com',
  'instagram.com', 'facebook.com', 'tiktok.com'
];

const TIPS = [
  "Try the Pomodoro Technique: 25 min focus, 5 min break",
  "Your morning hours are your most focused - use them wisely",
  "Notifications are the #1 focus killer - silence them",
  "One focused hour beats eight distracted ones",
  "Take a 5-minute walk when you feel focus slipping",
  "Your future self will thank you for this focus"
];

// Get date string YYYY-MM-DD
function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get last 7 days in reverse (oldest to newest)
function getLast7Days() {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push({
      date: new Date(date),
      dateStr: getDateString(date)
    });
  }
  return days;
}

// Format time in minutes to human readable
function formatTime(seconds) {
  if (seconds < 60) return '< 1m';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Calculate focus score for a day
function calculateDayScore(dayData, distractionSites) {
  if (!dayData || Object.keys(dayData).length === 0) {
    return 0;
  }
  
  const distractionTime = Object.entries(dayData)
    .filter(([site]) => distractionSites.includes(site))
    .reduce((sum, [_, siteData]) => {
      if (typeof siteData === 'object') {
        return sum + Object.values(siteData).reduce((s, v) => s + v, 0);
      }
      return sum + siteData;
    }, 0);
  
  const totalTime = Object.entries(dayData).reduce((sum, [_, siteData]) => {
    if (typeof siteData === 'object') {
      return sum + Object.values(siteData).reduce((s, v) => s + v, 0);
    }
    return sum + siteData;
  }, 0);
  
  if (totalTime === 0) return 0;
  
  return Math.max(0, Math.round(100 - (distractionTime / totalTime) * 100));
}

// Load and render the dashboard
function loadDashboard() {
  try {
    chrome.storage.local.get(['timeData', 'distractionSites', 'patterns'], (result) => {
      try {
        if (chrome.runtime.lastError) {
          console.error('[Zero Distract] Storage error:', chrome.runtime.lastError);
          return;
        }
        
        const timeData = result.timeData || {};
        const distractionSites = result.distractionSites || DEFAULT_DISTRACTION_SITES;
        const patterns = result.patterns || {};
        
        console.log('[Zero Distract Dashboard] Loaded data:', { timeData, hasData: Object.keys(timeData).length });
        
        // Get last 7 days
        const last7Days = getLast7Days();
        const dayScores = last7Days.map(({ date, dateStr }) => {
          const dayData = timeData[dateStr] || {};
          const score = calculateDayScore(dayData, distractionSites);
          console.log(`[Zero Distract] Day ${dateStr}: score=${score}, sites=${Object.keys(dayData).length}`);
          return {
            date,
            dateStr,
            dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
            dayData,
            score
          };
        });
        
        console.log('[Zero Distract] Day scores:', dayScores);
        
        // Update header
        const avgScore = Math.round(dayScores.reduce((sum, d) => sum + d.score, 0) / 7);
        console.log('[Zero Distract] Average score:', avgScore);
        updateHeader(dayScores, avgScore);
        
        // Render bar chart
        renderBarChart(dayScores);
        
        // Gather all site data for the week
        const allSites = {};
        dayScores.forEach(({ dayData }) => {
          Object.entries(dayData).forEach(([site, siteData]) => {
            if (!allSites[site]) {
              allSites[site] = {
                site,
                total: 0,
                days: 0
              };
            }
            
            // Handle both old (number) and new (hourly object) formats
            let siteTime = 0;
            if (typeof siteData === 'object') {
              siteTime = Object.values(siteData).reduce((sum, val) => sum + val, 0);
            } else {
              siteTime = siteData;
            }
            
            allSites[site].total += siteTime;
            allSites[site].days += 1;
          });
        });
        
        console.log('[Zero Distract] All sites:', allSites);
        
        // Render insights
        renderInsights(dayScores, allSites, distractionSites, patterns);
        
        // Render breakdown table
        renderBreakdown(allSites, distractionSites);
      } catch (error) {
        console.error('[Zero Distract] Error in loadDashboard callback:', error, error.stack);
      }
    });
  } catch (error) {
    console.error('[Zero Distract] Error in loadDashboard:', error, error.stack);
  }
}

function updateHeader(dayScores, avgScore) {
  try {
    const first = dayScores[0];
    const last = dayScores[6];
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startMonth = monthNames[first.date.getMonth()];
    const endMonth = monthNames[last.date.getMonth()];
    const dateStr = `${startMonth} ${first.date.getDate()} – ${endMonth} ${last.date.getDate()}`;
    
    const dateRangeEl = document.getElementById('dateRange');
    const scoreBadgeEl = document.getElementById('scoreBadge');
    
    if (dateRangeEl) {
      dateRangeEl.textContent = dateStr;
    }
    if (scoreBadgeEl) {
      scoreBadgeEl.textContent = `${avgScore}/100`;
    }
  } catch (error) {
    console.error('[Zero Distract] Error updating header:', error);
  }
}

function renderBarChart(dayScores) {
  try {
    const barChart = document.getElementById('barChart');
    if (!barChart) return;
    
    barChart.innerHTML = '';
    
    const maxScore = 100;
    
    dayScores.forEach((day, idx) => {
      const container = document.createElement('div');
      container.className = 'bar-container';
      container.style.cursor = 'pointer';
      
      const percentage = (day.score / maxScore) * 100;
      
      let colorClass = 'excellent';
      if (day.score < 50) colorClass = 'fair';
      else if (day.score < 70) colorClass = 'good';
      
      const bar = document.createElement('div');
      bar.className = `bar ${colorClass}`;
      bar.style.height = `${Math.max(4, percentage)}%`;
      
      const label = document.createElement('div');
      label.className = 'bar-label';
      label.textContent = day.dayName;
      
      const score = document.createElement('div');
      score.className = 'bar-score';
      score.textContent = day.score > 0 ? `${day.score}%` : '—';
      
      container.appendChild(bar);
      container.appendChild(label);
      container.appendChild(score);
      
      container.addEventListener('click', () => {
        showDailyDetail(day);
      });
      
      barChart.appendChild(container);
    });
  } catch (error) {
    console.error('[Zero Distract] Error rendering bar chart:', error);
  }
}

function showDailyDetail(day) {
  const section = document.getElementById('dailyDetailSection');
  const title = document.getElementById('dailyDetailTitle');
  const content = document.getElementById('dailyDetailContent');
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const fullDate = dayNames[day.date.getDay()] + ', ' +
    monthNames[day.date.getMonth()] + ' ' + day.date.getDate();
  
  title.textContent = fullDate;
  content.innerHTML = '';
  
  const sorted = Object.entries(day.dayData)
    .sort(([_, a], [__, b]) => b - a);
  
  if (sorted.length === 0) {
    content.innerHTML = '<div class="daily-detail-item"><span class="daily-detail-site">No data for this day</span></div>';
  } else {
    sorted.forEach(([site, time]) => {
      const item = document.createElement('div');
      item.className = 'daily-detail-item';
      
      const siteEl = document.createElement('span');
      siteEl.className = 'daily-detail-site';
      siteEl.textContent = site;
      
      const timeEl = document.createElement('span');
      timeEl.className = 'daily-detail-time';
      timeEl.textContent = formatTime(time);
      
      item.appendChild(siteEl);
      item.appendChild(timeEl);
      content.appendChild(item);
    });
  }
  
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderInsights(dayScores, allSites, distractionSites, patterns) {
  try {
    const insightsGrid = document.getElementById('insightsGrid');
    if (!insightsGrid) return;
    
    insightsGrid.innerHTML = '';
    
    // Find most distracted day
    let mostDistractedDay = dayScores[0];
    let maxDistraction = 0;
  
  dayScores.forEach(day => {
    const distTime = Object.entries(day.dayData)
      .filter(([site]) => distractionSites.includes(site))
      .reduce((sum, [_, timeData]) => {
        if (typeof timeData === 'object') {
          return sum + Object.values(timeData).reduce((s, v) => s + v, 0);
        }
        return sum + timeData;
      }, 0);
    
    if (distTime > maxDistraction) {
      maxDistraction = distTime;
      mostDistractedDay = day;
    }
  });
  
  // Find top distraction site
  let topSite = '';
  let topTime = 0;
  Object.entries(allSites).forEach(([site, data]) => {
    if (distractionSites.includes(site) && data.total > topTime) {
      topTime = data.total;
      topSite = site;
    }
  });
  
  // Find most focused day
  let mostFocusedDay = dayScores[0];
  dayScores.forEach(day => {
    if (day.score > mostFocusedDay.score) {
      mostFocusedDay = day;
    }
  });
  
  // Create insight cards
  const insights = [];
  
  // Pattern-based insight: Peak distraction window
  if (patterns && patterns.peakDistractionWindow) {
    insights.push({
      text: `Your focus is weakest between <strong>${patterns.peakDistractionWindow}</strong> — that's when you spend the most time on distracting sites.`
    });
  }
  
  // Pattern-based insight: Recurring drifts with time
  if (patterns && patterns.recurringDrifts && patterns.recurringDrifts.length > 0) {
    const drift = patterns.recurringDrifts[0];
    insights.push({
      text: `You tend to drift to <strong>${drift.site}</strong> around <strong>${drift.typicalTime}</strong> on <strong>${drift.dayNames.join('/')}</strong> — watch out for that!`
    });
  }
  
  // Pattern-based insight: Trend
  if (patterns && patterns.trend) {
    let trendText = '';
    if (patterns.trend === 'improving') {
      trendText = 'You\'re <strong>improving</strong>! Your focus is getting better week over week.';
    } else if (patterns.trend === 'declining') {
      trendText = 'Your focus is <strong>declining</strong> — time to reset your habits?';
    } else {
      trendText = 'Your focus is <strong>stable</strong> — keep maintaining those good habits.';
    }
    insights.push({
      text: trendText
    });
  }
  
  // Pattern-based insight: Worst day
  if (patterns && patterns.worstDay) {
    insights.push({
      text: `<strong>${patterns.worstDay}s</strong> are your least focused day — plan your most important work for other days.`
    });
  }
  
  // Fallback insights if patterns not available
  if (insights.length === 0) {
    if (maxDistraction > 0) {
      insights.push({
        text: `Your most distracted day was <strong>${mostDistractedDay.dayName}</strong> with <strong>${formatTime(maxDistraction)}</strong> on distracting sites.`
      });
    }
    
    if (topSite) {
      insights.push({
        text: `Your top distraction this week was <strong>${topSite}</strong> at <strong>${formatTime(topTime)}</strong> total.`
      });
    }
    
    if (mostFocusedDay.score > 0) {
      insights.push({
        text: `You were most focused on <strong>${mostFocusedDay.dayName}</strong> with a score of <strong>${mostFocusedDay.score}%</strong>.`
      });
    }
  }
  
  // Always add a tip
  insights.push({
    text: `<strong>Tip:</strong> ${TIPS[Math.floor(Math.random() * TIPS.length)]}`
  });
  
  insights.forEach(insight => {
    const card = document.createElement('div');
    card.className = 'insight-card';
    card.innerHTML = insight.text;
    insightsGrid.appendChild(card);
  });
  } catch (error) {
    console.error('[Zero Distract] Error rendering insights:', error);
  }
}

function renderBreakdown(allSites, distractionSites) {
  try {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
  
  const sorted = Object.values(allSites)
    .sort((a, b) => b.total - a.total);
  
  if (sorted.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4" style="text-align: center; color: var(--text-muted);">No data yet</td>';
    tableBody.appendChild(row);
  } else {
    sorted.forEach(item => {
      const row = document.createElement('tr');
      
      const isDistraction = distractionSites.includes(item.site);
      const category = isDistraction ? 'Distracting' : 'Productive';
      
      row.innerHTML = `
        <td><span class="site-name ${isDistraction ? 'distraction' : 'productive'}">${item.site}</span></td>
        <td>${formatTime(item.total)}</td>
        <td>${formatTime(item.total / item.days)}</td>
        <td><span class="category-badge ${isDistraction ? 'distracting' : 'productive'}">${category}</span></td>
      `;
      
      tableBody.appendChild(row);
    });
  }
  } catch (error) {
    console.error('[Zero Distract] Error rendering breakdown:', error);
  }
}

// Load on page load
window.addEventListener('DOMContentLoaded', loadDashboard);
