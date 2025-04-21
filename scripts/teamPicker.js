// ==================================================
// --- Team Picker Module/Object --- 
// ==================================================

// --- NEW: Fixed Config for Team Comparison Chart ---
const TEAM_CHART_STATS = {
    L10_HLTV2: { label: 'L10 HLTV' },
    L10_ADR: { label: 'L10 ADR' },
    L10_KD: { label: 'L10 K/D' },
    S_HLTV2: { label: 'S HLTV' },
    S_ADR: { label: 'S ADR' },
};

const TEAM_CHART_FIXED_RANGES = {
    L10_HLTV2: { min: 0.7, max: 1.4 },
    L10_ADR: { min: 75, max: 100 },
    L10_KD: { min: 0.7, max: 1.4 },
    S_HLTV2: { min: 0.7, max: 1.4 },
    S_ADR: { min: 75, max: 100 },
};
// --- End Fixed Config ---

// --- NEW: Helper to normalize using fixed ranges ---
function normalizeStatWithFixedRange(value, statKey, fixedRanges) {
    const range = fixedRanges[statKey];
    if (!range || range.max === range.min || typeof value !== 'number' || isNaN(value)) {
        return 0; // Return 0 if range is invalid or value is not a number
    }
    // Clamp the value within the fixed range before normalizing
    const clampedValue = Math.max(range.min, Math.min(range.max, value));
    const normalized = ((clampedValue - range.min) / (range.max - range.min)) * 100;
    return Math.max(0, Math.min(100, normalized)); // Ensure result is between 0 and 100
}
// --- End Helper ---

