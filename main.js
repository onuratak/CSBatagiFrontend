function updateAttendanceInSheet(playerName, newStatus) {
    // --- Constants ---
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbysTTfbVYfXNO8JmrHUQHLOTnGjrOMS5ApRJ6fhbsB3qvdA7jYQGvf4t0Qf1t5xuyTF/exec';

    // --- Player Data ---
    let players = [
        { name: "bobna", status: "Active Player", attendance: "no_response" },
        { name: "Cago", status: "Active Player", attendance: "no_response" },
        { name: "cat", status: "Active Player", attendance: "no_response" },
        { name: "darbe", status: "Active Player", attendance: "no_response" },
        { name: "HILLDIR", status: "Active Player", attendance: "no_response" },
        { name: "Malewhor", status: "Active Player", attendance: "no_response" },
        { name: "Mustasem", status: "Active Player", attendance: "no_response" },
        { name: "Neruit", status: "Active Player", attendance: "no_response" },
        { name: "sedo", status: "Active Player", attendance: "no_response" },
        { name: "Uncle ton", status: "Active Player", attendance: "coming" },
        { name: "womk", status: "Active Player", attendance: "not_coming" },
        { name: "candena", status: "Inactive Player", attendance: "no_response" },
        { name: "foz", status: "Inactive Player", attendance: "no_response" },
        { name: "mrbutters", status: "Inactive Player", attendance: "no_response" },
        { name: "repamar", status: "Inactive Player", attendance: "no_response" },
    ];

    // --- DOM Elements ---
    const playerListBody = document.getElementById('player-list');
    const pageContentArea = document.getElementById('page-content-area');
    const updateButton = document.getElementById('update-stats-button');
    const messageArea = document.getElementById('message-area');
    const spinner = document.getElementById('spinner');
    // Nav elements
    const menuButton = document.getElementById('menu-button');
    const navLinksContainer = document.getElementById('main-nav-links');
    const navLinks = navLinksContainer.querySelectorAll('.tab-nav-item');
    const iconHamburger = document.getElementById('icon-hamburger');
    const iconClose = document.getElementById('icon-close');

    // --- Functions ---

    // Function to display messages
    function showMessage(text, type = 'error') {
        messageArea.textContent = text;
        messageArea.className = '';
        messageArea.classList.add('text-center', 'mt-4', 'p-3', 'rounded-md', 'border', 'font-medium', 'max-w-md', 'mx-auto');

        if (type === 'success') {
            messageArea.classList.add('bg-green-100', 'text-green-800', 'border-green-300');
        } else {
            messageArea.classList.add('bg-red-100', 'text-red-800', 'border-red-300');
        }
        messageArea.classList.remove('hidden');

        setTimeout(() => {
            messageArea.classList.add('hidden');
        }, 5000);
    }

    // Function to set slider state visually
    function setSliderState(sliderElement, state) {
        sliderElement.classList.remove('state-no_response', 'state-coming', 'state-not_coming');
        sliderElement.classList.add(`state-${state}`);
        sliderElement.setAttribute('data-current-status', state);
    }

    // Function to render player rows
    function renderPlayers() {
        if (!playerListBody) return;
        playerListBody.innerHTML = '';

        players.forEach((player, index) => {
            const row = document.createElement('tr');
            row.setAttribute('data-player-name', player.name);

            const nameCell = document.createElement('td');
            nameCell.className = 'font-medium text-gray-900';
            nameCell.textContent = player.name;
            row.appendChild(nameCell);

            // Player Status Cell
            const statusCell = document.createElement('td');
            const statusBadge = document.createElement('span');
            statusBadge.className = 'px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap';
            statusBadge.textContent = player.status;
            statusBadge.classList.add(
                player.status === 'Active Player' ? 'bg-green-100' : 'bg-red-100',
                player.status === 'Active Player' ? 'text-green-800' : 'text-red-800'
            );
            statusCell.appendChild(statusBadge);
            row.appendChild(statusCell);

            // Attendance Slider Cell
            const attendanceCell = document.createElement('td');
            // Apply flex centering to the TD
            attendanceCell.className = 'flex justify-center items-center';

            const sliderId = `slider-${index}`;
            const initialState = player.attendance;
            const sliderContainer = document.createElement('div');
            sliderContainer.id = sliderId;
            sliderContainer.className = `attendance-slider state-${initialState}`;
            sliderContainer.setAttribute('data-player', player.name);
            sliderContainer.setAttribute('data-current-status', initialState);
            const dot = document.createElement('div');
            dot.className = 'dot';
            sliderContainer.appendChild(dot);
            attendanceCell.appendChild(sliderContainer);
            row.appendChild(attendanceCell);
            playerListBody.appendChild(row);
        });
    }

    // Fetch attendance data from Google Sheets
    async function fetchStatsFromSheet() {
        try {
            spinner.classList.remove('hidden');
            const response = await fetch(APPS_SCRIPT_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            // data format: [{ name: 'bobna', status: 'Active Player', attendance: 'coming'|'not_coming'|'no_response' }, ...]
            players = data;
            renderPlayers();
            showMessage('Data loaded successfully', 'success');
        } catch (err) {
            console.error(err);
            showMessage('Failed to fetch data');
        } finally {
            spinner.classList.add('hidden');
        }
    }


    // --- Event Listener for Attendance Sliders ---
    // console.log("playerListBody",playerListBody) //Check for this line
    playerListBody.addEventListener('click', async (event) => {
        // console.log("Event happened") //Check for this line
        const clickedSlider = event.target.closest('.attendance-slider');
        if (clickedSlider) {
            // console.log("clicked slider!") //Check for this line
            const playerName = clickedSlider.getAttribute('data-player');
            const currentStatus = clickedSlider.getAttribute('data-current-status');
            const playerIndex = players.findIndex(p => p.name === playerName);
            if (playerIndex > -1) {
                let newStatus;
                const clickX = event.offsetX;
                const sliderWidth = clickedSlider.offsetWidth;
                if (currentStatus === 'no_response') {
                    newStatus = (clickX < sliderWidth / 2) ? 'coming' : 'not_coming';
                } else if (currentStatus === 'coming') {
                    newStatus = (clickX > sliderWidth / 2) ? 'not_coming' : 'no_response';
                } else {
                    // currentStatus === 'not_coming'
                    newStatus = (clickX < sliderWidth / 2) ? 'coming' : 'no_response';
                }
                players[playerIndex].attendance = newStatus;
                setSliderState(clickedSlider, newStatus);
                // Sync with Google Sheets
                await updateAttendanceInSheet(playerName, newStatus);
                // Log the payload being sent
                console.log("Attendance update payload:", JSON.stringify({ name: playerName, attendance: newStatus }));
            }
        }
    });

    // --- Navigation Logic ---

    // Function to switch tabs/pages
    function showPage(pageId) {
        const allPages = pageContentArea.querySelectorAll('.page-content');
        allPages.forEach(page => {
            page.classList.add('hidden');
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
            // Special handling for mobile active state styling
            link.classList.remove('bg-blue-50', 'border-blue-500');
        });

        const targetPage = document.getElementById(`page-${pageId}`);
        const targetLink = navLinksContainer.querySelector(`.tab-nav-item[data-page="${pageId}"]`);

        if (targetPage) {
            targetPage.classList.remove('hidden');
        } else {
            console.error(`Page content with ID 'page-${pageId}' not found.`);
        }
        if (targetLink) {
            targetLink.classList.add('active');
            // Special handling for mobile active state styling
            if (navLinksContainer.classList.contains('mobile-menu-active')) {
                targetLink.classList.add('bg-blue-50', 'border-blue-500');
            }
        } else {
            console.error(`Nav link with data-page="${pageId}" not found.`);
        }

        if (pageId === 'attendance') {
            renderPlayers(); // Re-render players when switching to attendance tab
        }
    }

    // Toggle Mobile Menu
    menuButton.addEventListener('click', () => {
        const isExpanded = menuButton.getAttribute('aria-expanded') === 'true';
        menuButton.setAttribute('aria-expanded', !isExpanded);
        navLinksContainer.classList.toggle('hidden');
        navLinksContainer.classList.toggle('flex');
        navLinksContainer.classList.toggle('flex-col');
        navLinksContainer.classList.toggle('mobile-menu-active');

        // Toggle icons
        iconHamburger.classList.toggle('hidden');
        iconClose.classList.toggle('hidden');

        // Re-apply active styles if menu is opened
        if (!isExpanded) {
            const activeLink = navLinksContainer.querySelector('.tab-nav-item.active');
            if (activeLink) {
                activeLink.classList.add('bg-blue-50', 'border-blue-500');
            }
        }
    });

    // Add click listener to nav links container (event delegation) for page switching
    navLinksContainer.addEventListener('click', (event) => {
        const link = event.target.closest('.tab-nav-item');
        if (link) {
            event.preventDefault();
            const pageIdToShow = link.getAttribute('data-page');
            if (pageIdToShow) {
                showPage(pageIdToShow);

                // Close mobile menu if it's open
                const isMobileMenuOpen = menuButton.offsetParent !== null && !navLinksContainer.classList.contains('hidden');
                if (isMobileMenuOpen) {
                    menuButton.click();
                }
            }
        }
    });

    // Stub functions for other tabs
    function populateSonmac(data) {
        // ...
    }
    function populateLast10(data) {
        // ...
    }

    // --- Other Event Listeners ---
    updateButton.addEventListener('click', fetchStatsFromSheet);

    function testConnection() {
        fetch(APPS_SCRIPT_URL)
            .then(response => response.text())
            .then(data => console.log('Test connection successful:', data))
            .catch(error => console.error('Test connection failed:', error));
    }

    function updateAttendanceInSheet(playerName, newStatus) {
        console.log("APPS_SCRIPT_URL:", APPS_SCRIPT_URL);
        fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: playerName, attendance: newStatus }),
        })
            .then((response) => {
                if (!response.ok) {
                    return response.text().then((errorText) => {
                        console.error("Server error response:", errorText);
                        throw new Error("Network response was not ok: " + response.status);
                    });
                }
                return response.text();
            })
            .then((data) => {
                console.log("Success:", data);
            })
            .catch((error) => {
                console.error("Fetch error:", error);
            });
    }

    // --- Initial Setup ---
    // showPage('attendance'); // Show attendance page first - moved to DOMContentLoaded

    // Automatically fetch player data on page load
    // fetchStatsFromSheet(); - moved to DOMContentLoaded

    document.addEventListener('DOMContentLoaded', () => {
        showPage('attendance');
        fetchStatsFromSheet();
    });

    /*
      ASKING THE USER:
      - What is the expected behavior if updating attendance fails?
        Should the slider revert automatically, or remain in the new state?
      - Are there any additional states needed (e.g., 'maybe')?

      TEST CASES:
      1) Clicking "Update Stats from Sheet" should fetch data from the Google Apps Script.
         - Expect to see console logs if fetch fails.
         - Expect to see updated players if fetch succeeds.
      2) Toggling the slider for a known player (e.g., bobna) from 'no_response' to 'coming'.
         - Expect a console log: "Attendance updated..." if the network call is successful.
      4) Simulate a server error (e.g., invalid URL) to ensure "Failed to update attendance" message appears.
    */
}