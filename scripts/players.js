/* global Chart, StatsTables, showMessage */

// --- Configuration for Selectable Pentagon Stats ---
const SELECTABLE_STATS = {
    hltv_2: { label: 'HLTV 2.0', default: true },
    adr: { label: 'ADR', default: true },
    kd: { label: 'K/D', default: true },
    hs_ratio: { label: 'HS/Kill %', default: true, format: 'percent' },
    win_rate: { label: 'Win Rate %', default: true, format: 'percent' },
    kast: { label: 'KAST', default: false, format: 'percent' },
    utl_dmg: { label: 'Utility Dmg', default: false }, // Shortened label
    first_kill: { label: 'First Kill Avg', default: false },
    clutch_success: { label: 'Clutch Win %', default: false, format: 'percent' }, // Shortened label
    assists: { label: 'Assists Avg', default: false }
};
const PENTAGON_STAT_LIMIT = 5;

// Encapsulate chart-specific logic
const PlayerCharts = {
    // PENTAGON_STATS is now implicitly defined by the selection
    // playerChartInstances holds the Chart instances
    playerChartInstances: {},

    /**
     * Calculates the min/max ranges for a given list of stats from the player data.
     * Only considers players with matches > 0.
     * @param {Object.<string, object>} playersData - Object keyed by player names.
     * @param {Array<string>} statsToProcess - Array of stat keys (e.g., ['adr', 'kd']).
     * @returns {Object.<string, {min: number, max: number}>} Calculated ranges.
     */
    calculateStatRanges: function(playersData, statsToProcess) { // Modified to accept stats list
        const ranges = {};

        statsToProcess.forEach(stat => {
            ranges[stat] = { min: Infinity, max: -Infinity };
        });

        const activePlayers = Object.values(playersData).filter(p => p && typeof p.matches === 'number' && p.matches > 0);

        activePlayers.forEach(player => {
            statsToProcess.forEach(stat => {
                const value = player[stat];
                if (typeof value === 'number' && !isNaN(value)) {
                    if (value < ranges[stat].min) ranges[stat].min = value;
                    if (value > ranges[stat].max) ranges[stat].max = value;
                }
            });
        });

        statsToProcess.forEach(stat => {
            if (ranges[stat].min === Infinity) {
                ranges[stat].min = 0;
                // Simple default max, refine if needed based on stat type
                ranges[stat].max = (stat === 'adr' || stat.includes('ratio') || stat.includes('rate') || stat.includes('success') || stat === 'kast') ? 100 : 1.5;
            } else if (ranges[stat].min === ranges[stat].max) {
                const val = ranges[stat].min;
                const buffer = Math.abs(val * 0.1) || 0.1;
                ranges[stat].min = val - buffer;
                ranges[stat].max = val + buffer;
                if (val >= 0 && ranges[stat].min < 0) ranges[stat].min = 0;
            }
        });
        return ranges;
    },

    /**
     * Normalizes a single stat value based on pre-calculated ranges for *all* stats.
     * @param {number} value - The raw stat value.
     * @param {string} stat - The key of the stat (e.g., 'adr').
     * @param {Object.<string, {min: number, max: number}>} allStatRanges - The pre-calculated min/max ranges for ALL selectable stats.
     * @returns {number} The normalized value (0-100), or 0 if normalization fails.
     */
    normalizeStat: function(value, stat, allStatRanges) { // Takes ALL ranges
        const range = allStatRanges[stat]; // Look up the specific stat's range
        if (!range || range.max === range.min || typeof value !== 'number' || isNaN(value)) {
            return 0;
        }
        const normalized = ((value - range.min) / (range.max - range.min)) * 100;
        return Math.max(0, Math.min(100, normalized)); // Clamp between 0 and 100
    },

    /**
     * Renders the pentagon chart on a specific canvas using selected stats.
     * @param {object} playerData - The player's stats.
     * @param {string} canvasId - The ID of the canvas element.
     * @param {Object.<string, string>} selectedStats - Object of selected stats {key: label, ...}.
     * @param {Object.<string, {min: number, max: number}>} allStatRanges - Pre-calculated ranges for ALL selectable stats.
     */
    renderPentagonChart: function(playerData, canvasId, selectedStats, allStatRanges) { // Added selectedStats param
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            console.error(`Pentagon chart canvas with id '${canvasId}' not found!`);
            return;
        }

        const labels = Object.values(selectedStats); // Use labels from selected stats
        // Normalize data for the selected stats using the comprehensive ranges
        const data = Object.keys(selectedStats).map(statKey =>
            this.normalizeStat(playerData[statKey], statKey, allStatRanges)
        );

        const chartData = {
            labels: labels,
            datasets: [{
                label: `${playerData.name}'s Stats`,
                data: data,
                fill: true,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgb(54, 162, 235)',
                pointBackgroundColor: 'rgb(54, 162, 235)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(54, 162, 235)',
                borderWidth: 1.5,
                pointRadius: 2,
                pointHoverRadius: 4
            }]
        };

        const options = {
            responsive: true,
            scales: {
                r: {
                    angleLines: { display: true, lineWidth: 0.5, color: 'rgba(0, 0, 0, 0.1)' },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false, stepSize: 25, backdropColor: 'rgba(0, 0, 0, 0)' },
                    pointLabels: { font: { size: 7, weight: 'bold' }, color: '#4b5563' },
                    grid: { color: 'rgba(0, 0, 0, 0.08)', lineWidth: 0.5 }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: (context) => {
                            // Get the stat key corresponding to the hovered point
                            const statKey = Object.keys(selectedStats)[context.dataIndex];
                            const originalValueRaw = playerData[statKey];
                            let originalValueFormatted = 'N/A';
                            // Check SELECTABLE_STATS for formatting hints
                            const statConfig = SELECTABLE_STATS[statKey];
                            if (statKey === 'kd') {
                                originalValueFormatted = originalValueRaw.toFixed(2);
                            } else if (statConfig && statConfig.format === 'percent') {
                                originalValueFormatted = originalValueRaw.toFixed(1) + '%';
                            } else {
                                originalValueFormatted = originalValueRaw.toFixed(1);
                            }
                            return `${context.label}: ${originalValueFormatted}`; // Show actual formatted value on hover
                        }
                    }
                }
            },
            layout: { padding: 5 }
        };

        // Destroy previous chart instance for this canvas if it exists
        if (this.playerChartInstances[canvasId]) {
            this.playerChartInstances[canvasId].destroy();
        }

        // Create new chart instance and store it using the PlayerCharts scope
        this.playerChartInstances[canvasId] = new Chart(ctx, {
            type: 'radar',
            data: chartData,
            options: options
        });
    }
};

