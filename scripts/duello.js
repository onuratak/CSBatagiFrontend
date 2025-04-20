// scripts/duello.js

const Duello = {
    DUELLO_JSON_URL: 'data/duello_son_mac.json',
    DUELLO_SEZON_JSON_URL: 'data/duello_sezon.json',

    /**
     * Initializes the Duello module: loads both grids and sets up listeners.
     */
    init: function() {
        this.loadAndRenderDuelloSonMacGrid();
        this.loadAndRenderDuelloSezonGrid();
        // We can attach the listener once here, delegating from a parent container
        // Assuming pageContentArea is the parent where duello tables reside
        const pageContentArea = document.getElementById('page-content-area');
        if (pageContentArea) {
            pageContentArea.addEventListener('click', this.handleDuelloClick.bind(this));
        } else {
            console.error("Could not find page-content-area to attach Duello click listener.");
        }
    },

    /**
     * Fetches Duello Son Maç data from the local JSON file.
     */
    fetchDuelloSonMacData: async function() {
        try {
            const response = await fetch(this.DUELLO_JSON_URL); // Use module constant
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            if (!data || !data.playerRows || !data.playerCols || !data.duels) {
                throw new Error("Invalid data format received from Duello JSON file.");
            }
            return data;
        } catch (err) {
            console.error('Failed to fetch Duello Son Maç data:', err);
            showMessage(`Error loading Duello data: ${err.message}`, 'error'); // Use global showMessage
            return null;
        }
    },

    /**
     * Renders the Duello Son Maç grid.
     * @param {object} data - The duel data object.
     */
    renderDuelloSonMacGrid: function(data) {
        const table = document.getElementById('duello-table');
        if (!table) {
            console.error("Duello Son Mac table not found!");
            return;
        }
        if (!data) {
            table.innerHTML = '<thead><tr><th></th><th colspan="12" class="text-center p-4 text-red-500">Failed to load Duello Son Mac data.</th></tr></thead>';
            return;
        }
        // Call the shared render logic
        this.renderDuelloGridLogic(table, data); // Use module's render logic
    },

    /**
     * Fetches Duello Sezon data from the local JSON file.
     */
    fetchDuelloSezonData: async function() {
        try {
            const response = await fetch(this.DUELLO_SEZON_JSON_URL); // Use module constant
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            if (!data || !data.playerRows || !data.playerCols || !data.duels) {
                throw new Error("Invalid data format received from Duello Sezon JSON file.");
            }
            return data;
        } catch (err) {
            console.error('Failed to fetch Duello Sezon data:', err);
            showMessage(`Error loading Duello Sezon data: ${err.message}`, 'error'); // Use global showMessage
            return null;
        }
    },

    /**
     * Renders the Duello Sezon grid.
     * @param {object} data - The duel data object.
     */
    renderDuelloSezonGrid: function(data) {
        const table = document.getElementById('duello-sezon-table');
        if (!table) {
            console.error("Duello Sezon table not found!");
            return;
        }
        if (!data) {
            table.innerHTML = '<thead><tr><th></th><th colspan="12" class="text-center p-4 text-red-500">Failed to load Duello Sezon data.</th></tr></thead>';
            return;
        }
        // Call the shared render logic
        this.renderDuelloGridLogic(table, data); // Use module's render logic
    },

    /**
     * Loads and renders the Duello Sezon grid.
     */
    loadAndRenderDuelloSezonGrid: async function() {
        const duelloData = await this.fetchDuelloSezonData(); // Use module's fetch
        this.renderDuelloSezonGrid(duelloData); // Use module's render
    },

    /**
     * Loads and renders the Duello Son Maç grid.
     */
    loadAndRenderDuelloSonMacGrid: async function() {
        const duelloData = await this.fetchDuelloSonMacData(); // Use module's fetch
        this.renderDuelloSonMacGrid(duelloData); // Use module's render
    },

    /**
     * Helper function containing the core logic to render a Duello grid.
     * @param {HTMLTableElement} table - The table element to render into.
     * @param {object} data - The duel data object.
     */
    renderDuelloGridLogic: function(table, data) {
        table.innerHTML = ''; // Clear previous content
        const { playerRows, playerCols, duels } = data;

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const cornerCell = document.createElement('th');
        cornerCell.className = 'border bg-gray-50 p-3 font-semibold text-center';
        cornerCell.style.position = 'sticky'; cornerCell.style.left = '0'; cornerCell.style.top = '0';
        cornerCell.style.zIndex = '20'; cornerCell.style.minWidth = '120px';
        headerRow.appendChild(cornerCell);
        playerCols.forEach(colName => {
            const th = document.createElement('th');
            th.className = 'border bg-gray-50 p-3 font-semibold text-center';
            th.style.position = 'sticky'; th.style.top = '0'; th.style.zIndex = '10';
            th.style.minWidth = '100px'; th.textContent = colName;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');
        playerRows.forEach(rowName => {
            const tr = document.createElement('tr');
            const rowHeader = document.createElement('th');
            rowHeader.className = 'border bg-gray-50 p-3 font-semibold text-left';
            rowHeader.style.position = 'sticky'; rowHeader.style.left = '0'; rowHeader.style.zIndex = '10';
            rowHeader.textContent = rowName;
            tr.appendChild(rowHeader);

            playerCols.forEach(colName => {
                const td = document.createElement('td');
                td.className = 'border p-2 text-center';
                td.style.height = '70px'; td.style.verticalAlign = 'middle';
                const duelData = duels[rowName]?.[colName];

                if (rowName === colName) {
                    td.style.backgroundColor = '#f3f4f6';
                } else if (duelData && (duelData.kills > 0 || duelData.deaths > 0)) {
                    const cellSize = 90;
                    td.style.width = `${cellSize}px`; td.style.height = `${cellSize}px`;
                    td.style.minWidth = `${cellSize}px`; td.style.maxWidth = `${cellSize}px`;
                    td.style.minHeight = `${cellSize}px`; td.style.maxHeight = `${cellSize}px`;
                    td.style.padding = '0'; td.style.position = 'relative'; td.style.overflow = 'hidden';
                    td.style.backgroundColor = '#fff'; td.style.boxSizing = 'border-box';

                    const diagonalLength = Math.ceil(Math.sqrt(2 * cellSize * cellSize));
                    const diagonalLine = document.createElement('div');
                    diagonalLine.style.position = 'absolute'; diagonalLine.style.width = `${diagonalLength}px`;
                    diagonalLine.style.height = '1px'; diagonalLine.style.backgroundColor = '#ccc';
                    diagonalLine.style.top = '50%'; diagonalLine.style.left = '50%';
                    diagonalLine.style.transform = 'translate(-50%, -50%) rotate(45deg)';
                    diagonalLine.style.transformOrigin = 'center center'; diagonalLine.style.zIndex = '1';
                    td.appendChild(diagonalLine);

                    // Use module's circle creation function
                    this.createDuelCircle(td, rowName, colName, duelData.kills, 'bottom-left');
                    this.createDuelCircle(td, colName, rowName, duelData.deaths, 'top-right');
                } else {
                    td.className += ' text-gray-400';
                    td.textContent = '-';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
    },

    /**
     * Creates and appends a colored circle representing duel kills to a table cell.
     */
    createDuelCircle: function(cell, killerName, killedName, killCount, position) {
        let colorClass = 'bg-gray-400'; // Default
        if (killCount > 0) {
            colorClass = position === 'bottom-left' ? 'bg-green-600' : 'bg-red-600';
        }

        const circle = document.createElement('div');
        circle.className = `${colorClass} duello-circle text-white font-bold rounded-full flex items-center justify-center cursor-pointer`;
        circle.style.position = 'absolute';
        circle.style.width = '36px'; circle.style.height = '36px';
        circle.textContent = killCount;
        circle.dataset.killer = killerName;
        circle.dataset.killed = killedName;
        circle.dataset.count = killCount;
        circle.title = `${killerName} killed ${killedName} ${killCount} times`;

        if (position === 'top-right') {
            circle.style.top = '10px'; circle.style.right = '15px';
        } else { // bottom-left
            circle.style.bottom = '10px'; circle.style.left = '15px';
        }
        cell.appendChild(circle);
    },

    /**
     * Handles clicks within Duello grids to show a message.
     * Bound to pageContentArea in init().
     */
    handleDuelloClick: function(event) {
        // Check if the click originated within either duello table
        const duelloSonMacTable = event.target.closest('#duello-table');
        const duelloSezonTable = event.target.closest('#duello-sezon-table');

        if (duelloSonMacTable || duelloSezonTable) {
            const clickedCircle = event.target.closest('.duello-circle');
            if (clickedCircle) {
                const killer = clickedCircle.dataset.killer;
                const killed = clickedCircle.dataset.killed;
                const count = clickedCircle.dataset.count;
                if (killer && killed && count) {
                    const message = `${killer} killed ${killed} ${count} times`;
                    showMessage(message, 'success', 3000); // Use global showMessage
                }
            }
        }
    }

}; // End of Duello object 