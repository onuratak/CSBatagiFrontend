document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Function to apply the theme
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            body.classList.add('dark-theme');
            if (themeToggle) themeToggle.checked = true;
            localStorage.setItem('theme', 'dark');
        } else {
            body.classList.remove('dark-theme');
            if (themeToggle) themeToggle.checked = false;
            localStorage.setItem('theme', 'light');
        }
    };

    // Apply the saved theme or default to light (or system preference if desired)
    const savedTheme = localStorage.getItem('theme') || 'light'; // Default to light
    applyTheme(savedTheme);

    // Add event listener for the toggle switch
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            if (themeToggle.checked) {
                applyTheme('dark');
            } else {
                applyTheme('light');
            }
        });
    } else {
        console.error("Theme toggle element not found.");
    }
}); 