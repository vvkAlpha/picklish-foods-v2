// Subscription Management Module
import { db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    setDoc, 
    updateDoc,
    query, 
    where, 
    orderBy,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
    monthly: {
        id: 'monthly',
        name: 'Monthly Delight',
        duration: 'monthly',
        frequency: 1,
        description: 'Fresh pickles delivered every month',
        basePrice: 599,
        discount: 0,
        features: [
            '3-4 premium pickle varieties',
            'Free shipping',
            'Pause anytime',
            'Customer support'
        ],
        popular: false
    },
    quarterly: {
        id: 'quarterly',
        name: 'Quarterly Feast',
        duration: 'quarterly',
        frequency: 3,
        description: 'Seasonal pickle collection every 3 months',
        basePrice: 1699,
        discount: 10,
        features: [
            '6-8 premium pickle varieties',
            'Free shipping',
            'Seasonal specialties',
            'Pause/skip anytime',
            'Priority customer support'
        ],
        popular: true
    },
    halfyearly: {
        id: 'halfyearly',
        name: 'Half-Yearly Premium',
        duration: 'half-yearly',
        frequency: 6,
        description: 'Premium pickle experience every 6 months',
        basePrice: 3199,
        discount: 15,
        features: [
            '10-12 premium pickle varieties',
            'Free express shipping',
            'Exclusive limited editions',
            'Flexible delivery schedule',
            'Dedicated account manager',
            'Recipe cards included'
        ],
        popular: false
    }
};

