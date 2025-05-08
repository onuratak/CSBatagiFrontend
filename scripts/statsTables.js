/* global showMessage, formatStat, applyHeatmapToColumn, setInitialSortState, PlayerCharts, createPlayerCard, convertStatsArrayToObject */ // Added PlayerCharts dependencies
/* global SEASON_AVG_JSON_URL, LAST10_JSON_URL, NIGHT_AVG_JSON_URL */ // Assume these are defined globally or imported

// --- Constants --- (Moved outside IIFE for potential reuse if needed)
const PENTAGON_STAT_LIMIT_STATS = 5;

const StatsTables = (() => {
    let seasonStats = null;
    let last10Stats = null;
    let nightAvgStats = null;
    let seasonStatsBySteamId = {}; // NEW: Map for quick lookup
    let last10StatsBySteamId = {}; // NEW: Map for quick lookup
    let nightAvgStatsBySteamId = {}; // NEW: Map for quick lookup (though not requested for picker yet)

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

    // --- NEW: State specific to Season Avg Head-to-Head View ---
    let seasonAvgH2HInitialRenderDone = false;
    let seasonAvgH2HSelectableStats = {}; // Config for selectable stats

    // --- NEW: DOM Element References (Season Avg Head-to-Head Tab) ---
    let seasonAvgH2HPlayer1Select = null;
    let seasonAvgH2HPlayer2Select = null;
    let seasonAvgH2HCheckboxContainer = null;
    let seasonAvgH2HUpdateButton = null;
    let seasonAvgH2HValidationMsg = null;
    let seasonAvgH2HChartContainer = null; // Container for the single comparison chart
    let seasonAvgH2HStatSelectorToggle = null;
    let seasonAvgH2HStatSelectorContent = null;
    let seasonAvgH2HStatSelectorArrow = null;

    // --- State specific to Last 10 Graph View ---
    let last10GraphPopulated = false;
    let last10SelectableStats = {};
    let last10AllStatRanges = {};
    let last10InitialRenderDone = false;

    // --- DOM Element References (Last 10 Graph Tab) ---
    let last10CheckboxContainer = null;
    let last10UpdateButton = null;
    let last10ValidationMsg = null;
    let last10PlayerGrid = null;
    let last10SelectorToggle = null;
    let last10SelectorContent = null;
    let last10SelectorArrow = null;

    // --- State specific to Night Avg Graph View ---
    let nightAvgGraphPopulated = false;
    let nightAvgSelectableStats = {};
    let nightAvgAllStatRanges = {};
    let nightAvgInitialRenderDone = false;

    // --- DOM Element References (Night Avg Graph Tab) ---
    let nightAvgCheckboxContainer = null;
    let nightAvgUpdateButton = null;
    let nightAvgValidationMsg = null;
    let nightAvgPlayerGrid = null;
    let nightAvgSelectorToggle = null;
    let nightAvgSelectorContent = null;
    let nightAvgSelectorArrow = null;

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
            // console.log(`${description} data fetched successfully:`, data);
            return data;
        } catch (error) {
            // console.error(`Error fetching ${description} data from ${url}:`, error);
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
                        cell.classList.add('font-bold'); // Add bold font style
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
        { key: 'avg_clutches', label: 'Nr of clutches per game', decimals: 2 },
        { key: 'avg_clutches_won', label: 'Clutches Won', decimals: 1 },
        { key: 'clutch_success', label: 'Successful Clutch (%)', decimals: 1, isPercentage: true },
    ];

    const nightAvgColumns = [
        { key: 'name', label: 'Oyuncu' },
        { key: 'HLTV 2', label: 'HLTV2', decimals: 2, isBadge: true, heatmapGradient: hltvGradient },
        { key: 'ADR', label: 'ADR', decimals: 1, isBadge: true, heatmapGradient: adrGradient },
        { key: 'K/D', label: 'K/D', decimals: 2, isBadge: true, heatmapGradient: kdGradient },
        { key: 'HLTV2 DIFF', label: 'HLTV2 DIFF', decimals: 2, isDiff: true },
        { key: 'ADR DIFF', label: 'ADR DIFF', decimals: 1, isDiff: true },
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
            // NEW: Process data into map after fetching
            seasonStatsBySteamId = processStatsIntoMap(seasonStats, 'steam_id');
            // console.log("Processed season stats by SteamID:", seasonStatsBySteamId);
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
             // NEW: Process data into map after fetching
            last10StatsBySteamId = processStatsIntoMap(last10Stats, 'steam_id');
            // console.log("Processed last 10 stats by SteamID:", last10StatsBySteamId);
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
             // NEW: Process data into map after fetching
            // Assuming night_avg.json also includes steam_id now
            nightAvgStatsBySteamId = processStatsIntoMap(nightAvgStats, 'steam_id');
            // console.log("Processed night average stats by SteamID:", nightAvgStatsBySteamId);
            checkAndRenderNightAvgGraph(); // Trigger graph check if needed
        }
    }

    // --- NEW: Helper function to calculate Season Avg Stat Ranges if needed ---
    function ensureSeasonAvgStatRangesCalculated() {
        if (!seasonStats || Object.keys(seasonAvgAllStatRanges).length > 0) {
            return;
        }
        // console.log("Calculating Season Avg H2H stat ranges...");
        const allPlayersData = convertStatsArrayToObject(seasonStats);
        // Ensure H2H selectable stats config is generated if needed
        if (Object.keys(seasonAvgH2HSelectableStats).length === 0) {
            // console.log("Generating seasonAvgH2HSelectableStats before range calculation.");
            seasonAvgH2HSelectableStats = generateSelectableStatsConfig(commonColumns);
        }
        const allSelectableKeys = Object.keys(seasonAvgH2HSelectableStats);
        if (allSelectableKeys.length === 0) {
            //  console.warn("Cannot calculate H2H ranges for Season Avg: No selectable H2H stats found.");
             return;
        }
        seasonAvgAllStatRanges = PlayerCharts.calculateStatRanges(allPlayersData, allSelectableKeys);
        // console.log("Calculated all H2H stat ranges for Season Avg:", seasonAvgAllStatRanges);
    }

    // --- NEW: Helper function to calculate Last 10 Stat Ranges if needed ---
    function ensureLast10StatRangesCalculated() {
        if (!last10Stats || Object.keys(last10AllStatRanges).length > 0) {
            return;
        }
        // console.log("Calculating Last 10 H2H stat ranges...");
        const allPlayersData = convertStatsArrayToObject(last10Stats);
        if (Object.keys(last10H2HSelectableStats).length === 0) {
            // console.log("Generating last10H2HSelectableStats before range calculation.");
            last10H2HSelectableStats = generateSelectableStatsConfig(commonColumns);
        }
        const allSelectableKeys = Object.keys(last10H2HSelectableStats);
        if (allSelectableKeys.length === 0) {
            // console.warn("Cannot calculate H2H ranges for Last 10: No selectable H2H stats found.");
            return;
        }
        last10AllStatRanges = PlayerCharts.calculateStatRanges(allPlayersData, allSelectableKeys);
        // console.log("Calculated all H2H stat ranges for Last 10:", last10AllStatRanges);
    }

    // --- NEW: Helper function to calculate Night Avg Stat Ranges if needed ---
    function ensureNightAvgStatRangesCalculated() {
        if (!nightAvgStats || Object.keys(nightAvgAllStatRanges).length > 0) {
            return;
        }
        // console.log("Calculating Night Avg H2H stat ranges...");
        const allPlayersData = convertStatsArrayToObject(nightAvgStats);
        if (Object.keys(nightAvgH2HSelectableStats).length === 0) {
            // console.log("Generating nightAvgH2HSelectableStats before range calculation.");
            nightAvgH2HSelectableStats = generateSelectableStatsConfig(nightAvgColumns);
        }
        const allSelectableKeys = Object.keys(nightAvgH2HSelectableStats);
        if (allSelectableKeys.length === 0) {
            // console.warn("Cannot calculate H2H ranges for Night Avg: No selectable H2H stats found.");
            return;
        }
        nightAvgAllStatRanges = PlayerCharts.calculateStatRanges(allPlayersData, allSelectableKeys);
        // console.log("Calculated all H2H stat ranges for Night Avg:", nightAvgAllStatRanges);
    }

    // --- Season Avg Graph View Logic ---
    function renderSeasonAvgGraphView() {
        // Initial setup (run only once when tab is first viewed or data arrives)
        if (!seasonAvgInitialRenderDone) {
            //  console.log("Performing initial setup for Season Avg GraphView...");
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

            // Generate selectable stats config using the correct columns
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
            // console.warn("Season stats not loaded yet for graph view.");
            seasonAvgPlayerGrid.innerHTML = '<div class="text-center py-8 text-orange-500 col-span-full">Season data is still loading. Please wait...</div>';
            return; // Don't proceed further until data is loaded
        }

        // Calculate ranges for ALL selectable stats if not already done
        ensureSeasonAvgStatRangesCalculated();

        // Render the graphs if the view isn't already populated or if triggered by update button
        // The actual rendering logic is now inside handleUpdateSeasonAvgGraphsClick
        // We just ensure the initial placeholder is correct or trigger initial render if needed.
        if (!seasonAvgGraphPopulated) {
            // If exactly 5 are selected by default, trigger the initial render
            if (Object.keys(getSelectedSeasonAvgStats()).length === PENTAGON_STAT_LIMIT_STATS) {
                //  console.log("Triggering initial graph render for Season Avg.");
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
        // console.log('[DEBUG] SeasonAvg subtab click handler fired');
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
        } else if (targetPaneSelector === '#season-avg-tab-head2head') { // NEW: Handle H2H tab click
            renderSeasonAvgH2HView();
        }
    }

    // --- Helper: Generate Selectable Stats from Columns ---
    function generateSelectableStatsConfig(columns) {
        const config = {};
        let defaultCount = 0;
        const PENTAGON_LIMIT = 5; // Use local constant

        // First pass: identify potential candidates and assign defaults
        columns.forEach(col => {
            // Exclude only the name column
            if (col.key && col.label && col.key !== 'name') { // REMOVED !col.isDiff check
                // Determine if it should be a default selection
                // Prioritize non-diff columns for defaults if possible, but check only first 5 suitable overall
                const isDefaultCandidate = defaultCount < PENTAGON_LIMIT; // Still limit defaults to 5
                // Let's keep the simple logic: first 5 suitable stats are default
                const isDefault = isDefaultCandidate;

                config[col.key] = {
                    label: col.label,
                    default: isDefault,
                    // Assign format, handle potential missing decimals for DIFF columns if necessary
                    format: col.isPercentage ? 'percent' : (col.decimals === 2 ? 'decimal2' : (col.decimals === 1 ? 'decimal1' : 'decimal0'))
                };
                if (isDefault) {
                    defaultCount++;
                }
            }
        });

        // If fewer than 5 defaults were found (e.g., very few numeric columns),
        // this logic doesn't automatically select more. The user must choose 5.
        // console.log(`Generated selectable stats config for columns:`, columns, config);
        return config;
    }

    // --- Season Avg Graph View Specific Helpers ---
    function getSelectedSeasonAvgStats() {
        const selectedConfig = {};
        if (!seasonAvgCheckboxContainer) return selectedConfig;
        const checkboxes = seasonAvgCheckboxContainer.querySelectorAll('.season-avg-pentagon-stat-option:checked');
        checkboxes.forEach(cb => {
            const key = cb.dataset.statKey;
            if (seasonAvgSelectableStats[key]) { // Get the full config for the selected key
                selectedConfig[key] = seasonAvgSelectableStats[key];
            }
        });
        return selectedConfig;
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
        // console.log("Updating Season Avg graphs...");
        const selectedStatsConfig = getSelectedSeasonAvgStats(); // Get the rich config object

        if (Object.keys(selectedStatsConfig).length !== PENTAGON_STAT_LIMIT_STATS) {
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
                 // Pass the rich config object
                 PlayerCharts.renderPentagonChart(playerData, canvasId, selectedStatsConfig, seasonAvgAllStatRanges);
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

    // --- NEW: Helper function to process raw stats array into a map ---
    function processStatsIntoMap(statsArray, mapKey = 'steam_id') {
        const statsMap = {};
        if (!Array.isArray(statsArray)) {
            console.error("Invalid stats data provided for processing:", statsArray);
            return statsMap;
        }
        statsArray.forEach(player => {
            if (player && player[mapKey]) {
                statsMap[player[mapKey]] = player;
            } else {
                console.warn("Skipping player object due to missing key:", player);
            }
        });
        return statsMap;
    }

    // --- Last 10 Graph View Specific Helpers ---
    function getSelectedLast10Stats() {
        const selectedConfig = {};
        if (!last10CheckboxContainer) return selectedConfig;
        const checkboxes = last10CheckboxContainer.querySelectorAll('.last10-pentagon-stat-option:checked');
        checkboxes.forEach(cb => {
            const key = cb.dataset.statKey;
            if (last10SelectableStats[key]) { // Get the full config
                 selectedConfig[key] = last10SelectableStats[key];
            }
        });
        return selectedConfig;
    }

    function updateLast10StatSelectionUI() {
        if (!last10CheckboxContainer || !last10ValidationMsg || !last10UpdateButton) return;
        const selectedCount = Object.keys(getSelectedLast10Stats()).length;
        const checkboxes = last10CheckboxContainer.querySelectorAll('.last10-pentagon-stat-option');
        if (selectedCount === PENTAGON_STAT_LIMIT_STATS) {
            last10ValidationMsg.textContent = '';
            last10UpdateButton.disabled = false;
            last10UpdateButton.classList.remove('opacity-50', 'cursor-not-allowed');
            checkboxes.forEach(cb => { cb.disabled = !cb.checked; });
        } else {
            last10ValidationMsg.textContent = `Select ${PENTAGON_STAT_LIMIT_STATS} stats (${selectedCount} selected)`;
            last10UpdateButton.disabled = true;
            last10UpdateButton.classList.add('opacity-50', 'cursor-not-allowed');
            checkboxes.forEach(cb => { cb.disabled = false; });
        }
    }

    function handleLast10CheckboxChange() {
        updateLast10StatSelectionUI();
    }

    function handleUpdateLast10GraphsClick() {
        // console.log("Updating Last 10 graphs...");
        const selectedStatsConfig = getSelectedLast10Stats(); // Get the rich config object
        if (Object.keys(selectedStatsConfig).length !== PENTAGON_STAT_LIMIT_STATS) {
            last10ValidationMsg.textContent = `Error: Select exactly ${PENTAGON_STAT_LIMIT_STATS} stats.`;
            return;
        }
        if (!last10Stats || !last10PlayerGrid) {
            console.error("Cannot update graphs: Last 10 data or grid container missing.");
            last10ValidationMsg.textContent = "Error: Data or container missing.";
            return;
        }
        const allPlayersLast10Data = convertStatsArrayToObject(last10Stats);
        const activePlayersData = Object.values(allPlayersLast10Data)
            .filter(p => p && typeof p.matches === 'number' && p.matches > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
        last10PlayerGrid.innerHTML = '';
        activePlayersData.forEach(playerData => {
            const canvasId = `last10-chart-${playerData.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            createPlayerCardInternal(playerData, last10PlayerGrid, canvasId);
            setTimeout(() => {
                // Pass the rich config object
                PlayerCharts.renderPentagonChart(playerData, canvasId, selectedStatsConfig, last10AllStatRanges);
            }, 0);
        });
        last10ValidationMsg.textContent = 'Graphs updated!';
        setTimeout(() => { last10ValidationMsg.textContent = ''; }, 2000);
    }

    function populateLast10StatCheckboxes() {
        if (!last10CheckboxContainer) return;
        last10CheckboxContainer.innerHTML = '';
        Object.entries(last10SelectableStats).forEach(([key, config]) => {
            const div = document.createElement('div');
            const label = document.createElement('label');
            label.className = 'inline-flex items-center';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 last10-pentagon-stat-option'; // Unique class
            input.dataset.statKey = key;
            input.dataset.statLabel = config.label;
            input.checked = config.default;
            input.addEventListener('change', handleLast10CheckboxChange);
            const span = document.createElement('span');
            span.className = 'ml-2 text-sm text-gray-700';
            span.textContent = config.label;
            label.appendChild(input);
            label.appendChild(span);
            div.appendChild(label);
            last10CheckboxContainer.appendChild(div);
        });
        updateLast10StatSelectionUI();
    }

    // --- Main Rendering Logic for Last 10 Graph ---
    function renderLast10GraphView() {
        if (!last10InitialRenderDone) {
            // console.log("Performing initial setup for Last 10 Graph View...");
            last10CheckboxContainer = document.getElementById('last10-pentagon-stat-checkboxes');
            last10UpdateButton = document.getElementById('update-last10-graphs-btn');
            last10ValidationMsg = document.getElementById('last10-stat-validation-msg');
            last10PlayerGrid = document.getElementById('last10-player-grid');
            last10SelectorToggle = document.getElementById('last10-stat-selector-toggle');
            last10SelectorContent = document.getElementById('last10-stat-selector-content');
            last10SelectorArrow = document.getElementById('last10-stat-arrow');

            if (!last10CheckboxContainer || !last10UpdateButton || !last10ValidationMsg || !last10PlayerGrid || !last10SelectorToggle || !last10SelectorContent || !last10SelectorArrow) {
                console.error("Missing required elements for Last 10 graph tab setup!");
                const graphTab = document.getElementById('last10-tab-graph');
                if(graphTab) graphTab.innerHTML = '<p class="text-red-500 p-4">Error: UI elements missing for graph view.</p>';
                return;
            }
            // Generate selectable stats config using the correct columns
            last10SelectableStats = generateSelectableStatsConfig(commonColumns);
            populateLast10StatCheckboxes();
            last10UpdateButton.addEventListener('click', handleUpdateLast10GraphsClick);
            last10SelectorToggle.addEventListener('click', () => {
                last10SelectorContent.classList.toggle('hidden');
                last10SelectorArrow.classList.toggle('rotate-180');
            });
            last10InitialRenderDone = true;
        }

        if (!last10Stats) {
            // console.warn("Last 10 stats not loaded yet for graph view.");
            last10PlayerGrid.innerHTML = '<div class="text-center py-8 text-orange-500 col-span-full">Last 10 data is still loading. Please wait...</div>';
            return;
        }

        if (Object.keys(last10AllStatRanges).length === 0) {
            const allPlayersLast10Data = convertStatsArrayToObject(last10Stats);
            const allSelectableStatKeys = Object.keys(last10SelectableStats);
            last10AllStatRanges = PlayerCharts.calculateStatRanges(allPlayersLast10Data, allSelectableStatKeys);
            console.log("Calculated all stat ranges for Last 10:", last10AllStatRanges);
        }

        if (!last10GraphPopulated) {
            if (Object.keys(getSelectedLast10Stats()).length === PENTAGON_STAT_LIMIT_STATS) {
                //  console.log("Triggering initial graph render for Last 10.");
                 handleUpdateLast10GraphsClick();
                 last10GraphPopulated = true;
            } else {
                last10PlayerGrid.innerHTML = '<div class="text-center py-8 text-gray-500 col-span-full">Select 5 stats and click "Update Graphs".</div>';
            }
        }
    }

    // --- NEW Event Handler for Last 10 Tabs ---
    function handleLast10SubTabClick(event) {
        // console.log('[DEBUG] Last10 subtab click handler fired');
        const clickedTab = event.target.closest('.map-tab-button');
        if (!clickedTab || !clickedTab.closest('#last10-sub-tabs')) return;
        event.preventDefault();
        const targetPaneSelector = clickedTab.dataset.tabsTarget;
        const targetPane = document.querySelector(targetPaneSelector);
        const tabContainer = clickedTab.closest('ul');
        const allTabs = tabContainer.querySelectorAll('.map-tab-button');
        const contentContainer = document.getElementById('last10-tab-content');
        const allPanes = contentContainer ? contentContainer.querySelectorAll('.last10-tab-pane') : [];
        allTabs.forEach(tab => { tab.classList.remove('active'); tab.setAttribute('aria-selected', 'false'); });
        clickedTab.classList.add('active');
        clickedTab.setAttribute('aria-selected', 'true');
        allPanes.forEach(pane => { pane.classList.add('hidden'); pane.classList.remove('active'); });
        if (targetPane) {
            targetPane.classList.remove('hidden');
            targetPane.classList.add('active');
        } else {
            console.error(`Target pane not found for selector: ${targetPaneSelector}`);
        }
        if (targetPaneSelector === '#last10-tab-graph') {
            renderLast10GraphView();
        } else if (targetPaneSelector === '#last10-tab-head2head') {
            renderLast10H2HView();
        }
    }

    // --- Night Avg Graph View Specific Helpers ---
    function getSelectedNightAvgStats() {
        const selectedConfig = {};
        if (!nightAvgCheckboxContainer) return selectedConfig;
        const checkboxes = nightAvgCheckboxContainer.querySelectorAll('.night-avg-pentagon-stat-option:checked');
        checkboxes.forEach(cb => {
            const key = cb.dataset.statKey;
            if (nightAvgSelectableStats[key]) { // Get the full config
                 selectedConfig[key] = nightAvgSelectableStats[key];
            }
        });
        return selectedConfig;
    }

    function updateNightAvgStatSelectionUI() {
        if (!nightAvgCheckboxContainer || !nightAvgValidationMsg || !nightAvgUpdateButton) return;
        const selectedCount = Object.keys(getSelectedNightAvgStats()).length;
        const checkboxes = nightAvgCheckboxContainer.querySelectorAll('.night-avg-pentagon-stat-option');
        if (selectedCount === PENTAGON_STAT_LIMIT_STATS) {
            nightAvgValidationMsg.textContent = '';
            nightAvgUpdateButton.disabled = false;
            nightAvgUpdateButton.classList.remove('opacity-50', 'cursor-not-allowed');
            checkboxes.forEach(cb => { cb.disabled = !cb.checked; });
        } else {
            nightAvgValidationMsg.textContent = `Select ${PENTAGON_STAT_LIMIT_STATS} stats (${selectedCount} selected)`;
            nightAvgUpdateButton.disabled = true;
            nightAvgUpdateButton.classList.add('opacity-50', 'cursor-not-allowed');
            checkboxes.forEach(cb => { cb.disabled = false; });
        }
    }

    function handleNightAvgCheckboxChange() {
        updateNightAvgStatSelectionUI();
    }

    function handleUpdateNightAvgGraphsClick() {
        // console.log("Updating Night Avg graphs...");
        const selectedStatsConfig = getSelectedNightAvgStats(); // Get the rich config object
        if (Object.keys(selectedStatsConfig).length !== PENTAGON_STAT_LIMIT_STATS) {
            nightAvgValidationMsg.textContent = `Error: Select exactly ${PENTAGON_STAT_LIMIT_STATS} stats.`;
            return;
        }
        if (!nightAvgStats || !nightAvgPlayerGrid) {
            console.error("Cannot update graphs: Night Avg data or grid container missing.");
            nightAvgValidationMsg.textContent = "Error: Data or container missing.";
            return;
        }
        // Convert Night Avg data (keys might have spaces, need to handle)
        const allPlayersNightAvgData = convertStatsArrayToObject(nightAvgStats);
        const activePlayersData = Object.values(allPlayersNightAvgData)
            // Night avg data doesn't have matches, assume all players shown are 'active' for the night
            .sort((a, b) => a.name.localeCompare(b.name));

        nightAvgPlayerGrid.innerHTML = '';
        activePlayersData.forEach(playerData => {
            const canvasId = `night-avg-chart-${playerData.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            createPlayerCardInternal(playerData, nightAvgPlayerGrid, canvasId);
            setTimeout(() => {
                // Pass the rich config object
                PlayerCharts.renderPentagonChart(playerData, canvasId, selectedStatsConfig, nightAvgAllStatRanges);
            }, 0);
        });
        nightAvgValidationMsg.textContent = 'Graphs updated!';
        setTimeout(() => { nightAvgValidationMsg.textContent = ''; }, 2000);
    }

    function populateNightAvgStatCheckboxes() {
        if (!nightAvgCheckboxContainer) return;
        nightAvgCheckboxContainer.innerHTML = '';
        Object.entries(nightAvgSelectableStats).forEach(([key, config]) => {
            const div = document.createElement('div');
            const label = document.createElement('label');
            label.className = 'inline-flex items-center';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 night-avg-pentagon-stat-option'; // Unique class
            input.dataset.statKey = key;
            input.dataset.statLabel = config.label;
            input.checked = config.default;
            input.addEventListener('change', handleNightAvgCheckboxChange);
            const span = document.createElement('span');
            span.className = 'ml-2 text-sm text-gray-700';
            span.textContent = config.label;
            label.appendChild(input);
            label.appendChild(span);
            div.appendChild(label);
            nightAvgCheckboxContainer.appendChild(div);
        });
        updateNightAvgStatSelectionUI();
    }

    // --- Main Rendering Logic for Night Avg Graph ---
    function renderNightAvgGraphView() {
        // Initial setup (run only once when tab is first viewed or data arrives)
        if (!nightAvgInitialRenderDone) {
            // console.log("Performing initial setup for Night Avg Graph View...");
            // Get DOM elements
            nightAvgCheckboxContainer = document.getElementById('night-avg-pentagon-stat-checkboxes');
            nightAvgUpdateButton = document.getElementById('update-night-avg-graphs-btn');
            nightAvgValidationMsg = document.getElementById('night-avg-stat-validation-msg');
            nightAvgPlayerGrid = document.getElementById('night-avg-player-grid');
            nightAvgSelectorToggle = document.getElementById('night-avg-stat-selector-toggle');
            nightAvgSelectorContent = document.getElementById('night-avg-stat-selector-content');
            nightAvgSelectorArrow = document.getElementById('night-avg-stat-arrow');

            if (!nightAvgCheckboxContainer || !nightAvgUpdateButton || !nightAvgValidationMsg || !nightAvgPlayerGrid || !nightAvgSelectorToggle || !nightAvgSelectorContent || !nightAvgSelectorArrow) {
                console.error("Missing required elements for Night Avg graph tab setup!");
                const graphTab = document.getElementById('night-avg-tab-graph');
                if (graphTab) graphTab.innerHTML = '<p class="text-red-500 p-4">Error: UI elements missing for graph view.</p>';
                return;
            }

            nightAvgSelectableStats = generateSelectableStatsConfig(nightAvgColumns);
            populateNightAvgStatCheckboxes();
            nightAvgUpdateButton.addEventListener('click', handleUpdateNightAvgGraphsClick);
            nightAvgSelectorToggle.addEventListener('click', () => {
                nightAvgSelectorContent.classList.toggle('hidden');
                nightAvgSelectorArrow.classList.toggle('rotate-180');
            });
            nightAvgInitialRenderDone = true;
        }

        if (!nightAvgStats) {
            // console.warn("Night Avg stats not loaded yet for graph view.");
            if (nightAvgPlayerGrid) nightAvgPlayerGrid.innerHTML = '<div class="text-center py-8 text-orange-500 col-span-full">Night Avg data is still loading...</div>';
            return;
        }

        ensureNightAvgStatRangesCalculated();

        if (!nightAvgGraphPopulated) {
            if (Object.keys(getSelectedNightAvgStats()).length === PENTAGON_STAT_LIMIT_STATS) {
                // console.log("Triggering initial graph render for Night Avg.");
                handleUpdateNightAvgGraphsClick();
                nightAvgGraphPopulated = true;
            } else {
                if (nightAvgPlayerGrid) nightAvgPlayerGrid.innerHTML = '<div class="text-center py-8 text-gray-500 col-span-full">Select 5 stats and click "Update Graphs".</div>';
            }
        }
    }

    // Check if the graph tab is active and needs rendering
    function checkAndRenderNightAvgGraph() {
        const graphTabButton = document.getElementById('night-avg-graph-tab');
        if (graphTabButton && graphTabButton.getAttribute('aria-selected') === 'true') {
            renderNightAvgGraphView();
        }
    }

    // --- NEW Event Handler for Night Avg Tabs ---
    function handleNightAvgSubTabClick(event) {
        // console.log('[DEBUG] NightAvg subtab click handler fired');
        const clickedTab = event.target.closest('.map-tab-button');
        if (!clickedTab || !clickedTab.closest('#night-avg-sub-tabs')) return;
        event.preventDefault();
        const targetPaneSelector = clickedTab.dataset.tabsTarget;
        const targetPane = document.querySelector(targetPaneSelector);
        const tabContainer = clickedTab.closest('ul');
        const allTabs = tabContainer.querySelectorAll('.map-tab-button');
        const contentContainer = document.getElementById('night-avg-tab-content');
        const allPanes = contentContainer ? contentContainer.querySelectorAll('.night-avg-tab-pane') : [];
        allTabs.forEach(tab => { tab.classList.remove('active'); tab.setAttribute('aria-selected', 'false'); });
        clickedTab.classList.add('active');
        clickedTab.setAttribute('aria-selected', 'true');
        allPanes.forEach(pane => { pane.classList.add('hidden'); pane.classList.remove('active'); });
        if (targetPane) {
            targetPane.classList.remove('hidden');
            targetPane.classList.add('active');
        } else {
            console.error(`Target pane not found for selector: ${targetPaneSelector}`);
        }
        if (targetPaneSelector === '#night-avg-tab-graph') {
            renderNightAvgGraphView();
        } else if (targetPaneSelector === '#night-avg-tab-head2head') {
            renderNightAvgH2HView();
        }
    }

    // --- NEW: Getter functions for stats by steam ID ---
    function getSeasonStatsBySteamId(steamId) {
        return seasonStatsBySteamId[steamId] || null;
    }

    function getLast10StatsBySteamId(steamId) {
        return last10StatsBySteamId[steamId] || null;
    }

    function getNightAvgStatsBySteamId(steamId) { // Added for completeness
        return nightAvgStatsBySteamId[steamId] || null;
    }

    // --- NEW: Season Avg Head-to-Head View Logic ---

    // --- Generic H2H View Factory ---
    function createH2HView({
      tabPrefix,
      getStats,
      getStatsBySteamId,
      columns,
      getStatRanges,
      ensureStatRanges,
      selectableStats,
      statLimit = 5
    }) {
      // DOM element IDs - Update to match the new HTML structure
      const player1SelectId = `${tabPrefix}-h2h-player1-select`;
      const player2SelectId = `${tabPrefix}-h2h-player2-select`;
      const checkboxesId = `${tabPrefix}-h2h-pentagon-stat-checkboxes`;
      const updateBtnId = `update-${tabPrefix}-h2h-graph-btn`;
      const validationMsgId = `${tabPrefix}-h2h-stat-validation-msg`;
      const chartContainerId = `${tabPrefix}-h2h-chart-container`;
      const statSelectorToggleId = `${tabPrefix}-h2h-stat-selector-toggle`;
      const statSelectorContentId = `${tabPrefix}-h2h-stat-selector-content`;
      const statSelectorArrowId = `${tabPrefix}-h2h-stat-arrow`;
      
      // The tab content container and the tab itself
      const tabId = `${tabPrefix}-tab-head2head`;
      
      let initialRenderDone = false;

      // --- Helpers ---
      function generateSelectableStatsConfig(columns) {
        const config = {};
        let defaultCount = 0;
        columns.forEach(col => {
          if (col.key && col.label && col.key !== 'name') {
            const isDefault = defaultCount < statLimit;
            config[col.key] = {
              label: col.label,
              default: isDefault,
              format: col.isPercentage ? 'percent' : (col.decimals === 2 ? 'decimal2' : (col.decimals === 1 ? 'decimal1' : 'decimal0'))
            };
            if (isDefault) defaultCount++;
          }
        });
        return config;
      }

      function getSelectedStats() {
        const selectedConfig = {};
        const checkboxes = document.getElementById(checkboxesId)?.querySelectorAll('input[type="checkbox"]:checked') || [];
        checkboxes.forEach(cb => {
          const key = cb.dataset.statKey;
          if (selectableStats[key]) {
            selectedConfig[key] = selectableStats[key];
          }
        });
        return selectedConfig;
      }

      function updateStatSelectionUI() {
        const container = document.getElementById(checkboxesId);
        const validationMsg = document.getElementById(validationMsgId);
        const updateBtn = document.getElementById(updateBtnId);
        if (!container || !validationMsg || !updateBtn) return;
        const selectedCount = Object.keys(getSelectedStats()).length;
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        if (selectedCount === statLimit) {
          validationMsg.textContent = '';
          updateBtn.disabled = false;
          updateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          checkboxes.forEach(cb => { cb.disabled = !cb.checked; });
        } else {
          validationMsg.textContent = `Select ${statLimit} stats (${selectedCount} selected)`;
          updateBtn.disabled = true;
          updateBtn.classList.add('opacity-50', 'cursor-not-allowed');
          checkboxes.forEach(cb => { cb.disabled = false; });
        }
      }

      function handleCheckboxChange() {
        updateStatSelectionUI();
        // Auto-update H2H graph if both players and 5 stats are selected
        const p1 = document.getElementById(player1SelectId)?.value;
        const p2 = document.getElementById(player2SelectId)?.value;
        const selectedStatCount = Object.keys(getSelectedStats()).length;
        if (p1 && p2 && selectedStatCount === statLimit) {
          handleUpdateGraphClick();
        }
      }

      function populatePlayerSelectors() {
        const stats = getStats();
        const player1Select = document.getElementById(player1SelectId);
        const player2Select = document.getElementById(player2SelectId);

        if (!stats || !player1Select || !player2Select) {
            console.warn(`Cannot populate H2H player selectors for ${tabPrefix}: Stats or select elements not found.`);
            player1Select.innerHTML = '<option value="" disabled selected>Data loading...</option>';
            player2Select.innerHTML = '<option value="" disabled selected>Data loading...</option>';
            return;
        }

        // Filter players differently based on the tab
        let activePlayers = [];
        if (tabPrefix === 'night-avg') {
            // Night avg doesn't have 'matches', assume all players are active
            activePlayers = stats.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            // Season and Last10 require matches > 0
            activePlayers = stats.filter(p => p && typeof p.matches === 'number' && p.matches > 0).sort((a, b) => a.name.localeCompare(b.name));
        }

        if (activePlayers.length === 0) {
             console.warn(`No active players found for ${tabPrefix} H2H selectors.`);
             player1Select.innerHTML = '<option value="" disabled selected>No players</option>';
             player2Select.innerHTML = '<option value="" disabled selected>No players</option>';
             return;
        }

        // Store current selections
        const currentP1 = player1Select.value;
        const currentP2 = player2Select.value;

        // Populate options
        player1Select.innerHTML = '<option value="" disabled selected>Select Player 1</option>';
        player2Select.innerHTML = '<option value="" disabled selected>Select Player 2</option>';

        activePlayers.forEach(player => {
            if (!player || !player.steam_id || !player.name) {
                console.warn("Skipping invalid player data during H2H selector population:", player);
                return;
            }
            const option1 = document.createElement('option');
            option1.value = player.steam_id;
            option1.textContent = player.name;
            player1Select.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = player.steam_id;
            option2.textContent = player.name;
            player2Select.appendChild(option2);
        });

        // Restore previous selections if possible
        player1Select.value = currentP1 || "";
        player2Select.value = currentP2 || "";

        // Define change handler
        const handlePlayerSelectionChange = () => {
            const p1 = player1Select.value;
            const p2 = player2Select.value;

            // Disable selecting the same player
            Array.from(player2Select.options).forEach(opt => { opt.disabled = (opt.value === p1 && p1 !== ''); });
            Array.from(player1Select.options).forEach(opt => { opt.disabled = (opt.value === p2 && p2 !== ''); });

            updateStatSelectionUI(); // Update button state based on player selection

            // Auto-update graph if players and stats are valid
            const selectedStatCount = Object.keys(getSelectedStats()).length;
            if (p1 && p2 && selectedStatCount === statLimit) {
                handleUpdateGraphClick();
            }
        };

        // Remove old listeners before adding new ones to prevent duplicates
        player1Select.removeEventListener('change', handlePlayerSelectionChange);
        player1Select.addEventListener('change', handlePlayerSelectionChange);
        player2Select.removeEventListener('change', handlePlayerSelectionChange);
        player2Select.addEventListener('change', handlePlayerSelectionChange);

        // Initial call to set disabled options correctly
        handlePlayerSelectionChange();
      }

      function populateStatCheckboxes() {
        const container = document.getElementById(checkboxesId);
        if (!container) return;
        container.innerHTML = '';
        Object.entries(selectableStats).forEach(([key, config]) => {
          const div = document.createElement('div');
          const label = document.createElement('label');
          label.className = 'inline-flex items-center';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.className = `form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${tabPrefix}-h2h-pentagon-stat-option`;
          input.dataset.statKey = key;
          input.dataset.statLabel = config.label;
          input.checked = config.default;
          input.addEventListener('change', handleCheckboxChange);
          const span = document.createElement('span');
          span.className = 'ml-2 text-sm text-gray-700';
          span.textContent = config.label;
          label.appendChild(input);
          label.appendChild(span);
          div.appendChild(label);
          container.appendChild(div);
        });
        updateStatSelectionUI();
      }

      function handleUpdateGraphClick() {
        const validationMsg = document.getElementById(validationMsgId);
        const chartContainer = document.getElementById(chartContainerId);
        const player1Select = document.getElementById(player1SelectId);
        const player2Select = document.getElementById(player2SelectId);
        const selectedStatsConfig = getSelectedStats();
        const player1Id = player1Select.value;
        const player2Id = player2Select.value;
        if (Object.keys(selectedStatsConfig).length !== statLimit || !player1Id || !player2Id) {
          updateStatSelectionUI();
          return;
        }
        if (!getStatsBySteamId || !chartContainer || !PlayerCharts || typeof PlayerCharts.renderOverlayPentagonChart !== 'function') {
          validationMsg.textContent = 'Error: Required resources missing.';
          return;
        }
        const player1Data = getStatsBySteamId(player1Id);
        const player2Data = getStatsBySteamId(player2Id);
        if (!player1Data || !player2Data) {
          validationMsg.textContent = 'Error: Player data not found.';
          return;
        }
        let canvasId = `${tabPrefix}-h2h-chart-canvas`;
        let canvas = document.getElementById(canvasId);
        if (!canvas) {
          chartContainer.innerHTML = '';
          canvas = document.createElement('canvas');
          canvas.id = canvasId;
          canvas.width = 400;
          canvas.height = 384;
          chartContainer.appendChild(canvas);
        }
        ensureStatRanges();
        const statRanges = getStatRanges();
        if (Object.keys(statRanges).length === 0) {
          validationMsg.textContent = 'Error: Stat ranges unavailable. Data might still be loading.';
          return;
        }
        setTimeout(() => {
          PlayerCharts.renderOverlayPentagonChart(
            player1Data,
            player2Data,
            canvasId,
            selectedStatsConfig,
            statRanges
          );
        }, 0);
        validationMsg.textContent = 'Comparison updated!';
        setTimeout(() => { validationMsg.textContent = ''; }, 2000);
      }

      function render() {
        // Ensure H2H selectable stats config is generated if needed
        if (Object.keys(selectableStats).length === 0) {
            // console.log(`Generating ${tabPrefix} H2H selectable stats...`);
            const newConfig = generateSelectableStatsConfig(columns);

            // *** FIX: Modify the object referenced by selectableStats directly ***
            // Clear existing keys (should be empty, but good practice)
            Object.keys(selectableStats).forEach(key => delete selectableStats[key]);
            // Assign new keys from the generated config
            Object.assign(selectableStats, newConfig);
            // Removed the call to setSelectableStats

            // console.log(`${tabPrefix} H2H selectable stats generated:`, selectableStats);
        }

        if (!initialRenderDone) {
        //   console.log(`Performing initial setup for ${tabPrefix} H2H View...`);
          // Get DOM elements
          const player1Select = document.getElementById(player1SelectId);
          const player2Select = document.getElementById(player2SelectId);
          const checkboxesContainer = document.getElementById(checkboxesId);
          const updateBtn = document.getElementById(updateBtnId);
          const validationMsg = document.getElementById(validationMsgId);
          const chartContainer = document.getElementById(chartContainerId);
          const statSelectorToggle = document.getElementById(statSelectorToggleId);
          const statSelectorContent = document.getElementById(statSelectorContentId);
          const statSelectorArrow = document.getElementById(statSelectorArrowId);
          if (!player1Select || !player2Select || !checkboxesContainer || !updateBtn || !validationMsg || !chartContainer || !statSelectorToggle || !statSelectorContent || !statSelectorArrow) {
            const h2hTab = document.getElementById(tabId);
            if (h2hTab) h2hTab.innerHTML = '<p class="text-red-500 p-4">Error: UI elements missing for H2H view.</p>';
            return;
          }
          populatePlayerSelectors();
          populateStatCheckboxes();
          updateBtn.addEventListener('click', handleUpdateGraphClick);
          statSelectorToggle.addEventListener('click', () => {
            statSelectorContent.classList.toggle('hidden');
            statSelectorArrow.classList.toggle('rotate-180');
          });
          initialRenderDone = true;
        }
        // Data dependent logic
        const stats = getStats();
        const player1Select = document.getElementById(player1SelectId);
        const player2Select = document.getElementById(player2SelectId);
        const updateBtn = document.getElementById(updateBtnId);
        const chartContainer = document.getElementById(chartContainerId);
        if (!stats) {
          if (chartContainer) chartContainer.innerHTML = '<div class="text-center py-8 text-orange-500 col-span-full">Season data is still loading...</div>';
          if (player1Select) player1Select.disabled = true;
          if (player2Select) player2Select.disabled = true;
          if (updateBtn) updateBtn.disabled = true;
          return;
        } else {
          if (player1Select) player1Select.disabled = false;
          if (player2Select) player2Select.disabled = false;
          updateStatSelectionUI();
          // Re-populate selectors if data loaded after initial render but selectors are empty
          if (player1Select && player1Select.options.length <= 1 && stats) {
            //   console.log(`Repopulating ${tabPrefix} H2H player selectors as data is now available.`);
              populatePlayerSelectors();
          }
        }
        if (chartContainer && !chartContainer.querySelector('canvas')) {
          chartContainer.innerHTML = '<div class="text-center py-8 text-gray-500 col-span-full">Select two players and 5 stats, then click "Update Comparison".</div>';
        }
      }

      return { render };
    }

    // --- Main Rendering Function for H2H View (Season Avg) ---
    const seasonAvgH2HView = createH2HView({
      tabPrefix: 'season-avg',
      getStats: () => seasonStats,
      getStatsBySteamId: (id) => seasonStatsBySteamId[id],
      columns: commonColumns,
      getStatRanges: () => seasonAvgAllStatRanges,
      ensureStatRanges: ensureSeasonAvgStatRangesCalculated,
      selectableStats: seasonAvgH2HSelectableStats,
      statLimit: PENTAGON_STAT_LIMIT_STATS
    });

    function renderSeasonAvgH2HView() {
      seasonAvgH2HView.render();
    }

    // --- Main Rendering Function for H2H View (Last 10) ---
    let last10H2HSelectableStats = {};
    const last10H2HView = createH2HView({
      tabPrefix: 'last10',
      getStats: () => last10Stats,
      getStatsBySteamId: (id) => last10StatsBySteamId[id],
      columns: commonColumns,
      getStatRanges: () => last10AllStatRanges,
      ensureStatRanges: ensureLast10StatRangesCalculated,
      selectableStats: last10H2HSelectableStats,
      statLimit: PENTAGON_STAT_LIMIT_STATS
    });

    function renderLast10H2HView() {
      last10H2HView.render();
    }

    // --- Main Rendering Function for H2H View (Night Avg) ---
    let nightAvgH2HSelectableStats = {};
    const nightAvgH2HView = createH2HView({
      tabPrefix: 'night-avg',
      getStats: () => nightAvgStats,
      getStatsBySteamId: (id) => nightAvgStatsBySteamId[id],
      columns: nightAvgColumns, // Use night-specific columns
      getStatRanges: () => nightAvgAllStatRanges,
      ensureStatRanges: ensureNightAvgStatRangesCalculated,
      selectableStats: nightAvgH2HSelectableStats,
      statLimit: PENTAGON_STAT_LIMIT_STATS
    });

    function renderNightAvgH2HView() {
      nightAvgH2HView.render();
    }

    // --- Initialization ---
    function init() {
        loadAndRenderSeasonAvgTable();
        loadAndRenderLast10Table();
        loadAndRenderNightAvgTable();

        // Add event listener for season average sub-tabs
        const seasonAvgTabsContainer = document.getElementById('season-avg-sub-tabs');
        if (seasonAvgTabsContainer) {
            seasonAvgTabsContainer.removeEventListener('click', handleSeasonAvgSubTabClick);
            seasonAvgTabsContainer.addEventListener('click', handleSeasonAvgSubTabClick);
        }

        // Add event listener for last 10 sub-tabs
        const last10TabsContainer = document.getElementById('last10-sub-tabs');
        if (last10TabsContainer) {
            last10TabsContainer.removeEventListener('click', handleLast10SubTabClick);
            last10TabsContainer.addEventListener('click', handleLast10SubTabClick);
        }

        // Add event listener for night average sub-tabs
        const nightAvgTabsContainer = document.getElementById('night-avg-sub-tabs');
        if (nightAvgTabsContainer) {
            nightAvgTabsContainer.removeEventListener('click', handleNightAvgSubTabClick);
            nightAvgTabsContainer.addEventListener('click', handleNightAvgSubTabClick);
        }
    }

    // Public interface
    return {
        init: init,
        fillSeasonAvgTable: fillSeasonAvgTable,
        fillLast10Table: fillLast10Table,
        fillNightAvgTable: fillNightAvgTable,
        get seasonStats() { return seasonStats; },
        get last10Stats() { return last10Stats; },
        get nightAvgStats() { return nightAvgStats; },
        getSeasonStatsBySteamId: getSeasonStatsBySteamId, // Expose new getter
        getLast10StatsBySteamId: getLast10StatsBySteamId, // Expose new getter
        getNightAvgStatsBySteamId: getNightAvgStatsBySteamId // Expose new getter
    };
})();

// Make StatsTables globally available if needed by other scripts (like MainScript for sorting)
// window.StatsTables = StatsTables; // Or manage dependencies differently
// Expose globally for TeamPicker to use
window.StatsTables = StatsTables;