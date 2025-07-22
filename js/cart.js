// Shopping Cart Module
import { db } from './firebase-config.js';
import { doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let appliedVoucher = null;
let cartTotal = 0;
let discountAmount = 0;

// Load cart items into sidebar
window.loadCartItems = function() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalElement = document.getElementById('cartTotal');
    const cart = window.pickliSHApp.cart;
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart text-center py-4">
                <i class="fas fa-shopping-cart fa-3x text-muted mb-3"></i>
                <h6>Your cart is empty</h6>
                <p class="text-muted">Add some delicious pickles to get started!</p>
                <button class="btn btn-primary" onclick="showShop(); toggleCart();">Browse Products</button>
            </div>
        `;
        cartTotalElement.textContent = '0';
        return;
    }
    
    // Calculate totals
    calculateCartTotal();
    
    // Display cart items
    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item" data-item-id="${item.id}">
            <div class="cart-item-image">
                <i class="fas fa-pepper-hot"></i>
            </div>
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">₹${item.price}</div>
                <div class="quantity-controls mt-2">
                    <button class="btn btn-sm btn-outline-secondary" onclick="updateCartItemQuantity('${item.id}', ${item.quantity - 1})">-</button>
                    <span class="mx-2">${item.quantity}</span>
                    <button class="btn btn-sm btn-outline-secondary" onclick="updateCartItemQuantity('${item.id}', ${item.quantity + 1})">+</button>
                    <button class="btn btn-sm btn-outline-danger ms-2" onclick="removeFromCart('${item.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="cart-item-total">
                ₹${item.price * item.quantity}
            </div>
        </div>
    `).join('');
    
    cartTotalElement.textContent = (cartTotal - discountAmount).toString();
};

// Update cart item quantity
window.updateCartItemQuantity = function(itemId, newQuantity) {
    if (newQuantity < 1) {
        removeFromCart(itemId);
        return;
    }
    
    let cart = window.pickliSHApp.cart;
    const item = cart.find(item => item.id === itemId);
    
    if (item) {
        item.quantity = Math.min(newQuantity, 10); // Max 10 items
        
        // Update cart in app state and localStorage
        window.pickliSHApp.cart = cart;
        localStorage.setItem('picklish_cart', JSON.stringify(cart));
        
        // Reload cart UI
        loadCartItems();
        updateCartBadge();
    }
};

// Remove item from cart
window.removeFromCart = function(itemId) {
    let cart = window.pickliSHApp.cart;
    cart = cart.filter(item => item.id !== itemId);
    
    // Update cart in app state and localStorage
    window.pickliSHApp.cart = cart;
    localStorage.setItem('picklish_cart', JSON.stringify(cart));
    
    // Reload cart UI
    loadCartItems();
    updateCartBadge();
    
    showNotification('Item removed from cart', 'info');
};

// Calculate cart total
function calculateCartTotal() {
    const cart = window.pickliSHApp.cart;
    cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    // Apply voucher discount if applicable
    if (appliedVoucher) {
        discountAmount = calculateDiscount(cartTotal, appliedVoucher);
    } else {
        discountAmount = 0;
    }
}

// Apply voucher code
window.applyVoucher = function() {
    const voucherCodeInput = document.getElementById('cartVoucherCode');
    const voucherCode = voucherCodeInput.value.trim().toUpperCase();
    
    if (!voucherCode) {
        showNotification('Please enter a voucher code', 'error');
        return;
    }
    
    // Validate voucher
    validateAndApplyVoucher(voucherCode);
};

// Validate and apply voucher
async function validateAndApplyVoucher(voucherCode) {
    try {
        // Show loading state
        showNotification('Validating voucher...', 'info');
        
        // Check voucher in Firestore
        const voucherRef = doc(db, 'vouchers', voucherCode);
        const voucherSnap = await getDoc(voucherRef);
        
        if (!voucherSnap.exists()) {
            showNotification('Invalid voucher code', 'error');
            return;
        }
        
        const voucher = voucherSnap.data();
        
        // Check if voucher is active and not expired
        const now = new Date();
        if (!voucher.isActive) {
            showNotification('This voucher is no longer active', 'error');
            return;
        }
        
        if (voucher.expiresAt && voucher.expiresAt.toDate() < now) {
            showNotification('This voucher has expired', 'error');
            return;
        }
        
        if (voucher.startsAt && voucher.startsAt.toDate() > now) {
            showNotification('This voucher is not yet valid', 'error');
            return;
        }
        
        // Check minimum order amount
        if (voucher.minOrderAmount && cartTotal < voucher.minOrderAmount) {
            showNotification(`Minimum order amount of ₹${voucher.minOrderAmount} required`, 'error');
            return;
        }
        
        // Check usage limit
        if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
            showNotification('This voucher has reached its usage limit', 'error');
            return;
        }
        
        // Check user-specific usage (if user is logged in)
        if (window.pickliSHApp.user && voucher.userUsageLimit) {
            const userUsageCount = voucher.userUsage?.[window.pickliSHApp.user.uid] || 0;
            if (userUsageCount >= voucher.userUsageLimit) {
                showNotification('You have reached the usage limit for this voucher', 'error');
                return;
            }
        }
        
        // Apply voucher
        appliedVoucher = { code: voucherCode, ...voucher };
        calculateCartTotal();
        
        // Update UI
        loadCartItems();
        
        // Show success message
        const discount = calculateDiscount(cartTotal, appliedVoucher);
        showNotification(`Voucher applied! You saved ₹${discount}`, 'success');
        
        // Update voucher input appearance
        const voucherInput = document.getElementById('cartVoucherCode');
        voucherInput.value = voucherCode;
        voucherInput.classList.add('is-valid');
        
    } catch (error) {
        console.error('Error validating voucher:', error);
        showNotification('Error validating voucher. Please try again.', 'error');
    }
}

