/* global Chart, StatsTables, showMessage */

// --- Configuration for Selectable Pentagon Stats (Potentially used by other graph tabs) ---
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
const PENTAGON_STAT_LIMIT = 5; // Also used by other graph tabs

// Encapsulate chart-specific logic (Used by other graph tabs)
const PlayerCharts = {
    // playerChartInstances holds the Chart instances for various pages
    playerChartInstances: {},

    /**
     * Calculates the min/max ranges for a given list of stats from the player data.
     * Only considers players with matches > 0.
     * @param {Object.<string, object>} playersData - Object keyed by player names.
     * @param {Array<string>} statsToProcess - Array of stat keys (e.g., ['adr', 'kd']).
     * @returns {Object.<string, {min: number, max: number}>} Calculated ranges.
     */
    calculateStatRanges: function(playersData, statsToProcess) {
        const ranges = {};

        statsToProcess.forEach(stat => {
            ranges[stat] = { min: Infinity, max: -Infinity };
        });

        const allPlayers = Object.values(playersData);

        // Conditionally filter players: Only filter by matches > 0 if the 'matches' property exists
        const playersToConsider = allPlayers.length > 0 && allPlayers[0].hasOwnProperty('matches')
            ? allPlayers.filter(p => p && typeof p.matches === 'number' && p.matches > 0)
            : allPlayers; // If no 'matches' property, consider all players

        // Handle case where no players meet criteria or input was empty
        if (playersToConsider.length === 0) {
            //  console.warn("No players found to calculate ranges from after filtering (or initial data empty).");
             // Return ranges with default 0-1 values to avoid errors, though charts might be blank
             statsToProcess.forEach(stat => {
                 ranges[stat] = { min: 0, max: 1 };
             });
             return ranges;
        }

        playersToConsider.forEach(player => {
            statsToProcess.forEach(stat => {
                const value = player[stat];
                if (typeof value === 'number' && !isNaN(value)) {
                    if (value < ranges[stat].min) ranges[stat].min = value;
                    if (value > ranges[stat].max) ranges[stat].max = value;
                }
            });
        });

        statsToProcess.forEach(stat => {
            // Ensure min/max are valid numbers and handle edge cases
            if (!isFinite(ranges[stat].min)) {
                ranges[stat].min = 0;
                 // Simple default max, refine if needed based on stat type
                 ranges[stat].max = (stat === 'adr' || stat.includes('ratio') || stat.includes('rate') || stat.includes('success') || stat === 'kast') ? 100 : 1.5;
            } else if (ranges[stat].min === ranges[stat].max) {
                 // If all values are the same, create a small range around it
                 const val = ranges[stat].min;
                 const buffer = Math.abs(val * 0.1) || 0.1; // Add 10% buffer or 0.1 if value is 0
                 ranges[stat].min = val - buffer;
                 ranges[stat].max = val + buffer;
                 // Prevent min from going below 0 if the original value was non-negative
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
     * @param {Object.<string, {label: string, format?: string}>} selectedStatsConfig - Config object for the 5 selected stats.
     * @param {Object.<string, {min: number, max: number}>} allStatRanges - Pre-calculated ranges for ALL selectable stats.
     */
    renderPentagonChart: function(playerData, canvasId, selectedStatsConfig, allStatRanges) { // Changed param name
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            console.error(`Pentagon chart canvas with id '${canvasId}' not found!`);
            return;
        }

        const labels = Object.values(selectedStatsConfig).map(config => config.label); // Get labels from config
        const statKeys = Object.keys(selectedStatsConfig); // Get keys for tooltip lookup

        // Normalize data for the selected stats using the comprehensive ranges
        const data = statKeys.map(statKey =>
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

        const isDarkMode = document.body.classList.contains('dark-theme');
        // console.log(`[renderPentagonChart - ${canvasId}] isDarkMode:`, isDarkMode); // <<< Log the theme status

        const options = {
            responsive: true,
            scales: {
                r: {
                    angleLines: { 
                        display: true, 
                        lineWidth: 0.5, 
                        // Darker gray for light mode, light gray for dark mode
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)' // Increased light mode opacity 
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false, stepSize: 25, backdropColor: 'rgba(0, 0, 0, 0)' },
                    pointLabels: { 
                        font: { size: 7, weight: 'bold' }, 
                        // Use lighter gray for dark mode, very dark gray for light mode
                        color: isDarkMode ? '#f3f4f6' : '#1f2937' 
                    },
                    grid: { 
                        // Darker gray grid for light mode, light gray for dark mode
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.3)', // Increased light mode opacity
                        lineWidth: 0.5 
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: (context) => {
                            // Get the stat key corresponding to the hovered point
                            const statKey = statKeys[context.dataIndex]; // Use keys derived above
                            const originalValueRaw = playerData[statKey];
                            let originalValueFormatted = 'N/A';

                            // Use format hint from the passed-in config
                            const statConfig = selectedStatsConfig[statKey];

                            if (typeof originalValueRaw === 'number' && !isNaN(originalValueRaw)) {
                                if (statConfig && statConfig.format === 'percent') {
                                    originalValueFormatted = originalValueRaw.toFixed(1) + '%';
                                } else if (statConfig && statConfig.format === 'decimal2') {
                                    originalValueFormatted = originalValueRaw.toFixed(2);
                                } else if (statConfig && statConfig.format === 'decimal1') {
                                    originalValueFormatted = originalValueRaw.toFixed(1);
                                } else { // Default to decimal 0 or raw if no specific format
                                     originalValueFormatted = (originalValueRaw % 1 === 0) ? originalValueRaw.toFixed(0) : originalValueRaw.toFixed(2); // Show decimals only if needed
                                }
                            }

                            return `${context.label}: ${originalValueFormatted}`;
                        }
                    }
                }
            },
            layout: { padding: 5 }
        };

        // console.log(`[renderPentagonChart - ${canvasId}] Assigned pointLabel color:`, options.scales.r.pointLabels.color); // <<< Log the assigned color

        // Destroy previous chart instance for this canvas if it exists
        if (this.playerChartInstances[canvasId]) {
            this.playerChartInstances[canvasId].destroy();
        }

        // Create new chart instance and store it
        this.playerChartInstances[canvasId] = new Chart(ctx, {
            type: 'radar',
            data: chartData,
            options: options
        });
    },

    /**
     * Renders an overlay pentagon chart comparing two players on a specific canvas.
     * @param {object} player1Data - The first player's stats.
     * @param {object} player2Data - The second player's stats.
     * @param {string} canvasId - The ID of the canvas element.
     * @param {Object.<string, {label: string, format?: string}>} selectedStatsConfig - Config object for the 5 selected stats.
     * @param {Object.<string, {min: number, max: number}>} allStatRanges - Pre-calculated ranges for ALL selectable stats.
     */
    renderOverlayPentagonChart: function(player1Data, player2Data, canvasId, selectedStatsConfig, allStatRanges) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            console.error(`Overlay pentagon chart canvas with id '${canvasId}' not found!`);
            return;
        }

        const labels = Object.values(selectedStatsConfig).map(config => config.label);
        const statKeys = Object.keys(selectedStatsConfig);

        // Normalize data for both players using the comprehensive ranges
        const data1 = statKeys.map(statKey =>
            this.normalizeStat(player1Data[statKey], statKey, allStatRanges)
        );
        const data2 = statKeys.map(statKey =>
            this.normalizeStat(player2Data[statKey], statKey, allStatRanges)
        );

        const chartData = {
            labels: labels,
            datasets: [
                {
                    label: `${player1Data.name}`,
                    data: data1,
                    fill: true,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)', // Blue
                    borderColor: 'rgb(54, 162, 235)',
                    pointBackgroundColor: 'rgb(54, 162, 235)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(54, 162, 235)',
                    borderWidth: 1.5,
                    pointRadius: 2,
                    pointHoverRadius: 4
                },
                {
                    label: `${player2Data.name}`,
                    data: data2,
                    fill: true,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)', // Red
                    borderColor: 'rgb(255, 99, 132)',
                    pointBackgroundColor: 'rgb(255, 99, 132)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(255, 99, 132)',
                    borderWidth: 1.5,
                    pointRadius: 2,
                    pointHoverRadius: 4
                }
            ]
        };

        const isDarkMode = document.body.classList.contains('dark-theme');

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { display: true, lineWidth: 0.5, color: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)' },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false, stepSize: 25, backdropColor: 'rgba(0, 0, 0, 0)' },
                    pointLabels: { font: { size: 9, weight: 'bold' }, color: isDarkMode ? '#f3f4f6' : '#1f2937' }, // Slightly larger font
                    grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.3)', lineWidth: 0.5 }
                }
            },
            plugins: {
                legend: { // Display legend for comparison
                    display: true,
                    position: 'top',
                    labels: {
                         color: isDarkMode ? '#f3f4f6' : '#1f2937',
                         boxWidth: 12,
                         padding: 10,
                         font: { size: 10 }
                     }
                 },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: (context) => {
                            const datasetLabel = context.dataset.label || 'Player';
                            const statKey = statKeys[context.dataIndex];
                            // Determine which player's data this point belongs to
                            const playerData = (context.datasetIndex === 0) ? player1Data : player2Data;
                            const originalValueRaw = playerData[statKey];
                            let originalValueFormatted = 'N/A';
                            const statConfig = selectedStatsConfig[statKey];

                            if (typeof originalValueRaw === 'number' && !isNaN(originalValueRaw)) {
                                if (statConfig?.format === 'percent') originalValueFormatted = originalValueRaw.toFixed(1) + '%';
                                else if (statConfig?.format === 'decimal2') originalValueFormatted = originalValueRaw.toFixed(2);
                                else if (statConfig?.format === 'decimal1') originalValueFormatted = originalValueRaw.toFixed(1);
                                else originalValueFormatted = (originalValueRaw % 1 === 0) ? originalValueRaw.toFixed(0) : originalValueRaw.toFixed(2);
                            }
                            return `${datasetLabel} - ${context.label}: ${originalValueFormatted}`;
                        }
                    }
                }
            },
            layout: { padding: 10 } // Increased padding for labels/legend
        };

        // Destroy previous chart instance
        if (this.playerChartInstances[canvasId]) {
            this.playerChartInstances[canvasId].destroy();
        }

        // Create new chart instance
        this.playerChartInstances[canvasId] = new Chart(ctx, {
            type: 'radar',
            data: chartData,
            options: options
        });
    }
};

// --- End PlayerCharts Object ---

// --- Utility Functions (Potentially used globally) ---

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
 * Used by other graph tabs.
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

// --- End Utility Functions ---