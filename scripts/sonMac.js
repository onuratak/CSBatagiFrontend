// scripts/sonMac.js

const SonMac = {
    SONMAC_JSON_URL: 'data/sonmac_by_date.json',
    sonMacDataByDate: {}, // To store all son mac data by date

    /**
     * Initializes the Son Maç module.
     */
    init: function() {
        // Renamed from loadAndRenderSonMacData to loadSonMacDataByDate
        this.loadSonMacDataByDate(); 
    },

    /**
     * Fetches Son Maç match stats from the local JSON file (sonmac_by_date.json).
     */
    fetchSonMacDataByDate: async function() { // Renamed for clarity
        try {
            const response = await fetch(this.SONMAC_JSON_URL + '?v=' + window.STATIC_VERSION);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            // The data is now an object with dates as keys
            this.sonMacDataByDate = await response.json(); 
            console.log("SonMac data by date loaded successfully:", this.sonMacDataByDate);
            return this.sonMacDataByDate;
        } catch (err) {
            console.error('Failed to fetch Son Maç data by date:', err);
            showMessage(`Error loading Son Maç data: ${err.message}`, 'error');
            const mapTabContent = document.getElementById('mapTabContent');
            if (mapTabContent) {
                mapTabContent.innerHTML = '<p class="text-red-500 text-center">Error loading match data. Please try again later.</p>';
            }
            const dateSelector = document.getElementById('sonmac-date-selector');
            if (dateSelector) {
                dateSelector.innerHTML = '<option>Error loading dates</option>';
            }
            return null; 
        }
    },

    /**
     * Loads and renders the Son Maç data for a specific date.
     * Populates date selector and loads the most recent date by default.
     */
    loadSonMacDataByDate: async function() {
        const data = await this.fetchSonMacDataByDate();
        if (data) {
            this.populateSonMacDateSelector();
            // Load data for the most recent date by default
            if (Object.keys(this.sonMacDataByDate).length > 0) {
                const dates = Object.keys(this.sonMacDataByDate).sort((a, b) => new Date(b) - new Date(a));
                this.renderPageForDate(dates[0]); // New function to render content for a date
            }
        }
    },

    populateSonMacDateSelector: function() {
        const dateSelector = document.getElementById('sonmac-date-selector');
        if (!dateSelector) return;

        const dates = Object.keys(this.sonMacDataByDate).sort((a, b) => new Date(b) - new Date(a));
        dateSelector.innerHTML = '';

        if (dates.length === 0) {
            dateSelector.innerHTML = '<option>No dates available</option>';
            return;
        }

        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = this.formatDateForDisplay(date);
            dateSelector.appendChild(option);
        });

        dateSelector.addEventListener('change', (event) => {
            this.renderPageForDate(event.target.value);
        });

        if (dates.length > 0) {
            dateSelector.value = dates[0];
        }
    },

    /**
     * Renders the Son Mac page content for a given date.
     * @param {string} selectedDate - The YYYY-MM-DD date string.
     */
    renderPageForDate: function(selectedDate) {
        console.log(`Rendering Son Mac page for date: ${selectedDate}`);
        const dataForDate = this.sonMacDataByDate[selectedDate];

        const mapTabContent = document.getElementById('mapTabContent');
        const mapTabsContainer = document.getElementById('map-tabs');

        if (!dataForDate || !dataForDate.maps) {
            console.error(`No data found for date: ${selectedDate}`);
            if (mapTabContent) mapTabContent.innerHTML = '<p class="text-center text-gray-500">No match data available for the selected date.</p>';
            if (mapTabsContainer) mapTabsContainer.innerHTML = '';
            return;
        }

        mapTabContent.innerHTML = ''; 
        mapTabsContainer.innerHTML = '';

        const maps = dataForDate.maps;
        const mapNames = Object.keys(maps);

        if (mapNames.length > 0) {
            mapNames.forEach((mapName, index) => {
                const isFirstMap = index === 0;
                const mapData = maps[mapName];

                // Create Tab Button
                const li = document.createElement('li');
                li.className = 'mr-2';
                li.setAttribute('role', 'presentation');
                const tabButton = document.createElement('button');
                tabButton.id = `map-${mapName}-tab-btn`; // Unique ID for button
                tabButton.className = `tab-nav-item map-tab-button inline-block border-b-2 rounded-t-lg hover:text-gray-600 hover:border-gray-300`;
                if (isFirstMap) {
                    tabButton.classList.add('active', 'text-blue-600', 'border-blue-600');
                    tabButton.classList.remove('border-transparent');
                } else {
                    tabButton.classList.add('border-transparent');
                }
                tabButton.setAttribute('aria-controls', `map-content-${mapName}`); // aria-controls should point to content ID
                tabButton.textContent = mapName;
                li.appendChild(tabButton);
                mapTabsContainer.appendChild(li);

                // Create Map Content Area (will be populated by createTeamSection)
                const mapContentDiv = document.createElement('div');
                mapContentDiv.id = `map-content-${mapName}`; // Unique ID for content
                mapContentDiv.className = `p-4 rounded-lg bg-gray-50`;
                if (!isFirstMap) {
                    mapContentDiv.classList.add('hidden');
                }
                mapContentDiv.setAttribute('role', 'tabpanel');
                mapContentDiv.setAttribute('aria-labelledby', tabButton.id);
                
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
                mapContentDiv.appendChild(scoreboardDiv);

                // Create team sections
                const team1Div = this.createTeamSection(mapName, mapData.team1, 'blue');
                mapContentDiv.appendChild(team1Div);
                const team2Div = this.createTeamSection(mapName, mapData.team2, 'green');
                mapContentDiv.appendChild(team2Div);
                
                mapTabContent.appendChild(mapContentDiv);
            });
            
            this.initSonMacTabs(); // Initialize tab click listeners after all tabs are created
            this.populateAndSortTablesInContent(document.querySelector(`#map-tabs .map-tab-button.active`).getAttribute('aria-controls'));


        } else {
            mapTabContent.innerHTML = '<p class="text-center text-gray-500">No maps played or data available for this selection.</p>';
        }
    },
    
    /**
     * Populates and sorts tables within a given content area.
     * @param {string} contentId - The ID of the content div containing team tables.
     */
    populateAndSortTablesInContent: function(contentId) {
        const contentDiv = document.getElementById(contentId);
        if (!contentDiv) return;

        const teamDivs = contentDiv.querySelectorAll('div.mb-6'); // Assuming team sections have this structure
        teamDivs.forEach(teamDiv => {
            const tbody = teamDiv.querySelector('tbody');
            if (tbody && tbody.id && tbody.dataset.originalData) {
                try {
                    let playersData = JSON.parse(tbody.dataset.originalData);
                    sortData(playersData, 'hltv_2', 'desc'); // global sortData
                    this.fillSonMacTableBody(tbody, playersData);
                    setInitialSortState(tbody, 'hltv_2', 'desc'); // global setInitialSortState
                } catch (e) {
                    console.error(`Error processing data for tbody ${tbody.id}:`, e);
                    tbody.innerHTML = '<tr><td colspan="24" class="text-center text-red-600">Error loading player data.</td></tr>';
                }
            }
        });
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
        teamDiv.className = 'mb-6'; // Keep this class if used for selection in populateAndSortTablesInContent

        const teamHeading = document.createElement('h3');
        teamHeading.className = `text-lg font-semibold text-${color}-600 mb-2 px-3`;
        teamHeading.textContent = teamData.name;
        teamDiv.appendChild(teamHeading);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'overflow-x-auto';

        const table = document.createElement('table');
        table.className = 'styled-table min-w-full text-sm';

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

        // Sanitize names for ID: replace spaces and ensure lowercase
        const safeTeamName = teamData.name.replace(/\s+/g, '_').toLowerCase();
        const tbodyId = `sonmac-${mapName}-${safeTeamName}-${color}-tbody`;
        const tbody = document.createElement('tbody');
        tbody.id = tbodyId;
        // Store players data directly on the tbody for later retrieval
        tbody.dataset.originalData = JSON.stringify(teamData.players); 
        table.appendChild(tbody);
        
        tableContainer.appendChild(table);
        teamDiv.appendChild(tableContainer);
        return teamDiv;
    },

    /**
     * Initializes the click listeners for the Son Maç map tabs.
     */
    initSonMacTabs: function() {
        const mapTabsContainer = document.getElementById('map-tabs');
        if (!mapTabsContainer) return;

        mapTabsContainer.addEventListener('click', (event) => {
            const clickedTab = event.target.closest('.map-tab-button');
            if (!clickedTab) return;

            // Deactivate all tabs
            mapTabsContainer.querySelectorAll('.map-tab-button').forEach(btn => {
                btn.classList.remove('active', 'text-blue-600', 'border-blue-600');
                btn.classList.add('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300');
                btn.setAttribute('aria-selected', 'false');
            });

            // Hide all content panels
            document.querySelectorAll('#mapTabContent > div').forEach(content => {
                content.classList.add('hidden');
            });

            // Activate clicked tab
            clickedTab.classList.add('active', 'text-blue-600', 'border-blue-600');
            clickedTab.classList.remove('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300');
            clickedTab.setAttribute('aria-selected', 'true');

            // Show corresponding content and populate/sort its tables
            const contentId = clickedTab.getAttribute('aria-controls');
            const contentDiv = document.getElementById(contentId);
            if (contentDiv) {
                contentDiv.classList.remove('hidden');
                this.populateAndSortTablesInContent(contentId);
            } else {
                 console.error(`Content div with ID ${contentId} not found for tab ${clickedTab.id}`);
            }
        });
    },


    /**
     * Fills the table body for a Son Maç team table.
     * @param {HTMLTableSectionElement} tbody - The tbody element to fill.
     * @param {Array} playersData - The array of player data for the team.
     */
    fillSonMacTableBody: function(tbody, playersData) {
        // Clear only player rows, keep totals if they are already there and managed separately
        // A better approach might be to always rebuild player rows and then totals row.
        // For now, let's clear all then re-add players. Totals row is added in createTeamSection
        tbody.innerHTML = ''; 

        playersData.forEach(player => {
            const tr = document.createElement('tr');
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
        
        const gradient = [
            { percent: 0, color: '#EF4444' },
            { percent: 0.5, color: '#FDE68A' },
            { percent: 1, color: '#22C55E' }
        ];
        applyHeatmapToColumn(tbody.id, 1, gradient);
        applyHeatmapToColumn(tbody.id, 2, gradient);
        applyHeatmapToColumn(tbody.id, 3, gradient);
    },

    formatDateForDisplay: function(dateString) {
        // The dateString is already in YYYY-MM-DD format from the JSON keys
        return dateString; 
    }

};

// Ensure this is called when the script loads.
document.addEventListener('DOMContentLoaded', () => {
    SonMac.init(); // Call the main init function of the SonMac object
}); 