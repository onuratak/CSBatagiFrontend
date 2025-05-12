document.addEventListener('DOMContentLoaded', () => {
    // Ensure Firebase is initialized (usually in MainScript.js or similar)
    if (typeof firebase === 'undefined') {
        console.error('Firebase is not initialized. Make sure firebase-app-compat.js is loaded and firebase.initializeApp() is called.');
        // Optionally display an error message to the user
        // showMessage('Authentication cannot be initialized.', 'error'); 
        return;
    }

    const auth = firebase.auth();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // UI Elements
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const signOutBtn = document.getElementById('signout-btn');
    const userInfoDiv = document.getElementById('user-info');
    const userNameSpan = document.getElementById('user-name');
    // const userPic = document.getElementById('user-pic'); // Optional: If using profile picture

    // --- Event Listeners --- 

    // Google Sign-In
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', () => {
            auth.signInWithPopup(googleProvider)
                .then((result) => {
                    // This gives you a Google Access Token. You can use it to access the Google API.
                    const credential = result.credential;
                    const token = credential.accessToken;
                    // The signed-in user info.
                    const user = result.user;
                    console.log("Signed in user:", user.displayName);
                    // UI update is handled by onAuthStateChanged
                }).catch((error) => {
                    // Handle Errors here.
                    const errorCode = error.code;
                    const errorMessage = error.message;
                    // The email of the user's account used.
                    const email = error.email;
                    // The firebase.auth.AuthCredential type that was used.
                    const credential = error.credential;
                    console.error("Google Sign-In Error:", errorCode, errorMessage);
                    // Optionally show an error message to the user
                    // showMessage(`Sign-in failed: ${errorMessage}`, 'error'); 
                });
        });
    }

    // Sign-Out
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                console.log("User signed out.");
                // UI update is handled by onAuthStateChanged
            }).catch((error) => {
                console.error("Sign Out Error:", error);
                // Optionally show an error message to the user
                // showMessage(`Sign-out failed: ${error.message}`, 'error');
            });
        });
    }

    // --- Auth State Observer --- 

    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in.
            console.log("Auth state changed: User is signed in", user.displayName);
            if (userInfoDiv) userInfoDiv.classList.remove('hidden');
            if (userNameSpan) userNameSpan.textContent = user.displayName || 'User'; // Use display name
            // if (userPic) userPic.src = user.photoURL; // Optional: Set profile picture
            if (googleSignInBtn) googleSignInBtn.classList.add('hidden');
        } else {
            // User is signed out.
            console.log("Auth state changed: User is signed out");
            if (userInfoDiv) userInfoDiv.classList.add('hidden');
            if (userNameSpan) userNameSpan.textContent = '';
            // if (userPic) userPic.src = ''; // Optional: Clear profile picture
            if (googleSignInBtn) googleSignInBtn.classList.remove('hidden');
        }
        
        // --- IMPORTANT --- 
        // Future Step: Trigger data reloads or UI updates in other modules 
        // (like attendance.js) based on auth state if needed.
        // For example: 
        // if (typeof Attendance !== 'undefined' && Attendance.handleAuthStateChange) {
        //     Attendance.handleAuthStateChange(user);
        // }
    });

}); 