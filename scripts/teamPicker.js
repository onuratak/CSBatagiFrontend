// ==================================================
// --- Team Picker Module/Object --- 
// ==================================================

const TeamPicker = {
    // --- Constants (Specific to Team Picker) ---
    KABILE_JSON_URL: 'data/kabile.json',
    MAPS_JSON_URL: 'data/maps.json',

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
            // fetchLast10Stats(),  // REMOVED - Stats are handled globally now
            // fetchSeasonAvgStats() // REMOVED - Stats are handled globally now
        ]).then(([kabileData, mapsData]) => {
            // last10Stats and seasonStats should be populated globally by StatsTables.init()
            // If they aren't ready, mergePlayerWithStats will handle it gracefully.
            
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
     * @param {Object} player - The player object with attendance info
     * @returns {Object} - Player with merged stats
     */
    mergePlayerWithStats: function(player) {
        const playerWithStats = { ...player, stats: {} };
        
        // Find player in last 10 stats (use StatsTables module state)
        const last10Player = StatsTables.last10Stats.find(p => p.name === player.name);
        if (last10Player) {
            playerWithStats.stats.L10_HLTV2 = last10Player.hltv_2;
            playerWithStats.stats.L10_ADR = last10Player.adr;
            playerWithStats.stats.L10_KD = last10Player.kd;
        }
        
        // Find player in season stats (use StatsTables module state)
        const seasonPlayer = StatsTables.seasonStats.find(p => p.name === player.name);
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
        if (!availablePlayersContainer) return; // Exit if container not found

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