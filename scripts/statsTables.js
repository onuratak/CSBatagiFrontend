/* global showMessage, formatStat, applyHeatmapToColumn, setInitialSortState, PlayerCharts, createPlayerCard, convertStatsArrayToObject */ // Added PlayerCharts dependencies
/* global SEASON_AVG_JSON_URL, LAST10_JSON_URL, NIGHT_AVG_JSON_URL */ // Assume these are defined globally or imported

// --- Constants --- (Moved outside IIFE for potential reuse if needed)
const PENTAGON_STAT_LIMIT_STATS = 5;

const StatsTables = (() => {
    let seasonStats = null;
    let last10Stats = null;
    let nightAvgStats = null;

    // --- State specific to Season Avg Graph View ---
    let seasonAvgGraphPopulated = false;
    let seasonAvgSelectableStats = {}; // { key: { label: '...', format: '...' }, ... }
    let seasonAvgAllStatRanges = {}; // Store ranges for all selectable stats
    let seasonAvgInitialRenderDone = false; // Flag to prevent redundant initial setup

    // --- DOM Element References (Season Avg Graph Tab) ---
    let seasonAvgCheckboxContainer = null;
    let seasonAvgUpdateButton = null;
    let seasonAvgValidationMsg = null;
    let seasonAvgPlayerGrid = null;
    let seasonAvgSelectorToggle = null;
    let seasonAvgSelectorContent = null;
    let seasonAvgSelectorArrow = null;

    const DEFAULT_SORT_KEY_SEASON = 'hltv_2';
    const DEFAULT_SORT_KEY_LAST10 = 'hltv_2';
    const DEFAULT_SORT_KEY_NIGHT = 'HLTV 2';
    const DEFAULT_SORT_DIR = 'desc';

    // Heatmap Gradients (Example)
    const hltvGradient = [
        { percent: 0, color: '#f8696b' },    // Red
        { percent: 0.5, color: '#ffeb84' },  // Yellow
        { percent: 1, color: '#63be7b' }     // Green
    ];
    const kdGradient = [
        { percent: 0, color: '#f8696b' },
        { percent: 0.5, color: '#ffeb84' },
        { percent: 1, color: '#63be7b' }
    ];
    const adrGradient = [
        { percent: 0, color: '#f8696b' },
        { percent: 0.5, color: '#ffeb84' },
        { percent: 1, color: '#63be7b' }
    ];
    const diffGradient = [
        { percent: 0, color: '#f8696b' },   // Bad diff (negative)
        { percent: 0.5, color: '#ffffff' }, // Neutral (zero diff)
        { percent: 1, color: '#63be7b' }    // Good diff (positive)
    ];

    // --- Fetching Logic ---
    async function fetchJsonData(url, description) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log(`${description} data fetched successfully:`, data);
            return data;
        } catch (error) {
            console.error(`Error fetching ${description} data from ${url}:`, error);
            showMessage(`Failed to load ${description} data. Please try refreshing.`, 'error');
            return null; // Indicate failure
        }
    }

    // --- Rendering Logic ---

    function fillTableBody(tbody, data, columns, defaultSortKey, defaultSortDir) {
        if (!tbody) {
            console.error("Table body element not found for filling.");
            return;
        }
        tbody.innerHTML = ''; // Clear existing content or loading message

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columns.length}" class="text-center py-4 text-gray-500">No data available.</td></tr>`;
            return;
        }

        // Store original data for sorting
        tbody.dataset.originalData = JSON.stringify(data);

        data.forEach(player => {
            const row = tbody.insertRow();
            columns.forEach((col, index) => {
                const cell = row.insertCell();
                let value = player[col.key];
                let displayValue = 'N/A';

                if (value !== undefined && value !== null) {
                    if (col.key === 'name') {
                        displayValue = value;
                        cell.className = 'font-medium text-gray-900 whitespace-nowrap';
                    } else if (col.isPercentage) {
                         displayValue = `${formatStat(value, 1)}%`;
                    } else if (col.decimals !== undefined) {
                        displayValue = formatStat(value, col.decimals);
                    } else {
                        displayValue = value; // Display raw value if no format specified
                    }
                } else {
                    // Explicitly handle N/A for sorting/display if needed
                     if (col.key === 'name') {
                        displayValue = player.name || 'Unknown Player'; // Fallback if name is missing
                    }
                }

                // Apply text alignment
                cell.classList.add(index === 0 ? 'text-left' : 'text-center');

                // Apply badges and specific classes
                 if (col.isBadge) {
                    const badgeSpan = document.createElement('span');
                    badgeSpan.className = 'stat-badge'; // Base class for badges
                    badgeSpan.textContent = displayValue;
                    cell.appendChild(badgeSpan);
                } else {
                    cell.textContent = displayValue;
                }

                // Apply diff coloring
                if (col.isDiff) {
                     const numValue = parseFloat(value);
                     if (!isNaN(numValue)) {
                        cell.classList.add(numValue > 0 ? 'text-green-600' : numValue < 0 ? 'text-red-600' : 'text-gray-500');
                     }
                }
            });
        });

        // Apply initial sort state
        setInitialSortState(tbody, defaultSortKey, defaultSortDir);

        // Apply heatmaps after data is rendered
        columns.forEach((col, index) => {
             if (col.heatmapGradient) {
                // Use a slight delay to ensure DOM update before calculating heatmap
                setTimeout(() => applyHeatmapToColumn(tbody.id, index, col.heatmapGradient), 0);
            }
        });
    }

    // Define column configurations
    const commonColumns = [
        { key: 'name', label: 'Oyuncu' },
        { key: 'hltv_2', label: 'HLTV2', decimals: 2, isBadge: true, heatmapGradient: hltvGradient },
        { key: 'adr', label: 'ADR', decimals: 1, isBadge: true, heatmapGradient: adrGradient },
        { key: 'kd', label: 'K/D', decimals: 2, isBadge: true, heatmapGradient: kdGradient },
        { key: 'mvp', label: 'MVP', decimals: 0 },
        { key: 'kills', label: 'Kills', decimals: 1 },
        { key: 'deaths', label: 'Deaths', decimals: 1 },
        { key: 'assists', label: 'Assists', decimals: 1 },
        { key: 'hs', label: 'HS', decimals: 1 },
        { key: 'hs_ratio', label: 'HS/Kill ratio', decimals: 1, isPercentage: true },
        { key: 'first_kill', label: 'First Kill', decimals: 1 },
        { key: 'first_death', label: 'First Death', decimals: 1 },
        { key: 'bomb_planted', label: 'Bomb Planted', decimals: 1 },
        { key: 'bomb_defused', label: 'Bomb Defused', decimals: 1 },
        { key: 'hltv', label: 'HLTV', decimals: 2 },
        { key: 'kast', label: 'KAST', decimals: 1, isPercentage: true },
        { key: 'utl_dmg', label: 'Utility Damage', decimals: 1 },
        { key: 'two_kills', label: '2 kills', decimals: 1 },
        { key: 'three_kills', label: '3 kills', decimals: 1 },
        { key: 'four_kills', label: '4 kills', decimals: 1 },
        { key: 'five_kills', label: '5 kills', decimals: 1 },
        { key: 'matches', label: 'Nr of Matches', decimals: 0 },
        { key: 'win_rate', label: 'WIN RATE (%)', decimals: 1, isPercentage: true },
        { key: 'avg_clutches', label: 'Nr of clutches per game', decimals: 2 }, // Note: key change for consistency?
        { key: 'avg_clutches_won', label: 'Clutches Won', decimals: 1 }, // Note: key change?
        { key: 'clutch_success', label: 'Successful Clutch (%)', decimals: 1, isPercentage: true }, // Note: key change?
    ];

    const nightAvgColumns = [
        { key: 'name', label: 'Oyuncu' },
        { key: 'HLTV 2', label: 'HLTV2', decimals: 2, isBadge: true, heatmapGradient: hltvGradient }, // Key matches JSON
        { key: 'ADR', label: 'ADR', decimals: 1, isBadge: true, heatmapGradient: adrGradient }, // Key matches JSON
        { key: 'K/D', label: 'K/D', decimals: 2, isBadge: true, heatmapGradient: kdGradient }, // Key matches JSON
        { key: 'HLTV2 DIFF', label: 'HLTV2 DIFF', decimals: 2, isDiff: true }, // Key matches JSON
        { key: 'ADR DIFF', label: 'ADR DIFF', decimals: 1, isDiff: true }, // Key matches JSON
        { key: 'MVP', label: 'MVP', decimals: 0 },
        { key: 'Kills', label: 'Kills', decimals: 0 },
        { key: 'Deaths', label: 'Deaths', decimals: 0 },
        { key: 'Assists', label: 'Assists', decimals: 0 },
        { key: 'HS', label: 'HS', decimals: 0 },
        { key: 'HS/Kill ratio', label: 'HS/Kill ratio', decimals: 1, isPercentage: true },
        { key: 'First Kill', label: 'First Kill', decimals: 0 },
        { key: 'First Death', label: 'First Death', decimals: 0 },
        { key: 'Bomb Planted', label: 'Bomb Planted', decimals: 0 },
        { key: 'Bomb Defused', label: 'Bomb Defused', decimals: 0 },
        { key: 'HLTV', label: 'HLTV', decimals: 2 },
        { key: 'KAST', label: 'KAST', decimals: 1, isPercentage: true },
        { key: 'Utility Damage', label: 'Utility Damage', decimals: 1 },
        { key: '2 kills', label: '2 kills', decimals: 0 },
        { key: '3 kills', label: '3 kills', decimals: 0 },
        { key: '4 kills', label: '4 kills', decimals: 0 },
        { key: '5 kills', label: '5 kills', decimals: 0 },
        { key: 'Nr of Matches', label: 'Nr of Matches', decimals: 0 },
        { key: 'Clutch Opportunity', label: 'Clutch Opportunity', decimals: 0 },
        { key: 'Clutches Won', label: 'Clutches Won', decimals: 0 },
    ];

    function fillSeasonAvgTable(data, tbody) {
        fillTableBody(tbody, data, commonColumns, DEFAULT_SORT_KEY_SEASON, DEFAULT_SORT_DIR);
    }

    function fillLast10Table(data, tbody) {
        fillTableBody(tbody, data, commonColumns, DEFAULT_SORT_KEY_LAST10, DEFAULT_SORT_DIR);
    }

    function fillNightAvgTable(data, tbody) {
        fillTableBody(tbody, data, nightAvgColumns, DEFAULT_SORT_KEY_NIGHT, DEFAULT_SORT_DIR);
    }

    // --- Loading and Rendering Orchestration ---
    async function loadAndRenderSeasonAvgTable() {
        const tbody = document.getElementById('season-avg-table-body');
        if (!tbody) {
             console.error("Season Avg table body not found");
             return;
        }
        tbody.innerHTML = `<tr><td colspan="${commonColumns.length}" class="text-center py-4 text-gray-500">Loading season data...</td></tr>`;

        seasonStats = await fetchJsonData(SEASON_AVG_JSON_URL, 'Season Average');
        if (seasonStats) {
             // Initial render
            fillSeasonAvgTable(seasonStats, tbody);
            // Potentially trigger initial graph render if graph tab exists and is active (though unlikely on initial load)
            checkAndRenderSeasonGraph();
        }
    }

    async function loadAndRenderLast10Table() {
        const tbody = document.getElementById('last10-table-body');
         if (!tbody) {
             console.error("Last 10 table body not found");
             return;
         }
        tbody.innerHTML = `<tr><td colspan="${commonColumns.length}" class="text-center py-4 text-gray-500">Loading last 10 data...</td></tr>`;
        last10Stats = await fetchJsonData(LAST10_JSON_URL, 'Last 10');
        if (last10Stats) {
            fillLast10Table(last10Stats, tbody);
        }
    }

    async function loadAndRenderNightAvgTable() {
        const tbody = document.getElementById('night-avg-table-body');
         if (!tbody) {
             console.error("Night Avg table body not found");
             return;
         }
        tbody.innerHTML = `<tr><td colspan="${nightAvgColumns.length}" class="text-center py-4 text-gray-500">Loading night average data...</td></tr>`;
        nightAvgStats = await fetchJsonData(NIGHT_AVG_JSON_URL, 'Night Average');
        if (nightAvgStats) {
            fillNightAvgTable(nightAvgStats, tbody);
        }
    }

    // --- Season Avg Graph View Logic ---
    function renderSeasonAvgGraphView() {
        // Initial setup (run only once when tab is first viewed or data arrives)
        if (!seasonAvgInitialRenderDone) {
             console.log("Performing initial setup for Season Avg Graph View...");
            // Get DOM elements
            seasonAvgCheckboxContainer = document.getElementById('season-avg-pentagon-stat-checkboxes');
            seasonAvgUpdateButton = document.getElementById('update-season-avg-graphs-btn');
            seasonAvgValidationMsg = document.getElementById('season-avg-stat-validation-msg');
            seasonAvgPlayerGrid = document.getElementById('season-avg-player-grid');
            seasonAvgSelectorToggle = document.getElementById('season-avg-stat-selector-toggle');
            seasonAvgSelectorContent = document.getElementById('season-avg-stat-selector-content');
            seasonAvgSelectorArrow = document.getElementById('season-avg-stat-arrow');

            if (!seasonAvgCheckboxContainer || !seasonAvgUpdateButton || !seasonAvgValidationMsg || !seasonAvgPlayerGrid || !seasonAvgSelectorToggle || !seasonAvgSelectorContent || !seasonAvgSelectorArrow) {
                console.error("Missing required elements for Season Avg graph tab setup!");
                // Display error in a visible place if possible
                 const graphTab = document.getElementById('season-avg-tab-graph');
                 if(graphTab) graphTab.innerHTML = '<p class="text-red-500 p-4">Error: UI elements missing for graph view.</p>';
                return; // Stop further processing for this tab
            }

            // Generate selectable stats config (only needs to be done once)
            seasonAvgSelectableStats = generateSelectableStatsConfig(commonColumns);

            // Populate checkboxes
            populateSeasonAvgStatCheckboxes();

            // Add listener to the update button (only once)
            seasonAvgUpdateButton.addEventListener('click', handleUpdateSeasonAvgGraphsClick);

            // Add listener for the collapsible toggle (only once)
            seasonAvgSelectorToggle.addEventListener('click', () => {
                seasonAvgSelectorContent.classList.toggle('hidden');
                seasonAvgSelectorArrow.classList.toggle('rotate-180');
            });

            seasonAvgInitialRenderDone = true; // Mark setup as complete
        }

        // --- Data Dependent Rendering --- (Runs every time the function is called if data is ready)

        if (!seasonStats) {
            console.warn("Season stats not loaded yet for graph view.");
            seasonAvgPlayerGrid.innerHTML = '<div class="text-center py-8 text-orange-500 col-span-full">Season data is still loading. Please wait...</div>';
            return; // Don't proceed further until data is loaded
        }

        // Calculate ranges for ALL selectable stats if not already done
        if (Object.keys(seasonAvgAllStatRanges).length === 0) {
            const allPlayersSeasonData = convertStatsArrayToObject(seasonStats);
            const allSelectableStatKeys = Object.keys(seasonAvgSelectableStats);
            seasonAvgAllStatRanges = PlayerCharts.calculateStatRanges(allPlayersSeasonData, allSelectableStatKeys);
             console.log("Calculated all stat ranges for Season Avg:", seasonAvgAllStatRanges);
        }

        // Render the graphs if the view isn't already populated or if triggered by update button
        // The actual rendering logic is now inside handleUpdateSeasonAvgGraphsClick
        // We just ensure the initial placeholder is correct or trigger initial render if needed.
        if (!seasonAvgGraphPopulated) {
            // If exactly 5 are selected by default, trigger the initial render
            if (Object.keys(getSelectedSeasonAvgStats()).length === PENTAGON_STAT_LIMIT_STATS) {
                 console.log("Triggering initial graph render for Season Avg.");
                 handleUpdateSeasonAvgGraphsClick(); // Render initial graphs
                 seasonAvgGraphPopulated = true;
            } else {
                // Show placeholder message if defaults are not 5
                seasonAvgPlayerGrid.innerHTML = '<div class="text-center py-8 text-gray-500 col-span-full">Select 5 stats and click "Update Graphs".</div>';
            }
        }
    }

    // Internal helper to create card specifically for StatsTables (avoids direct call to players.js global)
    function createPlayerCardInternal(playerData, container, canvasId) {
        const card = document.createElement('div');
        card.className = 'player-card border rounded-lg bg-white shadow p-3 flex flex-col items-center text-center';
        card.dataset.playerName = playerData.name;

        /* Commented out Picture Placeholder
        const picDiv = document.createElement('div');
        picDiv.className = 'w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center mb-2';
        picDiv.innerHTML = '<span class="text-gray-500 text-xs">Pic</span>';
        card.appendChild(picDiv);
        */

        const nameSpan = document.createElement('span');
        nameSpan.className = 'text-base font-semibold text-gray-800 mb-2';
        nameSpan.textContent = playerData.name;
        card.appendChild(nameSpan);

        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'w-full relative';
        card.appendChild(canvasContainer);

        const canvas = document.createElement('canvas');
        canvas.id = canvasId; // Use provided unique ID
        canvas.width = 200;
        canvas.height = 192;
        canvasContainer.appendChild(canvas);

        container.appendChild(card);
        return card; // Return the card element itself
    }

    // Check if the graph tab is active and needs rendering
    function checkAndRenderSeasonGraph() {
        const graphTabButton = document.getElementById('season-avg-graph-tab');
        if (graphTabButton && graphTabButton.getAttribute('aria-selected') === 'true') {
            renderSeasonAvgGraphView();
        }
    }

    // --- Event Handlers ---
    function handleSeasonAvgSubTabClick(event) {
        const clickedTab = event.target.closest('.map-tab-button'); // Find closest map-tab-button
        if (!clickedTab || !clickedTab.closest('#season-avg-sub-tabs')) return; // Ensure it's within the correct tab list

        event.preventDefault();

        const targetPaneSelector = clickedTab.dataset.tabsTarget;
        const targetPane = document.querySelector(targetPaneSelector);
        const tabContainer = clickedTab.closest('ul'); // #season-avg-sub-tabs
        const allTabs = tabContainer.querySelectorAll('.map-tab-button'); // Select by map-tab-button
        const contentContainer = document.getElementById('season-avg-tab-content');
        const allPanes = contentContainer ? contentContainer.querySelectorAll('.season-avg-tab-pane') : [];

        // Update tab appearance - relies ONLY on adding/removing .active class
        allTabs.forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        });
        clickedTab.classList.add('active'); // Add ONLY the .active class
        clickedTab.setAttribute('aria-selected', 'true');

        // Update content pane visibility
        allPanes.forEach(pane => {
            pane.classList.add('hidden');
            pane.classList.remove('active');
        });
        if (targetPane) {
            targetPane.classList.remove('hidden');
            targetPane.classList.add('active');
        } else {
            console.error(`Target pane not found for selector: ${targetPaneSelector}`);
        }

        // If the graph tab was clicked, ensure its content is initialized/rendered
        if (targetPaneSelector === '#season-avg-tab-graph') {
            renderSeasonAvgGraphView(); // This now handles both initial setup and data loading checks
        }
    }

    // --- Helper: Generate Selectable Stats from Columns ---
    function generateSelectableStatsConfig(columns) {
        const config = {};
        const defaultSelected = ['hltv_2', 'adr', 'kd', 'hs_ratio', 'win_rate']; // Default 5
        columns.forEach(col => {
            // Exclude non-numeric/non-relevant columns for pentagon
            if (col.key && col.label && col.key !== 'name' && !col.isDiff) { // Allow decimals=0, check other props if needed
                config[col.key] = {
                    label: col.label,
                    default: defaultSelected.includes(col.key),
                    format: col.isPercentage ? 'percent' : (col.decimals === 2 ? 'decimal2' : 'decimal1') // Basic format hint
                };
            }
        });
        return config;
    }

    // --- Season Avg Graph View Specific Helpers ---
    function getSelectedSeasonAvgStats() {
        const selected = {};
        if (!seasonAvgCheckboxContainer) return selected;
        const checkboxes = seasonAvgCheckboxContainer.querySelectorAll('.season-avg-pentagon-stat-option:checked');
        checkboxes.forEach(cb => {
            selected[cb.dataset.statKey] = cb.dataset.statLabel;
        });
        return selected;
    }

    function updateSeasonAvgStatSelectionUI() {
        if (!seasonAvgCheckboxContainer || !seasonAvgValidationMsg || !seasonAvgUpdateButton) return;

        const selectedCount = Object.keys(getSelectedSeasonAvgStats()).length;
        const checkboxes = seasonAvgCheckboxContainer.querySelectorAll('.season-avg-pentagon-stat-option');

        if (selectedCount === PENTAGON_STAT_LIMIT_STATS) {
            seasonAvgValidationMsg.textContent = '';
            seasonAvgUpdateButton.disabled = false;
            seasonAvgUpdateButton.classList.remove('opacity-50', 'cursor-not-allowed');
            checkboxes.forEach(cb => { cb.disabled = !cb.checked; });
        } else {
            seasonAvgValidationMsg.textContent = `Select ${PENTAGON_STAT_LIMIT_STATS} stats (${selectedCount} selected)`;
            seasonAvgUpdateButton.disabled = true;
            seasonAvgUpdateButton.classList.add('opacity-50', 'cursor-not-allowed');
            checkboxes.forEach(cb => { cb.disabled = false; });
        }
    }

     function handleSeasonAvgCheckboxChange() {
        updateSeasonAvgStatSelectionUI();
    }

    function handleUpdateSeasonAvgGraphsClick() {
        console.log("Updating Season Avg graphs...");
        const selectedStats = getSelectedSeasonAvgStats();

        if (Object.keys(selectedStats).length !== PENTAGON_STAT_LIMIT_STATS) {
            seasonAvgValidationMsg.textContent = `Error: Select exactly ${PENTAGON_STAT_LIMIT_STATS} stats.`;
            return;
        }

        if (!seasonStats || !seasonAvgPlayerGrid) {
            console.error("Cannot update graphs: Season data or grid container missing.");
             seasonAvgValidationMsg.textContent = "Error: Data or container missing.";
            return;
        }

        // Re-render all charts using the stored raw data and ALL calculated ranges
        const allPlayersSeasonData = convertStatsArrayToObject(seasonStats);
        const activePlayersData = Object.values(allPlayersSeasonData)
            .filter(p => p && typeof p.matches === 'number' && p.matches > 0)
            .sort((a, b) => a.name.localeCompare(b.name));

        seasonAvgPlayerGrid.innerHTML = ''; // Clear existing cards before re-rendering

        activePlayersData.forEach(playerData => {
            const canvasId = `season-avg-chart-${playerData.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            createPlayerCardInternal(playerData, seasonAvgPlayerGrid, canvasId); // Create card structure
            // Render with the NEW selected stats and the initially calculated ranges for ALL stats
            setTimeout(() => {
                 PlayerCharts.renderPentagonChart(playerData, canvasId, selectedStats, seasonAvgAllStatRanges);
            }, 0);
        });

        seasonAvgValidationMsg.textContent = 'Graphs updated!';
        setTimeout(() => { seasonAvgValidationMsg.textContent = ''; }, 2000);
    }

    function populateSeasonAvgStatCheckboxes() {
        if (!seasonAvgCheckboxContainer) return;
        seasonAvgCheckboxContainer.innerHTML = ''; // Clear loading/placeholders

        Object.entries(seasonAvgSelectableStats).forEach(([key, config]) => {
            const div = document.createElement('div');
            const label = document.createElement('label');
            label.className = 'inline-flex items-center';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 season-avg-pentagon-stat-option'; // Unique class
            input.dataset.statKey = key;
            input.dataset.statLabel = config.label;
            input.checked = config.default;
            input.addEventListener('change', handleSeasonAvgCheckboxChange);
            const span = document.createElement('span');
            span.className = 'ml-2 text-sm text-gray-700';
            span.textContent = config.label;
            label.appendChild(input);
            label.appendChild(span);
            div.appendChild(label);
            seasonAvgCheckboxContainer.appendChild(div);
        });
         updateSeasonAvgStatSelectionUI(); // Set initial state after populating
    }

    // --- Initialization ---
    function init() {
        loadAndRenderSeasonAvgTable();
        loadAndRenderLast10Table();
        loadAndRenderNightAvgTable();

        // Add event listener for season average sub-tabs
        const seasonAvgTabsContainer = document.getElementById('season-avg-sub-tabs');
        if (seasonAvgTabsContainer) {
            seasonAvgTabsContainer.addEventListener('click', handleSeasonAvgSubTabClick);
        } else {
            // Only log warning if the page is expected to have these tabs
            // console.warn("Season average sub-tabs container not found.");
        }
    }

    // Public interface
    return {
        init: init,
        fillSeasonAvgTable: fillSeasonAvgTable, // Expose for sorting
        fillLast10Table: fillLast10Table,     // Expose for sorting
        fillNightAvgTable: fillNightAvgTable,   // Expose for sorting
        get seasonStats() { return seasonStats; }, // Getter for external use (like Players page)
        get last10Stats() { return last10Stats; },
        get nightAvgStats() { return nightAvgStats; }
    };
})();

// Make StatsTables globally available if needed by other scripts (like MainScript for sorting)
// window.StatsTables = StatsTables; // Or manage dependencies differently