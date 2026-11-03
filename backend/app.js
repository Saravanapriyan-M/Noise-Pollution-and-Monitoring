/**
 * Noise Pollution Monitoring System - Frontend Application Logic
 * ESP32 + MAX4466 Sound Sensor Telemetry
 * ChatGPT-inspired Collapsible Sidebar & Multi-Page Dashboard
 */

// =============================================================================
// API & Configuration
// =============================================================================
const API_BASE = window.location.protocol.startsWith('http') && window.location.port !== '5500' && window.location.port !== '3000'
    ? window.location.origin
    : 'http://localhost:8000';

// Default Thresholds (can be updated via Settings page & localStorage)
let highNoiseThreshold = 70.0;
let medNoiseThreshold = 50.0;
let audioAlertEnabled = true;
let alertToneFrequency = 880;

// Application State Tracking
let activePage = 'overview';
let previousNoiseStatus = null;
let lastPacketTimestamp = null;
let totalPacketsReceived = 0;
let storedReadings = []; // Full array from /api/readings
let alertEvents = []; // Recorded high noise alert incidents

// Session Min / Max / Avg Statistics
let sessionStats = {
    minDb: Infinity,
    maxDb: -Infinity,
    sumDb: 0,
    countDb: 0,
    minRms: Infinity,
    maxRms: -Infinity,
    sumRms: 0,
    countRms: 0
};

// Web Audio API
let audioContext = null;

// Chart.js Instances
let overviewChart = null;
let rmsChart = null;
let analyticsChart = null;

// =============================================================================
// DOM Elements
// =============================================================================
// Layout & Sidebar
const appLayoutEl = document.getElementById('app-layout');
const sidebarEl = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebarBackdropEl = document.getElementById('sidebar-backdrop');
const navItems = document.querySelectorAll('.nav-item');
const pageViews = document.querySelectorAll('.page-view');
const currentPageTitleEl = document.getElementById('current-page-title');
const currentPageSubtitleEl = document.getElementById('current-page-subtitle');
const sidebarAlertBadgeEl = document.getElementById('sidebar-alert-badge');

// Status & Header Elements
const headerSensorDotEl = document.getElementById('header-sensor-dot');
const headerSensorStatusTextEl = document.getElementById('header-sensor-status-text');
const headerLastUpdatedTextEl = document.getElementById('header-last-updated-text');
const audioToggleBtn = document.getElementById('audio-toggle-btn');
const audioBtnLabel = document.getElementById('audio-btn-label');
const audioIconOn = document.querySelector('.audio-icon-on');
const audioIconOff = document.querySelector('.audio-icon-off');

// Bottom Sidebar Status
const sidebarEsp32Dot = document.getElementById('sidebar-esp32-dot');
const sidebarEsp32Status = document.getElementById('sidebar-esp32-status');
const sidebarSensorDot = document.getElementById('sidebar-sensor-dot');
const sidebarSensorStatus = document.getElementById('sidebar-sensor-status');
const mobileStatusDot = document.getElementById('mobile-status-dot');

// Global Banners
const highNoiseBannerEl = document.getElementById('high-noise-banner');
const alertDbValueEl = document.getElementById('alert-db-value');
const activeAlertTimeEl = document.getElementById('active-alert-time');
const disconnectedBannerEl = document.getElementById('disconnected-banner');
const disconnectedMsgEl = document.getElementById('disconnected-msg');

// Overview Elements
const overviewCurrentDbEl = document.getElementById('overview-current-db');
const overviewDbUnitEl = document.getElementById('overview-db-unit');
const overviewNoiseBadgeEl = document.getElementById('overview-noise-badge');
const overviewScaleIndicatorEl = document.getElementById('overview-scale-indicator');
const overviewCurrentRmsEl = document.getElementById('overview-current-rms');
const overviewRmsUnitEl = document.getElementById('overview-rms-unit');
const overviewEsp32PillEl = document.getElementById('overview-esp32-pill');
const overviewRecentAlertSubtextEl = document.getElementById('overview-recent-alert-subtext');
const overviewRecentAlertBadgeEl = document.getElementById('overview-recent-alert-badge');
const overviewChartEmptyEl = document.getElementById('overview-chart-empty');

// Live Page Elements
const liveDbValEl = document.getElementById('live-db-val');
const liveStatusBadgeEl = document.getElementById('live-status-badge');
const liveAudioMeterFillEl = document.getElementById('live-audio-meter-fill');
const liveStatMinEl = document.getElementById('live-stat-min');
const liveStatMaxEl = document.getElementById('live-stat-max');
const liveStatP2pEl = document.getElementById('live-stat-p2p');
const liveStatAvgEl = document.getElementById('live-stat-avg');
const livePacketsBodyEl = document.getElementById('live-packets-body');
const btnResetSessionEl = document.getElementById('btn-reset-session');

// RMS Page Elements
const rmsCurrentValEl = document.getElementById('rms-current-val');
const rmsAvgValEl = document.getElementById('rms-avg-val');
const rmsMinValEl = document.getElementById('rms-min-val');
const rmsMaxValEl = document.getElementById('rms-max-val');

// Sensor Status Page Elements
const sensorPageStatusPill = document.getElementById('sensor-page-status-pill');
const sensorPageStateText = document.getElementById('sensor-page-state-text');
const sensorPageLastVal = document.getElementById('sensor-page-last-val');
const sensorPageLastComm = document.getElementById('sensor-page-last-comm');
const sensorPagePacketsCount = document.getElementById('sensor-page-packets-count');

// Analytics Page Elements
const analyticsLowPctEl = document.getElementById('analytics-low-pct');
const analyticsMedPctEl = document.getElementById('analytics-med-pct');
const analyticsHighPctEl = document.getElementById('analytics-high-pct');
const analyticsLowCountEl = document.getElementById('analytics-low-count');
const analyticsMedCountEl = document.getElementById('analytics-med-count');
const analyticsHighCountEl = document.getElementById('analytics-high-count');

