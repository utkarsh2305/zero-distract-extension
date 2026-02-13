# Zero Distract - Chrome Extension

**Reclaim your focus with intelligent nudges.** Zero Distract is a Manifest V3 Chrome extension that goes beyond simple site blocking to understand your distraction patterns and nudge you at the right moments.

Unlike basic site blockers (Cold Turkey, StayFocusd), Zero Distract tracks your actual time spent on distracting sites and analyzes patterns to deliver smart, contextual reminders when you need them most.

## Features

### 📊 Advanced Time Tracking
- **Automatic hourly bucketing** - Tracks time spent on each site per hour of the day
- **7-day analytics dashboard** - See your distraction patterns across the entire week
- **Daily focus score** - Compare today's focus against yesterday with percentage changes
- **Visual charts** - Interactive 7-day bar chart showing daily focus scores

### 🎯 Intelligent Pattern Detection
- **Peak distraction windows** - System identifies when you're most likely to get distracted
- **Recurring drift analysis** - Detects which days of the week you struggle most
- **Trend analysis** - Tracks if your focus is improving or declining
- **Smart timing** - Optional feature to nudge you earlier during your peak distraction times

### 🔔 Customizable Nudge System
- **Adjustable timing** - Choose when to be nudged (1-10 minutes after visiting a distraction site)
- **Cooldown periods** - Prevent notification fatigue (5-60 minute intervals)
- **Smart timing mode** - Automatically adjust nudge timing based on your patterns
- **Focus mode toggle** - Instantly activate/deactivate focus monitoring

### 🎨 Feed Replacement
- **YouTube, Reddit, Twitter blocking** - Replace feeds with productivity content
- **Todo list display** - See your tasks when you visit blocked sites
- **Inspirational quotes** - Get motivation when tempted
- **Per-site customization** - Toggle which sites have feed replacement

### ⚙️ Flexible Settings
- **Work hours** - Set when nudges and feed replacement are active
- **Distraction sites list** - Add or remove sites to monitor
- **Data export** - Download your time tracking data as JSON
- **Full reset** - Clear all data and restore defaults

## Installation

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/yourusername/zero-distract-extension.git
   cd zero-distract-extension
   ```

2. **Load as unpacked extension in Chrome**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `zero-distract-extension` folder

3. **Start using**
   - Click the Zero Distract icon in your Chrome toolbar
   - Browse normally - tracking starts automatically
   - Check your "Open Full Dashboard" to see analytics

## How It Works

### Data Flow
```
Content Scripts (Detect site visits)
        ↓
Background Service Worker (Track time hourly)
        ↓
Chrome Storage (Persist data with hourly buckets)
        ↓
