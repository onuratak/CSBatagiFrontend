// Initialize Firebase
// const firebaseApp = firebase.initializeApp(firebaseConfig); // MOVED to DOMContentLoaded
// const database = firebase.database(); // MOVED to DOMContentLoaded
// --- End Firebase Initialization ---

// --- Constants ---
const APPS_SCRIPT_URL = 'https://royal-flower-aa89.onur1atak.workers.dev/'; // Replace with your actual URL
const DEFAULT_PAGE = 'home'; 
const SEASON_AVG_JSON_URL = 'data/season_avg.json';
const LAST10_JSON_URL = 'data/last10.json';
const NIGHT_AVG_JSON_URL = 'data/night_avg.json';
// const SONMAC_JSON_URL = 'data/sonmac.json'; // MOVED to sonMac.js
// const DUELLO_JSON_URL = 'data/duello_son_mac.json'; // MOVED to duello.js
// const DUELLO_SEZON_JSON_URL = 'data/duello_sezon.json'; // MOVED to duello.js
// const KABILE_JSON_URL = 'data/kabile.json'; // MOVED to TeamPicker.js
// const MAPS_JSON_URL = 'data/maps.json'; // MOVED to TeamPicker.js

// --- Global State (Shared or needs wider access) ---
let database; // Firebase database reference (initialized in DOMContentLoaded)
let players = []; // Populated by fetchStatsFromSheet, used by Attendance and TeamPicker
let currentTimeoutId = null; // For showMessage

// --- DOM Elements (Globally used) ---
const playerListBody = document.getElementById('player-list');
const pageContentArea = document.getElementById('page-content-area');
const messageArea = document.getElementById('message-area');
const attendanceSummaryDiv = document.getElementById('attendance-summary');
const summaryTextSpan = document.getElementById('summary-text');
const tekerDonduIndicator = document.getElementById('teker-dondu-indicator');
const menuButton = document.getElementById('menu-button');
const navLinksContainer = document.getElementById('main-nav-links');
const navLinks = navLinksContainer.querySelectorAll('.tab-nav-item');
const iconHamburger = document.getElementById('icon-hamburger');
const iconClose = document.getElementById('icon-close');

// --- Global Helper Functions ---

/**
 * Displays a message to the user (success or error).
 * @param {string} text - The message text.
 * @param {'success' | 'error'} type - The type of message.
 * @param {number} duration - How long to show the message in ms.
 */
function showMessage(text, type = 'error', duration = 5000) {
    // Clear previous timeout if exists
    if (currentTimeoutId) {
        clearTimeout(currentTimeoutId);
    }

    messageArea.textContent = text;
    // Reset classes, keeping base ones if needed (like hidden initially)
    messageArea.className = 'hidden'; // Start hidden
    messageArea.classList.add(type); // Add 'success' or 'error' class
    messageArea.classList.remove('hidden'); // Make visible

    // Set timeout to hide the message
    currentTimeoutId = setTimeout(() => {
        messageArea.classList.add('hidden');
        messageArea.classList.remove(type);
        currentTimeoutId = null; // Reset timeout ID
    }, duration);
}

/**
 * Formats a stat value for display
 * @param {number} value - The stat value
 * @param {number} decimals - Number of decimals to display
 * @returns {string} - Formatted stat string
 */
function formatStat(value, decimals = 1) { // Used by multiple tables
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    return typeof value === 'number' ? value.toFixed(decimals) : 'N/A';
}


// --- Navigation Logic ---

/**
 * Shows the specified page content and updates navigation link styles.
 * @param {string} pageId - The ID of the page to show (e.g., 'attendance', 'draft').
 */
