// scripts/sonMac.js

const SonMac = {
    SONMAC_JSON_URL: 'data/sonmac.json',

    /**
     * Initializes the Son Maç module by fetching and rendering the data.
     */
    init: function() {
        this.loadAndRenderSonMacData();
    },

    /**
     * Fetches Son Maç match stats from the local JSON file.
     */
    fetchSonMacData: async function() {
        try {
            const response = await fetch(this.SONMAC_JSON_URL); // Use module constant
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
            showMessage(`Error loading Son Maç data: ${err.message}`, 'error'); // Uses global showMessage
            return null;
        }
    },

    /**
     * Loads and renders the Son Maç data, including initializing tabs and sorting.
     */
    loadAndRenderSonMacData: async function() {
        const matchData = await this.fetchSonMacData(); // Use module's fetch
        if (matchData) {
            // Populate creates the structure, including tbodies with originalData
            this.populateSonMacData(matchData); // Use module's populate
            this.initSonMacTabs(); // Initialize tab click listeners using module's initTabs

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
                            // Initial sort (uses global sortData)
                            sortData(playersData, 'hltv_2', 'desc');
                            // Render the body with sorted data (uses module's fill)
                            this.fillSonMacTableBody(tbody, playersData);
                            // Set initial header indicator (uses global setInitialSortState)
                            setInitialSortState(tbody, 'hltv_2', 'desc');
                        }
                    });
                }
            }
        }
    },

    /**
     * Populates the Son Maç page with match data, creating tabs and content areas.
     * @param {object} data - The match data object.
     */
    populateSonMacData: function(data) {
        if (!data || !data.maps) return;

        const mapTabs = document.querySelector('#map-tabs');
        mapTabs.innerHTML = ''; // Clear existing tabs

        let isFirst = true;
        Object.keys(data.maps).forEach(mapName => {
            const li = document.createElement('li');
            li.className = 'mr-2';
            li.setAttribute('role', 'presentation');

            const button = document.createElement('button');
            button.id = `${mapName}-tab`;
            button.className = `tab-nav-item map-tab-button inline-block border-b-2 ${isFirst ? 'border-blue-500 active' : 'border-transparent'} rounded-t-lg hover:text-gray-600 hover:border-gray-300`;
            button.setAttribute('aria-controls', mapName);
            button.textContent = mapName;

            li.appendChild(button);
            mapTabs.appendChild(li);

            // Create/populate map content using module function
            this.populateMapContent(mapName, data.maps[mapName], isFirst);

            if (isFirst) isFirst = false;
        });

        // Re-initialize tab functionality - Handled by loadAndRenderSonMacData calling initSonMacTabs
        // this.initSonMacTabs(); // No longer needed here
    },

    /**
     * Populates the content area for a specific map.
     * @param {string} mapName - The name of the map.
     * @param {object} mapData - The data for the map.
     * @param {boolean} isActive - Whether this map tab should be initially active.
     */
    populateMapContent: function(mapName, mapData, isActive) {
        const mapTabContent = document.getElementById('mapTabContent');

        let mapDiv = document.getElementById(mapName);
        if (!mapDiv) {
            mapDiv = document.createElement('div');
            mapDiv.id = mapName;
            mapTabContent.appendChild(mapDiv);
        } else {
            mapDiv.innerHTML = ''; // Clear existing content
        }
        mapDiv.className = isActive ? 'active' : 'hidden'; // Set class based on isActive

        // Create scoreboard
        const scoreboardDiv = document.createElement('div');
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

        // Create team sections using module function
        const team1Div = this.createTeamSection(mapName, mapData.team1, 'blue');
        mapDiv.appendChild(team1Div);
        const team2Div = this.createTeamSection(mapName, mapData.team2, 'green');
        mapDiv.appendChild(team2Div);
    },

    /**
     * Creates the HTML structure for a team's section within a map tab.
     * @param {string} mapName - The name of the map.
     * @param {object} teamData - The data for the team.
     * @param {string} color - The color associated with the team ('blue' or 'green').
     * @returns {HTMLDivElement} The created team section element.
     */
    createTeamSection: function(mapName, teamData, color) {
        const teamDiv = document.createElement('div');
        teamDiv.className = 'mb-6';

        const teamHeading = document.createElement('h3');
        teamHeading.className = `text-lg font-semibold text-${color}-600 mb-2 px-3`;
        teamHeading.textContent = teamData.name;
        teamDiv.appendChild(teamHeading);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'overflow-x-auto';

        const table = document.createElement('table');
        table.className = 'styled-table min-w-full text-sm';

        const thead = document.createElement('thead');
        // Add data-sort-key and sortable-header class for global sorting handler
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

        const tbodyId = `sonmac-${mapName}-${teamData.name.replace(/\s+/g, '_').toLowerCase()}-${color}`;
        const tbody = document.createElement('tbody');
        tbody.id = tbodyId;
        tbody.dataset.originalData = JSON.stringify(teamData.players); // Store player data

        // DO NOT fill initially. It will be filled after sorting in loadAndRenderSonMacData

        table.appendChild(tbody);
        tableContainer.appendChild(table);
        teamDiv.appendChild(tableContainer);
        return teamDiv;
    },

    /**
     * Initializes the click listeners for the Son Maç map tabs.
     */
    initSonMacTabs: function() {
        const mapTabs = document.querySelectorAll('#map-tabs button');
        const mapContents = document.querySelectorAll('#mapTabContent > div');

        mapTabs.forEach(tab => {
            // Store 'this' context
            const sonMacModule = this;
            tab.addEventListener('click', function() { // Use function() to get correct 'this' for the element

                // Remove active classes from all tabs and contents
                mapTabs.forEach(t => {
                    t.classList.remove('active', 'border-blue-500');
                    t.classList.add('border-transparent');
                });
                mapContents.forEach(c => c.classList.add('hidden'));

                // Add active class to clicked tab ('this' refers to the button here)
                this.classList.add('active', 'border-blue-500');
                this.classList.remove('border-transparent');

                // Show corresponding content
                const contentId = this.getAttribute('aria-controls');
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
                                // Sort data (uses global sortData)
                                sortData(playersData, 'hltv_2', 'desc');
                                // Fill the table body (uses module's fill)
                                sonMacModule.fillSonMacTableBody(tbody, playersData);
                                // Set the initial sort state (uses global setInitialSortState)
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
    },

    /**
     * Fills the table body for a Son Maç team table.
     * @param {HTMLTableSectionElement} tbody - The tbody element to fill.
     * @param {Array} playersData - The array of player data for the team.
     */
    fillSonMacTableBody: function(tbody, playersData) {
        tbody.innerHTML = ''; // Clear existing rows

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

        // Re-apply heatmap AFTER rows are in the DOM (uses global applyHeatmapToColumn)
        const gradient = [
            { percent: 0, color: '#EF4444' },
            { percent: 0.5, color: '#FDE68A' },
            { percent: 1, color: '#22C55E' }
        ];
        applyHeatmapToColumn(tbody.id, 1, gradient); // HLTV2
        applyHeatmapToColumn(tbody.id, 2, gradient); // ADR
        applyHeatmapToColumn(tbody.id, 3, gradient); // K/D
    }

}; // End of SonMac object 