UI Pages (Popup, Dashboard, Settings display data)
```

### Time Tracking
- **5-second interval check** - Lightweight alarm detects active tabs
- **Hourly bucketing** - Time stored in 24-hour buckets (00-23) per domain
- **Minimal storage writes** - Only writes to storage when hour changes

### Pattern Detection Algorithm
1. **Peak distraction window** - Finds the hour with highest total minutes
2. **Recurring drift** - Identifies which day of week has lowest focus score
3. **Trend analysis** - Compares average of last 3 days vs previous 3 days
4. **Worst day** - Determines which day was most distraction-heavy

### Focus Score Calculation
- **Daily score**: `100 × (work_time / (work_time + distraction_time))`
- **Work time**: Minutes on work-related sites (GitHub, documentation, etc.)
- **Distraction time**: Minutes on marked distraction sites
- **Comparison**: Shows percentage change vs yesterday

## Architecture

### Files Overview

**Core Extension Files:**
- `manifest.json` - Permission and configuration declarations
- `background.js` - Service worker handling time tracking and pattern detection
- `content.js` - Scripts injected into web pages for nudges and feed replacement

**UI Pages:**
- `popup.html/js/css` - Quick access popup showing daily score and top distractions
- `dashboard.html/js/css` - Full analytics week view with detailed breakdowns
- `settings.html/js/css` - User configuration for all features

**Assets:**
- `icons/` - Extension icons (16×16, 48×48, 128×128 PNG)

### Data Structure
```javascript
{
  timeData: {
    "2026-02-13": {
      "youtube.com": { "00": 0, "01": 0, ..., "14": 300, "15": 450 },
      "github.com": { "14": 60, "15": 120 }
    }
  },
  distractionSites: ["youtube.com", "reddit.com", ...],
  workHours: { startTime: "09:00", endTime: "17:00" },
  nudgeDelay: 3,
  nudgeCooldown: 15,
  smartTiming: true,
  feedReplacement: { youtube: true, reddit: true, twitter: true },
  feedContent: { showTodos: true, showQuotes: true },
  patterns: { recurringDrifts, peakDistractionWindow, trend, worstDay },
  isFirstRun: false
}
```

## Configuration

### Default Distraction Sites
```javascript
[
  'twitter.com', 'x.com', 'reddit.com', 'youtube.com',
  'instagram.com', 'facebook.com', 'tiktok.com'
]
```

### Default Settings
- **Nudge delay**: 3 minutes
- **Nudge cooldown**: 15 minutes
- **Smart timing**: Enabled
- **Work hours**: 09:00 - 17:00
- **Feed replacement**: All enabled
- **Feed content**: Todos + quotes

## Permissions

This extension uses minimal permissions:
- `storage` - To persist time data and settings
- `alarms` - For 5-second time tracking intervals
- `tabs` - To detect active tab changes
- `content scripts` - To inject nudges and replace feeds on distraction sites

## Browser Support

- **Minimum**: Chrome 88+ (Manifest V3 support)
- **Recommended**: Chrome 120+ (latest stable)

## Development

### Adding a New Distraction Site
1. Open Settings page
2. Click "Add Site" 
3. Enter domain (e.g., `twitch.tv`)
4. Site will be tracked and nudged immediately

### Customizing Nudge Messages
Edit the nudge message in `content.js` around line 300:
```javascript
const nudgeMessage = "You've been here too long. Time to refocus?";
```

### Changing Colors/Theme
Edit CSS files:
- `popup.css` - Popup styling
- `dashboard.css` - Dashboard styling
- `settings.css` - Settings styling

The main color is purple (`#7C3AED`). Change all instances to customize.

## Troubleshooting

### Data not showing in dashboard?
1. Visit a distraction site for at least 1 minute
2. Reload the dashboard (F5)
3. Open DevTools (F12) → Console to check for errors

### Nudges not appearing?
- Check Settings for work hours (nudges only active during work hours)
- Verify nudgeCooldown hasn't recently triggered
- Ensure site is in distraction sites list
- Check "Focus Mode" isn't disabled

### Settings not saving?
- Clear extension storage: `chrome://extensions/Zero Distract → Clear data`
- Reload extension
- Reconfigure settings

## Privacy

**Data stored locally only.** Zero Distract:
- ✅ Stores all data in Chrome's local storage (never sent to servers)
- ✅ Never tracks your identity or personal info
- ✅ Cannot access site content, only site domains visited
- ✅ Allows full data export and deletion

## Roadmap

Future enhancements:
- [ ] Export data as CSV/PDF reports
- [ ] Sync settings across devices
- [ ] Focus mode with website blocking
- [ ] Custom nudge notifications
- [ ] Integration with calendar (respect meeting times)
- [ ] Team/family focus challenges

## Contributing

Found a bug or have a feature request?
1. Open an issue describing the problem
2. Include steps to reproduce
3. Share relevant console logs (F12 → Console)

## License

MIT License - Feel free to modify and distribute

## Support

For questions or issues:
- Check the troubleshooting section above
- Open an issue on GitHub
- Review the console logs (F12) for error details

---

**Made with focus in mind.** Zero Distract helps you understand your digital habits and make intentional choices about your attention.