// Load subscription plans
window.loadSubscriptionPlans = function() {
    const subscriptionPlans = document.getElementById('subscriptionPlans');
    if (!subscriptionPlans) return;
    
    const plansHTML = Object.values(SUBSCRIPTION_PLANS).map(plan => {
        const finalPrice = plan.basePrice * (1 - plan.discount / 100);
        const savings = plan.basePrice - finalPrice;
        
        return `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="subscription-card ${plan.popular ? 'popular' : ''}">
                    <div class="subscription-duration">${plan.name}</div>
                    <div class="subscription-price">₹${Math.round(finalPrice)}</div>
                    ${savings > 0 ? `<div class="subscription-savings">Save ₹${Math.round(savings)} (${plan.discount}% off)</div>` : ''}
                    <p class="mb-3">${plan.description}</p>
                    <ul class="subscription-features mb-4">
                        ${plan.features.map(feature => `<li><i class="fas fa-check text-success me-2"></i>${feature}</li>`).join('')}
                    </ul>
                    <div class="subscription-actions">
                        <button class="btn btn-primary w-100 mb-2" onclick="subscribeToplan('${plan.id}')">
                            Subscribe Now
                        </button>
                        <button class="btn btn-outline-secondary w-100" onclick="customizeSubscription('${plan.id}')">
                            Customize Plan
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    subscriptionPlans.innerHTML = plansHTML;
};

// Subscribe to a plan
window.subscribeToplan = async function(planId) {
    if (!window.pickliSHApp.user) {
        showNotification('Please sign in to subscribe', 'error');
        return;
    }
    
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
        showNotification('Invalid subscription plan', 'error');
        return;
    }
    
    try {
        showNotification('Processing subscription...', 'info');
        
        // Create subscription document
        const subscriptionData = {
            userId: window.pickliSHApp.user.uid,
            userEmail: window.pickliSHApp.user.email,
            planId: planId,
            planName: plan.name,
            duration: plan.duration,
            frequency: plan.frequency,
            basePrice: plan.basePrice,
            discount: plan.discount,
            finalPrice: Math.round(plan.basePrice * (1 - plan.discount / 100)),
            status: 'active',
            createdAt: serverTimestamp(),
            startDate: serverTimestamp(),
            nextDelivery: calculateNextDelivery(plan.frequency),
            deliveryCount: 0,
            pausedUntil: null,
            customizations: {},
            paymentStatus: 'pending'
        };
        
        // Generate subscription ID
        const subscriptionId = `SUB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Save subscription to Firestore
        await setDoc(doc(db, 'subscriptions', subscriptionId), subscriptionData);
        
        // Initialize payment for subscription
        initializeSubscriptionPayment(subscriptionId, subscriptionData.finalPrice);
        
    } catch (error) {
        console.error('Error creating subscription:', error);
        showNotification('Error creating subscription. Please try again.', 'error');
    }
};

// Customize subscription
window.customizeSubscription = function(planId) {
    if (!window.pickliSHApp.user) {
        showNotification('Please sign in to customize subscription', 'error');
        return;
    }
    
    const plan = SUBSCRIPTION_PLANS[planId];
    showCustomizationModal(plan);
};

// Show customization modal
function showCustomizationModal(plan) {
    const modalHTML = `
        <div class="modal fade" id="customizationModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Customize ${plan.name}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="customizationForm">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Delivery Frequency</label>
                                    <select class="form-select" id="deliveryFrequency">
                                        <option value="${plan.frequency}" selected>Every ${plan.frequency} month(s) - Default</option>
                                        ${plan.frequency > 1 ? `<option value="${plan.frequency - 1}">Every ${plan.frequency - 1} month(s)</option>` : ''}
                                        <option value="${plan.frequency + 1}">Every ${plan.frequency + 1} month(s)</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Start Date</label>
                                    <input type="date" class="form-control" id="startDate" min="${new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="col-12 mb-3">
                                    <label class="form-label">Category Preferences</label>
                                    <div class="row">
                                        <div class="col-md-4">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" value="premium-meats" id="prefMeats" checked>
                                                <label class="form-check-label" for="prefMeats">Premium Meats</label>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" value="ocean-delights" id="prefSeafood" checked>
                                                <label class="form-check-label" for="prefSeafood">Ocean Delights</label>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" value="garden-fresh" id="prefVeg" checked>
                                                <label class="form-check-label" for="prefVeg">Garden Fresh</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-12 mb-3">
                                    <label class="form-label">Spice Level Preference</label>
                                    <select class="form-select" id="spiceLevel">
                                        <option value="mild">Mild</option>
                                        <option value="medium" selected>Medium</option>
                                        <option value="spicy">Spicy</option>
                                        <option value="extra-spicy">Extra Spicy</option>
                                    </select>
                                </div>
                                <div class="col-12 mb-3">
                                    <label class="form-label">Delivery Address</label>
                                    <textarea class="form-control" id="deliveryAddress" rows="3" placeholder="Enter your delivery address"></textarea>
                                </div>
                                <div class="col-12 mb-3">
                                    <label class="form-label">Special Instructions (Optional)</label>
                                    <textarea class="form-control" id="specialInstructions" rows="2" placeholder="Any dietary restrictions or special requests"></textarea>
                                </div>
                            </div>
                            <div class="pricing-summary mt-4 p-3 bg-light rounded">
                                <h6>Pricing Summary</h6>
                                <div class="d-flex justify-content-between">
                                    <span>Base Price:</span>
                                    <span>₹${plan.basePrice}</span>
                                </div>
                                ${plan.discount > 0 ? `
                                    <div class="d-flex justify-content-between text-success">
                                        <span>Discount (${plan.discount}%):</span>
                                        <span>-₹${Math.round(plan.basePrice * plan.discount / 100)}</span>
                                    </div>
                                ` : ''}
                                <hr>
                                <div class="d-flex justify-content-between fw-bold">
                                    <span>Total:</span>
                                    <span>₹${Math.round(plan.basePrice * (1 - plan.discount / 100))}</span>
                                </div>
                            </div>
                            <div class="mt-4">
                                <button type="submit" class="btn btn-primary btn-lg w-100">Subscribe with Customizations</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('customizationModal'));
    modal.show();
    
    // Handle form submission
    document.getElementById('customizationForm').addEventListener('submit', function(e) {
        e.preventDefault();
        processCustomSubscription(plan);
    });
    
    // Remove modal when hidden
    modal._element.addEventListener('hidden.bs.modal', function() {
        document.getElementById('customizationModal').remove();
    });
}

// Process custom subscription
async function processCustomSubscription(plan) {
    try {
        const formData = new FormData(document.getElementById('customizationForm'));
        
        // Get preferences
        const preferences = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        
        const customizations = {
            deliveryFrequency: parseInt(document.getElementById('deliveryFrequency').value),
            startDate: document.getElementById('startDate').value,
            categoryPreferences: preferences,
            spiceLevel: document.getElementById('spiceLevel').value,
            deliveryAddress: document.getElementById('deliveryAddress').value,
            specialInstructions: document.getElementById('specialInstructions').value
        };
        
        // Validate required fields
        if (!customizations.deliveryAddress.trim()) {
            showNotification('Please enter delivery address', 'error');
            return;
        }
        
        if (preferences.length === 0) {
            showNotification('Please select at least one category preference', 'error');
            return;
        }
        
        showNotification('Creating custom subscription...', 'info');
        
        // Create subscription with customizations
        const subscriptionData = {
            userId: window.pickliSHApp.user.uid,
            userEmail: window.pickliSHApp.user.email,
            planId: plan.id,
            planName: plan.name,
            duration: plan.duration,
            frequency: customizations.deliveryFrequency,
            basePrice: plan.basePrice,
            discount: plan.discount,
            finalPrice: Math.round(plan.basePrice * (1 - plan.discount / 100)),
            status: 'active',
            createdAt: serverTimestamp(),
            startDate: customizations.startDate ? new Date(customizations.startDate) : new Date(),
            nextDelivery: calculateNextDeliveryFromDate(
                customizations.startDate ? new Date(customizations.startDate) : new Date(),
                customizations.deliveryFrequency
            ),
            deliveryCount: 0,
            pausedUntil: null,
            customizations: customizations,
            paymentStatus: 'pending'
        };
        
        // Generate subscription ID
        const subscriptionId = `SUB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Save subscription to Firestore
        await setDoc(doc(db, 'subscriptions', subscriptionId), subscriptionData);
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('customizationModal'));
        modal.hide();
        
        // Initialize payment
        initializeSubscriptionPayment(subscriptionId, subscriptionData.finalPrice);
        
    } catch (error) {
        console.error('Error creating custom subscription:', error);
        showNotification('Error creating subscription. Please try again.', 'error');
    }
}