// Calculate discount based on voucher type
function calculateDiscount(total, voucher) {
    let discount = 0;
    
    switch (voucher.type) {
        case 'percentage':
            discount = Math.min(total * (voucher.value / 100), voucher.maxDiscount || Infinity);
            break;
        case 'fixed':
            discount = Math.min(voucher.value, total);
            break;
        case 'free_shipping':
            // For now, assuming shipping cost is ₹50
            discount = 50;
            break;
    }
    
    return Math.round(discount);
}

// Remove applied voucher
window.removeVoucher = function() {
    appliedVoucher = null;
    discountAmount = 0;
    
    // Reset voucher input
    const voucherInput = document.getElementById('cartVoucherCode');
    voucherInput.value = '';
    voucherInput.classList.remove('is-valid');
    
    // Recalculate and update UI
    calculateCartTotal();
    loadCartItems();
    
    showNotification('Voucher removed', 'info');
};

// Proceed to checkout
window.proceedToCheckout = function() {
    const cart = window.pickliSHApp.cart;
    
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }
    
    if (!window.pickliSHApp.user) {
        showNotification('Please sign in to checkout', 'error');
        return;
    }
    
    // Calculate final total
    calculateCartTotal();
    const finalTotal = cartTotal - discountAmount;
    
    // Create checkout session
    createCheckoutSession(finalTotal);
};

// Create checkout session
async function createCheckoutSession(total) {
    try {
        showNotification('Preparing checkout...', 'info');
        
        const user = window.pickliSHApp.user;
        const cart = window.pickliSHApp.cart;
        
        // Create order document
        const orderData = {
            userId: user.uid,
            userEmail: user.email,
            items: cart,
            subtotal: cartTotal,
            discountAmount: discountAmount,
            total: total,
            appliedVoucher: appliedVoucher ? appliedVoucher.code : null,
            status: 'pending',
            createdAt: serverTimestamp(),
            paymentStatus: 'pending'
        };
        
        // Generate order ID
        const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Save order to Firestore
        await setDoc(doc(db, 'orders', orderId), orderData);
        
        // Initialize Razorpay payment
        initializePayment(orderId, total, user);
        
    } catch (error) {
        console.error('Error creating checkout session:', error);
        showNotification('Error preparing checkout. Please try again.', 'error');
    }
}

// Initialize Razorpay payment
function initializePayment(orderId, amount, user) {
    const options = {
        key: window.RAZORPAY_KEY_ID || 'rzp_test_your_key_id', // Should be set as environment variable
        amount: amount * 100, // Razorpay expects amount in paise
        currency: 'INR',
        name: 'Picklish Foods',
        description: 'Premium Pickles Order',
        image: '/favicon.ico',
        order_id: orderId,
        handler: function(response) {
            handlePaymentSuccess(response, orderId);
        },
        prefill: {
            name: user.displayName || '',
            email: user.email || '',
            contact: user.phoneNumber || ''
        },
        notes: {
            order_id: orderId,
            user_id: user.uid
        },
        theme: {
            color: '#e67e22'
        },
        modal: {
            ondismiss: function() {
                showNotification('Payment cancelled', 'info');
            }
        }
    };
    
    const rzp = new Razorpay(options);
    rzp.open();
    
    rzp.on('payment.failed', function(response) {
        handlePaymentError(response, orderId);
    });
}

