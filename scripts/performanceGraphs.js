document.addEventListener('DOMContentLoaded', () => {
    // Controls
    const metricRadios = document.querySelectorAll('input[name="performance-metric"]');
    const playerTogglesContainer = document.getElementById('performance-player-toggles-list'); // Use the new ID

    // Table elements
    const tableContainer = document.querySelector('#performance-tab-table .overflow-x-auto');
    const tableElement = tableContainer?.querySelector('table.styled-table');
    const tableHead = tableElement?.querySelector('thead');
    const tableBody = document.getElementById('performance-table-body');

    // Graph elements
    // const playerSelectGraph = document.getElementById('performance-graph-player-select'); // REMOVED
    const chartCanvas = document.getElementById('performance-chart');
    const chartPlaceholder = document.getElementById('performance-graph-placeholder');

    // Tab elements
    const tableTab = document.getElementById('performance-table-tab');
    const graphTab = document.getElementById('performance-graph-tab');
    const tablePane = document.getElementById('performance-tab-table');
    const graphPane = document.getElementById('performance-tab-graph');

    let performanceData = [];
    let uniqueDates = [];
    let performanceChart = null;
    let playerColors = {}; // Store assigned colors for players

    // --- Color Generation ---
    function stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).substr(-2);
        }
        return color;
    }

    function assignPlayerColors() {
         playerColors = {};
         performanceData.forEach((player, index) => {
             // Generate color based on name for consistency, or use index for fallback
             playerColors[player.name] = stringToColor(player.name + 'salt'); // Add salt for better distribution
         });
    }

    // --- Data Fetching and Initialization ---
    async function loadPerformanceData() {
        try {
            const response = await fetch('data/performance_data.json?_cb=' + Date.now());
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            performanceData = await response.json();
            performanceData.sort((a, b) => a.name.localeCompare(b.name)); // Sort players alphabetically

            processDates();
            assignPlayerColors(); // Assign colors before populating toggles
            populatePlayerToggles(); // Populate checkboxes
            // populateGraphPlayerSelect(); // REMOVED

            setupEventListeners();
            setupSubTabNavigation();
            updateDisplay(); // Initial display

        } catch (error) {
            console.error('Error loading performance data:', error);
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="1" class="text-center py-4 text-red-500">Error loading data.</td></tr>';
            if (chartPlaceholder) {
                chartPlaceholder.textContent = 'Error loading performance data.';
                chartPlaceholder.classList.remove('hidden');
            }
            if (chartCanvas) chartCanvas.classList.add('hidden');
            // Also update toggles container on error
            if (playerTogglesContainer) {
                playerTogglesContainer.innerHTML = '<span class="text-xs text-red-500">Error loading player data.</span>';
            }
        }
    }

    function processDates() {
        const dateSet = new Set();
        performanceData.forEach(player => {
            player.performance.forEach(entry => {
                dateSet.add(entry.match_date);
            });
        });
        uniqueDates = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));
    }

    function populatePlayerToggles() {
        if (!playerTogglesContainer) return;
        playerTogglesContainer.innerHTML = ''; // Clear loading message or previous content

        if (performanceData.length === 0) {
            playerTogglesContainer.innerHTML = '<span class="text-xs text-gray-500 col-span-full">No players found in data.</span>';
            playerTogglesContainer.innerHTML = '<span class="text-xs text-gray-500">No players found in data.</span>';
            return; // Stop if no data
        }

        performanceData.forEach(player => {
            const playerColor = playerColors[player.name] || '#000000';
            const div = document.createElement('div');
            div.classList.add('flex', 'items-center');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `toggle-${player.name.replace(/\s+/g, '-')}`;
            checkbox.value = player.name;
            checkbox.checked = true; // Default to checked
            checkbox.classList.add('form-checkbox', 'h-4', 'w-4', 'text-blue-600', 'border-gray-300', 'rounded', 'focus:ring-blue-500');
            checkbox.addEventListener('change', updateDisplay); // Update graph on toggle change

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = player.name;
            label.classList.add('ml-2', 'text-sm', 'font-medium', 'text-gray-700', 'cursor-pointer');
            // Add a color swatch next to the name
            label.style.borderLeft = `10px solid ${playerColor}`;
            label.style.paddingLeft = '6px';
            label.style.display = 'inline-block';

            div.appendChild(checkbox);
            div.appendChild(label);
            playerTogglesContainer.appendChild(div);
        });
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        metricRadios.forEach(radio => {
            radio.addEventListener('change', updateDisplay);
        });
        // Event listeners for checkboxes are added in populatePlayerToggles

        // Add listeners for Select/Deselect All buttons
        const selectAllBtn = document.getElementById('select-all-players');
        const deselectAllBtn = document.getElementById('deselect-all-players');

        if (selectAllBtn && playerTogglesContainer) {
            selectAllBtn.addEventListener('click', () => {
                const checkboxes = playerTogglesContainer.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = true);
                updateDisplay(); // Update the chart
            });
        }

        if (deselectAllBtn && playerTogglesContainer) {
            deselectAllBtn.addEventListener('click', () => {
                const checkboxes = playerTogglesContainer.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = false);
                updateDisplay(); // Update the chart
            });
        }
    }

    // --- Sub-Tab Navigation ---
    function setupSubTabNavigation() {
        const tabs = document.querySelectorAll('#performance-sub-tabs button');
        const panes = document.querySelectorAll('#performance-tab-content .performance-tab-pane');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active', 'border-blue-600', 'text-blue-600'));
                tabs.forEach(t => t.classList.add('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300'));
                panes.forEach(p => p.classList.add('hidden'));
                panes.forEach(p => p.classList.remove('active'));

                tab.classList.add('active', 'border-blue-600', 'text-blue-600');
                tab.classList.remove('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300');
                const targetPaneId = tab.getAttribute('data-tabs-target');
                const targetPane = document.querySelector(targetPaneId);
                if (targetPane) {
                    targetPane.classList.remove('hidden');
                    targetPane.classList.add('active');
                }
                updateDisplay(); // Update content when switching tabs
            });
        });
    }

    // --- Display Logic ---
    function updateDisplay() {
        const selectedMetric = document.querySelector('input[name="performance-metric"]:checked').value;
        
        // Determine visible players for the graph
        const visiblePlayersGraph = getVisiblePlayers();

        if (tablePane && tablePane.classList.contains('active')) {
             populateTable(selectedMetric);
             clearChart();
        } else if (graphPane && graphPane.classList.contains('active')) {
             clearTable(); 
             if (visiblePlayersGraph.length > 0) {
                 populateChart(visiblePlayersGraph, selectedMetric);
             } else {
                 clearChart(); 
                 if(chartPlaceholder) chartPlaceholder.textContent = 'No players selected to display on the graph.';
             }
        } else {
             clearTable();
             clearChart();
        }
    }
    
    function getVisiblePlayers() {
        if (!playerTogglesContainer) return [];
        const checkedBoxes = playerTogglesContainer.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkedBoxes).map(cb => cb.value);
    }

    // --- Table Population (Remains largely the same) ---
    function populateTable(metric) {
        if (!tableHead || !tableBody) return;
        
        tableHead.innerHTML = ''; 
        tableBody.innerHTML = '';

        if (performanceData.length === 0 || uniqueDates.length === 0) {
            tableBody.innerHTML = '<tr><td class="text-center py-4 text-gray-500">No performance data available.</td></tr>';
            return;
        }

        const headerRow = tableHead.insertRow();
        const playerHeader = document.createElement('th');
        playerHeader.textContent = 'Oyuncu';
        playerHeader.classList.add('sticky', 'left-0', 'z-10', 'bg-gray-100', 'px-3', 'py-2'); 
        headerRow.appendChild(playerHeader);

        uniqueDates.forEach(dateStr => {
            const dateHeader = document.createElement('th');
            dateHeader.textContent = new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
            dateHeader.classList.add('text-center', 'px-2', 'py-2');
            headerRow.appendChild(dateHeader);
        });

         const colCount = uniqueDates.length + 1;
         if (tableBody.querySelector('td[colspan="1"]')) {
            tableBody.querySelector('td').setAttribute('colspan', colCount);
        }

        // --- Calculate average metric for sorting ---
        const dataWithAvg = performanceData.map(player => {
            const performanceMap = new Map(player.performance.map(entry => [entry.match_date, entry]));
            let sum = 0;
            let count = 0;
            uniqueDates.forEach(dateStr => {
                const entry = performanceMap.get(dateStr);
                const value = entry ? entry[metric] : null;
                if (value !== null && !isNaN(value)) {
                    sum += value;
                    count++;
                }
            });
            const average = (count > 0) ? (sum / count) : -Infinity; // Use -Infinity to sort players with no data last
            return { ...player, averageMetric: average }; 
        });

        // --- Sort players by average metric (descending) ---
        dataWithAvg.sort((a, b) => b.averageMetric - a.averageMetric);

        // --- Populate table rows using sorted data ---
        dataWithAvg.forEach(player => {
            const playerRow = tableBody.insertRow();
            const nameCell = playerRow.insertCell();
            nameCell.textContent = player.name;
            nameCell.classList.add('sticky', 'left-0', 'z-10', 'bg-white', 'whitespace-nowrap', 'px-3', 'py-1', 'font-medium'); 

            const performanceMap = new Map(player.performance.map(entry => [entry.match_date, entry]));

            uniqueDates.forEach(dateStr => {
                const dataCell = playerRow.insertCell();
                const entry = performanceMap.get(dateStr);
                const value = entry ? entry[metric] : null;

                dataCell.textContent = value !== null ? value.toFixed(2) : '-';
                dataCell.classList.add('text-center', 'px-2', 'py-1');
                if (value === null) {
                    dataCell.classList.add('text-gray-400');
                }
            });
        });
    }

    function clearTable() {
        if (tableHead) tableHead.innerHTML = '';
        if (tableBody) {
            const colSpan = (uniqueDates.length > 0) ? uniqueDates.length + 1 : 1;
            tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-4 text-gray-500">Select a metric (ADR or HLTV 2.0) to view the performance table.</td></tr>`;
        }
    }

    // --- Chart Population (New Multi-Player Logic) ---
    function populateChart(visiblePlayerNames, metric) { 
         if (!chartCanvas || !chartPlaceholder) return;
         if (!visiblePlayerNames || visiblePlayerNames.length === 0) {
             clearChart();
             chartPlaceholder.textContent = 'Select at least one player to display the graph.';
             return;
         }

        const datasets = [];
        const allLabelsSet = new Set(); // Use dates from all visible players for the x-axis

        visiblePlayerNames.forEach(playerName => {
            const playerData = performanceData.find(p => p.name === playerName);
            if (!playerData || !playerData.performance) return; // Skip if player data is missing

            const playerPerformance = playerData.performance.filter(entry => entry[metric] !== null);
            if (playerPerformance.length === 0) return; // Skip if no data for this metric
            
             playerPerformance.sort((a, b) => new Date(a.match_date) - new Date(b.match_date));
             playerPerformance.forEach(entry => allLabelsSet.add(entry.match_date)); // Collect all relevant dates

             // Map data points to the combined date axis, inserting nulls where needed
             const performanceMap = new Map(playerPerformance.map(entry => [entry.match_date, entry[metric]]));
             
             datasets.push({
                label: `${playerName}`, // Label dataset with player name
                data: [], // Data will be populated based on sorted dates
                borderColor: playerColors[playerName] || stringToColor(playerName+'fallback'),
                backgroundColor: (playerColors[playerName] || stringToColor(playerName+'fallback')) + '1A', // Add alpha for background
                tension: 0.1,
                fill: false, // Avoid filling areas for multiple lines initially
                pointRadius: 5, // Increased point size
                pointHoverRadius: 7, // Increased hover size
                spanGaps: true // Connect lines across null data points
             });
        });
        
        const sortedLabels = Array.from(allLabelsSet).sort((a,b) => new Date(a) - new Date(b));
        
        // Populate data for each dataset based on the sorted universal labels
        datasets.forEach(dataset => {
            const playerName = dataset.label;
            const playerData = performanceData.find(p => p.name === playerName);
            const performanceMap = new Map(playerData.performance.map(entry => [entry.match_date, entry[metric]]));
            dataset.data = sortedLabels.map(date => performanceMap.get(date) ?? null);
        });
        
        // Check if we actually have any data to plot after processing
        if (datasets.length === 0 || datasets.every(ds => ds.data.every(d => d === null))) {
             clearChart();
             chartPlaceholder.textContent = `No data available for the selected players and metric (${metric.toUpperCase()}).`;
             return;
        }

        const chartConfig = {
            type: 'line',
            data: {
                labels: sortedLabels.map(date => new Date(date).toLocaleDateString('tr-TR')), // Format labels for display
                datasets: datasets
            },
             options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: metric.toUpperCase()
                        }
                    },
                    x: {
                         title: {
                            display: true,
                            text: 'Tarih'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                             label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2);
                                }
                                return label;
                            }
                        }
                    },
                    legend: {
                         display: false // Hide legend as toggles are now separate
                     }
                },
                 hover: {
                    mode: 'nearest',
                    intersect: true
                }
            }
        };

        chartPlaceholder.classList.add('hidden');
        chartCanvas.classList.remove('hidden');

        if (performanceChart) {
            performanceChart.destroy();
        }
        performanceChart = new Chart(chartCanvas.getContext('2d'), chartConfig);
    }

    function clearChart() {
        if (performanceChart) {
            performanceChart.destroy();
            performanceChart = null;
        }
        if (chartPlaceholder) {
             chartPlaceholder.textContent = 'Toggle players and select a metric to view the graph.';
             chartPlaceholder.classList.remove('hidden');
        }
       if (chartCanvas) chartCanvas.classList.add('hidden');
    }

    // --- Initial Load ---
    loadPerformanceData();
}); 