// Alert History Elements
const alertsTableBodyEl = document.getElementById('alerts-table-body');
const alertsSearchInput = document.getElementById('alerts-search-input');
const alertsFilterSelect = document.getElementById('alerts-filter-select');
const btnExportAlerts = document.getElementById('btn-export-alerts');
const btnClearAlerts = document.getElementById('btn-clear-alerts');

// Historical Data Elements
const historyTableBodyEl = document.getElementById('history-table-body');
const historyTotalCountEl = document.getElementById('history-total-count');
const historySearchInput = document.getElementById('history-search-input');
const historyCategoryFilter = document.getElementById('history-category-filter');
const historyPageSize = document.getElementById('history-page-size');
const btnRefreshHistory = document.getElementById('btn-refresh-history');

// Reports Elements
const btnDownloadCsv = document.getElementById('btn-download-csv');
const btnDownloadJson = document.getElementById('btn-download-json');
const btnPrintReport = document.getElementById('btn-print-report');
const reportGenDateEl = document.getElementById('report-gen-date');
const reportTotalReadingsEl = document.getElementById('report-total-readings');
const reportAvgDbEl = document.getElementById('report-avg-db');
const reportPeakDbEl = document.getElementById('report-peak-db');
const reportMinDbEl = document.getElementById('report-min-db');
const reportAlertCountEl = document.getElementById('report-alert-count');
const reportOverallRatingEl = document.getElementById('report-overall-rating');

// Settings Elements
const settingHighThreshold = document.getElementById('setting-high-threshold');
const labelHighVal = document.getElementById('label-high-val');
const settingMedThreshold = document.getElementById('setting-med-threshold');
const labelMedVal = document.getElementById('label-med-val');
const settingAudioEnabled = document.getElementById('setting-audio-enabled');
const settingAudioPitch = document.getElementById('setting-audio-pitch');
const btnTestAudio = document.getElementById('btn-test-audio');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnResetSettings = document.getElementById('btn-reset-settings');
const settingsSaveToast = document.getElementById('settings-save-toast');

// Page Subtitle Dictionary
const pageMetadata = {
    overview: {
        title: 'Overview',
        subtitle: 'Real-time acoustic noise telemetry & live environmental monitoring'
    },
    live: {
        title: 'Live Noise Monitoring',
        subtitle: 'Actual real-time sensor waveform, peak variations and rapid updates'
    },
    rms: {
        title: 'RMS Analysis',
        subtitle: 'Root Mean Square voltage amplitude calculations & historical trends'
    },
    sensor: {
        title: 'Sensor Status',
        subtitle: 'Hardware diagnostics for MAX4466 electret microphone on ESP32 GPIO 34'
    },
    analytics: {
        title: 'Noise Analytics',
        subtitle: 'Acoustic classification breakdown (LOW, MEDIUM, HIGH) & standard compliance'
    },
    alerts: {
        title: 'Alert History',
        subtitle: 'Logged threshold violation incidents and high noise alarms'
    },
    history: {
        title: 'Historical Data',
        subtitle: 'Searchable and filterable database of stored sensor readings'
    },
    reports: {
        title: 'Reports & Export',
        subtitle: 'Generate and download official CSV, JSON, and printable acoustic reports'
    },
    settings: {
        title: 'Settings',
        subtitle: 'Configure hardware pinout, sampling intervals, and acoustic alert thresholds'
    }
};

// =============================================================================
// Web Audio API Setup
// =============================================================================
function initAudio() {
    if (!audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            audioContext = new AudioCtx();
        }
    }
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// Play high noise alert siren
function playAlertBeep() {
    if (!audioAlertEnabled) return;

    try {
        initAudio();
        if (!audioContext) return;

        const now = audioContext.currentTime;
        const freq1 = alertToneFrequency;
        const freq2 = Math.round(alertToneFrequency * 0.75);

        // Tone 1
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq1, now);
        gain1.gain.setValueAtTime(0.28, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        osc1.start(now);
        osc1.stop(now + 0.18);

        // Tone 2
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq2, now + 0.20);
        gain2.gain.setValueAtTime(0.28, now + 0.20);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.40);
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.start(now + 0.20);
        osc2.stop(now + 0.40);
    } catch (err) {
        console.warn('Audio playback notice:', err);
    }
}

// Unlock audio on first user touch/click
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });

// =============================================================================
// 1. ChatGPT-Inspired Collapsible Sidebar Behavior
// =============================================================================
function toggleSidebar() {
    const isCollapsed = sidebarEl.classList.toggle('collapsed');
    appLayoutEl.classList.toggle('sidebar-collapsed', isCollapsed);
    localStorage.setItem('noise_sidebar_collapsed', isCollapsed ? 'true' : 'false');

    // Trigger Chart.js resize smoothly after width transition
    setTimeout(() => {
        if (overviewChart) overviewChart.resize();
        if (rmsChart) rmsChart.resize();
        if (analyticsChart) analyticsChart.resize();
    }, 320);
}

// Restore sidebar collapsed preference on launch
function initSidebarPreference() {
    const savedState = localStorage.getItem('noise_sidebar_collapsed');
    if (savedState === 'true' && window.innerWidth > 768) {
        sidebarEl.classList.add('collapsed');
        appLayoutEl.classList.add('sidebar-collapsed');
    }
}

// Mobile drawer open/close
function openMobileSidebar() {
    sidebarEl.classList.add('mobile-open');
    sidebarBackdropEl.classList.add('active');
}

function closeMobileSidebar() {
    sidebarEl.classList.remove('mobile-open');
    sidebarBackdropEl.classList.remove('active');
}

sidebarToggleBtn.addEventListener('click', toggleSidebar);
if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMobileSidebar);
if (sidebarBackdropEl) sidebarBackdropEl.addEventListener('click', closeMobileSidebar);

// Keyboard shortcut: Ctrl + B or Cmd + B to toggle sidebar
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebar();
    }
});