// --- End PlayerCharts Object ---

// --- Utility Functions (can be used globally) ---

/**
 * Converts an array of player stat objects into an object keyed by player name.
 * @param {Array<object>} statsArray - Array of player stat objects.
 * @returns {Object.<string, object>} Object keyed by player name.
 */
function convertStatsArrayToObject(statsArray) {
    const statsObject = {};
    if (!Array.isArray(statsArray)) {
        console.error("Cannot convert stats: Input is not an array.");
        return statsObject;
    }
    statsArray.forEach(player => {
        if (player && player.name) {
            statsObject[player.name] = player;
        }
    });
    return statsObject;
}

/**
 * Creates a player card element structure (HTML only) for graph views.
 * Includes placeholder pic, name, and a container for the chart canvas.
 * Does NOT render the chart itself.
 * @param {object} playerData - The stats object for the player.
 * @param {HTMLElement} container - The grid container element where the card will be appended.
 * @returns {string} The unique canvas ID created for this card's canvas.
 */
function createPlayerCard(playerData, container) {
    const card = document.createElement('div');
    card.className = 'player-card border rounded-lg bg-white shadow p-3 flex flex-col items-center text-center';
    card.dataset.playerName = playerData.name;

    /* Commented out Picture Placeholder
    const picDiv = document.createElement('div');
    picDiv.className = 'w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center mb-2';
    picDiv.innerHTML = '<span class="text-gray-500 text-xs">Pic</span>';
    card.appendChild(picDiv);
    */

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'text-base font-semibold text-gray-800 mb-2';
    nameSpan.textContent = playerData.name;
    card.appendChild(nameSpan);

    // Canvas Container (for sizing)
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'w-full relative'; // REMOVED h-48
    card.appendChild(canvasContainer);

    // Canvas for Chart
    const canvas = document.createElement('canvas');
    // Generate a unique ID - sanitize name slightly just in case
    const canvasId = `player-chart-${playerData.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    canvas.id = canvasId;
    canvas.width = 200; // Base width
    canvas.height = 192; // Base height (adjust with container)
    canvasContainer.appendChild(canvas);

    container.appendChild(card);
    return canvasId;
}

// --- Functions specific to the "Players" Tab Initialization ---

let isPlayersPageInitialized = false;
let allPlayerStatRanges = {}; // Store ranges calculated on init
let allPlayersData = {}; // Store the raw player data

// --- DOM Element References --- (Define elements used in this specific section)
let playerGridElement = null;
let statCheckboxContainer = null;
let updateGraphsButton = null;
let statValidationMsgElement = null;
let playerStatSelectorToggle = null;
let playerStatSelectorContent = null;
let playerStatArrow = null;

/** Helper to get currently selected stats from checkboxes */
function getSelectedPentagonStats() {
    const selected = {};
    const checkboxes = statCheckboxContainer.querySelectorAll('.pentagon-stat-option:checked');
    checkboxes.forEach(cb => {
        selected[cb.dataset.statKey] = cb.dataset.statLabel;
    });
    return selected;
}

/** Helper to update the validation message and button state */
function updateStatSelectionUI() {
    const selectedCount = Object.keys(getSelectedPentagonStats()).length;
    const checkboxes = statCheckboxContainer.querySelectorAll('.pentagon-stat-option');

    if (selectedCount === PENTAGON_STAT_LIMIT) {
        statValidationMsgElement.textContent = ''; // Clear message
        updateGraphsButton.disabled = false;
        updateGraphsButton.classList.remove('opacity-50', 'cursor-not-allowed');
        // Disable unchecked boxes
        checkboxes.forEach(cb => {
            if (!cb.checked) {
                cb.disabled = true;
            }
        });
    } else {
        statValidationMsgElement.textContent = `Select ${PENTAGON_STAT_LIMIT} stats (${selectedCount} selected)`;
        updateGraphsButton.disabled = true;
        updateGraphsButton.classList.add('opacity-50', 'cursor-not-allowed');
        // Re-enable all checkboxes
        checkboxes.forEach(cb => {
            cb.disabled = false;
        });
    }
}

/** Event handler for checkbox changes */
function handleCheckboxChange() {
    updateStatSelectionUI();
}

/** Event handler for the Update Graphs button */
function handleUpdateGraphsClick() {
    console.log("Updating player graphs with selected stats...");
    const selectedStats = getSelectedPentagonStats();

    if (Object.keys(selectedStats).length !== PENTAGON_STAT_LIMIT) {
        statValidationMsgElement.textContent = `Error: Please select exactly ${PENTAGON_STAT_LIMIT} stats.`;
        return;
    }

    // Re-render all charts using the stored raw data and ranges
    const activePlayers = Object.values(allPlayersData)
        .filter(p => p && typeof p.matches === 'number' && p.matches > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

    activePlayers.forEach(playerData => {
        const canvasId = `player-chart-${playerData.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        // Render with the NEW selected stats and the initially calculated ranges for ALL stats
        PlayerCharts.renderPentagonChart(playerData, canvasId, selectedStats, allPlayerStatRanges);
    });

    console.log("Player graphs updated.");
    statValidationMsgElement.textContent = 'Graphs updated!'; // Feedback
    setTimeout(() => { statValidationMsgElement.textContent = ''; }, 2000); // Clear feedback after 2s
}