function showPage(pageId) {
    const allPages = pageContentArea.querySelectorAll('.page-content');
    allPages.forEach(page => {
        page.classList.add('hidden'); // Hide all pages
    });

    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden'); // Show the target page
    } else {
        console.error(`Page content with ID 'page-${pageId}' not found.`);
        // Optionally show a default page or an error message
        document.getElementById(`page-${DEFAULT_PAGE}`)?.classList.remove('hidden');
        pageId = DEFAULT_PAGE; // Fallback to default
    }

    // Update navigation link active states
    navLinks.forEach(link => {
        link.classList.remove('active');
        // Remove mobile-specific active styles if they exist
        link.classList.remove('bg-blue-50', 'border-l-blue-500', 'text-blue-600'); // More specific removal

        if (link.getAttribute('data-page') === pageId) {
            link.classList.add('active'); // Add active class to the correct link
            // Apply mobile-specific active styles if the menu is currently in mobile view
            if (navLinksContainer.classList.contains('mobile-menu-active')) {
                 link.classList.add('bg-eff6ff', 'border-l-blue-600', 'text-blue-600'); // Use actual color codes if needed
            }
        }
    });

    // Call TeamPicker initializer when showing team picker page
    if (pageId === 'team_picker' && typeof TeamPicker !== 'undefined' && typeof TeamPicker.init === 'function') {
        TeamPicker.init();
    }

    // Close mobile menu after selecting an item (optional but good UX)
    if (navLinksContainer.classList.contains('mobile-menu-active')) {
        toggleMobileMenu(false); // Force close - REVERTED
        // Explicitly close the menu - REMOVED
        // menuButton.setAttribute('aria-expanded', 'false');
        // iconHamburger.classList.remove('hidden');
        // iconClose.classList.add('hidden');
        // navLinksContainer.classList.add('hidden');
        // navLinksContainer.classList.remove('mobile-menu-active');
    }
}

/**
 * Toggles the visibility and state of the mobile navigation menu.
 * @param {boolean} [forceState] - Optional. Force 'true' to open, 'false' to close.
 */
function toggleMobileMenu(forceState) {
    const shouldBeOpen = forceState !== undefined ? forceState : menuButton.getAttribute('aria-expanded') === 'false';

    menuButton.setAttribute('aria-expanded', shouldBeOpen);
    iconHamburger.classList.toggle('hidden', shouldBeOpen);
    iconClose.classList.toggle('hidden', !shouldBeOpen);

    // Use Tailwind classes for visibility on mobile
    navLinksContainer.classList.toggle('hidden', !shouldBeOpen); // Hide if not open
     // Add/remove classes that define the mobile menu appearance
    navLinksContainer.classList.toggle('mobile-menu-active', shouldBeOpen);


    // Re-apply active styles correctly when opening/closing
    const activeLink = navLinksContainer.querySelector('.tab-nav-item.active');
    if (activeLink) {
        // Remove potentially incorrect mobile styles first
        activeLink.classList.remove('bg-eff6ff', 'border-l-blue-600', 'text-blue-600');
        if (shouldBeOpen) {
            // Add mobile active styles only if opening
             activeLink.classList.add('bg-eff6ff', 'border-l-blue-600', 'text-blue-600');
        }
    }
}

// --- Stat Table Fetching and Rendering (Season, Last10, Nightly) ---

/**
 * Fetches season average player stats from the local JSON file.
 */
// --- MOVED TO StatsTables.js ---
// async function fetchSeasonAvgStats() { ... }
// async function loadAndRenderSeasonAvgTable() { ... }
// function fillSeasonAvgTable(data, tbody) { ... }
// async function fetchNightAvgStats() { ... }
// async function fetchLast10Stats() { ... }
// async function loadAndRenderLast10Table() { ... }
// function fillLast10Table(data, tbody) { ... }
// async function loadAndRenderNightAvgTable() { ... } 
// function fillNightAvgTable(data, tbody) { ... }

// --- Son Maç Logic ---
// --- MOVED TO sonMac.js ---
// async function fetchSonMacData() { ... }
// async function loadAndRenderSonMacData() { ... }
// function populateSonMacData(data) { ... }
// function populateMapContent(mapName, mapData, isActive) { ... }
// function createTeamSection(mapName, teamData, color) { ... }
// function initSonMacTabs() { ... }
// function fillSonMacTableBody(tbody, playersData) { ... }

// --- Heatmap and Color Logic ---

/**
 * Interpolates between two hex colors.
 * @param {string} hex1 Start color (#RRGGBB)
 * @param {string} hex2 End color (#RRGGBB)
 * @param {number} factor Interpolation factor (0 to 1)
 * @returns {string} Interpolated hex color
 */
