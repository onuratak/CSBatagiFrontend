// ==================================================
// --- Attendance Module --- 
// ==================================================

const Attendance = {
    ATTENDANCE_STATES: ["not_coming", "no_response", "coming"], // Order matters for cycling
    TEKER_DONDU_THRESHOLD: 10, // Number of players needed for the wheel
    ATTENDANCE_DB_PATH: 'attendanceState', // Firebase path for attendance
    attendanceListenersAttached: false, // Flag for Firebase listener

    /**
     * Initializes the attendance module (e.g., fetches initial data, attaches listeners)
     */
    init: function() {
        // Fetch initial data from sheet (which also syncs to Firebase)
        this.fetchStatsFromSheet(); 

        // Attach Firebase listener only once
        if (!this.attendanceListenersAttached) {
            this.attachFirebaseListener();
            this.attendanceListenersAttached = true;
        }
    },

    /**
     * Attaches the Firebase listener for attendance state changes.
     */
    attachFirebaseListener: function() {
        if (typeof database === 'undefined' || database === null || !this.ATTENDANCE_DB_PATH) {
            console.error('Firebase database not available for attendance listener.');
            return;
        }
        const attendanceRef = database.ref(this.ATTENDANCE_DB_PATH);

        attendanceRef.on('value', (snapshot) => {
            const attendanceData = snapshot.val() || {};
            console.log("Firebase attendance listener triggered."); // Debug log
            // Update the entire UI based on the latest data from Firebase
            this.updateAttendanceUIFromFirebase(attendanceData);
        }, (error) => {
            console.error("Firebase attendance listener error:", error);
            showMessage("Error syncing attendance state.", "error");
        });
    },

    /**
     * Rebuilds the attendance table and summary based on Firebase data.
     * @param {object} attendanceData - The object containing { playerName: status } from Firebase.
     */
    updateAttendanceUIFromFirebase: function(attendanceData) {
         // Ensure required DOM elements exist 
        if (!playerListBody || !attendanceSummaryDiv || !summaryTextSpan || !tekerDonduIndicator) {
            console.error("Required DOM elements for rendering players/summary are missing.");
            return;
        }
        playerListBody.innerHTML = ''; // Clear existing rows

        // Define attendance state configurations (styles and text)
        const stateConfigs = {
            coming: { text: 'Geliyor', bgColor: 'bg-green-500', textColor: 'text-white' },
            not_coming: { text: 'Gelmiyor', bgColor: 'bg-red-500', textColor: 'text-white' },
            no_response: { text: 'Belirsiz', bgColor: 'bg-gray-300', textColor: 'text-gray-900' }
        };

        let countComing = 0;
        let countNoResponse = 0;

        // --- Render Table Rows --- 
        // Iterate through the players fetched from the sheet (for names/status)
        players.forEach((player) => {
            const playerName = player.name;
            // Get current attendance from Firebase data, default to no_response
            const currentAttendance = attendanceData[playerName] || 'no_response';

             // Recalculate counts based on Firebase data
            if (currentAttendance === 'coming') countComing++;
            if (currentAttendance === 'no_response') countNoResponse++;

            const row = document.createElement('tr');
            row.setAttribute('data-player-name', playerName);

            // Name cell (from global players array)
            const nameCell = document.createElement('td');
            nameCell.className = 'font-medium text-gray-900 whitespace-nowrap';
            nameCell.textContent = playerName;
            row.appendChild(nameCell);

            // Status cell (from global players array)
            const statusCell = document.createElement('td');
            statusCell.className = 'text-center'; 
            const statusBadge = document.createElement('span');
            statusBadge.className = 'status-badge px-2 py-1 text-xs font-medium rounded-md';
            let displayStatus = 'Unknown'; 
            const originalStatus = (player.status || '').toLowerCase();
            if (originalStatus.includes('aktif')) displayStatus = 'Aktif Oyuncu';
            else if (originalStatus === 'adam evde yok') displayStatus = 'Evde Yok';
            else if (player.status) displayStatus = player.status;
            statusBadge.textContent = displayStatus;
            if (originalStatus.includes('aktif')) statusBadge.classList.add('bg-green-100', 'text-green-800');
            else if (originalStatus === 'adam evde yok' || originalStatus.includes('inactive')) statusBadge.classList.add('bg-red-100', 'text-red-800');
            else statusBadge.classList.add('bg-gray-100', 'text-gray-800');
            statusCell.appendChild(statusBadge);
            row.appendChild(statusCell);

            // Attendance cell (state determined by Firebase)
            const attendanceCell = document.createElement('td');
            attendanceCell.className = 'text-center'; 
            const config = stateConfigs[currentAttendance];
            const container = document.createElement('div');
            container.className = 'attendance-control-container'; 
            const leftArrowBtn = document.createElement('button');
            leftArrowBtn.className = 'attendance-arrow';
            leftArrowBtn.setAttribute('aria-label', `Previous status for ${playerName}`);
            leftArrowBtn.setAttribute('data-direction', 'left');
            leftArrowBtn.setAttribute('data-player', playerName);
            leftArrowBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>`;
            const labelSpan = document.createElement('span');
            labelSpan.className = `attendance-label ${config.bgColor} ${config.textColor}`;
            labelSpan.textContent = config.text;
            labelSpan.setAttribute('data-state', currentAttendance);
            labelSpan.setAttribute('data-player', playerName);
            const rightArrowBtn = document.createElement('button');
            rightArrowBtn.className = 'attendance-arrow';
            rightArrowBtn.setAttribute('aria-label', `Next status for ${playerName}`);
            rightArrowBtn.setAttribute('data-direction', 'right');
            rightArrowBtn.setAttribute('data-player', playerName);
            rightArrowBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>`;
            container.appendChild(leftArrowBtn);
            container.appendChild(labelSpan);
            container.appendChild(rightArrowBtn);
            attendanceCell.appendChild(container);
            row.appendChild(attendanceCell);

            playerListBody.appendChild(row);
        });

        // --- Update Summary --- 
        summaryTextSpan.textContent = `Gelen oyuncu: ${countComing}  Belirsiz: ${countNoResponse}`;
        let summaryBgClass = 'bg-red-100';
        let summaryTextClass = 'text-red-800';
        let wheelColorClass = 'text-red-800'; 
        
        if (countComing >= this.TEKER_DONDU_THRESHOLD) { 
            summaryBgClass = 'bg-green-100';
            summaryTextClass = 'text-green-800';
            wheelColorClass = 'text-green-800';
            tekerDonduIndicator.classList.remove('hidden');
        } else {
            tekerDonduIndicator.classList.add('hidden');
        }

        attendanceSummaryDiv.classList.remove('bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800', 'text-gray-700');
        tekerDonduIndicator.classList.remove('text-green-800', 'text-red-800', 'text-gray-600'); 
        attendanceSummaryDiv.classList.add(summaryBgClass, summaryTextClass);
        if (!tekerDonduIndicator.classList.contains('hidden')) {
             tekerDonduIndicator.classList.add(wheelColorClass);
        }
    },

    /**
     * Renders the player list - Now just a placeholder, Firebase listener handles rendering.
     * Kept for potential future use or if direct rendering is needed elsewhere.
     */
    renderPlayers: function() {
        // console.log("renderPlayers called, but UI update is now handled by Firebase listener.");
        // The actual rendering logic is now in updateAttendanceUIFromFirebase
        // If needed, could potentially trigger an update by fetching latest FB state here?
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

            // --- Write Initial State to Firebase --- 
            if (typeof database !== 'undefined' && database !== null && this.ATTENDANCE_DB_PATH) {
                try {
                    const initialFirebaseState = {};
                    players.forEach(player => {
                        initialFirebaseState[player.name] = player.attendance || 'no_response';
                    });
                    const attendanceRef = database.ref(this.ATTENDANCE_DB_PATH);
                    await attendanceRef.set(initialFirebaseState);
                    console.log("Initial attendance state synced to Firebase.");
                } catch (firebaseError) {
                    console.error("Failed to sync initial attendance state to Firebase:", firebaseError);
                    // Show a message? Maybe not critical if render still works.
                }
            } else {
                 console.error('Firebase database not available or ATTENDANCE_DB_PATH not set. Skipping initial Firebase sync.');
            }
            // --- End Firebase Initial Sync --- 

            // Initial Render: Call the UI update function AFTER fetch and initial sync are complete
            // Pass the state we just synced to Firebase for consistency
            const initialFirebaseState = {};
            players.forEach(player => {
                initialFirebaseState[player.name] = player.attendance || 'no_response';
            });
            this.updateAttendanceUIFromFirebase(initialFirebaseState);
            
            // showMessage('Attendance data loaded!', 'success');
        } catch (err) {
            console.error('Failed to fetch stats:', err);
            showMessage(`Error loading data: ${err.message}`, 'error');
            // REMOVED: this.renderPlayers(); // Render even on error - Listener handles UI
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
    syncAttendanceUpdate: async function(playerName, newAttendance) {
        console.log(`Syncing update for ${playerName} to ${newAttendance} (Firebase & Sheet)`);

        // --- 1. Update Firebase --- 
        if (typeof database !== 'undefined' && database !== null && this.ATTENDANCE_DB_PATH) {
            try {
                const playerRef = database.ref(this.ATTENDANCE_DB_PATH).child(playerName);
                await playerRef.set(newAttendance);
                console.log(`Attendance updated successfully in Firebase for ${playerName}`);
            } catch (firebaseError) {
                console.error(`Failed to update attendance in Firebase for ${playerName}:`, firebaseError);
                // Don't necessarily show a message here, as the sheet update might still succeed,
                // but log the error for debugging.
            }
        } else {
            console.error('Firebase database not available or ATTENDANCE_DB_PATH not set. Skipping Firebase update.');
        }

        // --- 2. Update Google Sheet (Existing Logic) --- 
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
        let clickedElement = targetArrow || targetLabel;
        
        if (!clickedElement) return; // Exit if click wasn't on a relevant element

        const playerName = clickedElement.getAttribute('data-player');
        if (!playerName) return; // Exit if player name not found

        const controlContainer = clickedElement.closest('.attendance-control-container');
        if (!controlContainer) return; // Exit if container not found

        const labelSpan = controlContainer.querySelector('.attendance-label');
        if (!labelSpan) return; // Exit if label span not found

        // --- Get current state FROM THE UI (data-state attribute) --- 
        const currentState = labelSpan.getAttribute('data-state') || 'no_response';
        // --- End getting state from UI ---
        
        let direction = null; 
        if (targetArrow) {
            direction = targetArrow.getAttribute('data-direction');
        } else if (targetLabel) {
             const rect = targetLabel.getBoundingClientRect();
             const clickX = event.clientX - rect.left;
             direction = (clickX < rect.width / 2) ? 'left' : 'right'; 
        }

        if (direction) {
            let currentIndex = this.ATTENDANCE_STATES.indexOf(currentState); 

            if (direction === 'left') {
                currentIndex = (currentIndex - 1 + this.ATTENDANCE_STATES.length) % this.ATTENDANCE_STATES.length;
            } else { // Right arrow or label click
                currentIndex = (currentIndex + 1) % this.ATTENDANCE_STATES.length;
            }
            const newState = this.ATTENDANCE_STATES[currentIndex];

            // Call the combined update function (runs in background)
            this.syncAttendanceUpdate(playerName, newState);

        } else {
             console.warn(`Could not determine click direction for player ${playerName}`);
        }
    }

}; // End of Attendance object 