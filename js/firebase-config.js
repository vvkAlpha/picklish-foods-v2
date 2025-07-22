// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Firebase configuration - these should be set as environment variables
const firebaseConfig = {
    apiKey: window.location.hostname === 'localhost' ? 
        'demo-key-for-localhost' : 
        (window.FIREBASE_API_KEY || 'your-firebase-api-key'),
    authDomain: `${window.FIREBASE_PROJECT_ID || 'picklish-foods'}.firebaseapp.com`,
    projectId: window.FIREBASE_PROJECT_ID || 'picklish-foods',
    storageBucket: `${window.FIREBASE_PROJECT_ID || 'picklish-foods'}.firebasestorage.app`,
    messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID || '123456789',
    appId: window.FIREBASE_APP_ID || 'your-firebase-app-id'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Export the app instance
export default app;

// Global app state
window.pickliSHApp = {
    user: null,
    cart: JSON.parse(localStorage.getItem('picklish_cart') || '[]'),
    currentView: 'home',
    products: [],
    subscriptions: [],
    orders: [],
    loyaltyPoints: 0,
    vouchers: []
};

// Initialize auth state listener
auth.onAuthStateChanged((user) => {
    window.pickliSHApp.user = user;
    if (user) {
        // Load user-specific data
        loadUserData(user);
    }
    updateUIForUser(user);
});

// Load user-specific data
async function loadUserData(user) {
    try {
        // Load user profile, orders, subscriptions, etc.
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            window.pickliSHApp.loyaltyPoints = userData.loyaltyPoints || 0;
            // Update loyalty display if on loyalty page
            if (document.getElementById('loyaltyPoints')) {
                document.getElementById('loyaltyPoints').textContent = window.pickliSHApp.loyaltyPoints;
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Update UI based on authentication state
function updateUIForUser(user) {
    const userMenu = document.getElementById('userMenu');
    const loginButton = document.getElementById('loginButton');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const adminNavItem = document.getElementById('adminNavItem');
    
    if (user) {
        // User is signed in
        userMenu.style.display = 'block';
        loginButton.style.display = 'none';
        
        if (userName) userName.textContent = user.displayName || user.email;
        if (userAvatar) userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
        
        // Check if user is admin
        checkAdminStatus(user);
    } else {
        // User is signed out
        userMenu.style.display = 'none';
        loginButton.style.display = 'block';
        if (adminNavItem) adminNavItem.style.display = 'none';
    }
}

// Check if user has admin privileges
async function checkAdminStatus(user) {
    try {
        const adminNavItem = document.getElementById('adminNavItem');
        const token = await user.getIdTokenResult();
        
        if (token.claims.admin === true) {
            adminNavItem.style.display = 'block';
        } else {
            adminNavItem.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
}

// Make Firebase services globally available
window.firebase = { auth, db, storage };