function interpolateColor(hex1, hex2, factor) {
    const r1 = parseInt(hex1.substring(1, 3), 16);
    const g1 = parseInt(hex1.substring(3, 5), 16);
    const b1 = parseInt(hex1.substring(5, 7), 16);
    const r2 = parseInt(hex2.substring(1, 3), 16);
    const g2 = parseInt(hex2.substring(3, 5), 16);
    const b2 = parseInt(hex2.substring(5, 7), 16);

    const r = Math.round(r1 + factor * (r2 - r1));
    const g = Math.round(g1 + factor * (g2 - g1));
    const b = Math.round(b1 + factor * (b2 - b1));

    const toHex = (c) => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculates color based on value within a range and gradient stops.
 * @param {number} value The value to map.
 * @param {number} min Minimum value in the range.
 * @param {number} max Maximum value in the range.
 * @param {Array<{percent: number, color: string}>} gradientStops Array of stops (e.g., [{percent: 0, color: '#ff0000'}, {percent: 1, color: '#00ff00'}])
 * @returns {string} Calculated hex color.
 */
function calculateColor(value, min, max, gradientStops) {
    if (max === min || isNaN(value) || value === null) {
        // Return middle color if range is zero or value is invalid
        const middleIndex = Math.floor(gradientStops.length / 2);
        return gradientStops[middleIndex]?.color || '#ffffff'; // Fallback to white
    }
    // Clamp value to min/max to handle potential outliers slightly outside fetched range
    const clampedValue = Math.max(min, Math.min(max, value));
    const percent = (clampedValue - min) / (max - min);

    // Find the two stops the percentage falls between
    let stop1 = gradientStops[0];
    let stop2 = gradientStops[gradientStops.length - 1];

    for (let i = 0; i < gradientStops.length - 1; i++) {
        if (percent >= gradientStops[i].percent && percent <= gradientStops[i + 1].percent) {
            stop1 = gradientStops[i];
            stop2 = gradientStops[i + 1];
            break;
        }
    }

    // Calculate the factor for interpolation between the two stops
    const rangePercent = stop2.percent - stop1.percent;
    const factor = (rangePercent === 0) ? 0 : (percent - stop1.percent) / rangePercent;

    return interpolateColor(stop1.color, stop2.color, factor);
}

/**
 * Calculates relative luminance of a hex color.
 * @param {string} hexColor (#RRGGBB)
 * @returns {number} Luminance value (0 to 1)
 */
function getLuminance(hexColor) {
    const rgb = parseInt(hexColor.substring(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >>  8) & 0xff;
    const b = (rgb >>  0) & 0xff;

    const sR = r / 255;
    const sG = g / 255;
    const sB = b / 255;

    const R = (sR <= 0.03928) ? sR / 12.92 : Math.pow((sR + 0.055) / 1.055, 2.4);
    const G = (sG <= 0.03928) ? sG / 12.92 : Math.pow((sG + 0.055) / 1.055, 2.4);
    const B = (sB <= 0.03928) ? sB / 12.92 : Math.pow((sB + 0.055) / 1.055, 2.4);

    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Determines if white or black text provides better contrast against a background color.
 * Uses WCAG contrast ratio recommendations (simplified: chooses based on luminance threshold).
 * @param {string} bgColorHex (#RRGGBB)
 * @returns {string} '#ffffff' (white) or '#000000' (black)
 */
function calculateTextColor(bgColorHex, darkenFactor = 0.5) {
    // Ensure the factor is within bounds
    const factor = Math.max(0, Math.min(1, darkenFactor));

    // Remove '#' if present
    const hex = bgColorHex.startsWith('#') ? bgColorHex.substring(1) : bgColorHex;

    // Parse hex to RGB
    const bigint = parseInt(hex, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;

    // Darken each component
    r = Math.floor(r * factor);
    g = Math.floor(g * factor);
    b = Math.floor(b * factor);

    // Convert back to hex, ensuring 2 digits per component
    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = b.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
}


/**
 * Applies heatmap colors to badge spans within a specific table column.
 * @param {string} tbodyId The ID of the table body.
 * @param {number} columnIndex The 0-based index of the column.
 * @param {Array<{percent: number, color: string}>} gradientStops Color gradient definition.
 */
function applyHeatmapToColumn(tbodyId, columnIndex, gradientStops) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) {
        console.error(`applyHeatmapToColumn: tbody with id '${tbodyId}' not found.`);
        return;
    }

    // Select the SPAN inside the TD at the correct index (nth-child is 1-based)
    const spans = tbody.querySelectorAll(`tr td:nth-child(${columnIndex + 1}) span.stat-badge`);
    if (spans.length === 0) {
         return; // No spans to color
    }

    const values = [];
    spans.forEach(span => {
        const textContent = span.textContent; // Get text content first
        const value = parseFloat(textContent);
         if (!isNaN(value)) {
            values.push(value);
            // Store value on span for easy retrieval later, avoiding re-parsing
            span.dataset.value = value;
        } else {
             span.dataset.value = 'NaN'; // Mark as invalid
        }
    });

    if (values.length === 0) return; // No valid numeric values found

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    spans.forEach(span => {
        const value = parseFloat(span.dataset.value); // Retrieve stored value
        if (!isNaN(value)) {
            const bgColor = calculateColor(value, minVal, maxVal, gradientStops);
            const textColor = calculateTextColor(bgColor);
            // Add !important to override potential stylesheet rules
            span.style.setProperty('background-color', bgColor, 'important');
            span.style.setProperty('color', textColor, 'important');
        } else {
            // Optional: Style invalid values differently (e.g., gray)
            // Add !important here too for consistency if needed
            span.style.setProperty('background-color', '#e5e7eb', 'important'); // Light gray
            span.style.setProperty('color', '#4b5563', 'important');      // Darker gray text
        }
    });
}



// --- Sorting Logic ---
// Helper function for actual sorting
function sortData(data, sortKey, sortDir) {
     data.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        // Basic type checking (treat null/undefined as lowest)
        valA = valA === null || valA === undefined ? -Infinity : valA;
        valB = valB === null || valB === undefined ? -Infinity : valB;

        // Attempt numeric comparison first
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);

        if (!isNaN(numA) && !isNaN(numB)) {
            // Numeric sort
            return sortDir === 'asc' ? numA - numB : numB - numA;
        } else {
            // String sort (case-insensitive)
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            if (strA < strB) return sortDir === 'asc' ? -1 : 1;
            if (strA > strB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        }
    });
}

// Helper function to set header classes and store state
function setSortState(tbody, header, sortKey, sortDir) {
    const thead = tbody.closest('table').querySelector('thead');
     // Clear existing sort indicators
    thead.querySelectorAll('.sortable-header').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc', 'sort-active');
    });
    // Add indicator and active class to clicked header
    header.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    header.classList.add('sort-active');

    // Store current sort state
    tbody.dataset.currentSortKey = sortKey;
    tbody.dataset.currentSortDir = sortDir;
}