// =============================================================================
// 2. Tab Navigation & Page Switching
// =============================================================================
function navigateToPage(pageId) {
    if (!pageMetadata[pageId]) pageId = 'overview';
    activePage = pageId;

    // Update nav links active state
    navItems.forEach(item => {
        if (item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update page views active state
    pageViews.forEach(view => {
        if (view.id === `page-${pageId}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });

    // Update Header Titles
    const meta = pageMetadata[pageId];
    if (currentPageTitleEl) currentPageTitleEl.textContent = meta.title;
    if (currentPageSubtitleEl) currentPageSubtitleEl.textContent = meta.subtitle;

    // Update URL hash
    window.location.hash = pageId;

    // Close mobile drawer if open
    closeMobileSidebar();

    // Trigger chart redraw on tab switch so charts render at proper dimensions
    setTimeout(() => {
        if (pageId === 'overview' && overviewChart) overviewChart.resize();
        if (pageId === 'rms' && rmsChart) rmsChart.resize();
        if (pageId === 'analytics') {
            if (analyticsChart) analyticsChart.resize();
            updateAnalyticsPage();
        }
        if (pageId === 'history') updateHistoryTable();
        if (pageId === 'alerts') updateAlertsTable();
        if (pageId === 'reports') updateReportsPage();
    }, 150);
}

// Bind click on sidebar links
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const pageId = item.getAttribute('data-page');
        navigateToPage(pageId);
    });
});

// Support back/forward browser navigation
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && pageMetadata[hash]) {
        navigateToPage(hash);
    }
});

// =============================================================================
// 3. Audio Siren Toggle Button (Header)
// =============================================================================
function updateAudioButtonUI() {
    if (audioAlertEnabled) {
        audioBtnLabel.textContent = 'Audio Alert: ON';
        audioIconOn.style.display = 'block';
        audioIconOff.style.display = 'none';
        audioToggleBtn.classList.remove('muted');
    } else {
        audioBtnLabel.textContent = 'Audio Alert: OFF';
        audioIconOn.style.display = 'none';
        audioIconOff.style.display = 'block';
        audioToggleBtn.classList.add('muted');
    }
}

audioToggleBtn.addEventListener('click', () => {
    audioAlertEnabled = !audioAlertEnabled;
    settingAudioEnabled.checked = audioAlertEnabled;
    localStorage.setItem('noise_audio_enabled', audioAlertEnabled ? 'true' : 'false');
    updateAudioButtonUI();
});

// =============================================================================
// 4. Noise Status Classification Helper
// =============================================================================
function classifyNoise(db) {
    if (db === null || db === undefined || isNaN(db)) {
        return { label: 'NO DATA', className: 'status-unknown', level: 'unknown' };
    }
    if (db < medNoiseThreshold) {
        return { label: 'LOW', className: 'status-low', level: 'low' };
    } else if (db <= highNoiseThreshold) {
        return { label: 'MEDIUM', className: 'status-medium', level: 'med' };
    } else {
        return { label: 'HIGH', className: 'status-high', level: 'high' };
    }
}

function formatTime(isoString) {
    if (!isoString) return '--:--:--';
    try {
        const d = new Date(isoString);
        return isNaN(d.getTime()) ? '--:--:--' : d.toLocaleTimeString([], { hour12: false });
    } catch {
        return '--:--:--';
    }
}

function formatFullDateTime(isoString) {
    if (!isoString) return '--';
    try {
        const d = new Date(isoString);
        return isNaN(d.getTime()) ? '--' : `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour12: false })}`;
    } catch {
        return '--';
    }
}

// =============================================================================
// 5. Chart.js Initializations
// =============================================================================
function initCharts() {
    // 1. Overview Noise Chart
    const ctxOverview = document.getElementById('overviewNoiseChart').getContext('2d');
    const gradOverview = ctxOverview.createLinearGradient(0, 0, 0, 240);
    gradOverview.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    gradOverview.addColorStop(1, 'rgba(56, 189, 248, 0.01)');

    overviewChart = new Chart(ctxOverview, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Estimated Noise (dB)',
                data: [],
                borderColor: '#38bdf8',
                backgroundColor: gradOverview,
                borderWidth: 2,
                pointBackgroundColor: '#38bdf8',
                pointBorderColor: '#0b132b',
                pointBorderWidth: 1.5,
                pointRadius: 3,
                pointHoverRadius: 6,
                tension: 0.32,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderWidth: 1,
                    titleFont: { family: 'Inter', size: 12 },
                    bodyFont: { family: 'Inter', size: 13, weight: 'bold' },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: (ctx) => `Est. Noise: ${ctx.parsed.y} dB`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: '#64748b',
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 7
                    }
                },
                y: {
                    min: 30,
                    max: 100,
                    grid: {
                        color: (context) => context.tick.value === highNoiseThreshold ? 'rgba(239, 68, 68, 0.55)' : 'rgba(255, 255, 255, 0.05)',
                        lineWidth: (context) => context.tick.value === highNoiseThreshold ? 2 : 1
                    },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: (context) => context.tick.value === highNoiseThreshold ? '#ef4444' : '#64748b',
                        stepSize: 15,
                        callback: (value) => `${value} dB`
                    }
                }
            }
        }
    });

    // 2. RMS Analysis Chart
    const ctxRms = document.getElementById('rmsHistoryChart').getContext('2d');
    const gradRms = ctxRms.createLinearGradient(0, 0, 0, 240);
    gradRms.addColorStop(0, 'rgba(14, 165, 233, 0.35)');
    gradRms.addColorStop(1, 'rgba(14, 165, 233, 0.01)');

    rmsChart = new Chart(ctxRms, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'RMS Voltage (V)',
                data: [],
                borderColor: '#0ea5e9',
                backgroundColor: gradRms,
                borderWidth: 2,
                pointBackgroundColor: '#38bdf8',
                pointBorderColor: '#0b132b',
                pointBorderWidth: 1.5,
                pointRadius: 3,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: (ctx) => `RMS: ${ctx.parsed.y} V`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b', maxTicksLimit: 7 }
                },
                y: {
                    suggestedMin: 0.0,
                    suggestedMax: 0.15,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: '#64748b',
                        callback: (value) => `${value} V`
                    }
                }
            }
        }
    });

    // 3. Analytics Doughnut Chart
    const ctxAnalytics = document.getElementById('analyticsDoughnutChart').getContext('2d');
    analyticsChart = new Chart(ctxAnalytics, {
        type: 'doughnut',
        data: {
            labels: ['LOW (<50 dB)', 'MEDIUM (50-70 dB)', 'HIGH (>70 dB)'],
            datasets: [{
                data: [1, 0, 0],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderColor: '#0f1c3f',
                borderWidth: 3,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderWidth: 1,
                    padding: 8,
                    cornerRadius: 6
                }
            }
        }
    });
}

// =============================================================================
// 6. Connected & Disconnected State Handlers
// =============================================================================
function updateStatusIndicators(connected, customMsg = null) {
    const connClass = connected ? 'connected' : 'disconnected';
    const disconnClass = connected ? 'disconnected' : 'connected';

    // Header Chip
    headerSensorDotEl.classList.add(connClass);
    headerSensorDotEl.classList.remove(disconnClass);
    headerSensorStatusTextEl.textContent = connected ? 'Connected' : 'Disconnected';
    headerSensorStatusTextEl.className = `chip-state ${connClass}`;

    // Mobile Topbar Dot
    if (mobileStatusDot) {
        mobileStatusDot.classList.add(connClass);
        mobileStatusDot.classList.remove(disconnClass);
    }

    // Sidebar ESP32
    sidebarEsp32Dot.classList.add(connClass);
    sidebarEsp32Dot.classList.remove(disconnClass);
    sidebarEsp32Status.textContent = connected ? 'Connected' : 'Disconnected';
    sidebarEsp32Status.className = `status-value ${connClass}`;

    // Sidebar MAX4466
    sidebarSensorDot.classList.add(connClass);
    sidebarSensorDot.classList.remove(disconnClass);
    sidebarSensorStatus.textContent = connected ? 'GPIO 34 Active' : 'No Signal (GPIO34)';
    sidebarSensorStatus.className = `status-value ${connClass}`;

    // Overview ESP32 Pill
    if (overviewEsp32PillEl) {
        overviewEsp32PillEl.className = `state-pill ${connClass}`;
        overviewEsp32PillEl.textContent = connected ? 'Connected' : 'Disconnected';
    }

    // Sensor Status Page
    if (sensorPageStatusPill) {
        sensorPageStatusPill.className = `state-pill ${connClass}`;
        sensorPageStatusPill.textContent = connected ? 'Connected' : 'Disconnected';
    }
    if (sensorPageStateText) {
        sensorPageStateText.textContent = connected ? 'Active Telemetry' : 'Disconnected / Offline';
        sensorPageStateText.style.color = connected ? 'var(--status-connected)' : 'var(--status-disconnected)';
    }

    // Global Disconnected Banner
    if (!connected) {
        disconnectedBannerEl.style.display = 'flex';
        disconnectedMsgEl.textContent = customMsg || 'ESP32 is offline or signal delayed. Telemetry pending. Please check ESP32 power supply, WiFi connection, and GPIO34 MAX4466 wiring.';
        highNoiseBannerEl.style.display = 'none';

        // Only blank out numeric displays if we have NEVER received any valid telemetry yet
        if (totalPacketsReceived === 0) {
            overviewCurrentDbEl.textContent = 'No Sensor Data';
            overviewCurrentDbEl.classList.add('no-data');
            overviewDbUnitEl.style.display = 'none';

            overviewCurrentRmsEl.textContent = 'No Sensor Data';
            overviewCurrentRmsEl.classList.add('no-data');
            overviewRmsUnitEl.style.display = 'none';

            overviewNoiseBadgeEl.textContent = 'NO DATA';
            overviewNoiseBadgeEl.className = 'noise-status-badge status-unknown';
            overviewScaleIndicatorEl.style.width = '0%';

            liveDbValEl.textContent = '--';
            liveStatusBadgeEl.textContent = 'SENSOR DISCONNECTED';
            liveStatusBadgeEl.className = 'live-status-pill status-unknown';
            liveAudioMeterFillEl.style.width = '0%';
        }
    } else {
        disconnectedBannerEl.style.display = 'none';
        overviewCurrentDbEl.classList.remove('no-data');
        overviewDbUnitEl.style.display = 'inline';
        overviewCurrentRmsEl.classList.remove('no-data');
        overviewRmsUnitEl.style.display = 'inline';
    }
}

// =============================================================================
// 7. Process High Noise Alert & Audio
// =============================================================================
function processNoiseAlert(classification, dbVal, rmsVal, timestamp) {
    const formattedTime = formatTime(timestamp);

    if (classification.label === 'HIGH') {
        // Show prominent red high noise alert banner
        highNoiseBannerEl.style.display = 'flex';
        alertDbValueEl.textContent = `${dbVal.toFixed(1)} dB`;
        activeAlertTimeEl.textContent = formattedTime;

        // Check state transition into HIGH: play audio beep once
        if (previousNoiseStatus !== 'HIGH') {
            playAlertBeep();

            // Record alert incident
            alertEvents.unshift({
                id: alertEvents.length + 1,
                timestamp: timestamp,
                db: dbVal,
                rms: rmsVal,
                category: 'HIGH NOISE ALERT',
                status: 'TRIGGERED'
            });

            // Update badges
            if (sidebarAlertBadgeEl) {
                sidebarAlertBadgeEl.style.display = 'inline-block';
                sidebarAlertBadgeEl.textContent = alertEvents.length;
            }

            overviewRecentAlertBadgeEl.className = 'alert-status-badge alert-active';
            overviewRecentAlertBadgeEl.textContent = 'ALERT ACTIVE';
            overviewRecentAlertSubtextEl.textContent = `Triggered at ${formattedTime} (${dbVal.toFixed(1)} dB)`;

            updateAlertsTable();
        }
    } else {
        // Return to LOW or MEDIUM
        highNoiseBannerEl.style.display = 'none';

        if (previousNoiseStatus === 'HIGH' && alertEvents.length > 0) {
            // Mark most recent alert resolved
            alertEvents[0].status = 'RESOLVED';
            updateAlertsTable();
        }

        if (alertEvents.length > 0) {
            overviewRecentAlertBadgeEl.className = 'alert-status-badge';
            overviewRecentAlertBadgeEl.textContent = 'NORMAL';
            overviewRecentAlertSubtextEl.textContent = `Last Alert: ${formatTime(alertEvents[0].timestamp)} (${alertEvents[0].db.toFixed(1)} dB)`;
        } else {
            overviewRecentAlertBadgeEl.className = 'alert-status-badge';
            overviewRecentAlertBadgeEl.textContent = 'NORMAL';
            overviewRecentAlertSubtextEl.textContent = 'No high noise alerts recorded';
        }
    }

    previousNoiseStatus = classification.label;
}

// =============================================================================
// 8. Live Packets Feed & Session Statistics
// =============================================================================
let livePacketsBuffer = [];

function updateSessionStats(dbVal, rmsVal) {
    if (dbVal === null || isNaN(dbVal)) return;

    sessionStats.minDb = Math.min(sessionStats.minDb, dbVal);
    sessionStats.maxDb = Math.max(sessionStats.maxDb, dbVal);
    sessionStats.sumDb += dbVal;
    sessionStats.countDb++;

    if (rmsVal !== null && !isNaN(rmsVal)) {
        sessionStats.minRms = Math.min(sessionStats.minRms, rmsVal);
        sessionStats.maxRms = Math.max(sessionStats.maxRms, rmsVal);
        sessionStats.sumRms += rmsVal;
        sessionStats.countRms++;
    }

    // Update Live Page Stats Cards
    liveStatMinEl.textContent = `${sessionStats.minDb.toFixed(1)} dB`;
    liveStatMaxEl.textContent = `${sessionStats.maxDb.toFixed(1)} dB`;
    const p2pDelta = (sessionStats.maxDb - sessionStats.minDb).toFixed(1);
    liveStatP2pEl.textContent = `${p2pDelta} dB`;
    const avgDb = (sessionStats.sumDb / sessionStats.countDb).toFixed(1);
    liveStatAvgEl.textContent = `${avgDb} dB`;

    // Update RMS Page Stats
    rmsMinValEl.textContent = sessionStats.minRms !== Infinity ? sessionStats.minRms.toFixed(4) : '--';
    rmsMaxValEl.textContent = sessionStats.maxRms !== -Infinity ? sessionStats.maxRms.toFixed(4) : '--';
    const avgRms = (sessionStats.sumRms / sessionStats.countRms).toFixed(4);
    rmsAvgValEl.textContent = avgRms;
}

function resetSessionStats() {
    sessionStats = {
        minDb: Infinity,
        maxDb: -Infinity,
        sumDb: 0,
        countDb: 0,
        minRms: Infinity,
        maxRms: -Infinity,
        sumRms: 0,
        countRms: 0
    };
    liveStatMinEl.textContent = '-- dB';
    liveStatMaxEl.textContent = '-- dB';
    liveStatP2pEl.textContent = '-- dB';
    liveStatAvgEl.textContent = '-- dB';
    rmsMinValEl.textContent = '--';
    rmsMaxValEl.textContent = '--';
    rmsAvgValEl.textContent = '--';
    livePacketsBuffer = [];
    livePacketsBodyEl.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Session statistics reset. Waiting for new telemetry...</td></tr>';
}

if (btnResetSessionEl) {
    btnResetSessionEl.addEventListener('click', resetSessionStats);
}

function appendLivePacketRow(dbVal, rmsVal, timestamp) {
    totalPacketsReceived++;
    lastPacketTimestamp = timestamp;

    const classification = classifyNoise(dbVal);
    const packet = {
        num: totalPacketsReceived,
        time: formatTime(timestamp),
        db: dbVal.toFixed(1),
        rms: rmsVal.toFixed(4),
        classLabel: classification.label,
        classBadge: classification.className
    };

    livePacketsBuffer.unshift(packet);
    if (livePacketsBuffer.length > 10) livePacketsBuffer.pop();

    livePacketsBodyEl.innerHTML = livePacketsBuffer.map(p => `
        <tr>
            <td><strong>#${p.num}</strong></td>
            <td>${p.time}</td>
            <td><strong>${p.db} dB</strong></td>
            <td><code>${p.rms} V</code></td>
            <td><span class="noise-status-badge ${p.classBadge}">${p.classLabel}</span></td>
            <td><span class="badge-status low">VALID (GPIO34)</span></td>
        </tr>
    `).join('');
}

// Relative seconds ticker for Sensor Status Page
setInterval(() => {
    if (!lastPacketTimestamp || !sensorPageLastComm) return;
    try {
        const elapsed = Math.round((Date.now() - new Date(lastPacketTimestamp).getTime()) / 1000);
        sensorPageLastComm.textContent = `${formatTime(lastPacketTimestamp)} (${Math.max(0, elapsed)}s ago)`;
    } catch {
        // No-op
    }
}, 1000);

// =============================================================================
// 9. Fetch Latest Reading (/api/readings/latest)
// =============================================================================
async function fetchLatestReading() {
    try {
        const res = await fetch(`${API_BASE}/api/readings/latest?_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        const dbVal = data.db !== null && data.db !== undefined ? Number(data.db) : null;
        const rmsVal = data.rms !== null && data.rms !== undefined ? Number(data.rms) : null;

        // 1. If completely empty (no sensor data has ever been received)
        if (dbVal === null) {
            updateStatusIndicators(false, data.message || 'No Sensor Data. Awaiting ESP32 transmission.');
            return;
        }

        // 2. Update connectivity status indicators
        const isConnected = (data.sensor_status === 'Connected');
        updateStatusIndicators(isConnected, isConnected ? null : (data.message || 'ESP32 signal delayed. Reconnecting...'));

        const classification = classifyNoise(dbVal);
        const formattedT = formatTime(data.timestamp);
        headerLastUpdatedTextEl.textContent = formattedT;

        // --- OVERVIEW UPDATE ---
        overviewCurrentDbEl.textContent = dbVal.toFixed(1);
        overviewCurrentDbEl.classList.remove('no-data');
        overviewDbUnitEl.style.display = 'inline';

        const scalePct = Math.max(0, Math.min(100, ((dbVal - 30) / (100 - 30)) * 100));
        overviewScaleIndicatorEl.style.width = `${scalePct}%`;
        overviewNoiseBadgeEl.textContent = classification.label;
        overviewNoiseBadgeEl.className = `noise-status-badge ${classification.className}`;

        if (rmsVal !== null) {
            overviewCurrentRmsEl.textContent = rmsVal.toFixed(4);
            overviewCurrentRmsEl.classList.remove('no-data');
            overviewRmsUnitEl.style.display = 'inline';
            rmsCurrentValEl.textContent = rmsVal.toFixed(4);
        }

        // --- LIVE MONITORING UPDATE ---
        liveDbValEl.textContent = dbVal.toFixed(1);
        liveStatusBadgeEl.textContent = `${classification.label} NOISE LEVEL`;
        liveStatusBadgeEl.className = `live-status-pill ${classification.className}`;
        const audioMeterPct = Math.max(0, Math.min(100, ((dbVal - 30) / (105 - 30)) * 100));
        liveAudioMeterFillEl.style.width = `${audioMeterPct}%`;

        // Update session tracking & live packet row
        updateSessionStats(dbVal, rmsVal);
        appendLivePacketRow(dbVal, rmsVal, data.timestamp);

        // --- SENSOR STATUS PAGE UPDATE ---
        if (sensorPageLastVal) {
            sensorPageLastVal.textContent = `${dbVal.toFixed(1)} dB / ${rmsVal !== null ? rmsVal.toFixed(4) : '--'} V`;
        }
        if (sensorPagePacketsCount) {
            sensorPagePacketsCount.textContent = totalPacketsReceived;
        }

        // --- HIGH NOISE ALERT HANDLING ---
        processNoiseAlert(classification, dbVal, rmsVal, data.timestamp);

    } catch (err) {
        updateStatusIndicators(false, `No Sensor Data. Backend unreachable at ${API_BASE}.`);
    }
}

// =============================================================================
// 10. Fetch History for Charts & Tables (/api/readings)
// =============================================================================
async function fetchHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/readings?_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;

        const history = await res.json();
        if (!Array.isArray(history) || history.length === 0) {
            if (overviewChartEmptyEl) overviewChartEmptyEl.style.display = 'block';
            return;
        }

        storedReadings = history;
        if (overviewChartEmptyEl) overviewChartEmptyEl.style.display = 'none';

        const labels = history.map(item => formatTime(item.timestamp));
        const dbPoints = history.map(item => Number(item.db));
        const rmsPoints = history.map(item => Number(item.rms));

        // Update Overview Noise Chart
        if (overviewChart) {
            overviewChart.data.labels = labels;
            overviewChart.data.datasets[0].data = dbPoints;
            overviewChart.update('none');
        }

        // Update RMS History Chart
        if (rmsChart) {
            rmsChart.data.labels = labels;
            rmsChart.data.datasets[0].data = rmsPoints;
            rmsChart.update('none');
        }

        // Update active page content if currently visible
        if (activePage === 'analytics') updateAnalyticsPage();
        if (activePage === 'history') updateHistoryTable();
        if (activePage === 'reports') updateReportsPage();

    } catch (err) {
        // Handled silently
    }
}

