// --- Constants ---
const APPS_SCRIPT_URL = 'https://royal-flower-aa89.onur1atak.workers.dev/'; // Replace with your actual URL
const ATTENDANCE_STATES = ["not_coming", "no_response", "coming"]; // Order matters for cycling
const DEFAULT_PAGE = 'home'; // <<<<< CHANGED
const TEKER_DONDU_THRESHOLD = 10; // Number of players needed for the wheel
const SEASON_AVG_JSON_URL = 'data/season_avg.json';
const LAST10_JSON_URL = 'data/last10.json';
const NIGHT_AVG_JSON_URL = 'data/night_avg.json';
const SONMAC_JSON_URL = 'data/sonmac.json';
const DUELLO_JSON_URL = 'data/duello_son_mac.json'; // Added Duello JSON URL
const DUELLO_SEZON_JSON_URL = 'data/duello_sezon.json'; // Added Duello Sezon JSON URL
const KABILE_JSON_URL = 'data/kabile.json';
const MAPS_JSON_URL = 'data/maps.json';

// --- Global State (Shared or needs wider access) ---
let players = []; // Populated by fetchStatsFromSheet, used by Attendance and TeamPicker
let currentTimeoutId = null; // For showMessage
let last10Stats = []; // Populated by fetchLast10Stats, used by Last10 Table and TeamPicker
let seasonStats = []; // Populated by fetchSeasonAvgStats, used by Season Table and TeamPicker

// --- DOM Elements (Globally used) ---
const playerListBody = document.getElementById('player-list');
const pageContentArea = document.getElementById('page-content-area');
const updateButton = document.getElementById('update-stats-button');
const messageArea = document.getElementById('message-area');
const spinner = document.getElementById('spinner');
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


// --- Attendance Module (Example Structure - Not fully modularized yet) ---

/**
 * Renders the player list in the attendance table and updates the summary.
 */