// Helper function to set the *initial* sort state on load
function setInitialSortState(tbody, defaultSortKey, defaultSortDir) {
     const thead = tbody.closest('table').querySelector('thead');
     const defaultHeader = thead.querySelector(`.sortable-header[data-sort-key="${defaultSortKey}"]`);
     if (defaultHeader) {
         setSortState(tbody, defaultHeader, defaultSortKey, defaultSortDir);
     }
}

function handleSortClick(event) {
    const header = event.target.closest('.sortable-header');
    if (!header) return; 

    const sortKey = header.dataset.sortKey;
    const table = header.closest('table');
    const tbody = table.querySelector('tbody');
    const thead = table.querySelector('thead');

    if (!tbody || !tbody.dataset.originalData) { 
        console.error('Could not find table body or original data for sorting.');
        return;
    }

    // Parse the original, UNsorted data
    const originalData = JSON.parse(tbody.dataset.originalData);
    // Create a COPY to sort
    let dataToSort = [...originalData]; // Use spread syntax for a shallow copy

    // Determine sort direction
    const currentSortKey = tbody.dataset.currentSortKey;
    const currentSortDir = tbody.dataset.currentSortDir;
    let newSortDir = 'desc'; 
    if (currentSortKey === sortKey && currentSortDir === 'desc') {
        newSortDir = 'asc';
    }

    // --- Sorting --- 
    sortData(dataToSort, sortKey, newSortDir); // Sort the COPY

    // --- Re-render table --- 
    // Pass the SORTED COPY to the fill function
    if (tbody.id === 'season-avg-table-body') {
        StatsTables.fillSeasonAvgTable(dataToSort, tbody);
    } else if (tbody.id === 'last10-table-body') {
        StatsTables.fillLast10Table(dataToSort, tbody);
    } else if (tbody.id === 'night-avg-table-body') {
        StatsTables.fillNightAvgTable(dataToSort, tbody);
    } else if (tbody.id.startsWith('sonmac-')) {
        // fillSonMacTableBody(tbody, dataToSort); // OLD
        SonMac.fillSonMacTableBody(tbody, dataToSort); // UPDATED
    }

    // --- Update header indicators --- 
    setSortState(tbody, header, sortKey, newSortDir); 
}