// =============================================================================
// 11. Page-Specific Renderers
// =============================================================================

// --- NOISE ANALYTICS PAGE ---
function updateAnalyticsPage() {
    if (!storedReadings || storedReadings.length === 0) return;

    let lowCount = 0;
    let medCount = 0;
    let highCount = 0;

    storedReadings.forEach(item => {
        const db = Number(item.db);
        if (db < medNoiseThreshold) lowCount++;
        else if (db <= highNoiseThreshold) medCount++;
        else highCount++;
    });

    const total = storedReadings.length;
    const lowPct = Math.round((lowCount / total) * 100);
    const medPct = Math.round((medCount / total) * 100);
    const highPct = Math.round((highCount / total) * 100);

    analyticsLowPctEl.textContent = `${lowPct}%`;
    analyticsMedPctEl.textContent = `${medPct}%`;
    analyticsHighPctEl.textContent = `${highPct}%`;

    analyticsLowCountEl.textContent = `${lowCount} readings (${lowPct}%)`;
    analyticsMedCountEl.textContent = `${medCount} readings (${medPct}%)`;
    analyticsHighCountEl.textContent = `${highCount} readings (${highPct}%)`;

    if (analyticsChart) {
        analyticsChart.data.datasets[0].data = [lowCount, medCount, highCount];
        analyticsChart.update();
    }
}

