/* global Chart, StatsTables, showMessage, sortData, setInitialSortState, applyHeatmapToColumn */

const PENTAGON_STATS = {
    hltv_2: 'HLTV 2.0',
    adr: 'ADR',
    kd: 'K/D',
    hs_ratio: 'HS/Kill %',
    win_rate: 'Win Rate %'
};

let statRanges = {}; // Still needed for normalization
let isPlayersPageInitialized = false;
let playerChartInstances = {}; // Object to hold chart instances if needed for updates

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

function calculateStatRanges(playersData) { // playersData is an object {playerName: data}
    const ranges = {};
    const statsToProcess = Object.keys(PENTAGON_STATS);

    statsToProcess.forEach(stat => {
        ranges[stat] = { min: Infinity, max: -Infinity };
    });

    // Filter for players with matches > 0 before calculating ranges
    const activePlayers = Object.values(playersData).filter(p => p.matches > 0);

    activePlayers.forEach(player => {
        statsToProcess.forEach(stat => {
            const value = player[stat];
            if (typeof value === 'number' && !isNaN(value)) {
                if (value < ranges[stat].min) ranges[stat].min = value;
                if (value > ranges[stat].max) ranges[stat].max = value;
            } else {
                 // console.warn(`Missing or invalid stat '${stat}' for player ${player.name}`);
            }
        });
    });

     // Ensure min isn't equal to max and provide defaults
    statsToProcess.forEach(stat => {
        if (ranges[stat].min === Infinity) { 
            ranges[stat].min = 0;
            ranges[stat].max = (stat === 'adr') ? 100 : (stat === 'win_rate' || stat === 'hs_ratio') ? 100 : 1.5; // Sensible defaults
        } else if (ranges[stat].min === ranges[stat].max) {
            const val = ranges[stat].min;
             // Avoid setting 0 range if value is 0, give a small positive range
             const buffer = Math.abs(val * 0.1) || 0.1; // 10% buffer or 0.1 if value is 0
             ranges[stat].min = val - buffer;
             ranges[stat].max = val + buffer;
             // Ensure min is not negative if original value wasn't (e.g. win rate)
             if (val >= 0 && ranges[stat].min < 0) ranges[stat].min = 0;
        }
    });

    console.log("Calculated Stat Ranges (Active Players Only):", ranges);
    return ranges;
}

/**
 * Creates a player card element including placeholder pic, name, and chart canvas.
 * Does NOT render the chart itself.
 * @param {object} playerData - The stats object for the player.
 * @param {HTMLElement} container - The grid container element.
 * @returns {string} The unique canvas ID created for this card.
 */