function renderPlayers() {
    // Ensure required DOM elements exist
    if (!playerListBody || !attendanceSummaryDiv || !summaryTextSpan || !tekerDonduIndicator) {
        console.error("Required DOM elements for rendering players/summary are missing.");
        return;
    }
    playerListBody.innerHTML = ''; // Clear existing rows

    // Define default summary state
    let summaryBgClass = 'bg-red-100';
    let summaryTextClass = 'text-red-800';
    let wheelColorClass = 'text-red-800'; // Match wheel color to text

    // Handle case where player data is not available
    if (players.length === 0) {
         playerListBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500">No player data available. Try updating.</td></tr>';
         summaryTextSpan.textContent = 'Gelen oyuncu: 0  Belirsiz: 0';
         tekerDonduIndicator.classList.add('hidden'); // Ensure indicator is hidden
    } else {
        // Calculate counts
        let countComing = 0;
        let countNoResponse = 0;
        players.forEach(player => {
            if (player.attendance === 'coming') countComing++;
            if (player.attendance === 'no_response') countNoResponse++;
        });

        // Update summary text
        summaryTextSpan.textContent = `Gelen oyuncu: ${countComing}  Belirsiz: ${countNoResponse}`;

        // Determine background/text colors and Show/hide the "Teker Döndü" indicator
        if (countComing >= TEKER_DONDU_THRESHOLD) {
            summaryBgClass = 'bg-green-100';
            summaryTextClass = 'text-green-800';
            wheelColorClass = 'text-green-800'; // Match wheel color
            tekerDonduIndicator.classList.remove('hidden');
        } else {
            // Keep default red colors defined above
            tekerDonduIndicator.classList.add('hidden');
        }
    }

    // Apply summary styles
    // Remove potentially existing color classes first
    attendanceSummaryDiv.classList.remove('bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'text-gray-700');
    tekerDonduIndicator.classList.remove('text-green-800', 'text-red-800', 'text-gray-600'); // Remove potential wheel colors

    // Add the determined classes
    attendanceSummaryDiv.classList.add(summaryBgClass, summaryTextClass);
    if (!tekerDonduIndicator.classList.contains('hidden')) {
         tekerDonduIndicator.classList.add(wheelColorClass);
    }


    // Define attendance state configurations (styles and text)
    const stateConfigs = {
        coming: { text: 'Geliyor', bgColor: 'bg-green-500', textColor: 'text-white' },
        not_coming: { text: 'Gelmiyor', bgColor: 'bg-red-500', textColor: 'text-white' },
        no_response: { text: 'Belirsiz', bgColor: 'bg-gray-300', textColor: 'text-gray-900' }
    };

    // Create and append rows for each player (only if players exist)
    if (players.length > 0) {
        players.forEach((player) => {
            const row = document.createElement('tr');
            row.setAttribute('data-player-name', player.name);

            // 1) Name cell
            const nameCell = document.createElement('td');
            nameCell.className = 'font-medium text-gray-900 whitespace-nowrap'; // Keep nowrap on larger screens
            nameCell.textContent = player.name;
            row.appendChild(nameCell);

            // 2) Status cell
            const statusCell = document.createElement('td');
            statusCell.className = 'text-center'; // Center align status content
            const statusBadge = document.createElement('span');
            // *** Use rounded-md and ensure status-badge class is present ***
            statusBadge.className = 'status-badge px-2 py-1 text-xs font-medium rounded-md'; // Changed to rounded-md

            // --- Status Text Logic ---
            let displayStatus = 'Unknown'; // Default display text
            const originalStatus = (player.status || '').toLowerCase(); // Get original status safely

            if (originalStatus.includes('aktif')) {
                displayStatus = 'Aktif Oyuncu'; // Simplified active text
            } else if (originalStatus === 'adam evde yok') {
                displayStatus = 'Evde Yok'; // Simplified inactive text as requested
            } else if (player.status) {
                displayStatus = player.status; // Use original if not recognized but exists
            }
            statusBadge.textContent = displayStatus;
            // --- End Status Text Logic ---


            // Color-code the status badge based on the *original* status logic
            if (originalStatus.includes('aktif')) {
                statusBadge.classList.add('bg-green-100', 'text-green-800');
            } else if (originalStatus === 'adam evde yok' || originalStatus.includes('inactive')) { // Check original logic conditions
                statusBadge.classList.add('bg-red-100', 'text-red-800');
            } else {
                statusBadge.classList.add('bg-gray-100', 'text-gray-800'); // Default/Unknown style
            }
            statusCell.appendChild(statusBadge);
            row.appendChild(statusCell);

            // 3) Attendance cell (using the improved control)
            const attendanceCell = document.createElement('td');
            attendanceCell.className = 'text-center'; // Center content within the cell

            const currentState = player.attendance || 'no_response';
            const config = stateConfigs[currentState];

            // Container for the control
            const container = document.createElement('div');
            container.className = 'attendance-control-container'; // Centered flex container

            // Left arrow button (using SVG)
            const leftArrowBtn = document.createElement('button');
            leftArrowBtn.className = 'attendance-arrow';
            leftArrowBtn.setAttribute('aria-label', `Previous status for ${player.name}`);
            leftArrowBtn.setAttribute('data-direction', 'left');
            leftArrowBtn.setAttribute('data-player', player.name);
            leftArrowBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>`; // Left chevron SVG

            // Status pill label
            const labelSpan = document.createElement('span');
            // Apply base classes and dynamic background/text color
            labelSpan.className = `attendance-label ${config.bgColor} ${config.textColor}`;
            labelSpan.textContent = config.text;
            labelSpan.setAttribute('data-state', currentState); // Store current state
            labelSpan.setAttribute('data-player', player.name); // Link to player

            // Right arrow button (using SVG)
            const rightArrowBtn = document.createElement('button');
            rightArrowBtn.className = 'attendance-arrow';
            rightArrowBtn.setAttribute('aria-label', `Next status for ${player.name}`);
            rightArrowBtn.setAttribute('data-direction', 'right');
            rightArrowBtn.setAttribute('data-player', player.name);
            rightArrowBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>`; // Right chevron SVG

            // Append elements to the container
            container.appendChild(leftArrowBtn);
            container.appendChild(labelSpan);
            container.appendChild(rightArrowBtn);

            // Append the container to the cell
            attendanceCell.appendChild(container);
            row.appendChild(attendanceCell);

            // Add the row to the table body
            playerListBody.appendChild(row);
        });
    } // End player loop
}

/**
 * Fetches attendance data from the Google Apps Script endpoint.
 */
async function fetchStatsFromSheet() {
    spinner.classList.remove('hidden');
    updateButton.disabled = true;
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        if (!response.ok) {
            // Try to get more specific error from response body if possible
            let errorDetails = `HTTP error! Status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorDetails += ` - ${errorData.message || JSON.stringify(errorData)}`;
            } catch (e) { /* Ignore if response is not JSON */ }
            throw new Error(errorDetails);
        }
        const data = await response.json();
        // Basic validation: Check if it's an array
        if (!Array.isArray(data)) {
            console.error("Received data is not an array:", data);
            throw new Error("Invalid data format received from server.");
        }
        players = data; // Update the global players array
        renderPlayers(); // Re-render the table with new data
        //showMessage('Attendance data loaded successfully!', 'success');
    } catch (err) {
        console.error('Failed to fetch stats:', err);
        showMessage(`Error loading data: ${err.message}`, 'error');
        // Optionally render with empty state or keep old data
         renderPlayers(); // Render even on error to show empty state or previous data
    } finally {
        spinner.classList.add('hidden');
        updateButton.disabled = false;
    }
}

/**
 * Sends an attendance update for a specific player to the Google Apps Script endpoint.
 * @param {string} playerName - The name of the player to update.
 * @param {string} newAttendance - The new attendance status ('coming', 'not_coming', 'no_response').
 */
async function updateAttendanceInSheet(playerName, newAttendance) {
    // Optional: Add visual feedback (e.g., temporary spinner on the row)
    console.log(`Attempting to update ${playerName} to ${newAttendance}`);
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            // Use 'no-cors' if your Apps Script is not configured for CORS preflight (simple requests)
            // mode: 'no-cors', // Uncomment if needed, but you won't get response details back
            headers: {
                // 'Content-Type': 'application/json' // Needed for standard CORS
                'Content-Type': 'text/plain;charset=utf-8', // Often needed for simple 'no-cors' POST to Apps Script
            },
            // Body needs to be stringified for application/json or simple text for text/plain
             body: JSON.stringify({ name: playerName, attendance: newAttendance }),
            // Example for text/plain if Apps Script expects that:
            // body: `name=${encodeURIComponent(playerName)}&attendance=${encodeURIComponent(newAttendance)}`
        });

        // Note: With 'no-cors', response.ok will likely be false even on success.
        // You might need to rely on the absence of network errors.
        // If using standard CORS (recommended):
         if (!response.ok) {
             let errorText = `Network response was not ok (Status: ${response.status})`;
             try {
                // Try to parse error response if server sends JSON errors
                const errorData = await response.json();
                errorText += `: ${errorData.message || JSON.stringify(errorData)}`;
             } catch(e) {
                // Fallback if error response isn't JSON
                errorText = await response.text();
             }
             throw new Error(errorText);
         }
         // If using standard CORS and expecting JSON response:
         // const result = await response.json();
         // console.log('Update successful:', result);

        console.log(`Attendance updated successfully in sheet for ${playerName} to ${newAttendance}`);
        // Optional: Show temporary success message
        // showMessage(`${playerName}'s status updated!`, 'success', 2000);

    } catch (error) {
        console.error('Failed to update attendance in sheet:', error);
        showMessage(`Failed to update status for ${playerName}: ${error.message}`, 'error');
        // OPTIONAL: Revert the UI change if the update fails
        // To do this, you'd need to store the *previous* state before the optimistic update
        // and call fetchStatsFromSheet() or manually revert the specific player's state and re-render.
        // Example (simple refetch):
        // showMessage(`Update failed for ${playerName}. Reverting...`, 'error');
        // await fetchStatsFromSheet(); // Refetch to get the actual state from the sheet
    } finally {
         // Optional: Remove row-specific spinner if added
    }
}


/**
 * Handles clicks within the player list table, specifically for attendance changes.
 * Uses event delegation. Detects clicks on arrows OR the label itself.
 * @param {Event} event - The click event object.
 */
async function handlePlayerListClick(event) {
    const targetArrow = event.target.closest('.attendance-arrow');
    const targetLabel = event.target.closest('.attendance-label');
    let playerName = null;
    let direction = null; // 'left', 'right', or null if label clicked
    let playerIndex = -1;
    let isLabelClick = false;

    if (targetArrow) {
        // Clicked on an arrow button
        playerName = targetArrow.getAttribute('data-player');
        direction = targetArrow.getAttribute('data-direction');
    } else if (targetLabel) {
         // Clicked directly on the label pill
         isLabelClick = true;
         playerName = targetLabel.getAttribute('data-player');
         // Determine direction based on click position
         const rect = targetLabel.getBoundingClientRect();
         const clickX = event.clientX - rect.left; // X position within the element
         direction = (clickX < rect.width / 2) ? 'left' : 'right'; // Left half or right half
    }

    if (playerName) {
        playerIndex = players.findIndex(p => p.name === playerName);
    }

    if (playerIndex > -1 && direction) {
        // Common logic for both arrow and label clicks
        const currentState = players[playerIndex].attendance || 'no_response';
        let currentIndex = ATTENDANCE_STATES.indexOf(currentState);

        // Calculate the new index based on direction
        if (direction === 'left') {
            currentIndex = (currentIndex - 1 + ATTENDANCE_STATES.length) % ATTENDANCE_STATES.length;
        } else { // 'right'
            currentIndex = (currentIndex + 1) % ATTENDANCE_STATES.length;
        }

        const newState = ATTENDANCE_STATES[currentIndex];

        // Optimistic UI Update
        players[playerIndex].attendance = newState;
        renderPlayers(); // Update the UI

        // Asynchronously update the backend
        await updateAttendanceInSheet(playerName, newState);
    } else if (playerName && !direction) {
         console.warn(`Could not determine click direction for player ${playerName}`);
    } else if (targetArrow || targetLabel) {
         console.warn(`Player data not found for clicked element.`);
    }
    // If click was not on an arrow or label, do nothing.
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

    // If switching to attendance page, ensure players are rendered (might be redundant if already rendered)
    // if (pageId === 'attendance') {
    //     renderPlayers();
    // }
    
    // *** MODIFIED: Call TeamPicker initializer when showing team picker page ***
    if (pageId === 'team_picker') {
        TeamPicker.init();
    }

     // Close mobile menu after selecting an item (optional but good UX)
     if (navLinksContainer.classList.contains('mobile-menu-active')) {
        toggleMobileMenu(false); // Force close
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
async function fetchSeasonAvgStats() {
    try {
        const response = await fetch(SEASON_AVG_JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("Invalid data format received from JSON file.");
        }
        seasonStats = data; // Store globally
        return data;
    } catch (err) {
        console.error('Failed to fetch season avg stats:', err);
        showMessage(`Error loading season stats: ${err.message}`, 'error');
        return [];
    }
}

// Example usage: fetch and render
async function loadAndRenderSeasonAvgTable() {
    const stats = await fetchSeasonAvgStats(); // Ensure data is fetched
    if (stats.length > 0) {
        // Initial sort
        sortData(stats, 'hltv_2', 'desc');
        // Render
        fillSeasonAvgTable(stats);
        // Set initial header indicator
        const tbody = document.getElementById('season-avg-table-body');
        setInitialSortState(tbody, 'hltv_2', 'desc');
    }
}

// Modify fillSeasonAvgTable to accept data as a parameter:
function fillSeasonAvgTable(data, tbody) {
    // Get tbody if not provided
    tbody = tbody || document.getElementById('season-avg-table-body');
    if (!tbody) return;

    // Store original data ONLY if it doesn't exist (first load)
    if (!tbody.dataset.originalData) {
        tbody.dataset.originalData = JSON.stringify(data);
    }
    
    tbody.innerHTML = ''; // Clear existing rows

    // Render rows from the provided data array
    data.forEach(row => {
        // Use the global formatStat function
        const formatPercent = (num) => (typeof num === 'number' ? num.toFixed(2) + '%' : 'N/A');

        const tr = document.createElement('tr');
        // Apply ONLY stat-badge class to spans in the HTML string
        tr.innerHTML = `
            <td class="font-medium text-gray-900 whitespace-nowrap">${row.name || 'N/A'}</td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(row.hltv_2)}</span></td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(row.adr, 0)}</span></td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(row.kd)}</span></td>
            <td class="text-center">${formatStat(row.mvp)}</td>
            <td class="text-center">${formatStat(row.kills)}</td>
            <td class="text-center">${formatStat(row.deaths)}</td>
            <td class="text-center">${formatStat(row.assists)}</td>
            <td class="text-center">${formatStat(row.hs)}</td>
            <td class="text-center">${formatPercent(row.hs_ratio)}</td>
            <td class="text-center">${formatStat(row.first_kill)}</td>
            <td class="text-center">${formatStat(row.first_death)}</td>
            <td class="text-center">${formatStat(row.bomb_planted)}</td>
            <td class="text-center">${formatStat(row.bomb_defused)}</td>
            <td class="text-center">${formatStat(row.hltv)}</td>
            <td class="text-center">${formatPercent(row.kast)}</td>
            <td class="text-center">${formatStat(row.utl_dmg)}</td>
            <td class="text-center">${formatStat(row.two_kills)}</td>
            <td class="text-center">${formatStat(row.three_kills)}</td>
            <td class="text-center">${formatStat(row.four_kills)}</td>
            <td class="text-center">${formatStat(row.five_kills)}</td>
            <td class="text-center">${row.matches ?? 'N/A'}</td>
            <td class="text-center">${formatPercent(row.win_rate)}</td>
            <td class="text-center">${formatStat(row.avg_clutches)}</td>
            <td class="text-center">${formatStat(row.avg_clutches_won)}</td>
            <td class="text-center">${formatPercent(row.clutch_success)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Apply heatmap AFTER rows are in the DOM
    const gradient = [
        { percent: 0, color: '#EF4444' },   // Red-500
        { percent: 0.5, color: '#FDE68A' }, // Yellow-200 (the lighter one)
        { percent: 1, color: '#22C55E' }    // Green-500
    ];
    applyHeatmapToColumn(tbody.id, 1, gradient); // HLTV2 (index 1)
    applyHeatmapToColumn(tbody.id, 2, gradient); // ADR (index 2)
    applyHeatmapToColumn(tbody.id, 3, gradient); // K/D (index 3)
}

/**
 * Fetches nightly average player stats from the local JSON file.
 */
async function fetchNightAvgStats() {
    try {
        const response = await fetch(NIGHT_AVG_JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("Invalid data format received from JSON file.");
        }
        return data; // Don't store globally if only used here
    } catch (err) {
        console.error('Failed to fetch night avg stats:', err);
        showMessage(`Error loading night stats: ${err.message}`, 'error');
        return [];
    }
}

/**
 * Fetches last 10 average player stats from the local JSON file.
 */
async function fetchLast10Stats() {
    try {
        const response = await fetch(LAST10_JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("Invalid data format received from JSON file.");
        }
        last10Stats = data; // Store globally
        return data;
    } catch (err) {
        console.error('Failed to fetch last 10 stats:', err);
        showMessage(`Error loading last 10 stats: ${err.message}`, 'error');
        return []; // Return empty array on error
    }
}

// Function to fetch and render the last 10 games data
async function loadAndRenderLast10Table() {
    const stats = await fetchLast10Stats(); // Ensure data is fetched
    if (stats && stats.length > 0) { // Add check for stats being defined
         // Initial sort
        sortData(stats, 'hltv_2', 'desc');
        // Render
        fillLast10Table(stats);
         // Set initial header indicator
        const tbody = document.getElementById('last10-table-body');
        setInitialSortState(tbody, 'hltv_2', 'desc');
    }
}

// Function to fill the Last 10 table (mirrors fillSeasonAvgTable)
function fillLast10Table(data, tbody) {
    tbody = tbody || document.getElementById('last10-table-body');
    if (!tbody) return;

    // Store original data ONLY if it doesn't exist (first load)
    if (!tbody.dataset.originalData) {
        tbody.dataset.originalData = JSON.stringify(data);
    }
    
    tbody.innerHTML = ''; // Clear existing rows

    // Render rows from the provided data array
    data.forEach((row, index) => {
        // Use global formatStat
        const formatPercent = (num) => (typeof num === 'number' ? num.toFixed(2) + '%' : 'N/A');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="font-medium text-gray-900 whitespace-nowrap">${row.name || 'N/A'}</td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(row.hltv_2)}</span></td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(row.adr, 0)}</span></td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(row.kd)}</span></td>
            <td class="text-center">${formatStat(row.mvp)}</td>
            <td class="text-center">${formatStat(row.kills)}</td>
            <td class="text-center">${formatStat(row.deaths)}</td>
            <td class="text-center">${formatStat(row.assists)}</td>
            <td class="text-center">${formatStat(row.hs)}</td>
            <td class="text-center">${formatPercent(row.hs_ratio)}</td>
            <td class="text-center">${formatStat(row.first_kill)}</td>
            <td class="text-center">${formatStat(row.first_death)}</td>
            <td class="text-center">${formatStat(row.bomb_planted)}</td>
            <td class="text-center">${formatStat(row.bomb_defused)}</td>
            <td class="text-center">${formatStat(row.hltv)}</td>
            <td class="text-center">${formatPercent(row.kast)}</td>
            <td class="text-center">${formatStat(row.utl_dmg)}</td>
            <td class="text-center">${formatStat(row.two_kills)}</td>
            <td class="text-center">${formatStat(row.three_kills)}</td>
            <td class="text-center">${formatStat(row.four_kills)}</td>
            <td class="text-center">${formatStat(row.five_kills)}</td>
            <td class="text-center">${row.matches ?? 'N/A'}</td>
            <td class="text-center">${formatPercent(row.win_rate)}</td>
            <td class="text-center">${formatStat(row.avg_clutches)}</td>
            <td class="text-center">${formatStat(row.avg_clutches_won)}</td>
            <td class="text-center">${formatPercent(row.clutch_success)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Apply heatmap AFTER rows are in the DOM
    const gradient = [
        { percent: 0, color: '#EF4444' },   // Red-500
        { percent: 0.5, color: '#FDE68A' }, // Yellow-200 (the lighter one)
        { percent: 1, color: '#22C55E' }    // Green-500
    ];
    applyHeatmapToColumn(tbody.id, 1, gradient); // HLTV2 (index 1)
    applyHeatmapToColumn(tbody.id, 2, gradient); // ADR (index 2)
    applyHeatmapToColumn(tbody.id, 3, gradient); // K/D (index 3)
}

// --- Son Maç Logic ---

/**
 * Fetches Son Maç match stats from the local JSON file.
 */
async function fetchSonMacData() {
    try {
        const response = await fetch(SONMAC_JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (!data || !data.maps) {
            throw new Error("Invalid data format received from JSON file.");
        }
        return data;
    } catch (err) {
        console.error('Failed to fetch Son Maç data:', err);
        showMessage(`Error loading Son Maç data: ${err.message}`, 'error');
        return null;
    }
}

// Function to fetch and render the Son Maç data
async function loadAndRenderSonMacData() {
    const matchData = await fetchSonMacData();
    if (matchData) {
        // Populate creates the structure, including tbodies with originalData
        populateSonMacData(matchData);
        initSonMacTabs(); // Initialize tab click listeners

        // --- Apply heatmap and initial sort to the initially active tab --- 
        const firstActiveTab = document.querySelector('#map-tabs button.active');
        if (firstActiveTab) {
            const contentId = firstActiveTab.getAttribute('aria-controls');
            const contentDiv = document.getElementById(contentId);
            if (contentDiv) {
                const teamDivs = contentDiv.querySelectorAll('div.mb-6');
                teamDivs.forEach(teamDiv => {
                    const tbody = teamDiv.querySelector('tbody');
                    if (tbody && tbody.id && tbody.dataset.originalData) {
                        let playersData = JSON.parse(tbody.dataset.originalData);
                        // Initial sort
                        sortData(playersData, 'hltv_2', 'desc');
                        // Render the body with sorted data for the first time
                        fillSonMacTableBody(tbody, playersData);
                        // Set initial header indicator
                        setInitialSortState(tbody, 'hltv_2', 'desc');
                    }
                });
            }
        }
    }
}

// Function to populate the Son Maç page with match data
function populateSonMacData(data) {
    if (!data || !data.maps) return;
    
    // Get map tabs
    const mapTabs = document.querySelector('#map-tabs');
    mapTabs.innerHTML = ''; // Clear existing tabs
    
    // Create tabs for each map
    let isFirst = true;
    Object.keys(data.maps).forEach(mapName => {
        const li = document.createElement('li');
        li.className = 'mr-2';
        li.setAttribute('role', 'presentation');
        
        const button = document.createElement('button');
        button.id = `${mapName}-tab`;
        // Add the base class and the specific map tab class
        button.className = `tab-nav-item map-tab-button inline-block p-4 border-b-2 ${isFirst ? 'border-blue-500 active' : 'border-transparent'} rounded-t-lg hover:text-gray-600 hover:border-gray-300`;
        button.setAttribute('aria-controls', mapName);
        button.textContent = mapName;
        
        li.appendChild(button);
        mapTabs.appendChild(li);
        
        // Create/populate map content
        populateMapContent(mapName, data.maps[mapName], isFirst);
        
        if (isFirst) isFirst = false;
    });
    
    // Re-initialize tab functionality
    initSonMacTabs();
}

function populateMapContent(mapName, mapData, isActive) {
    const mapTabContent = document.getElementById('mapTabContent');
    
    // Create map div if it doesn't exist
    let mapDiv = document.getElementById(mapName);
    if (!mapDiv) {
        mapDiv = document.createElement('div');
        mapDiv.id = mapName;
        mapDiv.className = isActive ? 'active' : 'hidden';
        mapTabContent.appendChild(mapDiv);
    } else {
        mapDiv.innerHTML = ''; // Clear existing content
        mapDiv.className = isActive ? 'active' : 'hidden';
    }
    
    // Create scoreboard
    const scoreboardDiv = document.createElement('div');
    // Add overflow-x-auto to enable horizontal scroll if needed
    scoreboardDiv.className = 'flex justify-between md:justify-center md:gap-16 items-center mb-6 px-4 py-3 bg-gray-100 rounded-lg overflow-x-auto';
    scoreboardDiv.innerHTML = `
        <div class="text-center whitespace-nowrap"> 
            <h3 class="text-lg font-bold">${mapData.team1.name}</h3> 
            <div class="text-3xl font-extrabold text-blue-600">${mapData.team1.score}</div>
        </div>
        <div class="text-xl md:text-3xl font-semibold text-gray-500">vs</div> 
        <div class="text-center whitespace-nowrap"> 
            <h3 class="text-lg font-bold">${mapData.team2.name}</h3> 
            <div class="text-3xl font-extrabold text-green-600">${mapData.team2.score}</div>
        </div>
    `;
    mapDiv.appendChild(scoreboardDiv);
    
    // Create team1 section
    const team1Div = createTeamSection(mapName, mapData.team1, 'blue');
    mapDiv.appendChild(team1Div);
    
    // Create team2 section
    const team2Div = createTeamSection(mapName, mapData.team2, 'green');
    mapDiv.appendChild(team2Div);
}

function createTeamSection(mapName, teamData, color) {
    const teamDiv = document.createElement('div');
    teamDiv.className = 'mb-6';
    
    // Team heading
    const teamHeading = document.createElement('h3');
    teamHeading.className = `text-lg font-semibold text-${color}-600 mb-2 px-3`;
    teamHeading.textContent = teamData.name;
    teamDiv.appendChild(teamHeading);
    
    // Table container
    const tableContainer = document.createElement('div');
    tableContainer.className = 'overflow-x-auto';
    
    // Create table
    const table = document.createElement('table');
    table.className = 'styled-table min-w-full text-sm';
    
    // Table head - Add data-sort-key and sortable-header class
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="sortable-header" data-sort-key="name">Oyuncu</th>
            <th class="sortable-header" data-sort-key="hltv_2">HLTV2</th>
            <th class="sortable-header" data-sort-key="adr">ADR</th>
            <th class="sortable-header" data-sort-key="kd">K/D</th>
            <th class="sortable-header" data-sort-key="mvp">MVP</th>
            <th class="sortable-header" data-sort-key="kills">Kills</th>
            <th class="sortable-header" data-sort-key="deaths">Deaths</th>
            <th class="sortable-header" data-sort-key="assists">Assists</th>
            <th class="sortable-header" data-sort-key="hs">HS</th>
            <th class="sortable-header" data-sort-key="hs_ratio">HS/Kill ratio</th>
            <th class="sortable-header" data-sort-key="first_kill">First Kill</th>
            <th class="sortable-header" data-sort-key="first_death">First Death</th>
            <th class="sortable-header" data-sort-key="bomb_planted">Bomb Planted</th>
            <th class="sortable-header" data-sort-key="bomb_defused">Bomb Defused</th>
            <th class="sortable-header" data-sort-key="hltv">HLTV</th>
            <th class="sortable-header" data-sort-key="kast">KAST</th>
            <th class="sortable-header" data-sort-key="utl_dmg">Utility Damage</th>
            <th class="sortable-header" data-sort-key="two_kills">2 kills</th>
            <th class="sortable-header" data-sort-key="three_kills">3 kills</th>
            <th class="sortable-header" data-sort-key="four_kills">4 kills</th>
            <th class="sortable-header" data-sort-key="five_kills">5 kills</th>
            <th class="sortable-header" data-sort-key="score">Score</th>
            <th class="sortable-header" data-sort-key="clutches">Nr of clutches</th>
            <th class="sortable-header" data-sort-key="clutches_won">Clutches Won</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // Table body
    const tbodyId = `sonmac-${mapName}-${teamData.name.replace(/\s+/g, '_').toLowerCase()}-${color}`;
    const tbody = document.createElement('tbody');
    tbody.id = tbodyId;
    tbody.dataset.originalData = JSON.stringify(teamData.players); // Store player data
    
    // DO NOT fill initially. It will be filled after sorting in loadAndRenderSonMacData
     
     table.appendChild(tbody);
     tableContainer.appendChild(table);
    teamDiv.appendChild(tableContainer); 
    return teamDiv;
}

// Initialize Son Maç Tabs
function initSonMacTabs() {
    const mapTabs = document.querySelectorAll('#map-tabs button');
    const mapContents = document.querySelectorAll('#mapTabContent > div');
    
    mapTabs.forEach(tab => {
        tab.addEventListener('click', () => {

            // Remove active classes from all tabs and contents
            mapTabs.forEach(t => {
                t.classList.remove('active', 'border-blue-500');
                t.classList.add('border-transparent');
            });
            mapContents.forEach(c => c.classList.add('hidden'));
            
            // Add active class to clicked tab
            tab.classList.add('active', 'border-blue-500');
            tab.classList.remove('border-transparent');
            
            // Show corresponding content
            const contentId = tab.getAttribute('aria-controls');
            const contentDiv = document.getElementById(contentId);
            if (contentDiv) {
                contentDiv.classList.remove('hidden');

                // --- Render table content for the selected map --- 
                const teamDivs = contentDiv.querySelectorAll('div.mb-6');
                teamDivs.forEach(teamDiv => {
                    const tbody = teamDiv.querySelector('tbody');
                    if (tbody && tbody.id && tbody.dataset.originalData) {
                        try {
                            let playersData = JSON.parse(tbody.dataset.originalData);
                            // Sort data (defaulting to HLTV2 desc)
                            sortData(playersData, 'hltv_2', 'desc'); 
                            // Fill the table body (this also applies heatmap)
                            fillSonMacTableBody(tbody, playersData);
                            // Set the initial sort state for the header
                            setInitialSortState(tbody, 'hltv_2', 'desc');
                        } catch (e) {
                            console.error(`Error processing data for tbody ${tbody.id}:`, e);
                            tbody.innerHTML = '<tr><td colspan="24" class="text-center text-red-600">Error loading player data.</td></tr>';
                        }
                    } else {
                        console.error(`Could not find tbody, tbody.id, or originalData in a teamDiv within ${contentId}`);
                    }
                });
            } else {
                console.error(`Content div with ID ${contentId} not found!`);
            }
        });
    });
}

// Fill SonMaç Table Body (Specific renderer)
function fillSonMacTableBody(tbody, playersData) {
    // Note: originalData for SonMac is stored when the section is created
    
    tbody.innerHTML = ''; // Clear existing rows

    // Render rows from the provided playersData array
    playersData.forEach(player => {
        const tr = document.createElement('tr');
        // Use global formatStat
        const formatPercent = (num) => (typeof num === 'number' ? num.toFixed(2) + '%' : 'N/A');
        
        tr.innerHTML = `
            <td class="font-medium text-gray-900 whitespace-nowrap">${player.name || 'N/A'}</td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(player.hltv_2)}</span></td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(player.adr, 0)}</span></td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(player.kd)}</span></td>
            <td class="text-center">${formatStat(player.mvp)}</td>
            <td class="text-center">${formatStat(player.kills, 0)}</td>
            <td class="text-center">${formatStat(player.deaths, 0)}</td>
            <td class="text-center">${formatStat(player.assists, 0)}</td>
            <td class="text-center">${formatStat(player.hs, 0)}</td>
            <td class="text-center">${formatStat(player.hs_ratio)}</td>
            <td class="text-center">${formatStat(player.first_kill, 0)}</td>
            <td class="text-center">${formatStat(player.first_death, 0)}</td>
            <td class="text-center">${formatStat(player.bomb_planted, 0)}</td>
            <td class="text-center">${formatStat(player.bomb_defused, 0)}</td>
            <td class="text-center">${formatStat(player.hltv)}</td> 
            <td class="text-center">${formatPercent(player.kast)}</td>
            <td class="text-center">${formatStat(player.utl_dmg, 0)}</td>
            <td class="text-center">${formatStat(player.two_kills, 0)}</td>
            <td class="text-center">${formatStat(player.three_kills, 0)}</td>
            <td class="text-center">${formatStat(player.four_kills, 0)}</td>
            <td class="text-center">${formatStat(player.five_kills, 0)}</td>
            <td class="text-center">${formatStat(player.score, 0)}</td>
            <td class="text-center">${formatStat(player.clutches, 0)}</td>
            <td class="text-center">${formatStat(player.clutches_won, 0)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Re-apply heatmap AFTER rows are in the DOM
     const gradient = [
        { percent: 0, color: '#EF4444' },
        { percent: 0.5, color: '#FDE68A' },
        { percent: 1, color: '#22C55E' }
    ];
    applyHeatmapToColumn(tbody.id, 1, gradient); // HLTV2
    applyHeatmapToColumn(tbody.id, 2, gradient); // ADR
    applyHeatmapToColumn(tbody.id, 3, gradient); // K/D
}

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
function calculateTextColor(bgColorHex) {
    const luminance = getLuminance(bgColorHex);
    // Threshold slightly adjusted from pure 0.5 for better aesthetics in some cases
    return (luminance > 0.4) ? '#000000' : '#ffffff';
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
        fillSeasonAvgTable(dataToSort, tbody);
    } else if (tbody.id === 'last10-table-body') {
        fillLast10Table(dataToSort, tbody);
    } else if (tbody.id === 'night-avg-table-body') {
        fillNightAvgTable(dataToSort, tbody);
    } else if (tbody.id.startsWith('sonmac-')) {
        fillSonMacTableBody(tbody, dataToSort);
    }

    // --- Update header indicators --- 
    setSortState(tbody, header, sortKey, newSortDir); 
}

// --- Nightly Average Table --- 

// Function to fetch and render the nightly average table
async function loadAndRenderNightAvgTable() {
     // console.log("loadAndRenderNightAvgTable: Starting"); // Log start
     const stats = await fetchNightAvgStats();
     // console.log("loadAndRenderNightAvgTable: Fetched stats:", stats?.length > 0 ? `${stats.length} rows` : stats); // Log fetched data
     if (stats && stats.length > 0) {
         // Initial sort - NOTE: Uses keys with spaces from the JSON
         sortData(stats, 'HLTV 2', 'desc');
         // Render
         fillNightAvgTable(stats);
         // Set initial header indicator
         const tbody = document.getElementById('night-avg-table-body');
         setInitialSortState(tbody, 'HLTV 2', 'desc');
     }
}

// Function to fill the nightly average table with data
function fillNightAvgTable(data, tbody) {
     // console.log("fillNightAvgTable: Starting", data ? `${data.length} rows` : data); // Log start and data
     // Get tbody if not provided
    tbody = tbody || document.getElementById('night-avg-table-body');
     if (!tbody) {
        console.error("fillNightAvgTable: tbody with id 'night-avg-table-body' not found.");
        return;
    }
     // console.log("fillNightAvgTable: Found tbody", tbody.id); // Log tbody found

     // Store original data ONLY if it doesn't exist (first load)
     if (!tbody.dataset.originalData) {
         tbody.dataset.originalData = JSON.stringify(data);
     }

    tbody.innerHTML = ''; // Clear existing rows
    // console.log("fillNightAvgTable: Cleared tbody"); // Log tbody cleared

     // Render rows from the provided data array
    data.forEach((row, index) => {
         // if (index === 0) {
             // console.log("fillNightAvgTable: Processing first row:", row); // Log first row data
         // }
        // Use global formatStat
        const formatPercent = (num) => (typeof num === 'number' ? num.toFixed(2) + '%' : 'N/A');

        const tr = document.createElement('tr');
        // Apply ONLY stat-badge class to spans in the HTML string
        tr.innerHTML = `
            <td class="font-medium text-gray-900 whitespace-nowrap">${row.name || 'N/A'}</td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(row["HLTV 2"])}</span></td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(row["ADR"], 0)}</span></td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(row["K/D"])}</span></td>
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(row["HLTV2 DIFF"])}</span></td> 
            <td class="stat-badge-cell"><span class="stat-badge">${formatStat(row["ADR DIFF"])}</span></td> 
            <td class="text-center">${formatStat(row["MVP"])}</td>
            <td class="text-center">${formatStat(row["Kills"])}</td>
            <td class="text-center">${formatStat(row["Deaths"])}</td>
            <td class="text-center">${formatStat(row["Assists"])}</td>
            <td class="text-center">${formatStat(row["HS"])}</td>
            <td class="text-center">${formatPercent(row["HS/Kill ratio"])}</td>
            <td class="text-center">${formatStat(row["First Kill"])}</td>
            <td class="text-center">${formatStat(row["First Death"])}</td>
            <td class="text-center">${formatStat(row["Bomb Planted"])}</td>
            <td class="text-center">${formatStat(row["Bomb Defused"])}</td>
            <td class="text-center">${formatStat(row["HLTV"])}</td>
            <td class="text-center">${formatPercent(row["KAST"])}</td>
            <td class="text-center">${formatStat(row["Utility Damage"])}</td>
            <td class="text-center">${formatStat(row["2 kills"])}</td>
            <td class="text-center">${formatStat(row["3 kills"])}</td>
            <td class="text-center">${formatStat(row["4 kills"])}</td>
            <td class="text-center">${formatStat(row["5 kills"])}</td>
            <td class="text-center">${row["Nr of Matches"] ?? 'N/A'}</td>
            <td class="text-center">${formatStat(row["Clutch Opportunity"], 0)}</td> 
            <td class="text-center">${formatStat(row["Clutches Won"], 0)}</td> 
        `;
        tbody.appendChild(tr);
    });

     // console.log(`fillNightAvgTable: Finished processing ${data.length} rows.`); // Log finish processing

    // Apply heatmap AFTER rows are in the DOM
    const gradient = [
        { percent: 0, color: '#EF4444' },   // Red-500
        { percent: 0.5, color: '#FDE68A' }, // Yellow-200
        { percent: 1, color: '#22C55E' }    // Green-500
    ];
    applyHeatmapToColumn(tbody.id, 1, gradient); // HLTV2 (index 1)
    applyHeatmapToColumn(tbody.id, 2, gradient); // ADR (index 2)
    applyHeatmapToColumn(tbody.id, 3, gradient); // K/D (index 3)
    applyHeatmapToColumn(tbody.id, 4, gradient); // HLTV2 DIFF (new index 4)
    applyHeatmapToColumn(tbody.id, 5, gradient); // ADR DIFF (new index 5)
}

// --- Duello Logic (Son Maç & Sezon) ---

/**
 * Fetches Duello Son Maç data from the local JSON file.
 */
async function fetchDuelloSonMacData() {
    try {
        const response = await fetch(DUELLO_JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        // Basic validation
        if (!data || !data.playerRows || !data.playerCols || !data.duels) {
            throw new Error("Invalid data format received from Duello JSON file.");
        }
        return data;
    } catch (err) {
        console.error('Failed to fetch Duello Son Maç data:', err);
        showMessage(`Error loading Duello data: ${err.message}`, 'error');
        return null; // Return null on error
    }
}

/**
 * Renders the Duello Son Maç grid.
 * @param {object} data - The duel data object containing playerRows, playerCols, and duels.
 */
function renderDuelloSonMacGrid(data) {
    // Target the correct table ID for Son Mac
    const table = document.getElementById('duello-table');
    
    if (!table) {
        console.error("Duello Son Mac table not found!");
        return; // Exit if table not found
    }
    if (!data) {
        table.innerHTML = '<thead><tr><th></th><th colspan="12" class="text-center p-4 text-red-500">Failed to load Duello Son Mac data.</th></tr></thead>';
        return; // Exit if no data
    }
    
    // Call the shared helper function with the correct table element
    renderDuelloGridLogic(table, data);
}

/**
 * Fetches Duello Sezon data from the local JSON file.
 */
async function fetchDuelloSezonData() {
    try {
        const response = await fetch(DUELLO_SEZON_JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        // Basic validation
        if (!data || !data.playerRows || !data.playerCols || !data.duels) {
            throw new Error("Invalid data format received from Duello Sezon JSON file.");
        }
        return data;
    } catch (err) {
        console.error('Failed to fetch Duello Sezon data:', err);
        showMessage(`Error loading Duello Sezon data: ${err.message}`, 'error');
        return null; // Return null on error
    }
}

/**
 * Renders the Duello Sezon grid.
 * @param {object} data - The duel data object containing playerRows, playerCols, and duels.
 */
function renderDuelloSezonGrid(data) {
    // Target the new table ID
    const table = document.getElementById('duello-sezon-table'); 
    
    if (!table) {
        console.error("Duello Sezon table not found!");
        return;
    }
    if (!data) {
        table.innerHTML = '<thead><tr><th></th><th colspan="12" class="text-center p-4 text-red-500">Failed to load Duello Sezon data.</th></tr></thead>';
        return;
    }
    
    // The rest of the rendering logic is identical to renderDuelloSonMacGrid,
    // as the structure and data format are the same.
    // We can reuse the same logic by passing the table element directly.
    renderDuelloGridLogic(table, data); // Call helper function
}

/**
 * Loads and renders the Duello Sezon grid.
 */
async function loadAndRenderDuelloSezonGrid() {
    const duelloData = await fetchDuelloSezonData();
    renderDuelloSezonGrid(duelloData);
}

/**
 * Helper function containing the core logic to render a Duello grid
 * @param {HTMLTableElement} table - The table element to render into.
 * @param {object} data - The duel data object.
 */
function renderDuelloGridLogic(table, data) {
    // Clear previous content
    table.innerHTML = '';

    const { playerRows, playerCols, duels } = data;

    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Add empty corner cell
    const cornerCell = document.createElement('th');
    cornerCell.className = 'border bg-gray-50 p-3 font-semibold text-center';
    cornerCell.style.position = 'sticky';
    cornerCell.style.left = '0';
    cornerCell.style.top = '0';
    cornerCell.style.zIndex = '20';
    cornerCell.style.minWidth = '120px';
    headerRow.appendChild(cornerCell);

    // Add column headers
    playerCols.forEach(colName => {
        const th = document.createElement('th');
        th.className = 'border bg-gray-50 p-3 font-semibold text-center';
        th.style.position = 'sticky';
        th.style.top = '0';
        th.style.zIndex = '10';
        th.style.minWidth = '100px';
        th.textContent = colName;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');

    // Create rows
    playerRows.forEach(rowName => {
        const tr = document.createElement('tr');

        // Add row header (player name)
        const th = document.createElement('th');
        th.className = 'border bg-gray-50 p-3 font-semibold text-left';
        th.style.position = 'sticky';
        th.style.left = '0';
        th.style.zIndex = '10';
        th.textContent = rowName;
        tr.appendChild(th);

        // Add data cells
        playerCols.forEach(colName => {
            const td = document.createElement('td');
            td.className = 'border p-2 text-center';
            td.style.height = '70px';
            td.style.verticalAlign = 'middle';

            const duelData = duels[rowName]?.[colName];

            if (rowName === colName) {
                td.style.backgroundColor = '#f3f4f6'; // Self vs self - gray background
            } else if (duelData && (duelData.kills > 0 || duelData.deaths > 0)) {
                // Define cell size and styles
                const cellSize = 90; 
                td.style.width = `${cellSize}px`; td.style.height = `${cellSize}px`;
                td.style.minWidth = `${cellSize}px`; td.style.maxWidth = `${cellSize}px`;
                td.style.minHeight = `${cellSize}px`; td.style.maxHeight = `${cellSize}px`;
                td.style.padding = '0'; td.style.position = 'relative'; td.style.overflow = 'hidden';
                td.style.backgroundColor = '#fff'; td.style.boxSizing = 'border-box';
                
                // Create and style the diagonal line *before* appending
                const diagonalLength = Math.ceil(Math.sqrt(2 * cellSize * cellSize));
                const diagonalLine = document.createElement('div');
                diagonalLine.style.position = 'absolute'; diagonalLine.style.width = `${diagonalLength}px`; diagonalLine.style.height = '1px';
                diagonalLine.style.backgroundColor = '#ccc'; diagonalLine.style.top = '50%'; diagonalLine.style.left = '50%';
                diagonalLine.style.transform = 'translate(-50%, -50%) rotate(45deg)'; diagonalLine.style.transformOrigin = 'center center'; diagonalLine.style.zIndex = '1';
                td.appendChild(diagonalLine);

                createDuelCircle(td, rowName, colName, duelData.kills, 'bottom-left'); // row kills col
                createDuelCircle(td, colName, rowName, duelData.deaths, 'top-right'); // col kills row

            } else {
                td.className += ' text-gray-400';
                td.textContent = '-';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

/**
 * Creates and appends a colored circle representing duel kills to a table cell.
 * @param {HTMLTableCellElement} cell The TD element to append to.
 * @param {string} killerName Name of the killing player.
 * @param {string} killedName Name of the killed player.
 * @param {number} killCount Number of kills.
 * @param {'top-right' | 'bottom-left'} position Position of the circle within the cell.
 */
function createDuelCircle(cell, killerName, killedName, killCount, position) {
    // Determine color based on comparison (if possible - needs opponent data)
    // For simplicity here, we won't dynamically color based on K/D in this helper
    // Color logic remains in the main render function or needs opponent data passed in.
    // Defaulting to gray for now, assuming color will be handled elsewhere if needed.
    let colorClass = 'bg-gray-400'; // Default color
    
    // Simplified color logic based *only* on count > 0 for visual feedback
    if (killCount > 0) {
         colorClass = position === 'bottom-left' ? 'bg-green-600' : 'bg-red-600'; // Simplified: Green for killer, Red for victim shown
    } else {
         colorClass = 'bg-gray-400'; // Gray if zero
    }


    const circle = document.createElement('div');
    circle.className = `${colorClass} duello-circle text-white font-bold rounded-full flex items-center justify-center cursor-pointer`;
    circle.style.position = 'absolute';
    circle.style.width = '36px';
    circle.style.height = '36px';
    circle.textContent = killCount; 
    circle.dataset.killer = killerName;
    circle.dataset.killed = killedName;
    circle.dataset.count = killCount;
    circle.title = `${killerName} killed ${killedName} ${killCount} times`;

    if (position === 'top-right') {
        circle.style.top = '10px';
        circle.style.right = '15px';
    } else { // bottom-left
        circle.style.bottom = '10px';
        circle.style.left = '15px';
    }
    cell.appendChild(circle);
}

/**
 * Loads and renders the Duello Son Maç grid.
 */
async function loadAndRenderDuelloSonMacGrid() {
    const duelloData = await fetchDuelloSonMacData();
    // Ensure the rendering function is called correctly
    renderDuelloSonMacGrid(duelloData);
}


// ==================================================
// --- Team Picker Module/Object --- 
// ==================================================

const TeamPicker = {
    // --- State (specific to Team Picker) ---
    availablePlayers: [],
    teamAPlayers: [],
    teamBPlayers: [],
    teamAName: 'Team A',
    teamBName: 'Team B',
    MAX_PLAYERS_PER_TEAM: 15,
    // Note: last10Stats and seasonStats remain global for now

    /**
     * Initializes the team picker page
     */
    init: function() {
        // Load kabile and maps data first
        Promise.all([
            TeamPicker.fetchKabileData(),
            TeamPicker.fetchMapsData(),
            fetchLast10Stats(),  // Fetch global stats
            fetchSeasonAvgStats() // Fetch global stats
        ]).then(([kabileData, mapsData /*, l10Stats, sStats are now global */]) => {
            // last10Stats and seasonStats are already updated globally
            
            // Populate kabile dropdowns
            TeamPicker.populateKabileDropdowns(kabileData);
            
            // Populate map dropdowns
            TeamPicker.populateMapDropdowns(mapsData);
            
            // Set up event listeners (specific to team picker UI elements)
            const teamAKabileSelect = document.getElementById('team-a-kabile');
            const teamBKabileSelect = document.getElementById('team-b-kabile');
            if(teamAKabileSelect) teamAKabileSelect.addEventListener('change', TeamPicker.updateTeamName);
            if(teamBKabileSelect) teamBKabileSelect.addEventListener('change', TeamPicker.updateTeamName);
            
            TeamPicker.setupMapSideSelectionListeners();
            TeamPicker.updateMapSideTeamNames();
            TeamPicker.updateAvailablePlayers();
            TeamPicker.updatePlayerSlots('team-a-players', TeamPicker.teamAPlayers);
            TeamPicker.updatePlayerSlots('team-b-players', TeamPicker.teamBPlayers);
            TeamPicker.updateTeamStats('a');
            TeamPicker.updateTeamStats('b');

        }).catch(error => {
            console.error('Error loading data for Team Picker:', error);
            showMessage('Error loading data. Team Picker features may not work correctly.', 'error');
            
            // Still try to show available players without stats
            TeamPicker.updateAvailablePlayers();
            TeamPicker.updatePlayerSlots('team-a-players', TeamPicker.teamAPlayers);
            TeamPicker.updatePlayerSlots('team-b-players', TeamPicker.teamBPlayers);
        });
    },

    /**
     * Fetches kabile data from JSON file
     */
    fetchKabileData: async function() {
        try {
            const response = await fetch(KABILE_JSON_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching kabile data:', error);
            // Return default values if there's an error
            return ["Team A", "Team B", "Kabile 1", "HilingTurimik", "Kianlar", "ShilkadinoguflarI"];
        }
    },

    /**
     * Fetches maps data from JSON file
     */
    fetchMapsData: async function() {
        try {
            const response = await fetch(MAPS_JSON_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching maps data:', error);
            // Return default values if there's an error
            return [
                {"id": "anubis", "name": "Anubis"},
                {"id": "ancient", "name": "Ancient"},
                {"id": "dust2", "name": "Dust II"},
                {"id": "inferno", "name": "Inferno"},
                {"id": "mirage", "name": "Mirage"},
                {"id": "nuke", "name": "Nuke"},
                {"id": "overpass", "name": "Overpass"}
            ];
        }
    },

    /**
     * Populates kabile dropdowns with data from JSON
     */
    populateKabileDropdowns: function(kabileData) {
        const teamAKabile = document.getElementById('team-a-kabile');
        const teamBKabile = document.getElementById('team-b-kabile');
        
        if (!teamAKabile || !teamBKabile) return;
        
        // Clear existing options
        teamAKabile.innerHTML = '<option value="">Select Kabile</option>';
        teamBKabile.innerHTML = '<option value="">Select Kabile</option>';
        
        // Add options from JSON data
        kabileData.forEach(kabile => {
            const optionA = document.createElement('option');
            optionA.value = kabile;
            optionA.textContent = kabile;
            teamAKabile.appendChild(optionA);
            
            const optionB = document.createElement('option');
            optionB.value = kabile;
            optionB.textContent = kabile;
            teamBKabile.appendChild(optionB);
        });
    },

    /**
     * Populates map dropdowns with data from JSON
     */
    populateMapDropdowns: function(mapsData) {
        const mapSelects = [
            document.getElementById('map-1'),
            document.getElementById('map-2'),
            document.getElementById('map-3')
        ];
        
        mapSelects.forEach(select => {
            if (!select) return;
            
            // Clear existing options
            select.innerHTML = '<option value="">Select Map</option>';
            
            // Add options from JSON data
            mapsData.forEach(map => {
                const option = document.createElement('option');
                option.value = map.id;
                option.textContent = map.name;
                select.appendChild(option);
            });
        });
    },
    
    /**
     * Merges player data with their stats (uses global stats arrays)
     * @param {Object} player - The player object with attendance info
     * @returns {Object} - Player with merged stats
     */
    mergePlayerWithStats: function(player) {
        const playerWithStats = { ...player, stats: {} };
        
        // Find player in last 10 stats (global)
        const last10Player = last10Stats.find(p => p.name === player.name);
        if (last10Player) {
            playerWithStats.stats.L10_HLTV2 = last10Player.hltv_2;
            playerWithStats.stats.L10_ADR = last10Player.adr;
            playerWithStats.stats.L10_KD = last10Player.kd;
        }
        
        // Find player in season stats (global)
        const seasonPlayer = seasonStats.find(p => p.name === player.name);
        if (seasonPlayer) {
            playerWithStats.stats.S_HLTV2 = seasonPlayer.hltv_2;
            playerWithStats.stats.S_ADR = seasonPlayer.adr;
            playerWithStats.stats.S_KD = seasonPlayer.kd;
        }
        
        return playerWithStats;
    },
    
    /**
     * Updates the available players list based on players who are coming, with stats
     */
    updateAvailablePlayers: function() {
        const availablePlayersContainer = document.getElementById('available-players');
        
        // Filter players who are coming (uses global 'players' array)
        const comingPlayers = players.filter(player => player.attendance === 'coming');
        
        // Merge with stats data
        TeamPicker.availablePlayers = comingPlayers.map(player => TeamPicker.mergePlayerWithStats(player));
        
        // Clear container
        if(availablePlayersContainer) availablePlayersContainer.innerHTML = '';
        else return; // Exit if container not found
        
        if (TeamPicker.availablePlayers.length === 0) {
            availablePlayersContainer.innerHTML = '<div class="text-center py-4 text-gray-500">No players available. Check attendance.</div>';
            return;
        }
        
        // Create scrollable wrapper
        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'overflow-x-auto'; // Add horizontal scrolling
        
        // Create table
        const table = document.createElement('table');
        table.className = 'w-full border-collapse text-xs'; // Change from text-sm to text-xs
        table.id = 'available-players-table';
        
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                <th class="px-1 py-1">Player</th>
                <th class="px-1 py-1 text-center">L10 HLT</th>
                <th class="px-1 py-1 text-center">L10 ADR</th>
                <th class="px-1 py-1 text-center">L10 K/D</th>
                <th class="px-1 py-1 text-center">S HLT</th>
                <th class="px-1 py-1 text-center">S ADR</th>
                <th class="px-1 py-1 text-center">S K/D</th>
                <th class="px-1 py-1 text-center">Team</th>
                <th class="px-1 py-1 text-center">Act</th>
            </tr>
        `;
        
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        tbody.id = 'available-players-tbody';
        table.appendChild(tbody);
        
        scrollWrapper.appendChild(table); // Add table to scroll wrapper
        availablePlayersContainer.appendChild(scrollWrapper); // Add scroll wrapper to container
        
        // Sort by HLTV2 by default
        TeamPicker.availablePlayers.sort((a, b) => {
            const valueA = a.stats && a.stats.L10_HLTV2 !== undefined ? a.stats.L10_HLTV2 : -Infinity;
            const valueB = b.stats && b.stats.L10_HLTV2 !== undefined ? b.stats.L10_HLTV2 : -Infinity;
            return valueB - valueA; // Descending order
        });
        
        // Render the table body
        TeamPicker.renderAvailablePlayersTable();
    },

    /**
     * Sorts the available players array
     * @param {string} field - The field to sort by
     * @param {string} direction - The sort direction ('asc' or 'desc')
     */
    sortAvailablePlayers: function(field, direction) {
        TeamPicker.availablePlayers.sort((a, b) => {
            let valueA, valueB;
            
            if (field === 'name') {
                valueA = a.name;
                valueB = b.name;
            } else {
                valueA = a.stats && a.stats[field] !== undefined ? a.stats[field] : -Infinity;
                valueB = b.stats && b.stats[field] !== undefined ? b.stats[field] : -Infinity;
            }
            
            // Handle string comparison
            if (typeof valueA === 'string' && typeof valueB === 'string') {
                return direction === 'asc' 
                    ? valueA.localeCompare(valueB)
                    : valueB.localeCompare(valueA);
            }
            
            // Handle numeric comparison
            return direction === 'asc'
                ? valueA - valueB
                : valueB - valueA;
        });
    },

    /**
     * Renders the available players table body
     */
    renderAvailablePlayersTable: function() {
        const tbody = document.getElementById('available-players-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        // Create a row for each available player
        TeamPicker.availablePlayers.forEach(player => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50 text-xs'; // Added text-xs
            tr.setAttribute('data-player-name', player.name);
            
            // Add player to team status check
            const isInTeamA = TeamPicker.teamAPlayers.some(p => p.name === player.name);
            const isInTeamB = TeamPicker.teamBPlayers.some(p => p.name === player.name);
            
            if (isInTeamA) {
                tr.classList.add('bg-blue-50');
            } else if (isInTeamB) {
                tr.classList.add('bg-green-50');
            }
            
            // Create cells
            const stats = player.stats || {};
            
            // Determine team name for display
            let teamDisplay = '';
            let removeButton = '';
            
            if (isInTeamA) {
                teamDisplay = `<span class="text-xxs text-blue-600 font-medium">${TeamPicker.teamAName}</span>`;
                removeButton = `<button class="text-xxs text-red-600 hover:text-red-800 font-medium remove-from-team" data-player="${player.name}" data-team="team-a-players">×</button>`;
            } else if (isInTeamB) {
                teamDisplay = `<span class="text-xxs text-green-600 font-medium">${TeamPicker.teamBName}</span>`;
                removeButton = `<button class="text-xxs text-red-600 hover:text-red-800 font-medium remove-from-team" data-player="${player.name}" data-team="team-b-players">×</button>`;
            } else {
                teamDisplay = `<div class="flex gap-1 justify-center">
                    <button class="bg-blue-600 text-white px-1 py-0.5 rounded text-xxs add-to-team" data-team="A">A</button>
                    <button class="bg-green-600 text-white px-1 py-0.5 rounded text-xxs add-to-team" data-team="B">B</button>
                </div>`;
                removeButton = ''; // No remove button if not in a team
            }
            
            // Use global formatStat function
            tr.innerHTML = `
                <td class="px-1 py-1 font-medium">${player.name}</td>
                <td class="px-1 py-1 text-center">${formatStat(stats.L10_HLTV2)}</td>
                <td class="px-1 py-1 text-center">${formatStat(stats.L10_ADR, 0)}</td>
                <td class="px-1 py-1 text-center">${formatStat(stats.L10_KD)}</td>
                <td class="px-1 py-1 text-center">${formatStat(stats.S_HLTV2)}</td>
                <td class="px-1 py-1 text-center">${formatStat(stats.S_ADR, 0)}</td>
                <td class="px-1 py-1 text-center">${formatStat(stats.S_KD)}</td>
                <td class="px-1 py-1 text-center">${teamDisplay}</td>
                <td class="px-1 py-1 text-center">${removeButton}</td>
            `;
            
            // Add event listeners
            if (!isInTeamA && !isInTeamB) {
                // Add to team buttons
                const teamABtn = tr.querySelector('button[data-team="A"]');
                const teamBBtn = tr.querySelector('button[data-team="B"]');
                
                if (teamABtn) teamABtn.addEventListener('click', () => TeamPicker.addPlayerToTeam(player, 'A'));
                if (teamBBtn) teamBBtn.addEventListener('click', () => TeamPicker.addPlayerToTeam(player, 'B'));
            } else {
                // Remove button
                const removeBtn = tr.querySelector('.remove-from-team');
                if (removeBtn) {
                    removeBtn.addEventListener('click', (e) => {
                        const playerName = e.target.dataset.player;
                        const teamContainerId = e.target.dataset.team;
                        TeamPicker.removePlayerFromTeam(playerName, teamContainerId);
                    });
                }
            }
            
            tbody.appendChild(tr);
        });
    },
    
    /**
     * Updates the kabile name for a team
     */
    updateTeamName: function(event) {
        const kabileName = event.target.value;
        const teamId = event.target.id.includes('team-a') ? 'A' : 'B';
        const teamHeading = document.querySelector(`.team-container:nth-child(${teamId === 'A' ? '1' : '2'}) h3`);
        
        // Store the team name in the TeamPicker object
        if (teamId === 'A') {
            TeamPicker.teamAName = kabileName || 'Team A';
        } else {
            TeamPicker.teamBName = kabileName || 'Team B';
        }
        
        if (teamHeading) {
            teamHeading.textContent = teamId === 'A' ? TeamPicker.teamAName : TeamPicker.teamBName;
        }
        
        // Update team names in the map side selection dropdowns
        TeamPicker.updateMapSideTeamNames();
        
        // Update the available players table to show updated team names
        TeamPicker.renderAvailablePlayersTable();
    },
    
    /**
     * Updates team names in all map side selection dropdowns
     */
    updateMapSideTeamNames: function() {
        // Get all side team selection dropdowns
        const sideTeamSelects = [
            document.getElementById('map1-t-team'),
            document.getElementById('map1-ct-team'),
            document.getElementById('map2-t-team'),
            document.getElementById('map2-ct-team'),
            document.getElementById('map3-t-team'),
            document.getElementById('map3-ct-team')
        ];
        
        // Update each dropdown
        sideTeamSelects.forEach(select => {
            if (!select) return;
            
            // Find the options for Team A and Team B
            const teamAOption = select.querySelector('option[value="A"]');
            const teamBOption = select.querySelector('option[value="B"]');
            
            // Update the text content with current team names (from TeamPicker object)
            if (teamAOption) teamAOption.textContent = TeamPicker.teamAName;
            if (teamBOption) teamBOption.textContent = TeamPicker.teamBName;
        });
    },
    
    /**
     * Adds a player to the selected team
     */
    addPlayerToTeam: function(player, teamId) {
        const teamPlayers = teamId === 'A' ? TeamPicker.teamAPlayers : TeamPicker.teamBPlayers;
        
        // Check if player is already in a team
        if (TeamPicker.teamAPlayers.some(p => p.name === player.name) || 
            TeamPicker.teamBPlayers.some(p => p.name === player.name)) {
            // Player is already assigned to a team
            showMessage(`${player.name} is already assigned to a team.`, 'error', 3000); // Use global showMessage
            return;
        }
        
        // Remove team size limit check - Allow teams of any size
        
        // Add player to team
        teamPlayers.push(player);
        
        // Update UI
        TeamPicker.updatePlayerSlots(`team-${teamId.toLowerCase()}-players`, teamPlayers);
        TeamPicker.updateTeamStats(teamId.toLowerCase());
        TeamPicker.renderAvailablePlayersTable();
    },
    
    /**
     * Updates the player card UI to show assignment (Placeholder - handled by renderAvailablePlayersTable)
     */
    updatePlayerCardUI: function(playerName, teamId) {
        // This functionality is now handled by renderAvailablePlayersTable
    },
    
    /**
     * Calculates and displays team statistics
     * @param {string} teamId - 'a' or 'b'
     */
    updateTeamStats: function(teamId) {
        const teamPlayers = teamId === 'a' ? TeamPicker.teamAPlayers : TeamPicker.teamBPlayers;
        const playersContainer = document.getElementById(`team-${teamId}-players`);
        if (!playersContainer) return; // Exit if container not found
        
        // Find or create stats container (this element doesn't seem to exist in HTML?)
        // Let's assume we want to display averages in the table footer/a dedicated row
        // let statsContainer = document.getElementById(`team-${teamId}-stats`); 
        
        // If no players, clear the averages row
        const table = playersContainer.querySelector('table');
        if (table) {
            let averagesRow = table.querySelector('.team-averages-row');
            if (averagesRow && teamPlayers.length === 0) {
                averagesRow.remove(); // Remove the row if no players
                return;
            }
        }
        if (teamPlayers.length === 0) return; // Exit if no players

        
        // Calculate averages
        const statsToCalculate = ['L10_HLTV2', 'L10_ADR', 'L10_KD', 'S_HLTV2', 'S_ADR', 'S_KD'];
        const teamStats = {};
        
        statsToCalculate.forEach(stat => {
            const validValues = teamPlayers
                .map(p => p.stats && p.stats[stat])
                .filter(value => value !== undefined && value !== null && !isNaN(value));
            
            if (validValues.length > 0) {
                const sum = validValues.reduce((acc, val) => acc + val, 0);
                teamStats[stat] = sum / validValues.length;
            } else {
                teamStats[stat] = null;
            }
        });
        
        // Create/Update a table row for team averages
        if (!table) return;
        
        // Use tfoot for semantics, or append to tbody if preferred
        let tfoot = table.querySelector('tfoot');
        if (!tfoot) {
             tfoot = document.createElement('tfoot');
             // Insert tfoot after thead, before tbody if tbody exists
             const tbody = table.querySelector('tbody');
             if(tbody) table.insertBefore(tfoot, tbody);
             else table.appendChild(tfoot);
        }
        
        // Check if the averages row already exists in tfoot
        let averagesRow = tfoot.querySelector('.team-averages-row');
        if (!averagesRow) {
            // Create a new row
            averagesRow = document.createElement('tr');
            averagesRow.className = 'team-averages-row bg-gray-100 font-semibold text-xs'; // Match other table text size
            tfoot.appendChild(averagesRow);
        }
        
        // Set team color based on teamId
        const teamColor = teamId === 'a' ? 'blue-600' : 'green-600';
        
        // Update the averages row content (use global formatStat)
        averagesRow.innerHTML = `
            <td class="p-2 border-t-2 border-${teamId === 'a' ? 'blue' : 'green'}-600 text-${teamColor}">TEAM AVG</td>
            <td class="p-2 text-center border-t-2 border-${teamId === 'a' ? 'blue' : 'green'}-600">${formatStat(teamStats.L10_HLTV2)}</td>
            <td class="p-2 text-center border-t-2 border-${teamId === 'a' ? 'blue' : 'green'}-600">${formatStat(teamStats.L10_ADR, 0)}</td>
            <td class="p-2 text-center border-t-2 border-${teamId === 'a' ? 'blue' : 'green'}-600">${formatStat(teamStats.L10_KD)}</td>
            <td class="p-2 text-center border-t-2 border-${teamId === 'a' ? 'blue' : 'green'}-600">${formatStat(teamStats.S_HLTV2)}</td>
            <td class="p-2 text-center border-t-2 border-${teamId === 'a' ? 'blue' : 'green'}-600">${formatStat(teamStats.S_ADR, 0)}</td>
            <td class="p-2 text-center border-t-2 border-${teamId === 'a' ? 'blue' : 'green'}-600">${formatStat(teamStats.S_KD)}</td>
            <td class="p-2 text-center border-t-2 border-${teamId === 'a' ? 'blue' : 'green'}-600"></td> <!-- Action column -->
        `;
    },
    
    /**
     * Updates the player slots in a team container
     */
    updatePlayerSlots: function(containerId, teamPlayers) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        
        // Create scrollable wrapper
        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'overflow-x-auto'; // Add horizontal scrolling
        
        // Create table for player slots
        const table = document.createElement('table');
        table.className = 'w-full border-collapse text-xs'; // Use text-xs
        
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
                <th class="p-2">Player</th>
                <th class="p-2 text-center">L10 HLT</th>
                <th class="p-2 text-center">L10 ADR</th>
                <th class="p-2 text-center">L10 K/D</th>
                <th class="p-2 text-center">S HLT</th>
                <th class="p-2 text-center">S ADR</th>
                <th class="p-2 text-center">S K/D</th>
                <th class="p-2 text-center">Action</th>
            </tr>
        `;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        
        // Modified to handle any number of players - no more fixed slots
        if (teamPlayers.length === 0) {
            // Show empty state message if no players
            const tr = document.createElement('tr');
            tr.className = 'border-b';
            tr.innerHTML = `
                <td colspan="8" class="p-2 text-center text-gray-400 bg-gray-50 italic">No players added yet</td>
            `;
            tbody.appendChild(tr);
        } else {
            // Create rows for all existing players
            teamPlayers.forEach((player, index) => {
                const tr = document.createElement('tr');
                tr.className = 'border-b';
                
                // Show player with stats
                const stats = player.stats || {};
                
                // Use global formatStat
                tr.innerHTML = `
                    <td class="p-2 font-medium">${player.name}</td>
                    <td class="p-2 text-center">${formatStat(stats.L10_HLTV2)}</td>
                    <td class="p-2 text-center">${formatStat(stats.L10_ADR, 0)}</td>
                    <td class="p-2 text-center">${formatStat(stats.L10_KD)}</td>
                    <td class="p-2 text-center">${formatStat(stats.S_HLTV2)}</td>
                    <td class="p-2 text-center">${formatStat(stats.S_ADR, 0)}</td>
                    <td class="p-2 text-center">${formatStat(stats.S_KD)}</td>
                    <td class="p-2 text-center"></td> <!-- Placeholder for action button -->
                `;

                const actionCell = tr.querySelector('td:last-child'); // Get the last cell
                const removeBtn = document.createElement('button');
                removeBtn.className = 'text-xxs text-red-600 hover:text-red-800 font-medium'; // Smaller text
                removeBtn.textContent = '×'; // Use '×' symbol
                removeBtn.title = `Remove ${player.name}`;
                removeBtn.addEventListener('click', () => TeamPicker.removePlayerFromTeam(player.name, containerId));
                actionCell.appendChild(removeBtn);
                
                tbody.appendChild(tr);
            });
        }
        
        table.appendChild(tbody);
        // Note: Averages row is added/updated in updateTeamStats, potentially in tfoot
        scrollWrapper.appendChild(table); // Add table to scroll wrapper
        container.appendChild(scrollWrapper); // Add scroll wrapper to container
    },
    
    /**
     * Removes a player from a team
     */
    removePlayerFromTeam: function(playerName, containerId) {
        const teamId = containerId.includes('team-a') ? 'A' : 'B';
        const teamLetter = teamId.toLowerCase();
        const teamPlayers = teamId === 'A' ? TeamPicker.teamAPlayers : TeamPicker.teamBPlayers;
        
        // Find and remove player
        const playerIndex = teamPlayers.findIndex(p => p.name === playerName);
        if (playerIndex > -1) {
            teamPlayers.splice(playerIndex, 1);
        }
        
        // Update UI
        TeamPicker.updatePlayerSlots(containerId, teamPlayers);
        TeamPicker.updateTeamStats(teamLetter);
        TeamPicker.renderAvailablePlayersTable();
    },

    /**
     * Sets up event listeners for map side selection dropdowns
     */
    setupMapSideSelectionListeners: function() {
        // Map 1 listeners
        const map1TTeam = document.getElementById('map1-t-team');
        const map1CTTeam = document.getElementById('map1-ct-team');
        
        if (map1TTeam) map1TTeam.addEventListener('change', (e) => TeamPicker.updateOppositeSide(e, map1CTTeam));
        if (map1CTTeam) map1CTTeam.addEventListener('change', (e) => TeamPicker.updateOppositeSide(e, map1TTeam));
        
        // Map 2 listeners
        const map2TTeam = document.getElementById('map2-t-team');
        const map2CTTeam = document.getElementById('map2-ct-team');
        
        if (map2TTeam) map2TTeam.addEventListener('change', (e) => TeamPicker.updateOppositeSide(e, map2CTTeam));
        if (map2CTTeam) map2CTTeam.addEventListener('change', (e) => TeamPicker.updateOppositeSide(e, map2TTeam));
        
        // Map 3 listeners
        const map3TTeam = document.getElementById('map3-t-team');
        const map3CTTeam = document.getElementById('map3-ct-team');
        
        if (map3TTeam) map3TTeam.addEventListener('change', (e) => TeamPicker.updateOppositeSide(e, map3CTTeam));
        if (map3CTTeam) map3CTTeam.addEventListener('change', (e) => TeamPicker.updateOppositeSide(e, map3TTeam));
    },

    /**
     * Updates the opposite side dropdown when one side changes
     * @param {Event} event - The change event
     * @param {HTMLElement} oppositeSelect - The opposite side select element
     */
    updateOppositeSide: function(event, oppositeSelect) {
        if (!oppositeSelect) return;
        
        const selectedTeam = event.target.value;
        
        // If nothing selected, do nothing
        if (!selectedTeam) return;
        
        // Determine the opposite team
        const oppositeTeam = selectedTeam === 'A' ? 'B' : 'A';
        
        // Set the opposite select to the other team
        oppositeSelect.value = oppositeTeam;
    }

}; // End of TeamPicker object


// --- Event Listeners & Initialization ---

// Initial load: Fetch data and show the default page
document.addEventListener('DOMContentLoaded', () => {
    showPage(DEFAULT_PAGE); // Show the initial page
    fetchStatsFromSheet(); // Fetch initial attendance data
    loadAndRenderSeasonAvgTable(); // Fetch and render season average stats
    loadAndRenderLast10Table(); // Fetch and render last 10 games stats
    loadAndRenderNightAvgTable(); // Fetch and render nightly average stats
    loadAndRenderSonMacData(); // Fetch and render Son Maç data
    // initSonMacTabs(); // Called within loadAndRenderSonMacData
    loadAndRenderDuelloSonMacGrid(); 
    loadAndRenderDuelloSezonGrid(); 
    
    // Set initial navigation visibility based on screen size
    adjustNavLayout(); // Use helper function

    // Setup global event listeners
    setupGlobalEventListeners();
});

// Helper function to consolidate global event listener setup
function setupGlobalEventListeners() {
    updateButton.addEventListener('click', fetchStatsFromSheet);
    playerListBody.addEventListener('click', handlePlayerListClick); // Attendance clicks
    navLinksContainer.addEventListener('click', handleNavLinkClick); // Main navigation
    menuButton.addEventListener('click', () => toggleMobileMenu());
    pageContentArea.addEventListener('click', handleSortClick); // Table sorting
    pageContentArea.addEventListener('click', handleDuelloClick); // Duello clicks

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

    // *** REMOVED Team picker specific listener - now handled by showPage ***
    // document.querySelector('[data-page="team_picker"]').addEventListener('click', TeamPicker.init);
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
function handleDuelloClick(event) {
    // Check if the click originated within either duello table
    const duelloSonMacTable = event.target.closest('#duello-table');
    const duelloSezonTable = event.target.closest('#duello-sezon-table');
    if (duelloSonMacTable || duelloSezonTable) {
        const clickedCircle = event.target.closest('.duello-circle');
        if (clickedCircle) {
            const killer = clickedCircle.dataset.killer;
            const killed = clickedCircle.dataset.killed;
            const count = clickedCircle.dataset.count;
            if (killer && killed && count) {
                const message = `${killer} killed ${killed} ${count} times`;
                showMessage(message, 'success', 3000); 
            }
        }
    }
}

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