/** Populate checkboxes in the selector */
function populateStatCheckboxes() {
    statCheckboxContainer.innerHTML = ''; // Clear any placeholders
    Object.entries(SELECTABLE_STATS).forEach(([key, config]) => {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.className = 'inline-flex items-center';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 pentagon-stat-option';
        input.dataset.statKey = key;
        input.dataset.statLabel = config.label;
        input.checked = config.default;
        input.addEventListener('change', handleCheckboxChange); // Add listener

        const span = document.createElement('span');
        span.className = 'ml-2 text-sm text-gray-700';
        span.textContent = config.label;

        label.appendChild(input);
        label.appendChild(span);
        div.appendChild(label);
        statCheckboxContainer.appendChild(div);
    });
}

async function initializePlayersPage() {
    if (isPlayersPageInitialized) {
        // console.log('Players page already initialized.');
        return;
    }
    console.log("Initializing Players Page - Grid View with Stat Selection...");

    // --- Get DOM Elements --- Find elements specific to this page
    playerGridElement = document.getElementById('player-grid');
    statCheckboxContainer = document.getElementById('pentagon-stat-checkboxes');
    updateGraphsButton = document.getElementById('update-player-graphs-btn');
    statValidationMsgElement = document.getElementById('player-stat-validation-msg');
    playerStatSelectorToggle = document.getElementById('player-stat-selector-toggle');
    playerStatSelectorContent = document.getElementById('player-stat-selector-content');
    playerStatArrow = document.getElementById('player-stat-arrow');

    if (!playerGridElement || !statCheckboxContainer || !updateGraphsButton || !statValidationMsgElement || !playerStatSelectorToggle || !playerStatSelectorContent || !playerStatArrow) {
        console.error("One or more required elements for Players page stat selection not found!");
        return;
    }

    playerGridElement.innerHTML = '<div class="text-center py-8 text-gray-500 col-span-full">Loading player data...</div>';
    populateStatCheckboxes(); // Create checkboxes from config
    updateStatSelectionUI(); // Set initial UI state (button disabled if defaults != 5)

    // --- Get Data from StatsTables ---
    if (typeof StatsTables === 'undefined' || !StatsTables.seasonStats) {
        console.error("StatsTables module or seasonStats data is not available.");
        playerGridElement.innerHTML = '<div class="text-center py-8 text-red-500 col-span-full">Error: Core stats data not loaded. Please refresh.</div>';
        return;
    }

    const seasonStatsArray = StatsTables.seasonStats;
    allPlayersData = convertStatsArrayToObject(seasonStatsArray); // Store raw data

    if (Object.keys(allPlayersData).length === 0) {
        console.warn("No season average player data found after checking StatsTables.");
        playerGridElement.innerHTML = '<div class="text-center py-8 text-gray-500 col-span-full">No player season data available.</div>';
        return;
    }

    // Calculate ranges based on ALL selectable stats ONCE
    const allSelectableStatKeys = Object.keys(SELECTABLE_STATS);
    allPlayerStatRanges = PlayerCharts.calculateStatRanges(allPlayersData, allSelectableStatKeys);

    // Filter active players for display
    const activePlayersData = Object.values(allPlayersData)
                                    .filter(p => p.matches > 0)
                                    .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

    if (activePlayersData.length === 0) {
         playerGridElement.innerHTML = '<div class="text-center py-8 text-gray-500 col-span-full">No active players found in season data.</div>';
         return;
    }

    // --- Render Initial Player Cards --- (Using default stats)
    playerGridElement.innerHTML = ''; // Clear loading message
    const initialSelectedStats = getSelectedPentagonStats(); // Get defaults from HTML/config

    activePlayersData.forEach(playerData => {
        // 1. Create the card structure
        const canvasId = createPlayerCard(playerData, playerGridElement);
        // 2. Render the initial chart with default stats
        setTimeout(() => {
            PlayerCharts.renderPentagonChart(playerData, canvasId, initialSelectedStats, allPlayerStatRanges);
        }, 0);
    });
    // --- End Render Initial Player Cards ---

    // --- Add Event Listeners ---
    updateGraphsButton.addEventListener('click', handleUpdateGraphsClick);
    // Checkbox listeners are added during populateStatCheckboxes
    playerStatSelectorToggle.addEventListener('click', () => {
        playerStatSelectorContent.classList.toggle('hidden');
        playerStatArrow.classList.toggle('rotate-180');
    });

    isPlayersPageInitialized = true;
}

// Make the initialization function globally accessible
window.initializePlayersPage = initializePlayersPage;

// Optional: Add message display function if not globally available
function displayMessage(message, type = 'info') {
     const messageArea = document.getElementById('message-area'); // Assuming you have a message area element
     if (!messageArea) return;
    const colors = {
        info: 'bg-blue-100 border-blue-500 text-blue-700',
        success: 'bg-green-100 border-green-500 text-green-700',
        warning: 'bg-yellow-100 border-yellow-500 text-yellow-700',
        error: 'bg-red-100 border-red-500 text-red-700'
    };
    messageArea.className = `p-4 mb-4 border rounded ${colors[type] || colors.info}`;
    messageArea.textContent = message;
    messageArea.classList.remove('hidden');
    // Optional: Auto-hide after some time
    // setTimeout(() => messageArea.classList.add('hidden'), 5000);
} 