const TeamPicker = {
    // --- Constants (Specific to Team Picker) ---
    KABILE_JSON_URL: 'data/kabile.json',
    MAPS_JSON_URL: 'data/maps.json',
    DB_PATH: 'teamPickerState', // Firebase root path for this feature

    // --- State (specific to Team Picker) ---
    // These will now be primarily populated/updated by Firebase listeners
    availablePlayers: {}, // CHANGED: Use map keyed by steamId { steamId: { name: ..., steamId: ..., status: ..., stats: ... } }
    currentAttendanceData: {}, // Stores latest { steamId: { name: ..., status: ...} } from Firebase
    teamAPlayersData: {}, // CHANGED: Use map keyed by steamId { steamId: { name: ..., steamId: ..., stats: ... } }
    teamBPlayersData: {}, // CHANGED: Use map keyed by steamId { steamId: { name: ..., steamId: ..., stats: ... } }
    teamAName: 'Team A', // Can be updated by Kabile selection via FB
    teamBName: 'Team B', // Can be updated by Kabile selection via FB
    mapSelections: { // Will be populated by FB listener
        map1: { mapName: '', t_team: '', ct_team: '' },
        map2: { mapName: '', t_team: '', ct_team: '' },
        map3: { mapName: '', t_team: '', ct_team: '' },
    },
    teamAAverages: {}, // Added to store calculated averages for Team A
    teamBAverages: {}, // Added to store calculated averages for Team B
    MAX_PLAYERS_PER_TEAM: 15,
    dbRef: null, // Firebase database reference
    listenersAttached: false, // Flag to prevent duplicate listeners
    teamComparisonChartInstance: null, // Store chart instance

    /**
     * Initializes the team picker page
     */
    init: function() {
        // Get reference to the Firebase path for the team picker
        // Assuming 'database' is globally available from MainScript.js (initialized in DOMContentLoaded)
        if (typeof database === 'undefined' || database === null) {
            console.error("Firebase database is not initialized or assignment failed.");
            showMessage("Error connecting to sync service.", 'error');
            return;
        }
        this.dbRef = database.ref(this.DB_PATH);

        // Load static dropdown options first (Kabile, Maps)
        Promise.all([
            TeamPicker.fetchKabileData(),
            TeamPicker.fetchMapsData(),
        ]).then(([kabileData, mapsData]) => {
            TeamPicker.populateKabileDropdowns(kabileData); // Populate options
            TeamPicker.populateMapDropdowns(mapsData);     // Populate options
            
            // Initial population of available players - REMOVED
            // TeamPicker.updateAvailablePlayersList(); // Now handled by Firebase listener

            // Attach Firebase Listeners (only once)
            if (!this.listenersAttached) {
                TeamPicker.attachFirebaseListeners();
                this.listenersAttached = true;
            }

            // Setup local UI event listeners (dropdown changes, etc.)
            // These will now WRITE to Firebase, not just update local state/UI
            TeamPicker.setupLocalEventListeners(); 

        }).catch(error => {
            console.error('Error loading static data for Team Picker:', error);
            showMessage('Error loading Kabile/Map options.', 'error');
            // Attempt to proceed without dropdown options if necessary
             if (!this.listenersAttached) {
                TeamPicker.attachFirebaseListeners();
                this.listenersAttached = true;
            }
            TeamPicker.setupLocalEventListeners();
        });
    },

    /**
     * Attaches Firebase listeners to sync state
     */
    attachFirebaseListeners: function() {
        if (!this.dbRef) return;

        // --- Listener for Attendance State --- 
        if (typeof database !== 'undefined' && database !== null && Attendance.ATTENDANCE_DB_PATH) {
            const attendanceRef = database.ref(Attendance.ATTENDANCE_DB_PATH);
            attendanceRef.on('value', (snapshot) => {
                const newAttendanceDataRaw = snapshot.val() || {};
                console.log("TeamPicker received raw attendance update:", newAttendanceDataRaw);

                // --- Process raw attendance into the steamId keyed format ---
                // *** ASSUMPTION: newAttendanceDataRaw is like { playerName: { status: 'coming', steamId: '...' } } ***
                // *** OR { steamId: { name: '...', status: '...' } } ***
                // *** Adapt this processing based on your ACTUAL attendance data structure ***
                const newAttendanceDataProcessed = {};
                let processingError = false;
                for (const key in newAttendanceDataRaw) {
                    const playerData = newAttendanceDataRaw[key];
                    let steamId = null;
                    let playerName = null;
                    let status = null;

                    // Try to determine structure and extract data
                    if (playerData && playerData.steamId && playerData.status) { // Assumes key is playerName
                        steamId = playerData.steamId;
                        playerName = key;
                        status = playerData.status;
                    } else if (playerData && playerData.name && playerData.status) { // Assumes key is steamId
                        steamId = key;
                        playerName = playerData.name;
                        status = playerData.status;
                    } else {
                         console.warn(`Could not determine SteamID/Name/Status from attendance entry with key '${key}':`, playerData);
                         processingError = true;
                         continue; // Skip this entry
                    }

                    if (steamId && playerName && status) {
                         // Ensure steamId is stored as a string if it's numeric
                        const steamIdStr = String(steamId);
                        newAttendanceDataProcessed[steamIdStr] = { name: playerName, status: status, steamId: steamIdStr };
                    } else {
                        console.warn(`Missing required data (SteamID, Name, or Status) for attendance entry with key '${key}`);
                         processingError = true;
                    }
                }
                if(processingError) {
                    showMessage("Warning: Some attendance data could not be processed. Check format.", 'warning');
                }
                console.log("TeamPicker processed attendance data:", newAttendanceDataProcessed);
                // --- End processing --- 

                // --- New Logic: Remove players from teams if not 'coming' anymore --- 
                const updates = {};
                const playersToRemove = [];

                // Check Team A (using steamId as key)
                Object.keys(TeamPicker.teamAPlayersData).forEach(steamId => {
                    if (!newAttendanceDataProcessed[steamId] || newAttendanceDataProcessed[steamId].status !== 'coming') {
                        updates[`${TeamPicker.DB_PATH}/teamA/players/${steamId}`] = null;
                        playersToRemove.push(TeamPicker.teamAPlayersData[steamId]?.name || steamId); // Log name or ID
                    }
                });

                // Check Team B (using steamId as key)
                Object.keys(TeamPicker.teamBPlayersData).forEach(steamId => {
                    if (!newAttendanceDataProcessed[steamId] || newAttendanceDataProcessed[steamId].status !== 'coming') {
                        // Avoid duplicate remove update if already removed from Team A (Firebase handles this fine)
                        updates[`${TeamPicker.DB_PATH}/teamB/players/${steamId}`] = null;
                        if (!playersToRemove.includes(TeamPicker.teamBPlayersData[steamId]?.name || steamId)) {
                             playersToRemove.push(TeamPicker.teamBPlayersData[steamId]?.name || steamId);
                        }
                    }
                });

                // Perform Firebase update if needed
                if (Object.keys(updates).length > 0) {
                    console.log("Removing players due to attendance change:", playersToRemove);
                    database.ref().update(updates).catch(error => {
                        console.error("Error removing players based on attendance change:", error);
                        showMessage("Error updating teams based on attendance.", 'error');
                    });
                    // Note: The teamA/teamB listeners will handle the UI update for team lists
                }
                // --- End New Logic ---

                // Update local state and refresh available players list
                this.currentAttendanceData = newAttendanceDataProcessed; 
                this.updateAvailablePlayerDisplay(); // Update the list based on new attendance
            }, (error) => {
                console.error("Firebase attendance listener error in TeamPicker:", error);
            });
        } else {
            console.error('Firebase database or Attendance DB path not available for TeamPicker listener.');
        }
        // --- End Attendance Listener ---

        // Listener for Team A
        this.dbRef.child('teamA').on('value', (snapshot) => {
            const teamAData = snapshot.val() || { players: {}, kabile: '' };
            TeamPicker.teamAName = teamAData.kabile || 'Team A';
            // Store player map directly from Firebase
            TeamPicker.teamAPlayersData = teamAData.players || {};
            // Update slots using the new map structure
            TeamPicker.updatePlayerSlots('team-a-players', TeamPicker.teamAPlayersData, 'a');
            TeamPicker.updateAvailablePlayerDisplay(); // Refresh available list display state
            const teamAKabileSelect = document.getElementById('team-a-kabile');
            if(teamAKabileSelect) teamAKabileSelect.value = teamAData.kabile || "";
            TeamPicker.updateMapSideTeamNames();
            TeamPicker.updateStatsDifferenceDisplay(); // Update diff display & trigger chart update
        });

        // Listener for Team B
        this.dbRef.child('teamB').on('value', (snapshot) => {
            const teamBData = snapshot.val() || { players: {}, kabile: '' };
            TeamPicker.teamBName = teamBData.kabile || 'Team B';
            // Store player map directly from Firebase
            TeamPicker.teamBPlayersData = teamBData.players || {};
            // Update slots using the new map structure
            TeamPicker.updatePlayerSlots('team-b-players', TeamPicker.teamBPlayersData, 'b');
            TeamPicker.updateAvailablePlayerDisplay(); // Refresh available list display state
            const teamBKabileSelect = document.getElementById('team-b-kabile');
            if(teamBKabileSelect) teamBKabileSelect.value = teamBData.kabile || "";
            TeamPicker.updateMapSideTeamNames();
            TeamPicker.updateStatsDifferenceDisplay(); // Update diff display & trigger chart update
        });

        // Listener for Maps
        this.dbRef.child('maps').on('value', (snapshot) => {
            const mapsData = snapshot.val() || {};
            TeamPicker.mapSelections = { // Update local state
                map1: mapsData.map1 || { mapName: '', t_team: '', ct_team: '' },
                map2: mapsData.map2 || { mapName: '', t_team: '', ct_team: '' },
                map3: mapsData.map3 || { mapName: '', t_team: '', ct_team: '' },
            };
            // Update the map and side selection dropdowns in the UI
            TeamPicker.updateMapSelectsFromFirebase(TeamPicker.mapSelections);
        });
        
        // Listener for Available Players (if we decide to sync this list via Firebase)
        // this.dbRef.child('availablePlayers').on('value', (snapshot) => { ... });
        // For now, availablePlayers is derived locally and assignments are synced.
    },
    
     /**
     * Sets up local UI event listeners that trigger Firebase writes
     */
    setupLocalEventListeners: function() {
        // Kabile Selection
        const teamAKabileSelect = document.getElementById('team-a-kabile');
        const teamBKabileSelect = document.getElementById('team-b-kabile');
        if (teamAKabileSelect) teamAKabileSelect.addEventListener('change', (e) => TeamPicker.handleKabileChange('a', e.target.value));
        if (teamBKabileSelect) teamBKabileSelect.addEventListener('change', (e) => TeamPicker.handleKabileChange('b', e.target.value));

        // Map and Side Selection
        TeamPicker.setupMapSideSelectionListeners(); // Reuse existing setup, but handlers will write to FB

        // Player clicks (Available List - Handles Assign AND Remove)
        const availablePlayersContainer = document.getElementById('available-players');
        if (availablePlayersContainer) {
             availablePlayersContainer.removeEventListener('click', TeamPicker.handleAvailableListClick); // Use new handler
             availablePlayersContainer.addEventListener('click', TeamPicker.handleAvailableListClick);
         }
        
        // Player clicks (Team Lists - for removal)
        const teamAContainer = document.getElementById('team-a-players');
        const teamBContainer = document.getElementById('team-b-players');
        if (teamAContainer) {
            teamAContainer.removeEventListener('click', TeamPicker.handleTeamPlayerClick);
            teamAContainer.addEventListener('click', (e) => TeamPicker.handleTeamPlayerClick(e, 'a'));
        }
         if (teamBContainer) {
            teamBContainer.removeEventListener('click', TeamPicker.handleTeamPlayerClick);
            teamBContainer.addEventListener('click', (e) => TeamPicker.handleTeamPlayerClick(e, 'b'));
        }
        
        // NEW: Create Match Button Listener
        const createMatchBtn = document.getElementById('create-match-button');
        if (createMatchBtn) {
            createMatchBtn.addEventListener('click', TeamPicker.createMatchFromUI);
        }
    },
    
    /**
     * Handles changes to the Kabile select dropdowns. Writes to Firebase.
     * @param {'a' | 'b'} teamId - The team identifier ('a' or 'b').
     * @param {string} kabileName - The selected kabile name.
     */
    handleKabileChange: function(teamId, kabileName) {
        if (!this.dbRef) return;
        const teamPath = teamId === 'a' ? 'teamA' : 'teamB';
        this.dbRef.child(teamPath).child('kabile').set(kabileName)
            .catch(error => {
                console.error(`Error updating Kabile for Team ${teamId.toUpperCase()}:`, error);
                showMessage(`Failed to update Kabile for Team ${teamId.toUpperCase()}.`, 'error');
            });
    },

    /**
     * Handles clicks within the available players list (Assign or Remove).
     * @param {Event} event - The click event.
     */
    handleAvailableListClick: function(event) {
        const assignButton = event.target.closest('button.assign-button');
        const removeButton = event.target.closest('button.remove-from-list-button');
        const playerRow = event.target.closest('tr'); // Get the row element
        const steamId = playerRow?.dataset.steamId; // Get steamId from the row

        if (!steamId) return; // Need steamId to proceed

        // Find the full player data from the availablePlayers map
        const playerData = TeamPicker.availablePlayers[steamId]; 
        if (!playerData) {
            console.error(`Could not find player data for steamId ${steamId} in availablePlayers map.`);
            showMessage(`Internal error: Player data not found for ${steamId}.`, 'error');
            return;
        }

        if (assignButton) {
            // --- ASSIGN LOGIC ---
            const targetTeam = assignButton.dataset.targetTeam; // 'a' or 'b'
            if (!targetTeam || !TeamPicker.dbRef) return;
            console.log(`Assigning ${playerData.name} (ID: ${steamId}) to Team ${targetTeam.toUpperCase()}`);

            const updates = {};
            const targetTeamPath = targetTeam === 'a' ? 'teamA' : 'teamB';
            const sourceTeamPath = targetTeam === 'a' ? 'teamB' : 'teamA';

            // Ensure player data has stats merged before assigning
            const playerWithStats = TeamPicker.mergePlayerWithStats(playerData); // Pass the object {name, steamId, status}

            updates[`${TeamPicker.DB_PATH}/${targetTeamPath}/players/${steamId}`] = playerWithStats; // Store the full object
            updates[`${TeamPicker.DB_PATH}/${sourceTeamPath}/players/${steamId}`] = null; // Remove from the other team

            database.ref().update(updates)
                 .catch(error => {
                    console.error(`Error assigning player ${playerData.name}:`, error);
                    showMessage(`Failed to assign player ${playerData.name}.`, 'error');
                });

        } else if (removeButton) {
            // --- REMOVE LOGIC (from available list view) ---
            const currentTeam = removeButton.dataset.currentTeam; // 'a' or 'b'
            if (!currentTeam || !TeamPicker.dbRef) return;
            console.log(`Removing ${playerData.name} (ID: ${steamId}) from Team ${currentTeam.toUpperCase()} via available list`);

            const teamPath = currentTeam === 'a' ? 'teamA' : 'teamB';
            const updates = {};
            updates[`${TeamPicker.DB_PATH}/${teamPath}/players/${steamId}`] = null;

            database.ref().update(updates)
                 .catch(error => {
                    console.error(`Error removing player ${playerData.name}:`, error);
                    showMessage(`Failed to remove player ${playerData.name}.`, 'error');
                });
        }
    },
    
     /**
      * Handles clicks on players within Team A or Team B lists (for removal). Writes removal to Firebase.
      * @param {Event} event - The click event.
      * @param {'a' | 'b'} teamId - The team the player is currently in.
      */
    handleTeamPlayerClick: function(event, teamId) {
        const button = event.target.closest('button.remove-button');
        const playerRow = event.target.closest('tr'); // Get row to find steamId
        if (!button || !playerRow) return;

        const steamId = playerRow.dataset.steamId; // Get steamId from row's dataset
        const playerName = playerRow.dataset.playerName; // Get name for logging

        if (!steamId || !TeamPicker.dbRef) return;

        console.log(`Removing ${playerName} (ID: ${steamId}) from Team ${teamId.toUpperCase()}`); // Debug log

        const teamPath = teamId === 'a' ? 'teamA' : 'teamB';

        const updates = {};
        // Remove from the current team using steamId
        updates[`${TeamPicker.DB_PATH}/${teamPath}/players/${steamId}`] = null;

        // Perform atomic update
        database.ref().update(updates)
             .catch(error => {
                console.error(`Error removing player ${playerName}:`, error);
                showMessage(`Failed to remove player ${playerName}.`, 'error');
            });
    },

    /**
     * Updates the map/side select dropdown values based on data from Firebase.
     * @param {object} mapsState - The maps state object from Firebase.
     */
    updateMapSelectsFromFirebase: function(mapsState) {
        for (let i = 1; i <= 3; i++) {
            const mapData = mapsState[`map${i}`] || { mapName: '', t_team: '', ct_team: '' };
            const mapSelect = document.getElementById(`map-${i}`);
            const tSelect = document.getElementById(`map${i}-t-team`);
            const ctSelect = document.getElementById(`map${i}-ct-team`);

            if (mapSelect) mapSelect.value = mapData.mapName || "";
            if (tSelect) tSelect.value = mapData.t_team || "";
            if (ctSelect) ctSelect.value = mapData.ct_team || "";
        }
         // Ensure consistency (if T is A, CT must be B) - might be handled by Firebase rules later
         TeamPicker.enforceMapSideConsistency(); 
    },

    /**
     * Updates the list of available players based on current attendance and renders the table.
     * Called by Firebase listeners for attendance and team assignments.
     */
    updateAvailablePlayerDisplay: function() {
        const availablePlayersContainer = document.getElementById('available-players');
         if (!availablePlayersContainer) return; // Safety check

        if (!this.currentAttendanceData || Object.keys(this.currentAttendanceData).length === 0) {
             availablePlayersContainer.innerHTML = '<div class="text-center py-4 text-gray-500">Loading attendance...</div>';
            return; // Wait for attendance data
        }

        // --- Build the availablePlayers map --- 
        TeamPicker.availablePlayers = {}; // Reset the map
        for (const steamId in this.currentAttendanceData) {
            const playerData = this.currentAttendanceData[steamId];
            if (playerData.status === 'coming') {
                // Start with basic data from attendance
                const playerBase = { 
                    name: playerData.name,
                    steamId: steamId, // Already have it as key
                    status: playerData.status
                };
                // Merge stats using steamId
                TeamPicker.availablePlayers[steamId] = TeamPicker.mergePlayerWithStats(playerBase);
            }
        }
        // --- End building map --- 

        this.renderAvailablePlayersTable(); // Re-render the table with the new map
    },

    /**
     * Renders the table of available players based on TeamPicker.availablePlayers
     * This is called initially and potentially by listeners if availablePlayers syncs via FB.
     */
    renderAvailablePlayersTable: function() {
         const availablePlayersContainer = document.getElementById('available-players');
        if (!availablePlayersContainer) return; // Exit if container not found

        // Clear container
        availablePlayersContainer.innerHTML = ''; // Clear previous content
        
        if (Object.keys(TeamPicker.availablePlayers).length === 0) {
            availablePlayersContainer.innerHTML = '<div class="text-center py-4 text-gray-500">No players coming or attendance data missing.</div>';
            return;
        }

        // Convert map to array for sorting
        let availablePlayersArray = Object.values(TeamPicker.availablePlayers);

        // Sort by HLTV2 by default
        availablePlayersArray.sort((a, b) => {
            const valueA = a.stats?.L10_HLTV2 ?? -Infinity;
            const valueB = b.stats?.L10_HLTV2 ?? -Infinity;
            return valueB - valueA; // Descending order
        });

        // Create table structure (same as before)
        const scrollWrapper = document.createElement('div');
        scrollWrapper.className = 'overflow-x-auto';
        const table = document.createElement('table');
        table.className = 'w-full border-collapse text-xs';
        table.id = 'available-players-table';
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase sticky top-0 z-10">
                <th class="px-1 py-1">Player</th>
                <th class="px-1 py-1 text-center">L10<br>HLT</th>
                <th class="px-1 py-1 text-center">L10<br>ADR</th>
                <th class="px-1 py-1 text-center">L10<br>K/D</th>
                <th class="px-1 py-1 text-center">S<br>HLT</th>
                <th class="px-1 py-1 text-center">S<br>ADR</th>
                <th class="px-1 py-1 text-center">S<br>K/D</th>
                <th class="px-1 py-1 text-center">Team</th> 
                <th class="px-1 py-1 text-center">Action</th>
            </tr>
        `;
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        tbody.id = 'available-players-tbody';
        table.appendChild(tbody);
        scrollWrapper.appendChild(table);
        availablePlayersContainer.appendChild(scrollWrapper);

        // Render the table body rows from the sorted array
        availablePlayersArray.forEach(player => {
            // Pass the player object which now includes steamId
            const row = TeamPicker.createAvailablePlayerRow(player); 
            tbody.appendChild(row);
        });

        // After rendering, update rows based on current assignments
        TeamPicker.updateAssignedPlayersInAvailableList();
    },
    
    /**
     * Updates the visual state of rows in the available players list 
     * based on current team assignments (TeamPicker.teamAPlayersData / TeamPicker.teamBPlayersData maps).
     */
    updateAssignedPlayersInAvailableList: function() {
        const tbody = document.getElementById('available-players-tbody');
        if (!tbody) return;

        // Use the team data maps (keyed by steamId)
        const assignedToA = TeamPicker.teamAPlayersData;
        const assignedToB = TeamPicker.teamBPlayersData;

        tbody.querySelectorAll('tr').forEach(row => {
            const steamId = row.dataset.steamId; // Get steamId from row
            const teamCell = row.querySelector('.player-team-cell');
            const actionCell = row.querySelector('.player-action-cell');

            if (!steamId || !teamCell || !actionCell) return;

            row.classList.remove('bg-blue-50', 'bg-green-50', 'opacity-50'); 
            actionCell.innerHTML = ''; // Clear actions

            if (assignedToA[steamId]) { // Check if steamId exists as key in Team A map
                row.classList.add('bg-blue-50', 'opacity-50');
                teamCell.textContent = 'A';
                teamCell.className = 'player-team-cell px-1 py-1 text-center text-blue-600 font-semibold';
                // Add remove button using steamId
                actionCell.innerHTML = `
                    <button data-current-team="a" class="remove-from-list-button text-red-500 hover:text-red-700 px-1 text-xs">Remove</button>
                `;
            } else if (assignedToB[steamId]) { // Check if steamId exists as key in Team B map
                row.classList.add('bg-green-50', 'opacity-50');
                teamCell.textContent = 'B';
                teamCell.className = 'player-team-cell px-1 py-1 text-center text-green-600 font-semibold';
                 // Add remove button using steamId
                 actionCell.innerHTML = `
                    <button data-current-team="b" class="remove-from-list-button text-red-500 hover:text-red-700 px-1 text-xs">Remove</button>
                `;
            } else {
                // Player is available
                teamCell.textContent = '-';
                teamCell.className = 'player-team-cell px-1 py-1 text-center text-gray-500';
                // Add assign buttons using steamId
                actionCell.innerHTML = `
                    <button data-target-team="a" class="assign-button text-blue-500 hover:text-blue-700 px-1 text-xs">->A</button>
                    <button data-target-team="b" class="assign-button text-green-500 hover:text-green-700 px-1 text-xs">->B</button>
                `;
            }
        });
    },

    /**
     * Creates a single row for the available players table.
     * @param {Object} player - Player object with name, steamId, status, and stats.
     * @returns {HTMLTableRowElement} The created table row.
     */
    createAvailablePlayerRow: function(player) {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150';
        row.dataset.steamId = player.steamId; // Store steamId for easy access
        row.dataset.playerName = player.name; // Store name for logging/display if needed elsewhere

        // Determine initial assignment state (will be updated by updateAssignedPlayersInAvailableList)
        const teamText = '-';
        const teamClass = 'text-gray-500';

        row.innerHTML = `
            <td class="px-1 py-1 font-medium text-gray-900 whitespace-nowrap">${player.name}</td>
            <td class="px-1 py-1 text-center">${formatStat(player.stats?.L10_HLTV2)}</td>
            <td class="px-1 py-1 text-center">${formatStat(player.stats?.L10_ADR, 0)}</td>
            <td class="px-1 py-1 text-center">${formatStat(player.stats?.L10_KD)}</td>
            <td class="px-1 py-1 text-center">${formatStat(player.stats?.S_HLTV2)}</td>
            <td class="px-1 py-1 text-center">${formatStat(player.stats?.S_ADR, 0)}</td>
            <td class="px-1 py-1 text-center">${formatStat(player.stats?.S_KD)}</td>
            <td class="player-team-cell px-1 py-1 text-center ${teamClass}">${teamText}</td>
            <td class="player-action-cell px-1 py-1 text-center whitespace-nowrap">
                <button data-target-team="a" class="assign-button text-blue-500 hover:text-blue-700 px-1 text-xs">->A</button>
                <button data-target-team="b" class="assign-button text-green-500 hover:text-green-700 px-1 text-xs">->B</button>
            </td>
        `;
        return row;
    },

    // --- updatePlayerSlots (rendering logic for team lists) ---
     /**
     * Updates the player slots table for a specific team.
     * @param {string} containerId - ID of the container element ('team-a-players' or 'team-b-players').
     * @param {Object} teamPlayersMap - Map of player objects { steamId: player } for the team.
     * @param {'a' | 'b'} teamId - Team identifier.
     */
    updatePlayerSlots: function(containerId, teamPlayersMap, teamId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        const teamColor = teamId === 'a' ? 'blue' : 'green';
        const teamPlayerArray = Object.values(teamPlayersMap); // Convert map to array for iteration/sorting

        if (teamPlayerArray.length === 0) {
             container.innerHTML = '<p class="text-center text-gray-500 text-sm py-2">No players assigned.</p>';
        } else {
            // Create table structure
            const table = document.createElement('table');
            table.className = 'w-full border-collapse text-xs';
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr class="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase sticky top-0 z-10">
                    <th class="px-1 py-1">Player</th>
                    <th class="px-1 py-1 text-center">L10<br>HLT</th>
                    <th class="px-1 py-1 text-center">L10<br>ADR</th>
                    <th class="px-1 py-1 text-center">L10<br>K/D</th>
                    <th class="px-1 py-1 text-center">S<br>HLT</th>
                    <th class="px-1 py-1 text-center">S<br>ADR</th>
                    <th class="px-1 py-1 text-center">S<br>K/D</th>
                    <th class="px-1 py-1 text-center">Action</th>
                </tr>
            `;
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            tbody.id = `team-${teamId}-tbody`;

            // Sort players by L10 HLTV descending
            teamPlayerArray.sort((a, b) => {
                const valueA = a.stats?.L10_HLTV2 ?? -Infinity;
                const valueB = b.stats?.L10_HLTV2 ?? -Infinity;
                return valueB - valueA;
            });

            teamPlayerArray.forEach(player => {
                const row = document.createElement('tr');
                row.className = `border-b border-gray-200 bg-${teamColor}-50`;
                row.dataset.steamId = player.steamId; // Use steamId in dataset
                row.dataset.playerName = player.name; // Keep name for logging/tooltip

                row.innerHTML = `
                    <td class="px-1 py-1 font-medium text-gray-900">${player.name}</td>
                    <td class="px-1 py-1 text-center">${formatStat(player.stats?.L10_HLTV2)}</td>
                    <td class="px-1 py-1 text-center">${formatStat(player.stats?.L10_ADR, 0)}</td>
                    <td class="px-1 py-1 text-center">${formatStat(player.stats?.L10_KD)}</td>
                    <td class="px-1 py-1 text-center">${formatStat(player.stats?.S_HLTV2)}</td>
                    <td class="px-1 py-1 text-center">${formatStat(player.stats?.S_ADR, 0)}</td>
                    <td class="px-1 py-1 text-center">${formatStat(player.stats?.S_KD)}</td>
                    <td class="px-1 py-1 text-center">
                         <button class="remove-button text-red-500 hover:text-red-700 px-1 text-xs">Remove</button>
                     </td>
                `;
                tbody.appendChild(row);
            });

            table.appendChild(tbody);

            // Add Averages Row
            const averagesRow = table.createTFoot().insertRow(0);
            averagesRow.id = `team-${teamId}-averages-row`;
            averagesRow.className = `bg-${teamColor}-200 font-bold text-${teamColor}-800 text-xs`;
            averagesRow.innerHTML = `
                 <td class="px-1 py-1 whitespace-nowrap">TEAM AVG</td>
                 <td class="px-1 py-1 text-center whitespace-nowrap" data-stat="L10_HLTV2">N/A</td>
                 <td class="px-1 py-1 text-center whitespace-nowrap" data-stat="L10_ADR">N/A</td>
                 <td class="px-1 py-1 text-center whitespace-nowrap" data-stat="L10_KD">N/A</td>
                 <td class="px-1 py-1 text-center whitespace-nowrap" data-stat="S_HLTV2">N/A</td>
                 <td class="px-1 py-1 text-center whitespace-nowrap" data-stat="S_ADR">N/A</td>
                 <td class="px-1 py-1 text-center whitespace-nowrap" data-stat="S_KD">N/A</td>
                 <td class="px-1 py-1"></td>
             `;
            container.appendChild(table);
        } // End else block for non-empty team

        TeamPicker.updateTeamStats(teamId); // Call unconditionally
    },

    // --- updateTeamStats ---
    /**
     * Calculates and updates the average stats row for a team.
     * @param {'a' | 'b'} teamId - The team identifier ('a' or 'b').
     */
    updateTeamStats: function(teamId) {
        // Use the player map directly
        const teamPlayersMap = (teamId === 'a') ? TeamPicker.teamAPlayersData : TeamPicker.teamBPlayersData;
        const teamPlayerArray = Object.values(teamPlayersMap);
        const averagesRow = document.getElementById(`team-${teamId}-averages-row`);
        const targetAvgObject = (teamId === 'a') ? this.teamAAverages : this.teamBAverages;

        // Clear stored averages first
        for (const key in targetAvgObject) {
            delete targetAvgObject[key];
        }

        if (!averagesRow || teamPlayerArray.length === 0) {
             // If row exists but team is empty, reset stats in UI
            if (averagesRow) {
                 averagesRow.querySelectorAll('td[data-stat]').forEach(cell => {
                     cell.textContent = 'N/A';
                 });
             }
             // Ensure stored averages are cleared (already done above)
             TeamPicker.updateStatsDifferenceDisplay(); // Update diff display when a team becomes empty
             return;
         }

        const teamPlayersWithStats = teamPlayerArray.map(p => TeamPicker.mergePlayerWithStats(p));

        const statsToAverage = ['L10_HLTV2', 'L10_ADR', 'L10_KD', 'S_HLTV2', 'S_ADR', 'S_KD'];
        const sums = {};
        const counts = {};

        statsToAverage.forEach(stat => {
            sums[stat] = 0;
            counts[stat] = 0;
        });

        teamPlayersWithStats.forEach(player => {
            statsToAverage.forEach(stat => {
                const value = player.stats?.[stat];
                if (value !== undefined && value !== null && !isNaN(value)) {
                    sums[stat] += value;
                    counts[stat]++;
                }
            });
        });

        averagesRow.querySelectorAll('td[data-stat]').forEach(cell => {
            const statKey = cell.dataset.stat;
            if (counts[statKey] > 0) {
                const average = sums[statKey] / counts[statKey];
                 // Format based on stat type (ADR = 0 decimals, others = 1 or 2)
                const decimals = statKey.includes('ADR') ? 0 : (statKey.includes('KD') ? 1 : 2);
                 cell.textContent = formatStat(average, decimals); // Use global formatStat
                 targetAvgObject[statKey] = average; // Store the raw average
            } else {
                cell.textContent = 'N/A';
                // Ensure N/A is reflected in stored averages (or absence implies N/A)
                 delete targetAvgObject[statKey]; // Remove if no valid data
            }
        });
        // Update the difference display whenever a team's stats are updated
        TeamPicker.updateStatsDifferenceDisplay(); 
    },

    /**
     * Updates the team stats difference display AND the comparison chart.
     */
    updateStatsDifferenceDisplay: function() {
        const diffContainer = document.getElementById('team-stats-diff');
        if (!diffContainer) return;

        // --- Update Difference Display (Use stored averages) ---
        const diffElements = diffContainer.querySelectorAll('[data-diff-stat]');
        diffElements.forEach(el => {
            const key = el.dataset.diffStat; // Key like 'L10_HLTV2' or 'S_ADR'
            let valA = TeamPicker.teamAAverages[key];
            let valB = TeamPicker.teamBAverages[key];

            if (typeof valA === 'number' && typeof valB === 'number' && !isNaN(valA) && !isNaN(valB)) {
                const diff = valA - valB;
                // Adjust formatting precision based on stat type
                const decimals = (key === 'L10_KD' || key === 'S_KD') ? 2 : (key.includes('ADR') ? 0 : 1);
                el.textContent = diff.toFixed(decimals);
                el.className = 'text-center '; // Reset classes
                if (diff > 0.001) el.classList.add('text-green-600', 'font-medium'); // Add small tolerance for floating point
                else if (diff < -0.001) el.classList.add('text-red-600', 'font-medium');
                else el.classList.add('text-gray-500');
            } else {
                el.textContent = '-';
                el.className = 'text-center text-gray-500';
            }
        });
        // --- End Difference Display Update ---

        // --- Update Pentagon Chart ---
        // 1. Use the fixed stats config defined above
        const chartStatsConfig = TEAM_CHART_STATS;
        const chartStatKeys = Object.keys(chartStatsConfig);

        // 2. Extract average values for the fixed stats from stored averages
        const teamAChartData = {};
        const teamBChartData = {};

        chartStatKeys.forEach(key => {
             // Keys in chartStatsConfig directly match keys in team averages (e.g., 'L10_HLTV2')
             teamAChartData[key] = TeamPicker.teamAAverages[key] || 0; // Use stored average
             teamBChartData[key] = TeamPicker.teamBAverages[key] || 0;
        });

        // 3. Normalize data using the fixed ranges and the new helper
        const normalizedTeamA = chartStatKeys.map(key => normalizeStatWithFixedRange(teamAChartData[key], key, TEAM_CHART_FIXED_RANGES));
        const normalizedTeamB = chartStatKeys.map(key => normalizeStatWithFixedRange(teamBChartData[key], key, TEAM_CHART_FIXED_RANGES));

        // 4. Render the chart
        TeamPicker.renderTeamComparisonChart(
            normalizedTeamA,
            normalizedTeamB,
            chartStatsConfig, // Pass the fixed config for labels
            teamAChartData, // Pass original averages for tooltips
            teamBChartData,
            TEAM_CHART_FIXED_RANGES // Pass fixed ranges for axis label formatting
        );
        // --- End Pentagon Chart Update ---
    },

    /**
     * Renders the team comparison radar chart.
     * @param {Array<number>} normalizedDataA - Normalized data for Team A.
     * @param {Array<number>} normalizedDataB - Normalized data for Team B.
     * @param {Object} chartStatsConfig - Config object for the stats being displayed.
     * @param {Object} originalAvgsA - Original (non-normalized) average stats for Team A.
     * @param {Object} originalAvgsB - Original (non-normalized) average stats for Team B.
     * @param {Object} fixedRanges - The fixed min/max ranges for the stats.
     */
    renderTeamComparisonChart: function(normalizedDataA, normalizedDataB, chartStatsConfig, originalAvgsA, originalAvgsB, fixedRanges) {
        const canvasId = 'team-picker-pentagon-chart';
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            console.error(`Team comparison chart canvas with id '${canvasId}' not found!`);
            return;
        }

        const labels = Object.values(chartStatsConfig).map(config => config.label);
        const statKeys = Object.keys(chartStatsConfig);

        const chartData = {
            labels: labels,
            datasets: [
                {
                    label: TeamPicker.teamAName || 'Team A',
                    data: normalizedDataA,
                    fill: true,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)', // Blue
                    borderColor: 'rgb(54, 162, 235)',
                    pointBackgroundColor: 'rgb(54, 162, 235)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(54, 162, 235)',
                    borderWidth: 1.5,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: TeamPicker.teamBName || 'Team B',
                    data: normalizedDataB,
                    fill: true,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)', // Green (adjust color if needed)
                    borderColor: 'rgb(75, 192, 192)',
                    pointBackgroundColor: 'rgb(75, 192, 192)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(75, 192, 192)',
                    borderWidth: 1.5,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }
            ]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { display: true, lineWidth: 0.5, color: 'rgba(0, 0, 0, 0.1)' },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false }, // Keep radial ticks hidden (0-100)
                    pointLabels: {
                        font: { size: 9, weight: 'normal' },
                        color: '#4b5563',
                        // NEW: Callback to add ranges to point labels
                        callback: function(pointLabel, index) {
                            const statKey = statKeys[index];
                            const range = fixedRanges[statKey];
                            const statConfig = chartStatsConfig[statKey];
                            if (range && statConfig) {
                                // Format based on stat type for range display
                                const decimals = (statKey === 'L10_KD' || statKey === 'S_KD') ? 1 : (statKey.includes('ADR') ? 0 : 1);
                                return `${statConfig.label} (${range.min.toFixed(decimals)}-${range.max.toFixed(decimals)})`;
                            }
                            return statConfig ? statConfig.label : ''; // Fallback
                        }
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.08)', lineWidth: 0.5 }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                     labels: {
                        boxWidth: 20,
                        padding: 15
                    }
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            const datasetLabel = context.dataset.label || '';
                            const statIndex = context.dataIndex;
                            const statKey = statKeys[statIndex]; // Use statKeys from outer scope
                            const statConfig = chartStatsConfig[statKey]; // Use chartStatsConfig
                            let originalValue = 'N/A';

                            const originalData = (datasetLabel === (TeamPicker.teamAName || 'Team A')) ? originalAvgsA : originalAvgsB;
                            const valueRaw = originalData[statKey];

                             // Format the original value based on stat type
                             if (typeof valueRaw === 'number' && !isNaN(valueRaw)) {
                                const decimals = (statKey === 'L10_KD' || statKey === 'S_KD') ? 2 : (statKey.includes('ADR') ? 0 : 1);
                                originalValue = valueRaw.toFixed(decimals);
                             }
                            return `${datasetLabel} - ${statConfig.label}: ${originalValue}`;
                        }
                    }
                }
            },
            layout: { padding: { top: 5, bottom: 5, left: 15, right: 15 } } // Increased horizontal padding for labels
        };

        // Destroy previous chart instance if it exists
        if (TeamPicker.teamComparisonChartInstance) {
            TeamPicker.teamComparisonChartInstance.destroy();
        }

        // Create new chart instance and store it
        TeamPicker.teamComparisonChartInstance = new Chart(ctx, {
            type: 'radar',
            data: chartData,
            options: options
        });
    },

    // --- Map/Side Selection Logic ---
     /**
     * Sets up event listeners for map and side selection dropdowns.
     */
    setupMapSideSelectionListeners: function() {
        for (let i = 1; i <= 3; i++) {
            const mapSelect = document.getElementById(`map-${i}`);
            const tSelect = document.getElementById(`map${i}-t-team`);
            const ctSelect = document.getElementById(`map${i}-ct-team`);

            if (mapSelect) mapSelect.addEventListener('change', () => TeamPicker.handleMapChange(i));
            if (tSelect) tSelect.addEventListener('change', () => TeamPicker.handleSideChange(i, 't'));
            if (ctSelect) ctSelect.addEventListener('change', () => TeamPicker.handleSideChange(i, 'ct'));
        }
    },

    /**
     * Handles changes in map selection. Writes to Firebase.
     * @param {number} mapIndex - 1, 2, or 3.
     */
    handleMapChange: function(mapIndex) {
         if (!this.dbRef) return;
         const mapSelect = document.getElementById(`map-${mapIndex}`);
         if (!mapSelect) return;
         const mapName = mapSelect.value;
         this.dbRef.child(`maps/map${mapIndex}/mapName`).set(mapName)
            .catch(error => console.error(`Error updating Map ${mapIndex} name:`, error));
        // Side consistency check might be needed or handled by listener update
         TeamPicker.enforceMapSideConsistency(); 
    },

    /**
     * Handles changes in T/CT side selection. Writes to Firebase.
     * @param {number} mapIndex - 1, 2, or 3.
     * @param {'t' | 'ct'} side - The side that was changed.
     */
    handleSideChange: function(mapIndex, side) {
         if (!this.dbRef) return;
        const selectElement = document.getElementById(`map${mapIndex}-${side}-team`);
        if (!selectElement) return;
        const selectedTeam = selectElement.value; // 'A' or 'B' or ''

        const otherSide = (side === 't') ? 'ct' : 't';
        const otherSelectElement = document.getElementById(`map${mapIndex}-${otherSide}-team`);
        
        const updates = {};
        updates[`maps/map${mapIndex}/${side}_team`] = selectedTeam;

        // Auto-select other side if one is chosen and the other is empty or same
        if (selectedTeam && otherSelectElement) {
            const otherTeamCurrentValue = otherSelectElement.value;
            const otherTeamShouldBe = selectedTeam === 'A' ? 'B' : 'A';
             if(otherTeamCurrentValue === '' || otherTeamCurrentValue === selectedTeam) {
                 updates[`maps/map${mapIndex}/${otherSide}_team`] = otherTeamShouldBe;
             }
         } else if (!selectedTeam && otherSelectElement) {
             // If clearing one side, clear the other too for simplicity? Or leave it? Let's clear.
             updates[`maps/map${mapIndex}/${otherSide}_team`] = "";
         }

        this.dbRef.update(updates)
             .catch(error => console.error(`Error updating Map ${mapIndex} sides:`, error));
             
         // Note: UI update will be handled by the 'maps' listener reacting to the DB change.
         // We might still call enforceMapSideConsistency locally for immediate feedback, but the listener is the source of truth.
         // TeamPicker.enforceMapSideConsistency(); // Optional immediate UI update
    },
    
    /**
     * Updates the display names (Team A/B or Kabile name) in map side selectors.
     */
    updateMapSideTeamNames: function() {
        const teamAName = TeamPicker.teamAName || 'Team A';
        const teamBName = TeamPicker.teamBName || 'Team B';
        
        document.querySelectorAll('.map-container select option[value="A"]').forEach(opt => opt.textContent = teamAName);
        document.querySelectorAll('.map-container select option[value="B"]').forEach(opt => opt.textContent = teamBName);
    },

    /**
     * Enforces consistency in map side selections (if T is A, CT must be B).
     * This is mainly for immediate UI feedback; Firebase rules could enforce this too.
     */
    enforceMapSideConsistency: function() {
        for (let i = 1; i <= 3; i++) {
            const tSelect = document.getElementById(`map${i}-t-team`);
            const ctSelect = document.getElementById(`map${i}-ct-team`);

            if (!tSelect || !ctSelect) continue;

            const tVal = tSelect.value;
            const ctVal = ctSelect.value;

            if (tVal && tVal === ctVal) {
                // If both are set to the same, clear the one that wasn't just changed (tricky without event context)
                // For simplicity, let's just clear CT if T was set, and vice-versa (less ideal)
                // A better approach is in handleSideChange which writes the correct opposite to Firebase.
                // This function becomes more of a final check or visual sync if needed.
                console.warn(`Inconsistent sides detected for Map ${i}. Firebase update should correct this.`);
            }
            // The Firebase listener reacting to handleSideChange should ultimately fix the UI state.
        }
    },
     /**
     * Updates the team name based on kabile selection (Local UI update, FB triggers actual name change).
     */
    updateTeamName: function(event) {
         // This function might become redundant if kabile listener handles name update
         // Or it can provide immediate (though temporary) UI feedback before FB sync
         const teamId = event.target.id.includes('-a-') ? 'a' : 'b';
         const selectedKabile = event.target.value;
         const teamHeader = document.querySelector(`#page-team_picker .team-container:nth-child(${teamId === 'a' ? 1 : 2}) h3`);
         
         if (teamHeader) {
             teamHeader.textContent = selectedKabile || (teamId === 'a' ? 'Team A' : 'Team B');
             // Update local state immediately for responsiveness? Or rely purely on FB?
             // if (teamId === 'a') TeamPicker.teamAName = selectedKabile || 'Team A';
             // else TeamPicker.teamBName = selectedKabile || 'Team B';
         }
         // TeamPicker.updateMapSideTeamNames(); // Update names in map selects immediately
         // Note: The actual state change happens via handleKabileChange writing to Firebase.
    },

    /**
     * Fetches kabile data from JSON file
     */
    fetchKabileData: async function() {
        try {
            // Use the constant defined within the module
            const response = await fetch(this.KABILE_JSON_URL);
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
            // Use the constant defined within the module
            const response = await fetch(this.MAPS_JSON_URL);
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
     * @param {Object} player - The player object with at least name and steamId.
     * @returns {Object} - Player object with merged stats under player.stats.
     */
    mergePlayerWithStats: function(player) {
        // Use the getter functions from StatsTables which expect steamId
        if (!player || !player.steamId) {
            console.warn("Attempted to merge stats for player without steamId:", player);
            return { ...player, stats: {} }; // Return basic player data with empty stats
        }

        const steamId = String(player.steamId); // Ensure it's a string
        const mergedPlayer = { ...player, stats: {} }; // Start with a copy

        const last10PlayerStats = StatsTables.getLast10StatsBySteamId(steamId);
        if (last10PlayerStats) {
            mergedPlayer.stats.L10_HLTV2 = last10PlayerStats.hltv_2;
            mergedPlayer.stats.L10_ADR = last10PlayerStats.adr;
            mergedPlayer.stats.L10_KD = last10PlayerStats.kd;
        }

        const seasonPlayerStats = StatsTables.getSeasonStatsBySteamId(steamId);
        if (seasonPlayerStats) {
            mergedPlayer.stats.S_HLTV2 = seasonPlayerStats.hltv_2;
            mergedPlayer.stats.S_ADR = seasonPlayerStats.adr;
            mergedPlayer.stats.S_KD = seasonPlayerStats.kd;
        }

        // Log if stats are missing for debugging
        if (!last10PlayerStats || !seasonPlayerStats) {
             console.log(`Stats lookup for ${player.name} (ID: ${steamId}): Last10=${!!last10PlayerStats}, Season=${!!seasonPlayerStats}`);
        }

        return mergedPlayer;
    },

    // ==================================================
    // --- NEW: Match Creation Logic ---
    // ==================================================

    /**
     * Placeholder function to retrieve the Match Creation API token.
     * WARNING: Retrieving sensitive tokens directly in the frontend is insecure.
     * Implement a secure method (e.g., via a backend proxy) in a real application.
     * @returns {string|null} The API token or null if not found.
     */
    getMatchCreationToken: function() {
        // TODO: Implement secure token retrieval
        console.warn("Using placeholder for Match Creation Token. Implement secure retrieval!");
        // Example: return window.firebaseConfig?.matchmakingToken; // If stored in a config
        // Example: return prompt("Enter Match Creation Token (Insecure):"); // Highly insecure
        return null; // Return null to indicate failure for now
    },

    /**
     * Gathers data from the UI state and attempts to create a match via API call.
     */
    createMatchFromUI: async function() {
        console.log("Attempting to create match...");
        const createButton = document.getElementById('create-match-button');
        const spinner = document.getElementById('create-match-spinner');

        if (createButton) createButton.disabled = true;
        if (spinner) spinner.classList.remove('hidden');

        try {
            const mwToken = TeamPicker.getMatchCreationToken();
            if (!mwToken) {
                throw new Error("Match creation token not available. Cannot create match.");
            }

            // --- 1. Create Team Objects ---
            const team1Object = TeamPicker.createTeamObjectForAPI('a');
            const team2Object = TeamPicker.createTeamObjectForAPI('b');

            if (!team1Object || !team2Object) {
                // createTeamObjectForAPI will show specific errors
                throw new Error("Failed to create team data for API.");
            }

            // --- 2. Get Map List ---
            const maps = [
                TeamPicker.mapSelections.map1?.mapName,
                TeamPicker.mapSelections.map2?.mapName,
                TeamPicker.mapSelections.map3?.mapName
            ].filter(mapName => mapName && mapName !== ""); // Filter out empty selections

            if (maps.length === 0) {
                throw new Error("No maps selected. Please select at least one map.");
            }

            // --- 3. Get Map Sides ---
            const mapSides = [];
            const teamAName = TeamPicker.teamAName || 'Team A';
            const teamBName = TeamPicker.teamBName || 'Team B'; // Use synced names

            for (let i = 1; i <= maps.length; i++) {
                const mapSelection = TeamPicker.mapSelections[`map${i}`];
                let side = 'knife'; // Default to knife
                if (mapSelection?.ct_team === 'A') {
                    side = 'team1_ct';
                } else if (mapSelection?.ct_team === 'B') {
                    side = 'team2_ct';
                }
                mapSides.push(side);
            }
             // Pad mapSides with 'knife' if fewer sides are selected than maps
            while (mapSides.length < maps.length) {
                mapSides.push('knife');
            }
            // Ensure mapSides is not longer than maps (shouldn't happen with current logic)
            mapSides.length = maps.length;


            // --- 4. Construct Final Match Object ---
            const matchObject = {
                team1: team1Object,
                team2: team2Object,
                num_maps: maps.length,
                maplist: maps,
                map_sides: mapSides,
                clinch_series: true, // Assuming default true as in script
                players_per_team: team1Object.players ? Object.keys(team1Object.players).length : 0, // Use actual player count
                cvars: {
                    tv_enable: 1,
                    hostname: `${team1Name} vs ${teamBName}`
                }
            };

            console.log("Match Object Payload:", JSON.stringify(matchObject, null, 2)); // Log for debugging

            // --- 5. Make API Call ---
            const response = await fetch('https://db2.csbatagi.com/start-match', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${mwToken}`
                },
                body: JSON.stringify(matchObject)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error("API Error Response:", errorBody);
                throw new Error(`Failed to create match. Server responded with status ${response.status}. ${errorBody}`);
            }

            const result = await response.json(); // Assuming the API returns JSON
            console.log("Match creation successful:", result);
            showMessage('Match created successfully!', 'success');

        } catch (error) {
            console.error('Error creating match:', error);
            showMessage(`Error creating match: ${error.message}`, 'error');
        } finally {
            if (createButton) createButton.disabled = false;
            if (spinner) spinner.classList.add('hidden');
        }
    },

    /**
     * Creates the team data object structure needed for the match creation API.
     * @param {'a' | 'b'} teamId - The team identifier ('a' or 'b').
     * @returns {object|null} The team data object or null if invalid.
     */
    createTeamObjectForAPI: function(teamId) {
        const teamPlayersDataMap = (teamId === 'a') ? TeamPicker.teamAPlayersData : TeamPicker.teamBPlayersData;
        const teamName = (teamId === 'a') ? (TeamPicker.teamAName || 'Team A') : (TeamPicker.teamBName || 'Team B');
        const teamPlayerArray = Object.values(teamPlayersDataMap); // Get array from map

        if (!teamPlayerArray || teamPlayerArray.length === 0) {
            showMessage(`Team ${teamId.toUpperCase()} has no players. Cannot create match.`, 'error');
            return null;
        }

        const playersObj = {};
        let missingSteamIdOrName = false;
        teamPlayerArray.forEach(player => {
            const steamIdStr = String(player.steamId); // Ensure string key
            if (steamIdStr && player.name) {
                playersObj[steamIdStr] = player.name;
            } else {
                console.error(`Player data incomplete for API in Team ${teamId.toUpperCase()}:`, player);
                missingSteamIdOrName = true;
            }
        });

        if (missingSteamIdOrName) {
             showMessage(`One or more players in Team ${teamId.toUpperCase()} have incomplete data (SteamID or Name).`, 'error');
             return null;
        }

         // Use the actual lengths from the maps for comparison
         const teamASize = Object.keys(TeamPicker.teamAPlayersData).length;
         const teamBSize = Object.keys(TeamPicker.teamBPlayersData).length;
         if (teamASize !== teamBSize) {
             console.warn(`Team sizes are different: Team A (${teamASize}), Team B (${teamBSize}). API uses Team A's count.`);
         }

        return {
            name: teamName,
            players: playersObj // Payload format: { steamId: name, ... }
        };
    },

    // ==================================================
    // --- END NEW Match Creation Logic ---
    // ==================================================
}; 