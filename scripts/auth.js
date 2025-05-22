document.addEventListener('DOMContentLoaded', () => {
    // Ensure Firebase is initialized (usually in MainScript.js or similar)
    if (typeof firebase === 'undefined') {
        console.error('Firebase is not initialized. Make sure firebase-app-compat.js is loaded and firebase.initializeApp() is called.');
        return;
    }

    const auth = firebase.auth();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // Configure Google provider
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
    googleProvider.setCustomParameters({
        prompt: 'select_account'
    });

    // UI Elements
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const signOutBtn = document.getElementById('signout-btn');
    const userInfoDiv = document.getElementById('user-info');
    const userNameSpan = document.getElementById('user-name');

    // Handle redirect result (for fallback method)
    auth.getRedirectResult().then((result) => {
        if (result && result.user) {
            console.log("Redirect sign-in successful:", result.user.displayName);
            if (typeof showMessage !== 'undefined') {
                showMessage(`Welcome ${result.user.displayName || result.user.email}!`, 'success');
            }
        }
    }).catch((error) => {
        console.error("Redirect sign-in error:", error);
        if (typeof showMessage !== 'undefined') {
            showMessage(`Sign-in failed: ${error.message}`, 'error');
        }
    });

    // --- Event Listeners --- 

    // Google Sign-In
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
            try {
                console.log("Starting Google sign-in...");
                googleSignInBtn.disabled = true;
                googleSignInBtn.textContent = 'Signing in...';

                // Try popup first, with fallback to redirect for mobile/blocked popups
                let result;
                try {
                    result = await auth.signInWithPopup(googleProvider);
                } catch (popupError) {
                    console.log("Popup error:", popupError.code);
                    
                    if (popupError.code === 'auth/popup-blocked' || 
                        popupError.code === 'auth/popup-closed-by-user' ||
                        /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
                        console.log("Popup failed, trying redirect method...");
                        // Fallback to redirect for mobile or when popup is blocked
                        auth.signInWithRedirect(googleProvider);
                        return; // Exit here, redirect will handle the flow
                    }
                    throw popupError; // Re-throw if it's a different error
                }

                // This gives you a Google Access Token. You can use it to access the Google API.
                const credential = result.credential;
                const token = credential ? credential.accessToken : null;
                // The signed-in user info.
                const user = result.user;
                console.log("Signed in user:", user.displayName);

                if (typeof showMessage !== 'undefined') {
                    showMessage(`Welcome ${user.displayName || user.email}!`, 'success');
                }

                // UI update is handled by onAuthStateChanged
            } catch (error) {
                // Handle Errors here.
                const errorCode = error.code;
                const errorMessage = error.message;
                
                console.error("Google Sign-In Error:", {
                    code: errorCode,
                    message: errorMessage,
                    fullError: error
                });

                // Show user-friendly error messages
                let userMessage = 'Sign-in failed. ';
                switch (errorCode) {
                    case 'auth/popup-closed-by-user':
                        userMessage += 'The sign-in popup was closed. Please try again.';
                        break;
                    case 'auth/popup-blocked':
                        userMessage += 'Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.';
                        break;
                    case 'auth/cancelled-popup-request':
                        userMessage += 'Another sign-in attempt is in progress. Please wait.';
                        break;
                    case 'auth/network-request-failed':
                        userMessage += 'Network error. Please check your internet connection and try again.';
                        break;
                    case 'auth/too-many-requests':
                        userMessage += 'Too many failed attempts. Please try again later.';
                        break;
                    case 'auth/operation-not-allowed':
                        userMessage += 'Google sign-in is not enabled. Please contact support.';
                        break;
                    case 'auth/invalid-api-key':
                        userMessage += 'Configuration error. Please contact support.';
                        break;
                    default:
                        userMessage += errorMessage;
                }

                if (typeof showMessage !== 'undefined') {
                    showMessage(userMessage, 'error');
                } else {
                    alert(userMessage);
                }

            } finally {
                googleSignInBtn.disabled = false;
                googleSignInBtn.textContent = 'Sign in with Google';
            }
        });
    }

    // Sign-Out
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                console.log("User signed out.");
                if (typeof showMessage !== 'undefined') {
                    showMessage('Signed out successfully', 'success');
                }
            }).catch((error) => {
                console.error("Sign Out Error:", error);
                if (typeof showMessage !== 'undefined') {
                    showMessage(`Sign-out failed: ${error.message}`, 'error');
                }
            });
        });
    }

    // --- Auth State Observer --- 

    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in.
            console.log("Auth state changed: User is signed in", user.displayName);
            if (userInfoDiv) userInfoDiv.classList.remove('hidden');
            if (userNameSpan) userNameSpan.textContent = user.displayName || user.email || 'User';
            if (googleSignInBtn) googleSignInBtn.classList.add('hidden');
        } else {
            // User is signed out.
            console.log("Auth state changed: User is signed out");
            if (userInfoDiv) userInfoDiv.classList.add('hidden');
            if (userNameSpan) userNameSpan.textContent = '';
            if (googleSignInBtn) googleSignInBtn.classList.remove('hidden');
        }

        // Trigger data reloads in Attendance module based on auth state
        if (typeof Attendance !== 'undefined' && Attendance.handleAuthStateChange) {
            Attendance.handleAuthStateChange(user);
        }
    });

}); 