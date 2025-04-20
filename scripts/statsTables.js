// scripts/statsTables.js

const StatsTables = {
    SEASON_AVG_JSON_URL: 'data/season_avg.json',
    LAST10_JSON_URL: 'data/last10.json',
    NIGHT_AVG_JSON_URL: 'data/night_avg.json',

    seasonStats: [],
    last10Stats: [],

    /**
     * Initializes the stats tables module by loading and rendering all tables.
     */
    init: function() {
        this.loadAndRenderSeasonAvgTable();
        this.loadAndRenderLast10Table();
        this.loadAndRenderNightAvgTable();
    },

    /**
     * Fetches season average player stats from the local JSON file.
     */
    fetchSeasonAvgStats: async function() {
        try {
            const response = await fetch(this.SEASON_AVG_JSON_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("Invalid data format received from JSON file.");
            }
            this.seasonStats = data; // Store in module's state
            return data;
        } catch (err) {
            console.error('Failed to fetch season avg stats:', err);
            showMessage(`Error loading season stats: ${err.message}`, 'error'); // Uses global showMessage
            return [];
        }
    },

    /**
     * Loads and renders the season average table.
     */
    loadAndRenderSeasonAvgTable: async function() {
        const stats = await this.fetchSeasonAvgStats(); // Use module's fetch
        if (stats.length > 0) {
            // Initial sort (uses global sortData)
            sortData(stats, 'hltv_2', 'desc');
            // Render (uses module's fill)
            this.fillSeasonAvgTable(stats);
            // Set initial header indicator (uses global setInitialSortState)
            const tbody = document.getElementById('season-avg-table-body');
            setInitialSortState(tbody, 'hltv_2', 'desc');
        }
    },

    /**
     * Fills the Season Average table body with data.
     * @param {Array} data - The data array to render.
     * @param {HTMLTableSectionElement} [tbody] - Optional tbody element.
     */
    fillSeasonAvgTable: function(data, tbody) {
        tbody = tbody || document.getElementById('season-avg-table-body');
        if (!tbody) return;

        if (!tbody.dataset.originalData) {
            tbody.dataset.originalData = JSON.stringify(data);
        }

        tbody.innerHTML = '';

        data.forEach(row => {
            // Use the global formatStat function
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

        // Apply heatmap AFTER rows are in the DOM (uses global applyHeatmapToColumn)
        const gradient = [
            { percent: 0, color: '#EF4444' },
            { percent: 0.5, color: '#FDE68A' },
            { percent: 1, color: '#22C55E' }
        ];
        applyHeatmapToColumn(tbody.id, 1, gradient); // HLTV2
        applyHeatmapToColumn(tbody.id, 2, gradient); // ADR
        applyHeatmapToColumn(tbody.id, 3, gradient); // K/D
    },

    /**
     * Fetches last 10 average player stats from the local JSON file.
     */
    fetchLast10Stats: async function() {
        try {
            const response = await fetch(this.LAST10_JSON_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("Invalid data format received from JSON file.");
            }
            this.last10Stats = data; // Store in module's state
            return data;
        } catch (err) {
            console.error('Failed to fetch last 10 stats:', err);
            showMessage(`Error loading last 10 stats: ${err.message}`, 'error'); // Uses global showMessage
            return [];
        }
    },

    /**
     * Loads and renders the last 10 games table.
     */
    loadAndRenderLast10Table: async function() {
        const stats = await this.fetchLast10Stats(); // Use module's fetch
        if (stats && stats.length > 0) {
            // Initial sort (uses global sortData)
            sortData(stats, 'hltv_2', 'desc');
            // Render (uses module's fill)
            this.fillLast10Table(stats);
            // Set initial header indicator (uses global setInitialSortState)
            const tbody = document.getElementById('last10-table-body');
            setInitialSortState(tbody, 'hltv_2', 'desc');
        }
    },

    /**
     * Fills the Last 10 table body with data.
     * @param {Array} data - The data array to render.
     * @param {HTMLTableSectionElement} [tbody] - Optional tbody element.
     */
    fillLast10Table: function(data, tbody) {
        tbody = tbody || document.getElementById('last10-table-body');
        if (!tbody) return;

        if (!tbody.dataset.originalData) {
            tbody.dataset.originalData = JSON.stringify(data);
        }

        tbody.innerHTML = '';

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

        // Apply heatmap AFTER rows are in the DOM (uses global applyHeatmapToColumn)
        const gradient = [
            { percent: 0, color: '#EF4444' },
            { percent: 0.5, color: '#FDE68A' },
            { percent: 1, color: '#22C55E' }
        ];
        applyHeatmapToColumn(tbody.id, 1, gradient); // HLTV2
        applyHeatmapToColumn(tbody.id, 2, gradient); // ADR
        applyHeatmapToColumn(tbody.id, 3, gradient); // K/D
    },

    /**
     * Fetches nightly average player stats from the local JSON file.
     */
    fetchNightAvgStats: async function() {
        try {
            const response = await fetch(this.NIGHT_AVG_JSON_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("Invalid data format received from JSON file.");
            }
            return data; // Nightly stats not stored globally/in module state
        } catch (err) {
            console.error('Failed to fetch night avg stats:', err);
            showMessage(`Error loading night stats: ${err.message}`, 'error'); // Uses global showMessage
            return [];
        }
    },

    /**
     * Loads and renders the nightly average table.
     */
    loadAndRenderNightAvgTable: async function() {
        const stats = await this.fetchNightAvgStats(); // Use module's fetch
        if (stats && stats.length > 0) {
            // Initial sort (uses global sortData) - Uses keys with spaces
            sortData(stats, 'HLTV 2', 'desc');
            // Render (uses module's fill)
            this.fillNightAvgTable(stats);
            // Set initial header indicator (uses global setInitialSortState)
            const tbody = document.getElementById('night-avg-table-body');
            setInitialSortState(tbody, 'HLTV 2', 'desc');
        }
    },

    /**
     * Fills the nightly average table with data.
     * @param {Array} data - The data array to render.
     * @param {HTMLTableSectionElement} [tbody] - Optional tbody element.
     */
    fillNightAvgTable: function(data, tbody) {
        tbody = tbody || document.getElementById('night-avg-table-body');
        if (!tbody) {
           console.error("fillNightAvgTable: tbody with id 'night-avg-table-body' not found.");
           return;
       }

        if (!tbody.dataset.originalData) {
            tbody.dataset.originalData = JSON.stringify(data);
        }

       tbody.innerHTML = '';

        data.forEach((row, index) => {
           // Use global formatStat
           const formatPercent = (num) => (typeof num === 'number' ? num.toFixed(2) + '%' : 'N/A');

           const tr = document.createElement('tr');
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

       // Apply heatmap AFTER rows are in the DOM (uses global applyHeatmapToColumn)
       const gradient = [
           { percent: 0, color: '#EF4444' },
           { percent: 0.5, color: '#FDE68A' },
           { percent: 1, color: '#22C55E' }
       ];
       applyHeatmapToColumn(tbody.id, 1, gradient); // HLTV2
       applyHeatmapToColumn(tbody.id, 2, gradient); // ADR
       applyHeatmapToColumn(tbody.id, 3, gradient); // K/D
       applyHeatmapToColumn(tbody.id, 4, gradient); // HLTV2 DIFF
       applyHeatmapToColumn(tbody.id, 5, gradient); // ADR DIFF
   }

}; // End of StatsTables object 