// Load user subscriptions
window.loadUserSubscriptions = async function() {
    const user = window.pickliSHApp.user;
    if (!user) return;
    
    try {
        const userSubscriptionsContainer = document.getElementById('userSubscriptions');
        if (!userSubscriptionsContainer) return;
        
        userSubscriptionsContainer.style.display = 'block';
        
        const subscriptionsQuery = query(
            collection(db, 'subscriptions'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        
        const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
        
        if (subscriptionsSnapshot.empty) {
            document.getElementById('subscriptionsList').innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-calendar-alt fa-3x text-muted mb-3"></i>
                    <h5>No Active Subscriptions</h5>
                    <p class="text-muted">Subscribe to a plan to start receiving regular deliveries!</p>
                </div>
            `;
            return;
        }
        
        const subscriptions = subscriptionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        displayUserSubscriptions(subscriptions);
        
    } catch (error) {
        console.error('Error loading user subscriptions:', error);
        document.getElementById('subscriptionsList').innerHTML = `
            <div class="error-message">
                Error loading subscriptions. Please try again.
            </div>
        `;
    }
};

// Display user subscriptions
function displayUserSubscriptions(subscriptions) {
    const subscriptionsList = document.getElementById('subscriptionsList');
    
    subscriptionsList.innerHTML = subscriptions.map(subscription => `
        <div class="subscription-item card mb-3">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <h6 class="mb-1">${subscription.planName}</h6>
                        <small class="text-muted">ID: ${subscription.id.substring(0, 12).toUpperCase()}</small>
                        <div class="mt-2">
                            <span class="badge bg-${getSubscriptionStatusColor(subscription.status)}">${subscription.status.toUpperCase()}</span>
                            ${subscription.pausedUntil ? `<span class="badge bg-warning ms-2">PAUSED</span>` : ''}
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="subscription-details">
                            <strong>₹${subscription.finalPrice}</strong>
                            <div class="small text-muted">Every ${subscription.frequency} month(s)</div>
                            <div class="small text-muted">
                                Next: ${subscription.nextDelivery ? formatDate(subscription.nextDelivery.toDate()) : 'N/A'}
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="subscription-actions">
                            ${subscription.status === 'active' && !subscription.pausedUntil ? `
                                <button class="btn btn-sm btn-outline-warning" onclick="pauseSubscription('${subscription.id}')">
                                    <i class="fas fa-pause"></i> Pause
                                </button>
                            ` : ''}
                            ${subscription.pausedUntil ? `
                                <button class="btn btn-sm btn-outline-success" onclick="resumeSubscription('${subscription.id}')">
                                    <i class="fas fa-play"></i> Resume
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-outline-primary" onclick="manageSubscription('${subscription.id}')">
                                <i class="fas fa-cog"></i> Manage
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Pause subscription
window.pauseSubscription = async function(subscriptionId) {
    try {
        // Show confirmation modal
        if (!confirm('Are you sure you want to pause this subscription? You can resume it anytime.')) {
            return;
        }
        
        showNotification('Pausing subscription...', 'info');
        
        const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
        await updateDoc(subscriptionRef, {
            pausedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Pause for 30 days by default
            pausedAt: serverTimestamp()
        });
        
        showNotification('Subscription paused successfully', 'success');
        loadUserSubscriptions();
        
    } catch (error) {
        console.error('Error pausing subscription:', error);
        showNotification('Error pausing subscription. Please try again.', 'error');
    }
};

// Resume subscription
window.resumeSubscription = async function(subscriptionId) {
    try {
        showNotification('Resuming subscription...', 'info');
        
        const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
        const subscriptionSnap = await getDoc(subscriptionRef);
        
        if (subscriptionSnap.exists()) {
            const subscription = subscriptionSnap.data();
            
            await updateDoc(subscriptionRef, {
                pausedUntil: null,
                resumedAt: serverTimestamp(),
                nextDelivery: calculateNextDelivery(subscription.frequency)
            });
            
            showNotification('Subscription resumed successfully', 'success');
            loadUserSubscriptions();
        }
        
    } catch (error) {
        console.error('Error resuming subscription:', error);
        showNotification('Error resuming subscription. Please try again.', 'error');
    }
};

// Manage subscription
window.manageSubscription = function(subscriptionId) {
    // Show subscription management modal
    showSubscriptionManagementModal(subscriptionId);
};

// Show subscription management modal
async function showSubscriptionManagementModal(subscriptionId) {
    try {
        const subscriptionSnap = await getDoc(doc(db, 'subscriptions', subscriptionId));
        if (!subscriptionSnap.exists()) {
            showNotification('Subscription not found', 'error');
            return;
        }
        
        const subscription = subscriptionSnap.data();
        
        const modalHTML = `
            <div class="modal fade" id="subscriptionManagementModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Manage Subscription</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="subscription-info mb-4">
                                <h6>${subscription.planName}</h6>
                                <p class="text-muted">Created: ${formatDate(subscription.createdAt.toDate())}</p>
                                <div class="row">
                                    <div class="col-md-6">
                                        <strong>Status:</strong> 
                                        <span class="badge bg-${getSubscriptionStatusColor(subscription.status)}">${subscription.status.toUpperCase()}</span>
                                    </div>
                                    <div class="col-md-6">
                                        <strong>Next Delivery:</strong> ${subscription.nextDelivery ? formatDate(subscription.nextDelivery.toDate()) : 'N/A'}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="subscription-options">
                                <h6>Manage Your Subscription</h6>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <button class="btn btn-outline-primary w-100" onclick="skipNextDelivery('${subscriptionId}')">
                                            <i class="fas fa-forward"></i> Skip Next Delivery
                                        </button>
                                    </div>
                                    <div class="col-md-6">
                                        <button class="btn btn-outline-secondary w-100" onclick="changeDeliveryDate('${subscriptionId}')">
                                            <i class="fas fa-calendar"></i> Change Delivery Date
                                        </button>
                                    </div>
                                    <div class="col-md-6">
                                        <button class="btn btn-outline-info w-100" onclick="updatePreferences('${subscriptionId}')">
                                            <i class="fas fa-edit"></i> Update Preferences
                                        </button>
                                    </div>
                                    <div class="col-md-6">
                                        <button class="btn btn-outline-warning w-100" onclick="changeFrequency('${subscriptionId}')">
                                            <i class="fas fa-clock"></i> Change Frequency
                                        </button>
                                    </div>
                                    <div class="col-12">
                                        <button class="btn btn-outline-danger w-100" onclick="cancelSubscription('${subscriptionId}')">
                                            <i class="fas fa-times"></i> Cancel Subscription
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            ${subscription.customizations ? `
                                <div class="subscription-customizations mt-4">
                                    <h6>Current Preferences</h6>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <strong>Categories:</strong> ${subscription.customizations.categoryPreferences?.join(', ') || 'All'}
                                        </div>
                                        <div class="col-md-6">
                                            <strong>Spice Level:</strong> ${subscription.customizations.spiceLevel || 'Medium'}
                                        </div>
                                        <div class="col-12 mt-2">
                                            <strong>Delivery Address:</strong><br>
                                            ${subscription.customizations.deliveryAddress || 'Not specified'}
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('subscriptionManagementModal'));
        modal.show();
        
        // Remove modal when hidden
        modal._element.addEventListener('hidden.bs.modal', function() {
            document.getElementById('subscriptionManagementModal').remove();
        });
        
    } catch (error) {
        console.error('Error loading subscription details:', error);
        showNotification('Error loading subscription details', 'error');
    }
}

// Skip next delivery
window.skipNextDelivery = async function(subscriptionId) {
    try {
        if (!confirm('Skip the next delivery? Your subscription will continue with the following delivery.')) {
            return;
        }
        
        showNotification('Skipping next delivery...', 'info');
        
        const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
        const subscriptionSnap = await getDoc(subscriptionRef);
        
        if (subscriptionSnap.exists()) {
            const subscription = subscriptionSnap.data();
            const nextDelivery = calculateNextDelivery(subscription.frequency, subscription.nextDelivery.toDate());
            
            await updateDoc(subscriptionRef, {
                nextDelivery: nextDelivery,
                skippedDeliveries: (subscription.skippedDeliveries || 0) + 1,
                lastSkippedAt: serverTimestamp()
            });
            
            showNotification('Next delivery skipped successfully', 'success');
            
            // Close modal and reload subscriptions
            const modal = bootstrap.Modal.getInstance(document.getElementById('subscriptionManagementModal'));
            modal.hide();
            loadUserSubscriptions();
        }
        
    } catch (error) {
        console.error('Error skipping delivery:', error);
        showNotification('Error skipping delivery. Please try again.', 'error');
    }
};

// Cancel subscription
window.cancelSubscription = async function(subscriptionId) {
    try {
        if (!confirm('Are you sure you want to cancel this subscription? This action cannot be undone.')) {
            return;
        }
        
        showNotification('Cancelling subscription...', 'info');
        
        const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
        await updateDoc(subscriptionRef, {
            status: 'cancelled',
            cancelledAt: serverTimestamp(),
            nextDelivery: null
        });
        
        showNotification('Subscription cancelled successfully', 'success');
        
        // Close modal and reload subscriptions
        const modal = bootstrap.Modal.getInstance(document.getElementById('subscriptionManagementModal'));
        modal.hide();
        loadUserSubscriptions();
        
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        showNotification('Error cancelling subscription. Please try again.', 'error');
    }
};

// Initialize subscription payment
function initializeSubscriptionPayment(subscriptionId, amount) {
    const user = window.pickliSHApp.user;
    
    const options = {
        key: window.RAZORPAY_KEY_ID || 'rzp_test_your_key_id',
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        name: 'Picklish Foods',
        description: 'Subscription Payment',
        subscription_id: subscriptionId,
        handler: function(response) {
            handleSubscriptionPaymentSuccess(response, subscriptionId);
        },
        prefill: {
            name: user.displayName || '',
            email: user.email || ''
        },
        theme: {
            color: '#e67e22'
        }
    };
    
    const rzp = new Razorpay(options);
    rzp.open();
    
    rzp.on('payment.failed', function(response) {
        handleSubscriptionPaymentError(response, subscriptionId);
    });
}

// Handle successful subscription payment
async function handleSubscriptionPaymentSuccess(response, subscriptionId) {
    try {
        showNotification('Payment successful! Activating subscription...', 'success');
        
        const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
        await updateDoc(subscriptionRef, {
            paymentId: response.razorpay_payment_id,
            paymentStatus: 'completed',
            status: 'active',
            activatedAt: serverTimestamp()
        });
        
        showNotification('Subscription activated successfully!', 'success');
        loadUserSubscriptions();
        
    } catch (error) {
        console.error('Error activating subscription:', error);
        showNotification('Payment successful but activation failed. Please contact support.', 'error');
    }
}

// Handle subscription payment error
async function handleSubscriptionPaymentError(response, subscriptionId) {
    try {
        console.error('Subscription payment failed:', response);
        
        const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
        await updateDoc(subscriptionRef, {
            paymentStatus: 'failed',
            status: 'payment_failed',
            paymentError: response.error
        });
        
        showNotification(`Payment failed: ${response.error.description}`, 'error');
        
    } catch (error) {
        console.error('Error handling subscription payment failure:', error);
    }
}

// Utility functions
function calculateNextDelivery(frequency, fromDate = new Date()) {
    const nextDate = new Date(fromDate);
    nextDate.setMonth(nextDate.getMonth() + frequency);
    return nextDate;
}

function calculateNextDeliveryFromDate(startDate, frequency) {
    return calculateNextDelivery(frequency, startDate);
}

function getSubscriptionStatusColor(status) {
    const statusColors = {
        'active': 'success',
        'paused': 'warning',
        'cancelled': 'danger',
        'pending': 'info',
        'payment_failed': 'danger'
    };
    return statusColors[status] || 'secondary';
}