// --- ALERT HISTORY PAGE ---
function updateAlertsTable() {
    const searchVal = (alertsSearchInput?.value || '').toLowerCase().trim();
    const filterStatus = alertsFilterSelect?.value || 'all';

    let filtered = alertEvents.filter(ev => {
        const matchesSearch = !searchVal ||
            ev.db.toString().includes(searchVal) ||
            formatTime(ev.timestamp).toLowerCase().includes(searchVal);
        const matchesFilter = filterStatus === 'all' || ev.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    if (filtered.length === 0) {
        alertsTableBodyEl.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No high noise alerts matching criteria.</td></tr>`;
        return;
    }

    alertsTableBodyEl.innerHTML = filtered.map(ev => `
        <tr>
            <td><strong>#${ev.id}</strong></td>
            <td>${formatFullDateTime(ev.timestamp)}</td>
            <td><strong class="highlight-red">${Number(ev.db).toFixed(1)} dB</strong></td>
            <td><code>${Number(ev.rms).toFixed(4)} V</code></td>
            <td><span class="badge-status high">${ev.category}</span></td>
            <td><span class="badge-status ${ev.status === 'TRIGGERED' ? 'active' : 'resolved'}">${ev.status}</span></td>
        </tr>
    `).join('');
}

if (alertsSearchInput) alertsSearchInput.addEventListener('input', updateAlertsTable);
if (alertsFilterSelect) alertsFilterSelect.addEventListener('change', updateAlertsTable);

if (btnClearAlerts) {
    btnClearAlerts.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the alert history?')) {
            alertEvents = [];
            if (sidebarAlertBadgeEl) sidebarAlertBadgeEl.style.display = 'none';
            updateAlertsTable();
        }
    });
}

if (btnExportAlerts) {
    btnExportAlerts.addEventListener('click', () => {
        if (alertEvents.length === 0) {
            alert('No alert incidents logged to export.');
            return;
        }
        let csv = 'Incident_ID,Timestamp,Noise_dB,RMS_Voltage_V,Category,Status\n';
        alertEvents.forEach(ev => {
            csv += `"${ev.id}","${ev.timestamp}","${ev.db}","${ev.rms}","${ev.category}","${ev.status}"\n`;
        });
        downloadBlob(csv, `noise_alerts_history_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    });
}

// --- HISTORICAL DATA PAGE ---
function updateHistoryTable() {
    if (!storedReadings || storedReadings.length === 0) {
        historyTableBodyEl.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Awaiting sensor data transmission from ESP32...</td></tr>`;
        historyTotalCountEl.textContent = '0 Records Stored';
        return;
    }

    const searchVal = (historySearchInput?.value || '').toLowerCase().trim();
    const catVal = historyCategoryFilter?.value || 'all';
    const limitVal = historyPageSize?.value || '30';

    let filtered = storedReadings.filter(item => {
        const classification = classifyNoise(Number(item.db));
        const matchesCategory = catVal === 'all' || classification.label === catVal;
        const matchesSearch = !searchVal ||
            item.db.toString().includes(searchVal) ||
            item.rms.toString().includes(searchVal) ||
            formatTime(item.timestamp).toLowerCase().includes(searchVal) ||
            classification.label.toLowerCase().includes(searchVal);
        return matchesCategory && matchesSearch;
    });

    historyTotalCountEl.textContent = `Showing ${filtered.length} of ${storedReadings.length} records`;

    const limit = limitVal === 'all' ? filtered.length : parseInt(limitVal, 10);
    const displayed = filtered.slice(-limit).reverse(); // Show newest first

    historyTableBodyEl.innerHTML = displayed.map((item, idx) => {
        const cls = classifyNoise(Number(item.db));
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${formatFullDateTime(item.timestamp)}</td>
                <td><strong>${Number(item.db).toFixed(1)} dB</strong></td>
                <td><code>${Number(item.rms).toFixed(4)} V</code></td>
                <td><span class="noise-status-badge ${cls.className}">${cls.label}</span></td>
                <td><span class="badge-status low">Connected (GPIO34)</span></td>
            </tr>
        `;
    }).join('');
}

