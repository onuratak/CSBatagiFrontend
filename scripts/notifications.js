const Notifications = {
    /**
     * Initializes the notifications module
     */
    init: function() {
        this.setupNotificationPreferences();
    },

    /**
     * Sets up the notification preferences UI and handlers
     */
    setupNotificationPreferences: function() {
        // Remove listener for the old button if it existed
        // const oldNotificationSettingsBtn = document.getElementById('notification-settings-btn');
        // if (oldNotificationSettingsBtn) { 
        //    oldNotificationSettingsBtn.removeEventListener('click', this.showNotificationPreferences.bind(this));
        // }

        // Add listener for the new menu item within the dropdown
        // We need to wait for the button to be potentially created by the index.html script,
        // so we use a more robust way to attach the listener, or ensure this runs after DOMContentLoaded.
        // Since index.html script also runs on DOMContentLoaded, we might need a small delay or a different approach
        // if the button isn't found immediately. For now, let's assume it's available.

        // A more robust way is to attach to a parent that exists and delegate, or ensure this script runs last.
        // However, for simplicity with current structure, we'll try direct attachment.
        // The button itself is created dynamically, so direct getElementById might be tricky if this runs too early.
        // Let's rely on the DOMContentLoaded in index.html having created it.

        // The button 'open-notification-settings' is inside the dropdown created in index.html
        // We need to ensure this event listener is added *after* that button is created.
        // A common pattern is to attach the listener when the settings menu itself is interacted with or becomes visible,
        // or ensure this script runs after the one in index.html.

        // Assuming the button exists in the DOM when this function is called (e.g., called after DOMContentLoaded)
        const openNotificationSettingsBtn = document.getElementById('open-notification-settings');
        if (openNotificationSettingsBtn) {
            openNotificationSettingsBtn.addEventListener('click', () => {
                this.showNotificationPreferences();
                // Optionally close the settings dropdown after clicking
                const settingsDropdownMenu = document.getElementById('settings-dropdown-menu');
                if(settingsDropdownMenu) settingsDropdownMenu.classList.add('hidden');
            });
        } else {
            // If the button isn't found, this might indicate a timing issue
            // or that the settings menu structure hasn't been added to the DOM yet.
            // Consider deferring this or using a mutation observer if issues persist.
            console.warn('Could not find #open-notification-settings button to attach listener.');
        }
    },

    /**
     * Shows the notification preferences modal
     */
    showNotificationPreferences: async function() {
        const user = firebase.auth().currentUser;
        if (!user) {
            showMessage("You must be logged in to change notification settings.", "error");
            return;
        }

        const messaging = firebase.messaging();
        const currentToken = await messaging.getToken();
        if (!currentToken) {
            showMessage("Please enable notifications first.", "error");
            return;
        }

        // Get current preferences from user's data
        const preferencesSnapshot = await database.ref(`users/${user.uid}/fcmTokens/${currentToken}/preferences`).once('value');
        const preferences = preferencesSnapshot.val() || {
            statusChanges: true,
            tekerDondu: true
        };

        // Create modal content
        const modalContent = `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" id="notification-modal">
                <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div class="mt-3 text-center">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">Notification Settings</h3>
                        <div class="mt-4 px-7 py-3">
                            <div class="flex items-center justify-between mb-4">
                                <label class="text-gray-700">Player Status Changes</label>
                                <input type="checkbox" id="status-changes-toggle" 
                                    class="form-checkbox h-5 w-5 text-blue-600" 
                                    ${preferences.statusChanges ? 'checked' : ''}>
                            </div>
                            <div class="flex items-center justify-between">
                                <label class="text-gray-700">Teker Dondu (10 Players)</label>
                                <input type="checkbox" id="teker-dondu-toggle" 
                                    class="form-checkbox h-5 w-5 text-blue-600" 
                                    ${preferences.tekerDondu ? 'checked' : ''}>
                            </div>
                        </div>
                        <div class="items-center px-4 py-3">
                            <button id="save-notification-settings" 
                                class="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300">
                                Save Settings
                            </button>
                            <button id="close-notification-modal" 
                                class="ml-3 px-4 py-2 bg-gray-100 text-gray-700 text-base font-medium rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to document
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalContent;
        document.body.appendChild(modalContainer);

        // Add event listeners
        const modal = document.getElementById('notification-modal');
        const saveButton = document.getElementById('save-notification-settings');
        const closeButton = document.getElementById('close-notification-modal');
        const statusToggle = document.getElementById('status-changes-toggle');
        const tekerDonduToggle = document.getElementById('teker-dondu-toggle');

        saveButton.addEventListener('click', async () => {
            const newPreferences = {
                statusChanges: statusToggle.checked,
                tekerDondu: tekerDonduToggle.checked
            };

            try {
                await database.ref(`users/${user.uid}/fcmTokens/${currentToken}`).update({
                    enabled: true,
                    preferences: newPreferences,
                    lastUpdated: firebase.database.ServerValue.TIMESTAMP
                });
                showMessage("Notification settings saved successfully!", "success");
                modal.remove();
            } catch (error) {
                console.error("Error saving notification preferences:", error);
                showMessage("Error saving notification settings.", "error");
            }
        });

        closeButton.addEventListener('click', () => {
            modal.remove();
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },

    /**
     * Sends a notification to users based on their preferences
     * @param {string} type - The type of notification ('status_change' or 'teker_dondu')
     * @param {object} data - The notification data
     */
    sendNotification: async function(type, data) {
        if (typeof database === 'undefined' || database === null) {
            console.error('Firebase database not available for sending notification.');
            return;
        }

        try {
            // Get all users' FCM tokens with their preferences
            const usersSnapshot = await database.ref('users').once('value');
            const usersData = usersSnapshot.val() || {};
            
            // Collect valid tokens from all users
            const validTokens = [];
            for (const [uid, userData] of Object.entries(usersData)) {
                if (!userData.fcmTokens) continue;
                
                for (const [token, tokenData] of Object.entries(userData.fcmTokens)) {
                    if (!tokenData.enabled) continue;
                    if (type === 'status_change' && !tokenData.preferences?.statusChanges) continue;
                    if (type === 'teker_dondu' && !tokenData.preferences?.tekerDondu) continue;
                    validTokens.push(token);
                }
            }

            if (validTokens.length === 0) {
                console.log('No valid FCM tokens found for this notification type.');
                return;
            }

            // Create notification message
            const message = {
                notification: data.notification,
                data: {
                    type: type,
                    ...data.data
                },
                tokens: validTokens
            };

            // Send the notification using Firebase Cloud Functions
            const response = await fetch('https://us-central1-csbatagirealtimedb.cloudfunctions.net/sendNotification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('Notification sent successfully');
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }
};

// Initialize notifications when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    Notifications.init();
}); 