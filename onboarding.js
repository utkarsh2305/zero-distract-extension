// Onboarding script for Zero Distract extension

(function() {
  'use strict';

  let currentStep = 0;
  let focusToggleActive = false;

  const scenarios = [
    {
      title: 'Normal browsing',
      desc: 'Extension icon sits quietly in toolbar. Green = Focus on. Gray = off. Click to open popup.',
    },
    {
      title: 'Click the icon',
      desc: 'A dropdown popup appears below the icon \u2014 your daily command center. Toggle focus, see stats.',
    },
    {
      title: 'Smart nudge appears',
      desc: 'A small toast slides into the corner when AI detects you\'re drifting. Dismissible with \u2715.',
    },
    {
      title: 'Feed replaced',
      desc: 'During Focus Mode, landing on Twitter/Reddit/YouTube swaps the feed with your priorities.',
    },
  ];

  // DOM references
  const scenarioButtons = document.querySelectorAll('.scenario-btn');
  const callout = document.getElementById('callout');
  const extensionIcon = document.getElementById('extensionIcon');
  const popupDropdown = document.getElementById('popupDropdown');
  const popupOverlay = document.getElementById('popupOverlay');
  const nudgeToast = document.getElementById('nudgeToast');
  const feedReplacedOverlay = document.getElementById('feedReplacedOverlay');
  const explanationTitle = document.getElementById('explanationTitle');
  const explanationDesc = document.getElementById('explanationDesc');
  const popupFocusToggle = document.getElementById('popupFocusToggle');
  const popupToggleEmoji = document.getElementById('popupToggleEmoji');
  const popupToggleTitle = document.getElementById('popupToggleTitle');
  const popupToggleSubtitle = document.getElementById('popupToggleSubtitle');
  const getStartedBtn = document.getElementById('getStartedBtn');

  function setStep(step) {
    currentStep = step;

    // Update scenario buttons
    scenarioButtons.forEach((btn, i) => {
      btn.classList.toggle('active', i === step);
    });

    // Update explanation panel
    explanationTitle.textContent = scenarios[step].title;
    explanationDesc.textContent = scenarios[step].desc;

    // Reset all interactive elements
    callout.classList.add('hidden');
    popupDropdown.classList.add('hidden');
    popupOverlay.classList.add('hidden');
    nudgeToast.classList.add('hidden');
    feedReplacedOverlay.classList.add('hidden');

    // Remove alert dot if exists
    const alertDot = extensionIcon.querySelector('.alert-dot');
    if (alertDot) alertDot.remove();

    // Update extension icon state based on focus mode
    if (step === 3) {
      extensionIcon.classList.add('focus-active');
    } else {
      extensionIcon.classList.toggle('focus-active', focusToggleActive);
    }

    // Show elements for current step
    switch (step) {
      case 0:
        callout.classList.remove('hidden');
        break;

      case 1:
        popupDropdown.classList.remove('hidden');
        popupOverlay.classList.remove('hidden');
        break;

      case 2:
        nudgeToast.classList.remove('hidden');
        // Add alert dot to extension icon
        const dot = document.createElement('div');
        dot.className = 'alert-dot';
        extensionIcon.appendChild(dot);
        break;

      case 3:
        feedReplacedOverlay.classList.remove('hidden');
        updateFeedTime();
        break;
    }
  }

  // Update feed replacement time display
  function updateFeedTime() {
    const timeEl = document.getElementById('feedReplacedTime');
    if (!timeEl) return;
    const now = new Date();
    const h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    timeEl.textContent = displayHour + ':' + m + ' ' + ampm;
  }

  // Scenario button clicks
  scenarioButtons.forEach((btn, i) => {
    btn.addEventListener('click', () => setStep(i));
  });

  // Extension icon click -> toggle popup
  extensionIcon.addEventListener('click', () => {
    if (currentStep === 1) {
      setStep(0);
    } else {
      setStep(1);
    }
  });

  // Popup overlay click -> close popup
  popupOverlay.addEventListener('click', () => {
    setStep(0);
  });

  // Popup focus toggle
  popupFocusToggle.addEventListener('click', () => {
    focusToggleActive = !focusToggleActive;
    popupFocusToggle.classList.toggle('active', focusToggleActive);
    extensionIcon.classList.toggle('focus-active', focusToggleActive);

    if (focusToggleActive) {
      popupToggleEmoji.textContent = '\uD83D\uDFE2'; // green circle
      popupToggleTitle.textContent = 'Focus Mode Active';
      popupToggleSubtitle.textContent = 'Feeds hidden \u00B7 Nudges on';
    } else {
      popupToggleEmoji.textContent = '\u23F8'; // pause
      popupToggleTitle.textContent = 'Focus Mode Off';
      popupToggleSubtitle.textContent = 'Tap to start focusing';
    }
  });

  // Nudge dismiss
  document.getElementById('nudgeDismiss').addEventListener('click', () => {
    setStep(0);
  });

  // Nudge buttons
  document.getElementById('nudgeBackToWork').addEventListener('click', () => {
    setStep(0);
  });

  document.getElementById('nudge5Min').addEventListener('click', () => {
    nudgeToast.classList.add('hidden');
  });

  // Feed replacement continue button
  document.querySelector('.feed-replaced-continue').addEventListener('click', () => {
    feedReplacedOverlay.classList.add('hidden');
  });

  // Priority checkboxes
  document.querySelectorAll('.priority-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', () => {
      const item = checkbox.closest('.priority-item');
      const text = item.querySelector('.priority-text');
      const isChecked = checkbox.classList.toggle('checked');
      text.classList.toggle('completed', isChecked);
      checkbox.textContent = isChecked ? '\u2713' : '';
    });
  });

  // Get Started button
  getStartedBtn.addEventListener('click', () => {
    try {
      chrome.storage.local.set({ isFirstRun: false }, () => {
        window.close();
      });
    } catch (e) {
      // Not running as extension, just close
      window.close();
    }
  });

  // Initialize
  setStep(0);
  // Update feed time every minute
  setInterval(updateFeedTime, 60000);

})();