// --- Nightly Average Table --- 

// MOVED TO StatsTables.js

// --- Duello Logic (Son Maç & Sezon) ---
// --- MOVED TO duello.js ---
// async function fetchDuelloSonMacData() { ... }
// function renderDuelloSonMacGrid(data) { ... }
// async function fetchDuelloSezonData() { ... }
// function renderDuelloSezonGrid(data) { ... }
// async function loadAndRenderDuelloSezonGrid() { ... }
// function renderDuelloGridLogic(table, data) { ... }
// function createDuelCircle(cell, killerName, killedName, killCount, position) { ... }
// async function loadAndRenderDuelloSonMacGrid() { ... }
// function handleDuelloClick(event) { ... }

// --- Event Listeners & Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Initialization (Moved Here) ---
    const firebaseConfig = {
        apiKey: "AIzaSyAJpmATHX2Zugnm4c1WhU5Kg9iMOruiZBU",
        authDomain: "csbatagirealtimedb.firebaseapp.com",
        databaseURL: "https://csbatagirealtimedb-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "csbatagirealtimedb",
        storageBucket: "csbatagirealtimedb.firebasestorage.app",
        messagingSenderId: "408840223663",
        appId: "1:408840223663:web:bdcf576d64b3a1fb6c4d5a"
      };
    try {
        const firebaseApp = firebase.initializeApp(firebaseConfig);
        database = firebase.database(); // Assign to the globally declared variable
        console.log("Firebase initialized successfully.");
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showMessage("Critical Error: Could not connect to Firebase.", 'error', 10000);
        return; // Stop further initialization if Firebase fails
    }
    // --- End Firebase Initialization ---

    // --- Firebase Messaging (Push Notifications) ---
    if (window.firebase && firebase.messaging) {
      const messaging = firebase.messaging();

      navigator.serviceWorker.register('firebase-messaging-sw.js').then(function(registration) {
        // Always request notification permission on page load
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            getTokenAndLog(registration);
          } else {
            console.log('Notification permission not granted:', permission);
          }
        });
      });

      function getTokenAndLog(registration) {
        messaging.getToken({
          vapidKey: 'BOBSX1e7RIaNamSRVADSxWzasn6IXp2Q7QH0wqsi856l1bdairiUTC5IBqIe7gpdgnwK9dTqyAk-aYMV7r19a20',
          serviceWorkerRegistration: registration
        }).then((currentToken) => {
          if (currentToken) {

            // Store the token in the database for push notifications (silently)
            if (database) {
              database.ref('fcmTokens/' + currentToken).set(true)
                .catch((dbError) => {
                  // Log only if database save fails
                  console.error('Error saving FCM Token to DB:', dbError);
                });
            } else {
              // Log only if database object is missing
              console.error('DB not initialized, cannot save FCM token.');
            }
          } else {
            // Keep this log: Important for knowing why no token was generated
            console.log('No registration token available. Request permission to generate one.');
          }
        }).catch((err) => {
          // Keep this log: Important for token retrieval errors (like the 401)
          console.log('An error occurred while retrieving token. ', err);
        });
      }

      // Foreground message handler
      messaging.onMessage((payload) => {
        console.log('Message received. ', payload);
        if (Notification.permission === 'granted' && payload.notification) {
          new Notification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/images/BatakLogo192.png'
          });
        }
      });
    }

    showPage(DEFAULT_PAGE); // Show the initial page
    Attendance.init(); // Initialize Attendance module
    StatsTables.init(); // Initialize StatsTables module
    SonMac.init(); // Initialize SonMac module
    Duello.init(); // Initialize Duello module
    adjustNavLayout(); // Set initial navigation visibility
    setupGlobalEventListeners(); // Setup global event listeners
});

