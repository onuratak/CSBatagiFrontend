// ==================================================
// --- Attendance Module --- 
// ==================================================

const Attendance = {
    ATTENDANCE_STATES: ["not_coming", "no_response", "coming"], // Order matters for cycling
    TEKER_DONDU_THRESHOLD: 10, // Number of players needed for the wheel

    /**
     * Initializes the attendance module (e.g., fetches initial data)
     */
    init: function() {
        this.fetchStatsFromSheet();
        // Add other initialization if needed
    },

    /**
     * Renders the player list in the attendance table and updates the summary.
     * Relies on global `players` array and DOM elements fetched in MainScript.js
     */
    renderPlayers: function() {
        // Ensure required DOM elements exist (fetched globally)
        if (!playerListBody || !attendanceSummaryDiv || !summaryTextSpan || !tekerDonduIndicator) {
            console.error("Required DOM elements for rendering players/summary are missing.");
            return;
        }
        playerListBody.innerHTML = ''; // Clear existing rows

        // Define default summary state
        let summaryBgClass = 'bg-red-100';
        let summaryTextClass = 'text-red-800';
        let wheelColorClass = 'text-red-800'; // Match wheel color to text

        // Handle case where player data is not available (uses global players)
        if (players.length === 0) {
             playerListBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500">No player data available. Try updating.</td></tr>';
             summaryTextSpan.textContent = 'Gelen oyuncu: 0  Belirsiz: 0';
             tekerDonduIndicator.classList.add('hidden'); // Ensure indicator is hidden
        } else {
            // Calculate counts (uses global players)
            let countComing = 0;
            let countNoResponse = 0;
            players.forEach(player => {
                if (player.attendance === 'coming') countComing++;
                if (player.attendance === 'no_response') countNoResponse++;
            });

            // Update summary text
            summaryTextSpan.textContent = `Gelen oyuncu: ${countComing}  Belirsiz: ${countNoResponse}`;

            // Determine background/text colors and Show/hide the "Teker Döndü" indicator
            if (countComing >= this.TEKER_DONDU_THRESHOLD) { // Use this.TEKER_DONDU_THRESHOLD
                summaryBgClass = 'bg-green-100';
                summaryTextClass = 'text-green-800';
                wheelColorClass = 'text-green-800'; // Match wheel color
                tekerDonduIndicator.classList.remove('hidden');
            } else {
                // Keep default red colors defined above
                tekerDonduIndicator.classList.add('hidden');
            }
        }

        // Apply summary styles
        attendanceSummaryDiv.classList.remove('bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'text-gray-700');
        tekerDonduIndicator.classList.remove('text-green-800', 'text-red-800', 'text-gray-600'); 
        attendanceSummaryDiv.classList.add(summaryBgClass, summaryTextClass);
        if (!tekerDonduIndicator.classList.contains('hidden')) {
             tekerDonduIndicator.classList.add(wheelColorClass);
        }

        // Define attendance state configurations (styles and text)
        const stateConfigs = {
            coming: { text: 'Geliyor', bgColor: 'bg-green-500', textColor: 'text-white' },
            not_coming: { text: 'Gelmiyor', bgColor: 'bg-red-500', textColor: 'text-white' },
            no_response: { text: 'Belirsiz', bgColor: 'bg-gray-300', textColor: 'text-gray-900' }
        };

        // Create and append rows for each player (only if players exist - uses global players)
        if (players.length > 0) {
            players.forEach((player) => {
                const row = document.createElement('tr');
                row.setAttribute('data-player-name', player.name);

                // Name cell
                const nameCell = document.createElement('td');
                nameCell.className = 'font-medium text-gray-900 whitespace-nowrap';
                nameCell.textContent = player.name;
                row.appendChild(nameCell);

                // Status cell
                const statusCell = document.createElement('td');
                statusCell.className = 'text-center'; 
                const statusBadge = document.createElement('span');
                statusBadge.className = 'status-badge px-2 py-1 text-xs font-medium rounded-md';

                let displayStatus = 'Unknown'; 
                const originalStatus = (player.status || '').toLowerCase();
                if (originalStatus.includes('aktif')) {
                    displayStatus = 'Aktif Oyuncu';
                } else if (originalStatus === 'adam evde yok') {
                    displayStatus = 'Evde Yok';
                } else if (player.status) {
                    displayStatus = player.status;
                }
                statusBadge.textContent = displayStatus;

                if (originalStatus.includes('aktif')) {
                    statusBadge.classList.add('bg-green-100', 'text-green-800');
                } else if (originalStatus === 'adam evde yok' || originalStatus.includes('inactive')) { 
                    statusBadge.classList.add('bg-red-100', 'text-red-800');
                } else {
                    statusBadge.classList.add('bg-gray-100', 'text-gray-800');
                }
                statusCell.appendChild(statusBadge);
                row.appendChild(statusCell);

                // Attendance cell
                const attendanceCell = document.createElement('td');
                attendanceCell.className = 'text-center'; 

                const currentState = player.attendance || 'no_response';
                const config = stateConfigs[currentState];

                const container = document.createElement('div');
                container.className = 'attendance-control-container'; 

                const leftArrowBtn = document.createElement('button');
                leftArrowBtn.className = 'attendance-arrow';
                leftArrowBtn.setAttribute('aria-label', `Previous status for ${player.name}`);
                leftArrowBtn.setAttribute('data-direction', 'left');
                leftArrowBtn.setAttribute('data-player', player.name);
                leftArrowBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>`;

                const labelSpan = document.createElement('span');
                labelSpan.className = `attendance-label ${config.bgColor} ${config.textColor}`;
                labelSpan.textContent = config.text;
                labelSpan.setAttribute('data-state', currentState);
                labelSpan.setAttribute('data-player', player.name);

                const rightArrowBtn = document.createElement('button');
                rightArrowBtn.className = 'attendance-arrow';
                rightArrowBtn.setAttribute('aria-label', `Next status for ${player.name}`);
                rightArrowBtn.setAttribute('data-direction', 'right');
                rightArrowBtn.setAttribute('data-player', player.name);
                rightArrowBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>`;

                container.appendChild(leftArrowBtn);
                container.appendChild(labelSpan);
                container.appendChild(rightArrowBtn);
                attendanceCell.appendChild(container);
                row.appendChild(attendanceCell);

                playerListBody.appendChild(row);
            });
        } 
    },

    /**
     * Fetches attendance data from the Google Apps Script endpoint.
     * Updates the global `players` array.
     * Uses global `spinner`, `updateButton`, `showMessage`.
     */
    fetchStatsFromSheet: async function() {
        if (!spinner || !updateButton) {
            console.error("Spinner or Update Button not found");
            return;
        }
        spinner.classList.remove('hidden');
        updateButton.disabled = true;
        try {
            const response = await fetch(APPS_SCRIPT_URL); // Uses global constant
            if (!response.ok) {
                let errorDetails = `HTTP error! Status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorDetails += ` - ${errorData.message || JSON.stringify(errorData)}`;
                } catch (e) { /* Ignore */ }
                throw new Error(errorDetails);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                console.error("Received data is not an array:", data);
                throw new Error("Invalid data format received from server.");
            }
            players = data; // Update the global players array
            this.renderPlayers(); // Call the module's render function
            // showMessage('Attendance data loaded!', 'success'); // Uses global showMessage
        } catch (err) {
            console.error('Failed to fetch stats:', err);
            showMessage(`Error loading data: ${err.message}`, 'error'); // Uses global showMessage
            this.renderPlayers(); // Render even on error
        } finally {
            spinner.classList.add('hidden');
            updateButton.disabled = false;
        }
    },

    /**
     * Sends an attendance update for a specific player to the Google Apps Script endpoint.
     * Uses global `APPS_SCRIPT_URL`, `showMessage`.
     * @param {string} playerName - The name of the player to update.
     * @param {string} newAttendance - The new attendance status ('coming', 'not_coming', 'no_response').
     */
    updateAttendanceInSheet: async function(playerName, newAttendance) {
        console.log(`Attempting to update ${playerName} to ${newAttendance}`);
        try {
            const response = await fetch(APPS_SCRIPT_URL, { // Uses global constant
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                 body: JSON.stringify({ name: playerName, attendance: newAttendance }),
            });

             if (!response.ok) {
                 let errorText = `Network response was not ok (Status: ${response.status})`;
                 try {
                    const errorData = await response.json();
                    errorText += `: ${errorData.message || JSON.stringify(errorData)}`;
                 } catch(e) {
                    errorText = await response.text();
                 }
                 throw new Error(errorText);
             }
             // Optional: Process success response
             // const result = await response.json(); 
             // console.log('Update successful:', result);

            console.log(`Attendance updated successfully in sheet for ${playerName} to ${newAttendance}`);
            // showMessage(`${playerName}'s status updated!`, 'success', 2000); // Uses global showMessage

        } catch (error) {
            console.error('Failed to update attendance in sheet:', error);
            showMessage(`Failed to update status for ${playerName}: ${error.message}`, 'error'); // Uses global showMessage
            // Consider reverting UI or refetching on error
            // await this.fetchStatsFromSheet();
        }
    },

    /**
     * Handles clicks within the player list table for attendance changes.
     * Uses global `players` array and module methods/constants.
     * @param {Event} event - The click event object.
     */
    handlePlayerListClick: async function(event) {
        const targetArrow = event.target.closest('.attendance-arrow');
        const targetLabel = event.target.closest('.attendance-label');
        let playerName = null;
        let direction = null; 
        let playerIndex = -1;

        if (targetArrow) {
            playerName = targetArrow.getAttribute('data-player');
            direction = targetArrow.getAttribute('data-direction');
        } else if (targetLabel) {
             playerName = targetLabel.getAttribute('data-player');
             const rect = targetLabel.getBoundingClientRect();
             const clickX = event.clientX - rect.left;
             direction = (clickX < rect.width / 2) ? 'left' : 'right'; 
        }

        if (playerName) {
            playerIndex = players.findIndex(p => p.name === playerName); // Find in global players array
        }

        if (playerIndex > -1 && direction) {
            const currentState = players[playerIndex].attendance || 'no_response';
            let currentIndex = this.ATTENDANCE_STATES.indexOf(currentState); // Use this.ATTENDANCE_STATES

            if (direction === 'left') {
                currentIndex = (currentIndex - 1 + this.ATTENDANCE_STATES.length) % this.ATTENDANCE_STATES.length;
            } else { 
                currentIndex = (currentIndex + 1) % this.ATTENDANCE_STATES.length;
            }
            const newState = this.ATTENDANCE_STATES[currentIndex];

            // Optimistic UI Update
            players[playerIndex].attendance = newState; // Update global players array
            this.renderPlayers(); // Render changes

            // Asynchronously update the backend
            await this.updateAttendanceInSheet(playerName, newState);
        } else if (playerName && !direction) {
             console.warn(`Could not determine click direction for player ${playerName}`);
        } else if (targetArrow || targetLabel) {
             console.warn(`Player data not found for clicked element.`);
        }
    }

}; // End of Attendance object 