// Handle successful payment
async function handlePaymentSuccess(response, orderId) {
    try {
        showNotification('Payment successful! Processing order...', 'success');
        
        // Update order with payment details
        const orderUpdate = {
            paymentId: response.razorpay_payment_id,
            paymentSignature: response.razorpay_signature,
            paymentStatus: 'completed',
            status: 'confirmed',
            paidAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'orders', orderId), orderUpdate, { merge: true });
        
        // Update voucher usage if applicable
        if (appliedVoucher) {
            await updateVoucherUsage(appliedVoucher.code, window.pickliSHApp.user.uid);
        }
        
        // Update user loyalty points
        await updateLoyaltyPoints(cartTotal - discountAmount);
        
        // Clear cart
        window.pickliSHApp.cart = [];
        localStorage.removeItem('picklish_cart');
        
        // Update UI
        updateCartBadge();
        toggleCart();
        
        // Show success message and redirect
        showOrderSuccessModal(orderId);
        
    } catch (error) {
        console.error('Error processing successful payment:', error);
        showNotification('Payment successful but order processing failed. Please contact support.', 'error');
    }
}

// Handle payment error
async function handlePaymentError(response, orderId) {
    try {
        console.error('Payment failed:', response);
        
        // Update order status
        const orderUpdate = {
            paymentStatus: 'failed',
            status: 'payment_failed',
            paymentError: response.error,
            failedAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'orders', orderId), orderUpdate, { merge: true });
        
        showNotification(`Payment failed: ${response.error.description}`, 'error');
        
    } catch (error) {
        console.error('Error handling payment failure:', error);
    }
}

// Update voucher usage
async function updateVoucherUsage(voucherCode, userId) {
    try {
        const voucherRef = doc(db, 'vouchers', voucherCode);
        const voucherSnap = await getDoc(voucherRef);
        
        if (voucherSnap.exists()) {
            const voucher = voucherSnap.data();
            const updates = {
                usedCount: (voucher.usedCount || 0) + 1,
                lastUsedAt: serverTimestamp()
            };
            
            // Update user-specific usage
            if (userId) {
                const userUsage = voucher.userUsage || {};
                userUsage[userId] = (userUsage[userId] || 0) + 1;
                updates.userUsage = userUsage;
            }
            
            await setDoc(voucherRef, updates, { merge: true });
        }
    } catch (error) {
        console.error('Error updating voucher usage:', error);
    }
}

// Update user loyalty points
async function updateLoyaltyPoints(orderAmount) {
    try {
        const user = window.pickliSHApp.user;
        if (!user) return;
        
        // Calculate points (1 point per ₹10 spent)
        const pointsEarned = Math.floor(orderAmount / 10);
        
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const newPoints = (userData.loyaltyPoints || 0) + pointsEarned;
            const newTotalSpent = (userData.totalSpent || 0) + orderAmount;
            const newOrderCount = (userData.orderCount || 0) + 1;
            
            await setDoc(userRef, {
                loyaltyPoints: newPoints,
                totalSpent: newTotalSpent,
                orderCount: newOrderCount
            }, { merge: true });
            
            // Update app state
            window.pickliSHApp.loyaltyPoints = newPoints;
            
            if (pointsEarned > 0) {
                showNotification(`You earned ${pointsEarned} loyalty points!`, 'success');
            }
        }
    } catch (error) {
        console.error('Error updating loyalty points:', error);
    }
}

// Show order success modal
function showOrderSuccessModal(orderId) {
    const modalHTML = `
        <div class="modal fade" id="orderSuccessModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-body text-center p-4">
                        <i class="fas fa-check-circle fa-4x text-success mb-3"></i>
                        <h4 class="mb-3">Order Placed Successfully!</h4>
                        <p class="mb-3">Your order #${orderId.substring(0, 12).toUpperCase()} has been confirmed.</p>
                        <p class="text-muted mb-4">We'll send you updates about your order via email.</p>
                        <div class="d-flex gap-2 justify-content-center">
                            <button class="btn btn-primary" onclick="showOrders(); closeOrderSuccessModal();">
                                View Orders
                            </button>
                            <button class="btn btn-outline-primary" onclick="showShop(); closeOrderSuccessModal();">
                                Continue Shopping
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('orderSuccessModal'));
    modal.show();
}

// Close order success modal
window.closeOrderSuccessModal = function() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('orderSuccessModal'));
    if (modal) {
        modal.hide();
    }
    
    // Remove modal from DOM
    const modalElement = document.getElementById('orderSuccessModal');
    if (modalElement) {
        modalElement.remove();
    }
};

// Update cart badge
function updateCartBadge() {
    const cartBadge = document.getElementById('cartBadge');
    const cart = window.pickliSHApp.cart;
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    if (cartBadge) {
        cartBadge.textContent = totalItems;
        cartBadge.style.display = totalItems > 0 ? 'inline' : 'none';
    }
}

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load cart from localStorage if exists
    const savedCart = localStorage.getItem('picklish_cart');
    if (savedCart) {
        try {
            window.pickliSHApp.cart = JSON.parse(savedCart);
            updateCartBadge();
        } catch (error) {
            console.error('Error loading cart from localStorage:', error);
            window.pickliSHApp.cart = [];
        }
    }
});
