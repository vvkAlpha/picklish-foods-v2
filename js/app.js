// Main Application Controller
import { auth, db } from './firebase-config.js';
import './auth.js';
import './shop.js';
import './cart.js';
import './subscriptions.js';
import './admin.js';
import './reviews.js';
import './loyalty.js';
import './payments.js';

// App initialization
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Hide loading screen after a short delay
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 1500);

    // Initialize UI
    showHome();
    updateCartUI();
    
    // Initialize Bootstrap components
    initializeBootstrap();
    
    // Load initial data
    loadProducts();
    loadSubscriptionPlans();
}

// Bootstrap initialization
function initializeBootstrap() {
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
}

// Navigation functions
window.showHome = function() {
    switchView('homeView');
    setActiveNav('home');
};

window.showShop = function() {
    switchView('shopView');
    setActiveNav('shop');
    loadProducts();
};

window.showSubscriptions = function() {
    switchView('subscriptionsView');
    setActiveNav('subscriptions');
    loadSubscriptionPlans();
    
    // Load user subscriptions if logged in
    if (window.pickliSHApp.user) {
        loadUserSubscriptions();
    }
};

window.showAdmin = function() {
    if (!window.pickliSHApp.user) {
        showNotification('Please sign in to access admin panel', 'error');
        return;
    }
    
    switchView('adminView');
    setActiveNav('admin');
    initializeAdmin();
};

window.showProfile = function() {
    if (!window.pickliSHApp.user) {
        showNotification('Please sign in to view profile', 'error');
        return;
    }
    
    switchView('profileView');
    showProfileSection('profile');
};

window.showOrders = function() {
    if (!window.pickliSHApp.user) {
        showNotification('Please sign in to view orders', 'error');
        return;
    }
    
    switchView('profileView');
    showProfileSection('orders');
};

window.showLoyalty = function() {
    if (!window.pickliSHApp.user) {
        showNotification('Please sign in to view loyalty program', 'error');
        return;
    }
    
    switchView('loyaltyView');
    loadLoyaltyData();
};

// View switching
function switchView(viewId) {
    // Hide all views
    const views = document.querySelectorAll('.view');
    views.forEach(view => view.style.display = 'none');
    
    // Show target view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.style.display = 'block';
        window.pickliSHApp.currentView = viewId.replace('View', '');
    }
}

function setActiveNav(section) {
    // Remove active class from all nav links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    
    // Add active class to current section if exists
    const currentNavLink = document.querySelector(`[onclick="show${section.charAt(0).toUpperCase() + section.slice(1)}()"]`);
    if (currentNavLink) {
        currentNavLink.classList.add('active');
    }
}

// Profile section navigation
window.showProfileSection = function(section) {
    const profileContent = document.getElementById('profileContent');
    const navLinks = document.querySelectorAll('.profile-sidebar .nav-link');
    
    // Update active nav
    navLinks.forEach(link => link.classList.remove('active'));
    document.querySelector(`[onclick="showProfileSection('${section}')"]`).classList.add('active');
    
    // Load section content
    switch(section) {
        case 'profile':
            loadProfileContent();
            break;
        case 'orders':
            loadOrderHistory();
            break;
        case 'subscriptions':
            loadUserSubscriptions();
            break;
        case 'reviews':
            loadUserReviews();
            break;
    }
};

// Load profile content
function loadProfileContent() {
    const profileContent = document.getElementById('profileContent');
    const user = window.pickliSHApp.user;
    
    profileContent.innerHTML = `
        <div class="profile-section">
            <h4>Profile Information</h4>
            <form id="profileForm">
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Name</label>
                        <input type="text" class="form-control" value="${user.displayName || ''}" id="profileName">
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-control" value="${user.email || ''}" readonly>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Phone</label>
                        <input type="tel" class="form-control" id="profilePhone">
                    </div>
                    <div class="col-12 mb-3">
                        <label class="form-label">Address</label>
                        <textarea class="form-control" rows="3" id="profileAddress"></textarea>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary">Update Profile</button>
            </form>
        </div>
    `;
    
    // Handle profile form submission
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
}

// Update profile
async function updateProfile(e) {
    e.preventDefault();
    
    try {
        const user = window.pickliSHApp.user;
        const formData = {
            name: document.getElementById('profileName').value,
            phone: document.getElementById('profilePhone').value,
            address: document.getElementById('profileAddress').value,
            updatedAt: new Date()
        };
        
        // Update user document in Firestore
        await setDoc(doc(db, 'users', user.uid), formData, { merge: true });
        
        showNotification('Profile updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Error updating profile. Please try again.', 'error');
    }
}