if (historySearchInput) historySearchInput.addEventListener('input', updateHistoryTable);
if (historyCategoryFilter) historyCategoryFilter.addEventListener('change', updateHistoryTable);
if (historyPageSize) historyPageSize.addEventListener('change', updateHistoryTable);
if (btnRefreshHistory) btnRefreshHistory.addEventListener('click', fetchHistory);

// --- REPORTS PAGE ---
function updateReportsPage() {
    reportGenDateEl.textContent = new Date().toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    if (!storedReadings || storedReadings.length === 0) {
        reportTotalReadingsEl.textContent = '0';
        reportAvgDbEl.textContent = '-- dB';
        reportPeakDbEl.textContent = '-- dB';
        reportMinDbEl.textContent = '-- dB';
        reportAlertCountEl.textContent = alertEvents.length.toString();
        reportOverallRatingEl.textContent = 'Awaiting Telemetry';
        return;
    }

    let minD = Infinity;
    let maxD = -Infinity;
    let sumD = 0;

    storedReadings.forEach(item => {
        const d = Number(item.db);
        minD = Math.min(minD, d);
        maxD = Math.max(maxD, d);
        sumD += d;
    });

    const avgD = (sumD / storedReadings.length).toFixed(1);

    reportTotalReadingsEl.textContent = storedReadings.length.toString();
    reportAvgDbEl.textContent = `${avgD} dB`;
    reportPeakDbEl.textContent = `${maxD.toFixed(1)} dB`;
    reportMinDbEl.textContent = `${minD.toFixed(1)} dB`;
    reportAlertCountEl.textContent = alertEvents.length.toString();

    // Rating
    if (avgD < medNoiseThreshold) {
        reportOverallRatingEl.textContent = 'Safe / Quiet (LOW)';
        reportOverallRatingEl.className = 'rep-value highlight-green';
    } else if (avgD <= highNoiseThreshold) {
        reportOverallRatingEl.textContent = 'Moderate (MEDIUM)';
        reportOverallRatingEl.className = 'rep-value highlight-orange';
    } else {
        reportOverallRatingEl.textContent = 'Elevated Hazard (HIGH)';
        reportOverallRatingEl.className = 'rep-value highlight-red';
    }
}