function createPlayerCard(playerData, container) {
    const card = document.createElement('div');
    card.className = 'player-card border rounded-lg bg-white shadow p-3 flex flex-col items-center text-center';
    card.dataset.playerName = playerData.name;

    // Picture Placeholder
    const picDiv = document.createElement('div');
    picDiv.className = 'w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center mb-2';
    picDiv.innerHTML = '<span class="text-gray-500 text-xs">Pic</span>';
    card.appendChild(picDiv);

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'text-base font-semibold text-gray-800 mb-2';
    nameSpan.textContent = playerData.name;
    card.appendChild(nameSpan);

    // Canvas Container (for sizing)
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'w-full h-48 relative'; // Adjust height as needed
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

function normalizeStat(value, stat) {
    const range = statRanges[stat];
    if (!range || range.max === range.min || typeof value !== 'number' || isNaN(value)) {
        // console.warn(`Normalization failed for ${stat} with value ${value}. Range:`, range);
        return 0;
    }
    const normalized = ((value - range.min) / (range.max - range.min)) * 100;
    return Math.max(0, Math.min(100, normalized));
}

/**
 * Renders the pentagon chart on a specific canvas.
 * @param {object} playerData - The player's stats.
 * @param {string} canvasId - The ID of the canvas element.
 */
function renderPentagonChart(playerData, canvasId) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) {
        console.error(`Pentagon chart canvas with id '${canvasId}' not found!`);
        return;
    }

    const labels = Object.values(PENTAGON_STATS);
    const data = Object.keys(PENTAGON_STATS).map(stat => normalizeStat(playerData[stat], stat));

    // console.log(`Rendering chart for ${playerData.name} (${canvasId}) with data:`, data);

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
            borderWidth: 1.5, // Slightly thicker line
            pointRadius: 2, // Smaller points
            pointHoverRadius: 4
        }]
    };

    const options = {
        maintainAspectRatio: false, // Let the container div control aspect ratio
        responsive: true,
        scales: {
            r: {
                angleLines: { display: true, lineWidth: 0.5, color: 'rgba(0, 0, 0, 0.1)' }, // Thinner angle lines
                suggestedMin: 0,
                suggestedMax: 100,
                ticks: {
                    display: false,
                    stepSize: 25,
                    backdropColor: 'rgba(0, 0, 0, 0)'
                },
                pointLabels: {
                     font: {
                        size: 9 // Smaller font for labels on cards
                    },
                    color: '#4b5563' // Darker gray for labels
                },
                 grid: {
                     color: 'rgba(0, 0, 0, 0.08)', // Even Lighter grid lines
                     lineWidth: 0.5
                 }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: true,
                callbacks: {
                    label: function(context) {
                        const statKey = Object.keys(PENTAGON_STATS)[context.dataIndex];
                        const originalValue = playerData[statKey]?.toFixed(statKey === 'kd' ? 2 : 1) ?? 'N/A';
                        return `${context.label}: ${originalValue}`; // Show actual value on hover
                    }
                }
            }
        },
        // Reduce padding around the chart area
        layout: {
            padding: 0
        }
    };

    // Destroy previous chart instance for this canvas if it exists
    if (playerChartInstances[canvasId]) {
        playerChartInstances[canvasId].destroy();
    }

    // Create new chart instance and store it
    playerChartInstances[canvasId] = new Chart(ctx, {
        type: 'radar',
        data: chartData,
        options: options
    });
}

// REMOVED displayPlayerStats function


async function initializePlayersPage() {
    if (isPlayersPageInitialized) {
        // console.log('Players page already initialized.');
        return;
    }
    console.log("Initializing Players Page - Grid View...");

    const playerGrid = document.getElementById('player-grid');
    if (!playerGrid) {
        console.error("Player grid element not found!");
        return;
    }

    playerGrid.innerHTML = '<div class="text-center py-8 text-gray-500 col-span-full">Loading player data...</div>'; // Use full span

    // --- Get Data from StatsTables --- 
    if (typeof StatsTables === 'undefined' || !StatsTables.seasonStats) {
        console.error("StatsTables module or seasonStats data is not available.");
        playerGrid.innerHTML = '<div class="text-center py-8 text-red-500 col-span-full">Error: Core stats data not loaded. Please refresh.</div>';
        return;
    }

    const seasonStatsArray = StatsTables.seasonStats;
    const allPlayersSeasonData = convertStatsArrayToObject(seasonStatsArray);

    if (Object.keys(allPlayersSeasonData).length === 0) {
        console.warn("No season average player data found after checking StatsTables.");
        playerGrid.innerHTML = '<div class="text-center py-8 text-gray-500 col-span-full">No player season data available.</div>';
        return;
    }

    // Calculate ranges based on *active* players ONLY
    statRanges = calculateStatRanges(allPlayersSeasonData); // Pass the full object, function filters inside

    // Filter active players for display
    const activePlayersData = Object.values(allPlayersSeasonData)
                                    .filter(p => p.matches > 0)
                                    .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

    if (activePlayersData.length === 0) {
         playerGrid.innerHTML = '<div class="text-center py-8 text-gray-500 col-span-full">No active players found in season data.</div>';
         return;
    }

    // --- Render Player Cards --- 
    playerGrid.innerHTML = ''; // Clear loading message
    activePlayersData.forEach(playerData => {
        // 1. Create the card structure and get the canvas ID
        const canvasId = createPlayerCard(playerData, playerGrid);
        // 2. Render the chart onto the newly created canvas
        // Use a minimal timeout to ensure the canvas is in the DOM before Chart.js tries to use it
        // This is sometimes needed, especially when creating many charts rapidly.
        setTimeout(() => {
            renderPentagonChart(playerData, canvasId);
        }, 0); 
    });
    // --- End Render Player Cards ---

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