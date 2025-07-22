// Authentication Module
import { auth, db } from './firebase-config.js';
import { 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut as firebaseSignOut,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    doc, 
    setDoc, 
    getDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const provider = new GoogleAuthProvider();

// Configure Google Auth Provider
provider.addScope('email');
provider.addScope('profile');

// Sign in function
window.signIn = async function() {
    try {
        showNotification('Signing in...', 'info');
        
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Create or update user document in Firestore
        await createUserDocument(user);
        
        showNotification('Successfully signed in!', 'success');
        
        // Redirect to appropriate page if needed
        if (window.pickliSHApp.currentView === 'admin') {
            // Check if user has admin privileges
            const token = await user.getIdTokenResult();
            if (!token.claims.admin) {
                showHome();
                showNotification('Access denied. Admin privileges required.', 'error');
            }
        }
        
    } catch (error) {
        console.error('Sign in error:', error);
        
        let errorMessage = 'Sign in failed. Please try again.';
        
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                errorMessage = 'Sign in was cancelled.';
                break;
            case 'auth/popup-blocked':
                errorMessage = 'Popup was blocked. Please allow popups and try again.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your connection.';
                break;
        }
        
        showNotification(errorMessage, 'error');
    }
};

// Sign out function
window.signOut = async function() {
    try {
        await firebaseSignOut(auth);
        
        // Clear app state
        window.pickliSHApp.user = null;
        window.pickliSHApp.loyaltyPoints = 0;
        
        // Redirect to home if on protected pages
        if (['admin', 'profile', 'loyalty'].includes(window.pickliSHApp.currentView)) {
            showHome();
        }
        
        showNotification('Successfully signed out!', 'success');
        
    } catch (error) {
        console.error('Sign out error:', error);
        showNotification('Error signing out. Please try again.', 'error');
    }
};

// Create or update user document in Firestore
async function createUserDocument(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        const userData = {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        if (!userSnap.exists()) {
            // New user - set default values
            userData.createdAt = serverTimestamp();
            userData.loyaltyPoints = 0;
            userData.totalSpent = 0;
            userData.orderCount = 0;
            userData.isActive = true;
            userData.role = 'customer'; // Default role
            
            showNotification('Welcome to Picklish Foods!', 'success');
        }
        
        await setDoc(userRef, userData, { merge: true });
        
        // Load user data into app state
        if (userSnap.exists()) {
            const existingData = userSnap.data();
            window.pickliSHApp.loyaltyPoints = existingData.loyaltyPoints || 0;
        }
        
    } catch (error) {
        console.error('Error creating/updating user document:', error);
    }
}

// Check if user is admin
export async function checkAdminRole(user) {
    try {
        const token = await user.getIdTokenResult();
        return token.claims.admin === true;
    } catch (error) {
        console.error('Error checking admin role:', error);
        return false;
    }
}

// Require authentication for protected functions
export function requireAuth(callback) {
    return function(...args) {
        if (!window.pickliSHApp.user) {
            showNotification('Please sign in to continue', 'error');
            return;
        }
        return callback.apply(this, args);
    };
}

// Require admin role for admin functions
export function requireAdmin(callback) {
    return async function(...args) {
        const user = window.pickliSHApp.user;
        
        if (!user) {
            showNotification('Please sign in to continue', 'error');
            return;
        }
        
        const isAdmin = await checkAdminRole(user);
        if (!isAdmin) {
            showNotification('Admin privileges required', 'error');
            return;
        }
        
        return callback.apply(this, args);
    };
}

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        console.log('User signed in:', user.email);
        
        // Update UI elements
        updateAuthUI(user);
        
        // Load user-specific data
        await loadUserData(user);
        
    } else {
        // User is signed out
        console.log('User signed out');
        updateAuthUI(null);
        
        // Clear user-specific data
        clearUserData();
    }
});

// Update authentication UI
function updateAuthUI(user) {
    const userMenu = document.getElementById('userMenu');
    const loginButton = document.getElementById('loginButton');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const adminNavItem = document.getElementById('adminNavItem');
    
    if (user) {
        // Show user menu, hide login button
        if (userMenu) userMenu.style.display = 'block';
        if (loginButton) loginButton.style.display = 'none';
        
        // Update user info
        if (userName) userName.textContent = user.displayName || user.email;
        if (userAvatar) {
            userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=e67e22&color=fff`;
            userAvatar.alt = user.displayName || user.email;
        }
        
        // Check admin status
        checkAndUpdateAdminUI(user);
        
    } else {
        // Hide user menu, show login button
        if (userMenu) userMenu.style.display = 'none';
        if (loginButton) loginButton.style.display = 'block';
        if (adminNavItem) adminNavItem.style.display = 'none';
    }
}

// Check and update admin UI
async function checkAndUpdateAdminUI(user) {
    try {
        const isAdmin = await checkAdminRole(user);
        const adminNavItem = document.getElementById('adminNavItem');
        
        if (adminNavItem) {
            adminNavItem.style.display = isAdmin ? 'block' : 'none';
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
}

// Load user-specific data
async function loadUserData(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // Update app state
            window.pickliSHApp.loyaltyPoints = userData.loyaltyPoints || 0;
            
            // Update UI elements
            const loyaltyPointsElement = document.getElementById('loyaltyPoints');
            if (loyaltyPointsElement) {
                loyaltyPointsElement.textContent = window.pickliSHApp.loyaltyPoints;
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Clear user-specific data
function clearUserData() {
    window.pickliSHApp.loyaltyPoints = 0;
    
    // Update UI elements
    const loyaltyPointsElement = document.getElementById('loyaltyPoints');
    if (loyaltyPointsElement) {
        loyaltyPointsElement.textContent = '0';
    }
}

// Handle authentication errors
function handleAuthError(error) {
    console.error('Authentication error:', error);
    
    let message = 'Authentication failed. Please try again.';
    
    switch (error.code) {
        case 'auth/user-disabled':
            message = 'Your account has been disabled. Please contact support.';
            break;
        case 'auth/user-not-found':
            message = 'Account not found. Please check your credentials.';
            break;
        case 'auth/network-request-failed':
            message = 'Network error. Please check your internet connection.';
            break;
        case 'auth/too-many-requests':
            message = 'Too many failed attempts. Please wait before trying again.';
            break;
    }
    
    showNotification(message, 'error');
}

// Export functions for use in other modules
window.checkAdminRole = checkAdminRole;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;