// Download Helper
function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Export CSV Report
if (btnDownloadCsv) {
    btnDownloadCsv.addEventListener('click', () => {
        if (!storedReadings || storedReadings.length === 0) {
            alert('No telemetry readings available to export.');
            return;
        }

        let csv = 'Timestamp_ISO,Timestamp_Formatted,Estimated_dB,RMS_Voltage_V,Classification,Sensor_Pin,Microcontroller\n';
        storedReadings.forEach(item => {
            const cls = classifyNoise(Number(item.db));
            csv += `"${item.timestamp}","${formatFullDateTime(item.timestamp)}","${Number(item.db).toFixed(1)}","${Number(item.rms).toFixed(4)}","${cls.label}","GPIO34","ESP32"\n`;
        });

        downloadBlob(csv, `noise_telemetry_report_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    });
}

// Export JSON Report
if (btnDownloadJson) {
    btnDownloadJson.addEventListener('click', () => {
        if (!storedReadings || storedReadings.length === 0) {
            alert('No telemetry readings available to export.');
            return;
        }

        const payload = {
            export_timestamp: new Date().toISOString(),
            system: 'Noise Pollution Monitoring System',
            microcontroller: 'ESP32',
            sensor: 'MAX4466 Electret Microphone',
            gpio_pin: 34,
            thresholds: {
                high_noise_alert_db: highNoiseThreshold,
                medium_noise_db: medNoiseThreshold
            },
            total_records: storedReadings.length,
            records: storedReadings
        };

        downloadBlob(JSON.stringify(payload, null, 2), `noise_telemetry_data_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    });
}

// Print / PDF Summary
if (btnPrintReport) {
    btnPrintReport.addEventListener('click', () => {
        window.print();
    });
}

// =============================================================================
// 12. Settings Page Handlers
// =============================================================================
function loadStoredSettings() {
    const savedHigh = localStorage.getItem('noise_high_threshold');
    if (savedHigh) {
        highNoiseThreshold = parseFloat(savedHigh);
        settingHighThreshold.value = highNoiseThreshold;
        labelHighVal.textContent = `${highNoiseThreshold.toFixed(1)} dB`;
    }

    const savedMed = localStorage.getItem('noise_med_threshold');
    if (savedMed) {
        medNoiseThreshold = parseFloat(savedMed);
        settingMedThreshold.value = medNoiseThreshold;
        labelMedVal.textContent = `${medNoiseThreshold.toFixed(1)} dB`;
    }

    const savedAudio = localStorage.getItem('noise_audio_enabled');
    if (savedAudio !== null) {
        audioAlertEnabled = savedAudio === 'true';
        settingAudioEnabled.checked = audioAlertEnabled;
        updateAudioButtonUI();
    }

    const savedPitch = localStorage.getItem('noise_audio_pitch');
    if (savedPitch) {
        alertToneFrequency = parseInt(savedPitch, 10);
        settingAudioPitch.value = alertToneFrequency;
    }
}

// Range Sliders Live Value Labels
settingHighThreshold.addEventListener('input', (e) => {
    labelHighVal.textContent = `${parseFloat(e.target.value).toFixed(1)} dB`;
});

settingMedThreshold.addEventListener('input', (e) => {
    labelMedVal.textContent = `${parseFloat(e.target.value).toFixed(1)} dB`;
});

// Test Alert Audio Button
btnTestAudio.addEventListener('click', () => {
    const originalPitch = alertToneFrequency;
    alertToneFrequency = parseInt(settingAudioPitch.value, 10);
    const origAudioState = audioAlertEnabled;
    audioAlertEnabled = true;
    playAlertBeep();
    audioAlertEnabled = origAudioState;
    alertToneFrequency = originalPitch;
});

// Save Settings Button
btnSaveSettings.addEventListener('click', () => {
    highNoiseThreshold = parseFloat(settingHighThreshold.value);
    medNoiseThreshold = parseFloat(settingMedThreshold.value);
    audioAlertEnabled = settingAudioEnabled.checked;
    alertToneFrequency = parseInt(settingAudioPitch.value, 10);

    localStorage.setItem('noise_high_threshold', highNoiseThreshold.toString());
    localStorage.setItem('noise_med_threshold', medNoiseThreshold.toString());
    localStorage.setItem('noise_audio_enabled', audioAlertEnabled ? 'true' : 'false');
    localStorage.setItem('noise_audio_pitch', alertToneFrequency.toString());

    updateAudioButtonUI();

    // Update Overview Chart threshold line
    if (overviewChart) {
        overviewChart.options.scales.y.grid.color = (context) =>
            context.tick.value === highNoiseThreshold ? 'rgba(239, 68, 68, 0.55)' : 'rgba(255, 255, 255, 0.05)';
        overviewChart.update();
    }

    // Show confirmation toast
    settingsSaveToast.style.display = 'block';
    setTimeout(() => {
        settingsSaveToast.style.display = 'none';
    }, 3000);
});

// Reset Settings Button
btnResetSettings.addEventListener('click', () => {
    highNoiseThreshold = 70.0;
    medNoiseThreshold = 50.0;
    audioAlertEnabled = true;
    alertToneFrequency = 880;

    settingHighThreshold.value = 70;
    labelHighVal.textContent = '70.0 dB';
    settingMedThreshold.value = 50;
    labelMedVal.textContent = '50.0 dB';
    settingAudioEnabled.checked = true;
    settingAudioPitch.value = '880';

    localStorage.removeItem('noise_high_threshold');
    localStorage.removeItem('noise_med_threshold');
    localStorage.removeItem('noise_audio_enabled');
    localStorage.removeItem('noise_audio_pitch');

    updateAudioButtonUI();

    settingsSaveToast.textContent = 'Reset to factory defaults.';
    settingsSaveToast.style.display = 'block';
    setTimeout(() => {
        settingsSaveToast.textContent = 'Settings saved successfully!';
        settingsSaveToast.style.display = 'none';
    }, 3000);
});

// =============================================================================
// 13. Combined 2-Second Polling Loop
// =============================================================================
async function refreshTelemetry() {
    await fetchLatestReading();
    await fetchHistory();
}

// Bootstrap Application on Load
document.addEventListener('DOMContentLoaded', () => {
    initSidebarPreference();
    loadStoredSettings();
    updateAudioButtonUI();
    initCharts();

    // Check initial URL hash for direct tab linking
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && pageMetadata[initialHash]) {
        navigateToPage(initialHash);
    } else {
        navigateToPage('overview');
    }

    // Immediate first refresh
    refreshTelemetry();

    // Poll every 2.0 seconds automatically
    setInterval(refreshTelemetry, 2000);
});
