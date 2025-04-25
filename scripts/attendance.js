// ==================================================
// --- Attendance Module --- 
// ==================================================

const Attendance = {
    ATTENDANCE_STATES: ["not_coming", "no_response", "coming"], // Order matters for cycling
    EMOJI_STATES: [
        "normal", 
        "tired", 
        "sick", 
        "feeling_good", 
        "waffle",
        "cocuk_bende",
        "evde_degil",
        "sonrakine",
        "kafa_izni",
        "hanimpoints",
        "sikimin_keyfi",
        "dokuzda_haber"
    ], // Order matters for cycling
    EMOJI_MAPPING: {
        "normal": "😊",
        "tired": "😴",
        "sick": "🤒", 
        "feeling_good": "🔥",
        "waffle": "🧇",
        "cocuk_bende": "👶",
        "evde_degil": "🛄",
        "sonrakine": "🔜",
        "kafa_izni": "💆‍♂️",
        "hanimpoints": "🙅‍♀️",
        "sikimin_keyfi": "🍆",
        "dokuzda_haber": "9️⃣"
    },
    EMOJI_EXPLANATIONS: {
        "normal": "Normal",
        "tired": "Yorgun",
        "sick": "Hasta", 
        "feeling_good": "İyi hissediyorum",
        "waffle": "Waffle",
        "cocuk_bende": "Çocuk bende / hasta",
        "evde_degil": "Evde değil",
        "sonrakine": "Bi sonraki maça geliyorum",
        "kafa_izni": "Kafa izni",
        "hanimpoints": "Not enough hanımpoints",
        "sikimin_keyfi": "Sikimin keyfine, size mi soracağım götelekler",
        "dokuzda_haber": "9'da kalirsaniz haber edin"
    },
    TEKER_DONDU_THRESHOLD: 10, // Number of players needed for the wheel
    ATTENDANCE_DB_PATH: 'attendanceState', // Firebase path for attendance
    EMOJI_DB_PATH: 'emojiState', // Firebase path for emoji states
    attendanceListenersAttached: false, // Flag for Firebase listener
    emojiListenersAttached: false, // Flag for emoji Firebase listener

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

        // Attach emoji Firebase listener only once
        if (!this.emojiListenersAttached) {
            this.attachEmojiFirebaseListener();
            this.emojiListenersAttached = true;
        }
        
        // Force emoji initialization (in case Firebase listener hasn't triggered yet)
        this.initializeEmojiStatuses();
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
     * Attaches the Firebase listener for emoji state changes.
     */
    attachEmojiFirebaseListener: function() {
        if (typeof database === 'undefined' || database === null || !this.EMOJI_DB_PATH) {
            console.error('Firebase database not available for emoji status listener.');
            return;
        }
        const emojiRef = database.ref(this.EMOJI_DB_PATH);

        emojiRef.on('value', (snapshot) => {
            const emojiData = snapshot.val() || {};
            console.log("Firebase emoji status listener triggered."); // Debug log
            // Update the emoji UI based on the latest data from Firebase
            this.updateEmojiUIFromFirebase(emojiData);
        }, (error) => {
            console.error("Firebase emoji listener error:", error);
            showMessage("Error syncing emoji states.", "error");
        });
    },

    /**
     * Initializes the emoji statuses in Firebase if they don't exist yet
     */
    initializeEmojiStatuses: function() {
        if (typeof database === 'undefined' || database === null || !this.EMOJI_DB_PATH) {
            console.error('Firebase database not available for emoji status initialization.');
            return;
        }

        const emojiRef = database.ref(this.EMOJI_DB_PATH);
        
        // Check if emoji data exists
        emojiRef.once('value', (snapshot) => {
            const emojiData = snapshot.val() || {};
            const initialEmojiState = {};
            let needsSync = false;

            // For each player, check if emoji data exists in Firebase
            players.forEach(player => {
                if (player.steamId) {
                    const steamIdStr = String(player.steamId);
                    if (!emojiData[steamIdStr]) {
                        initialEmojiState[steamIdStr] = {
                            name: player.name,
                            status: 'normal' // Default emoji state
                        };
                        needsSync = true;
                    }
                }
            });

            // If needed, update Firebase with initial emoji states
            if (needsSync) {
                emojiRef.update(initialEmojiState)
                    .then(() => {
                        console.log("Initial emoji states synced to Firebase");
                        // Explicitly update UI with complete data
                        const completeData = {...emojiData, ...initialEmojiState};
                        this.updateEmojiUIFromFirebase(completeData);
                    })
                    .catch(error => console.error("Failed to sync initial emoji states:", error));
            } else {
                // If no sync needed, update UI with existing data
                this.updateEmojiUIFromFirebase(emojiData);
            }
        });
    },

    /**
     * Updates the emoji UI based on Firebase data.
     * @param {object} emojiData - The object containing emoji status data from Firebase.
     */
    updateEmojiUIFromFirebase: function(emojiData) {
        console.log("Updating emoji UI with data:", emojiData); // Debug log
        
        const playerRows = document.querySelectorAll('#player-list tr[data-player-name]');
        if (playerRows.length === 0) {
            console.warn("No player rows found to update emoji UI.");
            return;
        }
        
        playerRows.forEach(row => {
            const playerName = row.getAttribute('data-player-name');
            if (!playerName) {
                console.warn("Row missing data-player-name attribute");
                return;
            }
            
            const player = players.find(p => p.name === playerName);
            
            if (!player || !player.steamId) {
                console.warn(`Could not find player data or SteamID for ${playerName}.`);
                return;
            }
            
            const steamIdStr = String(player.steamId);
            const statusCell = row.querySelector('td:nth-child(2)'); // Status is second column
            
            if (!statusCell) {
                console.warn(`Could not find status cell for ${playerName}.`);
                return;
            }
            
            // Clear status cell first
            statusCell.innerHTML = '';
            
            // Create a new emoji control container
            const container = document.createElement('div');
            container.className = 'emoji-control-container'; 

            const leftArrowBtn = document.createElement('button');
            leftArrowBtn.className = 'emoji-arrow';
            leftArrowBtn.setAttribute('aria-label', `Previous emoji for ${playerName}`);
            leftArrowBtn.setAttribute('data-direction', 'left');
            leftArrowBtn.setAttribute('data-player', playerName);
            leftArrowBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>`;
            
            // Get the current emoji state from Firebase
            let currentState = "normal"; // Default
            if (emojiData[steamIdStr] && emojiData[steamIdStr].status) {
                currentState = emojiData[steamIdStr].status;
            }
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'emoji-label';
            labelSpan.textContent = this.EMOJI_MAPPING[currentState] || "😊";
            labelSpan.setAttribute('data-state', currentState);
            labelSpan.setAttribute('data-player', playerName);
            
            // Add tooltip with explanation
            const explanation = this.EMOJI_EXPLANATIONS[currentState] || "Normal";
            labelSpan.setAttribute('title', explanation);
            labelSpan.setAttribute('data-tooltip', explanation);
            
            const rightArrowBtn = document.createElement('button');
            rightArrowBtn.className = 'emoji-arrow';
            rightArrowBtn.setAttribute('aria-label', `Next emoji for ${playerName}`);
            rightArrowBtn.setAttribute('data-direction', 'right');
            rightArrowBtn.setAttribute('data-player', playerName);
            rightArrowBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>`;
            
            container.appendChild(leftArrowBtn);
            container.appendChild(labelSpan);
            container.appendChild(rightArrowBtn);
            statusCell.appendChild(container);
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

        // Also get emoji states from Firebase if available
        let emojiStates = {};
        if (typeof database !== 'undefined' && database !== null) {
            const emojiRef = database.ref(this.EMOJI_DB_PATH);
            emojiRef.once('value', (snapshot) => {
                emojiStates = snapshot.val() || {};
            });
        }

        let countComing = 0;
        let countNoResponse = 0;

        // --- Render Table Rows --- 
        // Iterate through the players fetched from the sheet (for names/status)
        players.forEach((player) => {
            const playerName = player.name;
            // Get current attendance from Firebase data, default to no_response
            // OLD WAY: const currentAttendance = attendanceData[playerName] || 'no_response';

            // --- NEW WAY: Look up using steamId if possible --- 
            let currentAttendance = 'no_response'; // Default
            if (player.steamId) {
                const steamIdStr = String(player.steamId);
                // Check if the data from Firebase has steamId as key
                if (attendanceData[steamIdStr] && typeof attendanceData[steamIdStr] === 'object') {
                    currentAttendance = attendanceData[steamIdStr].status || 'no_response';
                } else if (typeof attendanceData[playerName] === 'string') {
                    // Fallback for the potentially inconsistent initial state passed directly after fetch
                    // (Ideally, the initial call should also pass the steamId-keyed data)
                    console.warn("Attendance listener received player-name keyed data, using fallback.");
                    currentAttendance = attendanceData[playerName] || 'no_response';
                } else {
                     // Player with steamId exists locally, but not found in Firebase data or format is wrong
                     console.warn(`Could not find status for ${playerName} (ID: ${steamIdStr}) in Firebase data object:`, attendanceData);
                }
            } else {
                // Fallback if player object is missing steamId (shouldn't happen ideally)
                currentAttendance = attendanceData[playerName] || 'no_response'; 
                console.warn(`Player object for ${playerName} is missing steamId, falling back to name lookup.`);
            }
            // --- End NEW WAY ---

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

            // Status cell - now with EMOJI controls
            const statusCell = document.createElement('td');
            statusCell.className = 'text-center'; 
            
            // --- Create emoji controls directly here ---
            const steamIdStr = String(player.steamId || '');
            const emojiContainer = document.createElement('div');
            emojiContainer.className = 'emoji-control-container';
            
            const leftArrowBtn = document.createElement('button');
            leftArrowBtn.className = 'emoji-arrow';
            leftArrowBtn.setAttribute('aria-label', `Previous emoji for ${playerName}`);
            leftArrowBtn.setAttribute('data-direction', 'left');
            leftArrowBtn.setAttribute('data-player', playerName);
            leftArrowBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>`;
            
            // Get the current emoji state if available
            let currentEmojiState = "normal"; // Default
            if (emojiStates[steamIdStr] && emojiStates[steamIdStr].status) {
                currentEmojiState = emojiStates[steamIdStr].status;
            }
            
            const emojiLabel = document.createElement('span');
            emojiLabel.className = 'emoji-label';
            emojiLabel.textContent = this.EMOJI_MAPPING[currentEmojiState] || "😊";
            emojiLabel.setAttribute('data-state', currentEmojiState);
            emojiLabel.setAttribute('data-player', playerName);
            
            // Add tooltip with explanation
            const explanation = this.EMOJI_EXPLANATIONS[currentEmojiState] || "Normal";
            emojiLabel.setAttribute('title', explanation);
            emojiLabel.setAttribute('data-tooltip', explanation);
            
            const rightArrowBtn = document.createElement('button');
            rightArrowBtn.className = 'emoji-arrow';
            rightArrowBtn.setAttribute('aria-label', `Next emoji for ${playerName}`);
            rightArrowBtn.setAttribute('data-direction', 'right');
            rightArrowBtn.setAttribute('data-player', playerName);
            rightArrowBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>`;
            
            emojiContainer.appendChild(leftArrowBtn);
            emojiContainer.appendChild(emojiLabel);
            emojiContainer.appendChild(rightArrowBtn);
            statusCell.appendChild(emojiContainer);
            
            row.appendChild(statusCell);
            
            // Check player status for row styling
            const originalStatus = (player.status || '').toLowerCase();
            if (originalStatus === 'adam evde yok') {
                row.classList.add('bg-red-100'); // Light red background for 'Evde Yok'
            }

            // Attendance cell (state determined by Firebase)
            const attendanceCell = document.createElement('td');
            attendanceCell.className = 'text-center'; 
            const config = stateConfigs[currentAttendance];
            const container = document.createElement('div');
            container.className = 'attendance-control-container'; 
            const leftArrowBtn2 = document.createElement('button');
            leftArrowBtn2.className = 'attendance-arrow';
            leftArrowBtn2.setAttribute('aria-label', `Previous status for ${playerName}`);
            leftArrowBtn2.setAttribute('data-direction', 'left');
            leftArrowBtn2.setAttribute('data-player', playerName);
            leftArrowBtn2.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>`;
            const labelSpan = document.createElement('span');
            labelSpan.className = `attendance-label ${config.bgColor} ${config.textColor}`;
            labelSpan.textContent = config.text;
            labelSpan.setAttribute('data-state', currentAttendance);
            labelSpan.setAttribute('data-player', playerName);
            const rightArrowBtn2 = document.createElement('button');
            rightArrowBtn2.className = 'attendance-arrow';
            rightArrowBtn2.setAttribute('aria-label', `Next status for ${playerName}`);
            rightArrowBtn2.setAttribute('data-direction', 'right');
            rightArrowBtn2.setAttribute('data-player', playerName);
            rightArrowBtn2.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>`;
            container.appendChild(leftArrowBtn2);
            container.appendChild(labelSpan);
            container.appendChild(rightArrowBtn2);
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

        // Initialize any missing emoji statuses in Firebase
        this.initializeEmojiStatuses();
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
            // players = data; // Update the global players array
            // NEW: Map steamid to steamId
            players = data.map(player => ({
                ...player, // Copy existing properties (name, status, attendance)
                steamId: player.steamid // Add steamId property from steamid
            }));
            console.log("Processed players with steamId:", players); // Debug log

            // --- Write Initial State to Firebase --- 
            if (typeof database !== 'undefined' && database !== null && this.ATTENDANCE_DB_PATH) {
                try {
                    const initialFirebaseState = {};
                    // NEW: Build state keyed by steamId
                    players.forEach(player => {
                        if (player.steamId && player.name) { // Ensure we have ID and name
                             const steamIdStr = String(player.steamId); // Ensure string key
                             initialFirebaseState[steamIdStr] = { 
                                 name: player.name, 
                                 status: player.attendance || 'no_response' 
                             };
                        } else {
                             console.warn("Skipping player for initial Firebase sync due to missing steamId or name:", player);
                        }
                    });
                    const attendanceRef = database.ref(this.ATTENDANCE_DB_PATH);
                    await attendanceRef.set(initialFirebaseState);
                    console.log("Initial attendance state (keyed by steamId) synced to Firebase.");
                } catch (firebaseError) {
                    console.error("Failed to sync initial attendance state to Firebase:", firebaseError);
                    // Show a message? Maybe not critical if render still works.
                }
            } else {
                 console.error('Firebase database not available or ATTENDANCE_DB_PATH not set. Skipping initial Firebase sync.');
            }
            // --- End Firebase Initial Sync --- 

            // Initial Render: Call the UI update function AFTER fetch and initial sync are complete
            // Rebuild the state object in the format expected by the original UI update function
            // (The listener in *this* file expects { playerName: status })
            const stateForLocalUI = {};
            players.forEach(player => {
                 if(player.name) {
                    stateForLocalUI[player.name] = player.attendance || 'no_response';
                 }
            });
            this.updateAttendanceUIFromFirebase(stateForLocalUI);
            
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
     * Updates a player's emoji status in Firebase.
     * @param {string} playerName - The name of the player to update.
     * @param {string} newEmojiState - The new emoji status.
     */
    syncEmojiUpdate: async function(playerName, newEmojiState) {
        console.log(`Syncing emoji update for ${playerName} to ${newEmojiState}`);

        // Find player 
        const player = players.find(p => p.name === playerName);
        if (!player || !player.steamId) {
            console.error(`Could not find player data or SteamID for ${playerName}. Emoji update aborted.`);
            return;
        }
        const steamIdStr = String(player.steamId);

        // Update Firebase
        if (typeof database !== 'undefined' && database !== null && this.EMOJI_DB_PATH) {
            try {
                const emojiRef = database.ref(`${this.EMOJI_DB_PATH}/${steamIdStr}`);
                await emojiRef.update({
                    name: playerName,
                    status: newEmojiState
                });
                console.log(`Firebase emoji status updated for ${playerName} (ID: ${steamIdStr}).`);
            } catch (firebaseError) {
                console.error("Failed to update Firebase emoji status:", firebaseError);
                showMessage(`Error updating emoji for ${playerName}.`, "error");
            }
        } else {
            console.warn('Firebase database not available. Skipping Firebase sync for emoji update.');
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

        // --- Find player ONCE at the beginning ---
        const player = players.find(p => p.name === playerName);
        if (!player || !player.steamId) {
            showMessage(`Error: Could not find player data or SteamID for ${playerName}. Update aborted.`, "error");
            console.error(`Could not find player data or SteamID for ${playerName}. Update aborted.`);
            return; // Stop if player/steamId isn't found
        }
        const steamIdStr = String(player.steamId); // Ensure string key

        // --- Update Firebase using steamId ---
        if (typeof database !== 'undefined' && database !== null && this.ATTENDANCE_DB_PATH) {
            try {
                // Use steamIdStr directly
                const playerStatusRef = database.ref(`${this.ATTENDANCE_DB_PATH}/${steamIdStr}/status`);
                await playerStatusRef.set(newAttendance);
                console.log(`Firebase attendance status updated for ${playerName} (ID: ${steamIdStr}).`);
            } catch (firebaseError) {
                console.error("Failed to update Firebase attendance status:", firebaseError);
                showMessage(`Error syncing status for ${playerName} to database.`, "error");
                // Decide if we should stop here or still try the sheet
                // return; // Uncomment to stop if Firebase fails
            }
        } else {
            console.warn('Firebase database not available. Skipping Firebase sync for attendance update.');
        }
        // --- End Firebase Update ---

        // --- Update Google Sheet (existing logic) ---
        try {
            // Send the update request - no need to wait for or check response
            fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    steamId: steamIdStr,
                    attendance: newAttendance
                }),
                // This will prevent fetch from throwing on redirects
                redirect: 'follow'
            });
            
            // Just assume it worked (which it apparently does)
            console.log(`Sent sheet update for ${playerName}`);
            
        } catch (err) {
            // Minimal error logging - no user-facing message
            console.error("Error sending sheet update:", err);
        }
        // --- End Sheet Update ---
    },

    /**
     * Handles clicks within the player list table for attendance changes.
     * Uses global `players` array and module methods/constants.
     * @param {Event} event - The click event object.
     */
    handlePlayerListClick: async function(event) {
        console.log("Player list click detected", event.target);
        
        // Handle attendance arrows/labels
        const targetAttendanceArrow = event.target.closest('.attendance-arrow');
        const targetAttendanceLabel = event.target.closest('.attendance-label');
        
        if (targetAttendanceArrow || targetAttendanceLabel) {
            console.log("Attendance control clicked");
            let clickedElement = targetAttendanceArrow || targetAttendanceLabel;
            
            const playerName = clickedElement.getAttribute('data-player');
            if (!playerName) return;

            const controlContainer = clickedElement.closest('.attendance-control-container');
            if (!controlContainer) return;

            const labelSpan = controlContainer.querySelector('.attendance-label');
            if (!labelSpan) return;

            // Get current state FROM THE UI
            const currentState = labelSpan.getAttribute('data-state') || 'no_response';
            
            let direction = null; 
            if (targetAttendanceArrow) {
                direction = targetAttendanceArrow.getAttribute('data-direction');
            } else if (targetAttendanceLabel) {
                const rect = targetAttendanceLabel.getBoundingClientRect();
                const clickX = event.clientX - rect.left;
                direction = (clickX < rect.width / 2) ? 'left' : 'right'; 
            }

            if (direction) {
                let currentIndex = this.ATTENDANCE_STATES.indexOf(currentState); 

                if (direction === 'left') {
                    currentIndex = (currentIndex - 1 + this.ATTENDANCE_STATES.length) % this.ATTENDANCE_STATES.length;
                } else {
                    currentIndex = (currentIndex + 1) % this.ATTENDANCE_STATES.length;
                }
                const newState = this.ATTENDANCE_STATES[currentIndex];

                this.syncAttendanceUpdate(playerName, newState);
            }
            return;
        }

        // Handle emoji arrows/labels
        const targetEmojiArrow = event.target.closest('.emoji-arrow');
        const targetEmojiLabel = event.target.closest('.emoji-label');
        
        if (targetEmojiArrow || targetEmojiLabel) {
            console.log("Emoji control clicked", targetEmojiArrow || targetEmojiLabel);
            let clickedElement = targetEmojiArrow || targetEmojiLabel;
            
            const playerName = clickedElement.getAttribute('data-player');
            if (!playerName) {
                console.warn("Missing data-player attribute on emoji control");
                return;
            }

            const controlContainer = clickedElement.closest('.emoji-control-container');
            if (!controlContainer) {
                console.warn("Cannot find parent emoji-control-container");
                return;
            }

            const labelSpan = controlContainer.querySelector('.emoji-label');
            if (!labelSpan) {
                console.warn("Cannot find emoji-label within container");
                return;
            }

            // Get current emoji state FROM THE UI
            const currentState = labelSpan.getAttribute('data-state') || 'normal';
            console.log(`Current emoji state for ${playerName}: ${currentState}`);
            
            let direction = null; 
            if (targetEmojiArrow) {
                direction = targetEmojiArrow.getAttribute('data-direction');
            } else if (targetEmojiLabel) {
                const rect = targetEmojiLabel.getBoundingClientRect();
                const clickX = event.clientX - rect.left;
                direction = (clickX < rect.width / 2) ? 'left' : 'right'; 
            }
            console.log(`Direction: ${direction}`);

            if (direction) {
                let currentIndex = this.EMOJI_STATES.indexOf(currentState); 
                console.log(`Current index: ${currentIndex}`);

                if (direction === 'left') {
                    currentIndex = (currentIndex - 1 + this.EMOJI_STATES.length) % this.EMOJI_STATES.length;
                } else {
                    currentIndex = (currentIndex + 1) % this.EMOJI_STATES.length;
                }
                const newState = this.EMOJI_STATES[currentIndex];
                console.log(`New emoji state: ${newState}`);

                this.syncEmojiUpdate(playerName, newState);
            }
        }
    },

    /**
     * NEW: Clears attendance and emoji states to defaults.
     * Syncs changes to Firebase and Google Sheets.
     */
    clearAttendanceAndEmojis: async function() {
        const clearButton = document.getElementById('clear-attendance-button');
        const clearSpinner = document.getElementById('clear-spinner');

        if (!clearButton || !clearSpinner) {
            console.error("Clear button or spinner element not found.");
            return;
        }

        if (typeof database === 'undefined' || database === null) {
            showMessage("Database connection not available.", "error");
            return;
        }

        clearButton.disabled = true;
        clearSpinner.classList.remove('hidden');
        showMessage("Clearing attendance...", "info");

        try {
            // 1. Get current state from Firebase
            const attendanceSnapshot = await database.ref(this.ATTENDANCE_DB_PATH).once('value');
            const currentAttendanceData = attendanceSnapshot.val() || {};
            const emojiSnapshot = await database.ref(this.EMOJI_DB_PATH).once('value');
            const currentEmojiData = emojiSnapshot.val() || {};

            const firebaseUpdates = {};
            const sheetUpdates = []; // Array to store { steamId, attendance } for POST

            // 2. Iterate through global players list (contains sheet status)
            for (const player of players) {
                if (!player.steamId || !player.name) {
                    console.warn("Skipping player due to missing steamId or name:", player);
                    continue;
                }
                const steamIdStr = String(player.steamId);
                const currentAttendance = currentAttendanceData[steamIdStr]?.status || 'no_response';
                const currentEmoji = currentEmojiData[steamIdStr]?.status || 'normal';

                let targetAttendance = 'no_response';
                const targetEmoji = 'normal';

                // Log the status being checked from the global players array
                console.log(`Checking player: ${player.name}, Sheet Status: '${player.status}'`);

                // Determine target attendance based on sheet status ('adam evde yok')
                const sheetStatus = (player.status || '').trim().toLowerCase();
                if (sheetStatus === 'adam evde yok') {
                    // Always set 'adam evde yok' players to 'not_coming' on clear
                    targetAttendance = 'not_coming';
                } else {
                    // Set all other players to 'no_response'
                    targetAttendance = 'no_response';
                }

                // Prepare Firebase updates if changes are needed
                if (targetAttendance !== currentAttendance) {
                    firebaseUpdates[`${this.ATTENDANCE_DB_PATH}/${steamIdStr}/status`] = targetAttendance;
                    // Mark for sheet update
                    sheetUpdates.push({ steamId: steamIdStr, attendance: targetAttendance });
                }
                // Always ensure name is present in attendance data
                if (!currentAttendanceData[steamIdStr]?.name) {
                     firebaseUpdates[`${this.ATTENDANCE_DB_PATH}/${steamIdStr}/name`] = player.name;
                }

                if (targetEmoji !== currentEmoji) {
                    firebaseUpdates[`${this.EMOJI_DB_PATH}/${steamIdStr}/status`] = targetEmoji;
                }
                // Always ensure name is present in emoji data
                 if (!currentEmojiData[steamIdStr]?.name) {
                     firebaseUpdates[`${this.EMOJI_DB_PATH}/${steamIdStr}/name`] = player.name;
                }
            }

            // 3. Perform Firebase update
            if (Object.keys(firebaseUpdates).length > 0) {
                console.log("Applying Firebase updates:", firebaseUpdates);
                await database.ref().update(firebaseUpdates);
                console.log("Firebase updated successfully.");
            } else {
                console.log("No Firebase updates needed.");
            }

            // 4. Perform Google Sheet updates (POST requests)
            if (sheetUpdates.length > 0) {
                console.log("Sending updates to Google Sheet:", sheetUpdates);
                // Send updates concurrently
                const sheetPromises = sheetUpdates.map(update =>
                    fetch(APPS_SCRIPT_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(update),
                        redirect: 'follow'
                    }).catch(err => {
                         // Log sheet errors but don't block completion
                         console.error(`Error sending sheet update for ${update.steamId}:`, err);
                     })
                );
                await Promise.all(sheetPromises);
                console.log("Sheet updates sent.");
            }

            showMessage('Attendance cleared successfully!', 'success');

        } catch (error) {
            console.error('Error clearing attendance:', error);
            showMessage(`Error clearing attendance: ${error.message}`, 'error');
        } finally {
            clearButton.disabled = false;
            clearSpinner.classList.add('hidden');
        }
    }
}; // End of Attendance object

// --- Event Listener Setup --- 
document.addEventListener('DOMContentLoaded', () => {
    // Ensure Attendance.init is called only after Firebase is likely initialized
    // We rely on MainScript.js handling the initial Firebase setup.
    // Delaying slightly or using a custom event might be more robust if needed.
    // setTimeout(Attendance.init, 500); // Example delay, adjust if necessary

    // --- Add Listener for Clear Button --- 
    const clearButton = document.getElementById('clear-attendance-button');
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            // Prompt for password
            const password = prompt("Please enter the password to clear attendance:");
            // Hardcoded password for now
            const correctPassword = "osirikler"; 
            //const correctPassword = window.CLEAR_ATTENDANCE_PASSWORD || "INJECTED_PASSWORD_PLACEHOLDER"; 

            if (password === correctPassword) {
                // Show confirmation dialog in Turkish
                if (confirm('Emin misiniz? Bu işlem tüm katılım durumlarını sıfırlayacak.')) {
                    Attendance.clearAttendanceAndEmojis();
                }
            } else if (password !== null) { // Don't alert if the user pressed Cancel
                alert("Incorrect password. Action cancelled.");
            }
        });
    }

    // --- Add Listener for Player List Clicks --- 
    const playerList = document.getElementById('player-list');
    if (playerList) {
        playerList.addEventListener('click', (event) => Attendance.handlePlayerListClick(event));
    }
});
