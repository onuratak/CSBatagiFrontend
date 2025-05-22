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
            const response = await fetch(this.DUELLO_JSON_URL + '?_cb=' + Date.now()); // Use module constant
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
            const response = await fetch(this.DUELLO_SEZON_JSON_URL + '?_cb=' + Date.now()); // Use module constant
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
            th.title = colName; // Add title for full name tooltip
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
            rowHeader.title = rowName; // Add title attribute for tooltip
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
                    td.style.boxSizing = 'border-box';

                    // Define colors
                    const lightGreen = '#e8f5e9'; // Background Winner (Row)
                    const lightRed = '#ffebee';   // Background Loser (Row)
                    const darkGreenClass = 'bg-green-600'; // Circle Winner (Row)
                    const darkRedClass = 'bg-red-600';     // Circle Loser (Row)
                    const grayBg = '#f3f4f6'; // Gray for 0 kills bg
                    const grayCircleClass = 'bg-gray-400'; // Gray for 0 kills circle

                    // Determine winner and set colors accordingly
                    let bottomLeftBackgroundColor, topRightBackgroundColor;
                    let bottomLeftCircleColorClass, topRightCircleColorClass;

                    if (duelData.kills > duelData.deaths) { // Row player wins
                        bottomLeftBackgroundColor = lightGreen;
                        topRightBackgroundColor = lightRed;
                        bottomLeftCircleColorClass = darkGreenClass;
                        topRightCircleColorClass = darkRedClass;
                    } else if (duelData.deaths > duelData.kills) { // Column player wins
                        bottomLeftBackgroundColor = lightRed;
                        topRightBackgroundColor = lightGreen;
                        bottomLeftCircleColorClass = darkRedClass;
                        topRightCircleColorClass = darkGreenClass;
                    } else { // Tie
                        bottomLeftBackgroundColor = lightGreen; // Or gray, depending on preference
                        topRightBackgroundColor = lightRed;
                        bottomLeftCircleColorClass = darkGreenClass; // Or gray
                        topRightCircleColorClass = darkRedClass; // Or gray
                    }
                    
                    // Override with gray if kill count is zero for that specific circle/half
                    if (duelData.kills === 0) {
                        bottomLeftCircleColorClass = grayCircleClass;
                        bottomLeftBackgroundColor = grayBg;
                    }
                    if (duelData.deaths === 0) {
                        topRightCircleColorClass = grayCircleClass;
                        topRightBackgroundColor = grayBg; // Ensure bg is also gray if no kills
                    }


                    // APPLY SVG Background with winner-based colored halves
                    const svgBackground = `
                    <svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 100 100' preserveAspectRatio='none'>
                        <polygon points='0,0 0,100 100,100' fill='${bottomLeftBackgroundColor}'/>
                        <polygon points='0,0 100,0 100,100' fill='${topRightBackgroundColor}'/>
                        <line x1='0' y1='0' x2='100' y2='100' stroke='#cccccc' stroke-width='1'/>
                    </svg>`;
                    const encodedSvg = encodeURIComponent(svgBackground.replace(/\n\s*/g, ""));
                    td.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodedSvg}")`;
                    td.style.backgroundRepeat = 'no-repeat';
                    td.style.backgroundSize = '100% 100%';

                    // Pass the determined color class to the circle function
                    this.createDuelCircle(td, rowName, colName, duelData.kills, 'bottom-left', bottomLeftCircleColorClass);
                    this.createDuelCircle(td, colName, rowName, duelData.deaths, 'top-right', topRightCircleColorClass);

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
    createDuelCircle: function(cell, killerName, killedName, killCount, position, circleColorClass) {
        // Use the passed color class, fallback to gray if killCount is 0
        const finalColorClass = killCount > 0 ? circleColorClass : 'bg-gray-400';

        const circle = document.createElement('div');
        circle.className = `${finalColorClass} duello-circle text-white font-bold rounded-full flex items-center justify-center cursor-pointer`;
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