// Load order history
function loadOrderHistory() {
    const profileContent = document.getElementById('profileContent');
    
    profileContent.innerHTML = `
        <div class="orders-section">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>Order History</h4>
                <div class="dropdown">
                    <button class="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                        Filter Orders
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" onclick="filterOrders('all')">All Orders</a></li>
                        <li><a class="dropdown-item" href="#" onclick="filterOrders('delivered')">Delivered</a></li>
                        <li><a class="dropdown-item" href="#" onclick="filterOrders('pending')">Pending</a></li>
                        <li><a class="dropdown-item" href="#" onclick="filterOrders('cancelled')">Cancelled</a></li>
                    </ul>
                </div>
            </div>
            <div id="ordersList">
                <div class="text-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading orders...</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Load orders from Firestore
    loadUserOrders();
}

// Utility functions
window.showNotification = function(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
};

window.formatCurrency = function(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

window.formatDate = function(date) {
    return new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(new Date(date));
};

// Load initial data functions
async function loadProducts() {
    try {
        // This will be implemented in shop.js
        if (window.loadShopProducts) {
            await window.loadShopProducts();
        }
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

async function loadSubscriptionPlans() {
    try {
        // This will be implemented in subscriptions.js
        if (window.loadSubscriptionPlans) {
            await window.loadSubscriptionPlans();
        }
    } catch (error) {
        console.error('Error loading subscription plans:', error);
    }
}

async function loadUserOrders() {
    try {
        const user = window.pickliSHApp.user;
        if (!user) return;
        
        const ordersQuery = query(
            collection(db, 'orders'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        
        const ordersSnapshot = await getDocs(ordersQuery);
        const orders = ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        displayOrderHistory(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('ordersList').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                Error loading orders. Please try again.
            </div>
        `;
    }
}

function displayOrderHistory(orders) {
    const ordersList = document.getElementById('ordersList');
    
    if (orders.length === 0) {
        ordersList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-box-open fa-3x text-muted mb-3"></i>
                <h5>No orders found</h5>
                <p class="text-muted">Start shopping to see your orders here!</p>
                <button class="btn btn-primary" onclick="showShop()">Browse Products</button>
            </div>
        `;
        return;
    }
    
    ordersList.innerHTML = orders.map(order => `
        <div class="order-card card mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <h6 class="mb-1">Order #${order.id.substring(0, 8).toUpperCase()}</h6>
                        <small class="text-muted">${formatDate(order.createdAt.toDate())}</small>
                    </div>
                    <span class="badge bg-${getOrderStatusColor(order.status)}">${order.status.toUpperCase()}</span>
                </div>
                <div class="order-items mb-3">
                    ${order.items.map(item => `
                        <div class="d-flex justify-content-between">
                            <span>${item.name} x ${item.quantity}</span>
                            <span>${formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <strong>Total: ${formatCurrency(order.total)}</strong>
                    <div>
                        <button class="btn btn-sm btn-outline-primary" onclick="viewOrderDetails('${order.id}')">
                            View Details
                        </button>
                        ${order.status === 'delivered' ? `
                            <button class="btn btn-sm btn-primary ms-2" onclick="reorderItems('${order.id}')">
                                Reorder
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function getOrderStatusColor(status) {
    const statusColors = {
        'pending': 'warning',
        'confirmed': 'info',
        'shipped': 'primary',
        'delivered': 'success',
        'cancelled': 'danger'
    };
    return statusColors[status] || 'secondary';
}

// Make functions globally available
window.filterOrders = function(status) {
    // Implementation for filtering orders
    console.log('Filtering orders by:', status);
};

window.viewOrderDetails = function(orderId) {
    // Implementation for viewing order details
    console.log('Viewing order details:', orderId);
};

window.reorderItems = function(orderId) {
    // Implementation for reordering items
    console.log('Reordering items from:', orderId);
};

// Initialize cart from localStorage
function updateCartUI() {
    const cartBadge = document.getElementById('cartBadge');
    const cart = window.pickliSHApp.cart;
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    if (cartBadge) {
        cartBadge.textContent = totalItems;
        cartBadge.style.display = totalItems > 0 ? 'inline' : 'none';
    }
}

// Cart toggle function
window.toggleCart = function() {
    const cartSidebar = document.getElementById('cartSidebar');
    cartSidebar.classList.toggle('open');
    
    if (cartSidebar.classList.contains('open')) {
        // Load cart items
        if (window.loadCartItems) {
            window.loadCartItems();
        }
    }
};