// Helper function to consolidate global event listener setup
function setupGlobalEventListeners() {
    // updateButton.addEventListener('click', fetchStatsFromSheet);
    // REMOVED: updateButton.addEventListener('click', () => Attendance.fetchStatsFromSheet()); // UPDATED line causing error
    // playerListBody.addEventListener('click', handlePlayerListClick); 
    playerListBody.addEventListener('click', (e) => Attendance.handlePlayerListClick(e)); // UPDATED
    navLinksContainer.addEventListener('click', handleNavLinkClick); // Main navigation
    menuButton.addEventListener('click', () => toggleMobileMenu());
    pageContentArea.addEventListener('click', handleSortClick); // Table sorting
    // pageContentArea.addEventListener('click', handleDuelloClick); // REMOVED - Handled by Duello.init()

    // --- Sub-Tab Switching Logic ---
    pageContentArea.addEventListener('click', (event) => {
        // Check if a sub-tab button was clicked
        const tabButton = event.target.closest('button[data-tabs-target]');
        if (!tabButton) return;

        // Find the parent tab container and content area
        const subTabNav = tabButton.closest('[role="tablist"]');
        if (!subTabNav) return;
        const subTabContent = subTabNav.parentElement.nextElementSibling; // Assumes content follows nav
        if (!subTabContent) return;

        // --- FIX: Skip stats tabs, let statsTables.js handle them ---
        const statsTabIds = ['season-avg-sub-tabs', 'last10-sub-tabs', 'night-avg-sub-tabs'];
        if (statsTabIds.includes(subTabNav.id)) {
            return; // Let statsTables.js handle these
        }

        // Get target pane ID from button
        const targetPaneId = tabButton.getAttribute('data-tabs-target');
        const targetPane = subTabContent.querySelector(targetPaneId);

        if (targetPane) {
            // Deactivate all buttons and hide all panes in this group
            subTabNav.querySelectorAll('button[data-tabs-target]').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
            });
            subTabContent.querySelectorAll('.duello-tab-pane, .night-avg-tab-pane, .last10-tab-pane, .season-avg-tab-pane, .performance-tab-pane').forEach(pane => {
                 // Make sure we only hide panes within the CURRENT sub-tab group
                if (pane.closest('#' + subTabContent.id) === subTabContent) { 
                    pane.classList.add('hidden');
                    pane.classList.remove('active');
                }
            });

            // Activate the clicked button and show the target pane
            tabButton.classList.add('active');
            tabButton.setAttribute('aria-selected', 'true');
            targetPane.classList.remove('hidden');
            targetPane.classList.add('active');
        }
    });
    // --- End Sub-Tab Switching Logic ---


    // Landing page tile clicks
    const homePageContainer = document.getElementById('page-home');
    if (homePageContainer) {
        homePageContainer.addEventListener('click', (event) => {
            const tile = event.target.closest('.landing-tile');
            if (tile && tile.dataset.pageTarget) {
                event.preventDefault(); 
                const targetPageId = tile.dataset.pageTarget;
                showPage(targetPageId);
            }
        });
    }
    // Header title click
    const headerHomeLink = document.getElementById('header-home-link');
    if (headerHomeLink) {
        headerHomeLink.addEventListener('click', (event) => {
            event.preventDefault();
            showPage('home');
        });
    }

    window.addEventListener('resize', adjustNavLayout); // Responsive nav

}

// Handle clicks on nav links
function handleNavLinkClick(event) {
    const link = event.target.closest('.tab-nav-item');
    if (link && link.dataset.page) { // Check if it's a valid nav link with a page target
        event.preventDefault(); // Prevent default anchor link behavior
        const pageId = link.dataset.page;
        showPage(pageId);
    }
}

// Handle clicks within Duello grids
// MOVED TO duello.js

// Adjust nav layout on resize/load
function adjustNavLayout() {
    if (window.innerWidth >= 768) { // Tailwind's md breakpoint is 768px
        navLinksContainer.classList.remove('hidden', 'mobile-menu-active');
        menuButton.setAttribute('aria-expanded', 'false');
        iconHamburger.classList.remove('hidden');
        iconClose.classList.add('hidden');
    } else {
        // Ensure it's hidden only if not explicitly opened
        if (menuButton.getAttribute('aria-expanded') === 'false') {
            navLinksContainer.classList.add('hidden');
            navLinksContainer.classList.remove('mobile-menu-active');
            iconHamburger.classList.remove('hidden');
            iconClose.classList.add('hidden');
        }
    }
}

// Ensure all necessary DOM elements are defined before being used
// e.g., make sure table bodies exist before filling them
// Consider adding checks within rendering functions if needed.
