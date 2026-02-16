# Zero Distract

**Reclaim your focus with intelligent nudges.** Zero Distract is a Manifest V3 Chrome extension that goes beyond simple site blocking — it tracks your distraction patterns, delivers smart contextual nudges, and replaces social media feeds with your priorities.

![Chrome Web Store](https://img.shields.io/badge/platform-Chrome-blue) ![Manifest V3](https://img.shields.io/badge/manifest-v3-green) ![License](https://img.shields.io/badge/license-MIT-yellow)

## What Makes It Different

Unlike basic site blockers (Cold Turkey, StayFocusd), Zero Distract doesn't just block — it **understands**. It analyzes your browsing patterns across the week, identifies when you're most likely to drift, and nudges you at the right moment with the right message.

## Features

### Focus Mode Toggle
One-click activation from the popup. When enabled:
- Smart nudges appear after spending time on distraction sites
- Social media feeds are replaced with your priority list
- The extension icon turns green to show active status

### Time Tracking
- Automatic hourly bucketing of time spent per domain
- Lightweight 5-second interval detection via Chrome alarms
- 7-day data retention with daily focus score calculation

### Smart Nudges
- Contextual toast notifications when you drift to distraction sites
- Adjustable delay (1-10 minutes) and cooldown (5-60 minutes)
- Smart timing mode — nudges faster during your peak distraction hours
- Pattern-aware: detects recurring drifts and adjusts automatically
- Only active during configured work hours

### Feed Replacement
- Replaces homepage feeds on YouTube, Reddit, and Twitter/X
- Shows current time, a motivational message, and your priority checklist
- Editable todo list that persists across sessions
- "Continue anyway" bypass with 30-minute cooldown
- Per-site toggle (enable/disable individually)

### Analytics Dashboard
- 7-day bar chart with color-coded daily focus scores (green/orange/red)
- Click any day for detailed site-by-site breakdown
- Weekly insights: peak distraction windows, recurring drift days, trend direction
- Site breakdown table with total time, daily averages, and categories

### Pattern Detection
- **Peak distraction window** — identifies the hour you're most distracted
- **Recurring drift analysis** — detects which days of the week are hardest
- **Trend analysis** — compares last 3 days vs previous 3 days
- **Worst day detection** — highlights your most distraction-heavy day

### Interactive Onboarding
First-time users get a 4-step interactive walkthrough:
1. **Your focus companion** — how the toolbar icon works
2. **Control at a glance** — interactive popup demo with live toggle
3. **Smart nudges** — see the nudge toast with working buttons
4. **Feed replacement** — try the priority checklist with toggleable checkboxes

### Settings
- Work hours configuration (start/end time)
- Distraction sites list management (add/remove)
- Nudge timing and cooldown controls
- Feed replacement toggles per site
- Data export (JSON) and full reset

## Installation

### From Source (Developer Mode)

1. Clone the repository:
   ```bash
   git clone https://github.com/AstrolabzX/zero-distract-extension.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (top right toggle)

4. Click **Load unpacked** and select the project folder

5. Pin the Zero Distract icon in your toolbar

### First Run

On first install, the interactive onboarding page opens automatically. Click through the 4 scenarios to learn how the extension works, then click **Get Started**.

## How It Works

```
Content Script (content.js)          Background Worker (background.js)
├─ Detects site visits               ├─ 5-second alarm tracks active tab
├─ Shows nudge toasts (Shadow DOM)   ├─ Hourly time bucketing per domain
├─ Replaces feeds (Shadow DOM)       ├─ Pattern detection (daily)
└─ Todo list management              └─ Badge icon updates
         ↕                                    ↕
                   Chrome Storage (local)
                   ├─ timeData (hourly buckets)
                   ├─ focusMode, distractionSites
                   ├─ patterns, settings
                   └─ feedReplacementTodos
         ↕                                    ↕
Popup (popup.js)                     Dashboard / Settings
├─ Focus toggle                      ├─ 7-day analytics
├─ Top 3 distractions today          ├─ Site breakdown
├─ Focus score vs yesterday          └─ All configuration
└─ Quick links to dashboard/settings
```

### Focus Score Calculation
```
score = 100 - (distraction_time / total_tracked_time) * 100
```
- **100** = no time on distraction sites
- **0** = all time on distraction sites
- Compared daily against yesterday's score

## Project Structure

```
zero-distract-extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── background.js          # Service worker: tracking, alarms, patterns
├── content.js             # Content script: nudges + feed replacement
├── popup.html/css/js      # Toolbar popup UI
├── dashboard.html/css/js  # Weekly analytics page
├── settings.html/css/js   # Configuration page
├── onboarding.html/css/js # Interactive first-run walkthrough
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Data Structure

```javascript
// Chrome storage (local only — never sent externally)
{
  focusMode: false,                    // Toggle state
  isFirstRun: false,                   // Onboarding trigger
  timeData: {
    "2026-02-14": {
      "youtube.com": { "09": 120, "10": 300 },  // seconds per hour
      "github.com": { "10": 60, "11": 240 }
    }
  },
  distractionSites: ["twitter.com", "x.com", "reddit.com", ...],
  workHours: { startTime: "09:00", endTime: "17:00" },
  nudgeDelay: 3,                       // minutes
  nudgeCooldown: 15,                   // minutes
  smartTiming: true,
  feedReplacement: { youtube: true, reddit: true, twitter: true },
  feedContent: { showTodos: true, showQuotes: true },
  feedReplacementTodos: ["", "", ""],   // User's priority list
  patterns: {
    recurringDrifts: [...],
    peakDistractionWindow: "14:00",
    trend: "improving",
    worstDay: "Wednesday"
  }
}
```

## Permissions

| Permission | Why |
|-----------|-----|
| `storage` | Persist time data, settings, and todos locally |
| `alarms` | 5-second interval for lightweight time tracking |
| `tabs` | Detect active tab changes and domain switches |

Content scripts are injected on all `http/https` pages to enable nudges and feed replacement via Shadow DOM (fully isolated from page styles).

## Default Configuration

| Setting | Default |
|---------|---------|
| Distraction sites | twitter.com, x.com, reddit.com, youtube.com, instagram.com, facebook.com, tiktok.com |
| Work hours | 09:00 - 17:00 |
| Nudge delay | 3 minutes |
| Nudge cooldown | 15 minutes |
| Smart timing | Enabled |
| Feed replacement | YouTube, Reddit, Twitter (all enabled) |

## Troubleshooting

**Nudges not appearing?**
- Ensure Focus Mode is toggled on (green icon)
- Check that the site is in your distraction sites list (Settings)
- Verify you're within configured work hours
- Wait for the nudge delay to elapse (default: 3 minutes)

**Dashboard shows no data?**
- Browse normally for a few minutes with the extension loaded
- Refresh the dashboard page
- Check the service worker console for errors (chrome://extensions → Service Workers)

**"Extension context invalidated" errors?**
- These only occur on tabs that were open when you reloaded the extension
- Refresh those tabs to resolve — this does not affect normal usage

**Feed replacement not showing?**
- Only activates on homepage of supported sites (youtube.com, reddit.com, twitter.com/x.com)
- Must be within work hours with Focus Mode enabled
- Check Settings to ensure the specific site toggle is on

## Privacy

All data stays on your device. Zero Distract:
- Stores everything in Chrome's local storage — nothing is sent to any server
- Does not track identity, account info, or page content
- Only records domain names and time spent
- Provides full data export and deletion in Settings

## Browser Support

- **Minimum**: Chrome 88+ (Manifest V3)
- **Recommended**: Chrome 120+

## License

MIT License — free to use, modify, and distribute.

---

**Built to help you focus.** Zero Distract doesn't block you — it helps you understand your habits and make intentional choices about your attention.
