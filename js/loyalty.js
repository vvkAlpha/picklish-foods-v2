// Loyalty Program Management Module
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
    limit,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Loyalty program configuration
const LOYALTY_CONFIG = {
    pointsPerRupee: 0.1, // 1 point per ₹10 spent
    welcomeBonus: 100,
    reviewBonus: 10,
    referralBonus: 200,
    birthdayBonus: 500,
    tiers: {
        bronze: { minPoints: 0, multiplier: 1, name: 'Bronze' },
        silver: { minPoints: 1000, multiplier: 1.2, name: 'Silver' },
        gold: { minPoints: 2500, multiplier: 1.5, name: 'Gold' },
        platinum: { minPoints: 5000, multiplier: 2, name: 'Platinum' }
    }
};

// Load loyalty data for current user
window.loadLoyaltyData = async function() {
    const user = window.pickliSHApp.user;
    if (!user) {
        showNotification('Please sign in to view loyalty program', 'error');
        return;
    }
    
    try {
        // Load user loyalty data
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        let userData = {};
        if (userSnap.exists()) {
            userData = userSnap.data();
        }
        
        const loyaltyPoints = userData.loyaltyPoints || 0;
        const totalSpent = userData.totalSpent || 0;
        const currentTier = calculateUserTier(loyaltyPoints);
        
        // Update app state
        window.pickliSHApp.loyaltyPoints = loyaltyPoints;
        
        // Load available vouchers
        await loadAvailableVouchers();
        
        // Load points history
        await loadPointsHistory(user.uid);
        
        // Update loyalty display
        updateLoyaltyDisplay(loyaltyPoints, totalSpent, currentTier);
        
    } catch (error) {
        console.error('Error loading loyalty data:', error);
        showNotification('Error loading loyalty program data', 'error');
    }
};

// Calculate user tier based on points
function calculateUserTier(points) {
    const tiers = LOYALTY_CONFIG.tiers;
    
    if (points >= tiers.platinum.minPoints) return 'platinum';
    if (points >= tiers.gold.minPoints) return 'gold';
    if (points >= tiers.silver.minPoints) return 'silver';
    return 'bronze';
}

// Update loyalty display
function updateLoyaltyDisplay(points, totalSpent, tier) {
    const loyaltyPointsElement = document.getElementById('loyaltyPoints');
    if (loyaltyPointsElement) {
        loyaltyPointsElement.textContent = points.toLocaleString();
    }
    
    // Update tier display if on loyalty page
    const tierDisplay = document.getElementById('userTier');
    if (tierDisplay) {
        const tierInfo = LOYALTY_CONFIG.tiers[tier];
        const nextTier = getNextTier(tier);
        const pointsToNext = nextTier ? nextTier.minPoints - points : 0;
        
        tierDisplay.innerHTML = `
            <div class="tier-info mb-4">
                <div class="row">
                    <div class="col-md-4">
                        <div class="tier-badge text-center">
                            <div class="tier-icon mb-2">
                                <i class="fas fa-crown fa-3x text-${getTierColor(tier)}"></i>
                            </div>
                            <h5 class="tier-name text-${getTierColor(tier)}">${tierInfo.name} Member</h5>
                            <p class="tier-multiplier">Points Multiplier: ${tierInfo.multiplier}x</p>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="tier-progress">
                            <h6>Your Progress</h6>
                            <p><strong>Total Points:</strong> ${points.toLocaleString()}</p>
                            <p><strong>Total Spent:</strong> ₹${totalSpent.toLocaleString()}</p>
                            
                            ${nextTier ? `
                                <div class="next-tier mt-3">
                                    <p><strong>Next Tier:</strong> ${nextTier.name}</p>
                                    <div class="progress">
                                        <div class="progress-bar bg-${getTierColor(tier)}" 
                                             style="width: ${Math.min((points / nextTier.minPoints) * 100, 100)}%"></div>
                                    </div>
                                    <small class="text-muted">${pointsToNext} points to ${nextTier.name}</small>
                                </div>
                            ` : `
                                <div class="max-tier mt-3">
                                    <p class="text-success"><strong>🎉 You've reached the highest tier!</strong></p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Get next tier information
function getNextTier(currentTier) {
    const tiers = LOYALTY_CONFIG.tiers;
    
    switch(currentTier) {
        case 'bronze': return tiers.silver;
        case 'silver': return tiers.gold;
        case 'gold': return tiers.platinum;
        default: return null;
    }
}

// Get tier color for styling
function getTierColor(tier) {
    const colors = {
        bronze: 'warning',
        silver: 'secondary',
        gold: 'warning',
        platinum: 'dark'
    };
    return colors[tier] || 'primary';
}

// Load available vouchers for redemption
async function loadAvailableVouchers() {
    try {
        const vouchersQuery = query(
            collection(db, 'loyaltyVouchers'),
            where('isActive', '==', true),
            orderBy('pointsCost', 'asc')
        );
        
        const vouchersSnapshot = await getDocs(vouchersQuery);
        const vouchers = vouchersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        displayAvailableVouchers(vouchers);
        
    } catch (error) {
        console.error('Error loading vouchers:', error);
        
        // Show default vouchers if Firestore query fails
        const defaultVouchers = getDefaultLoyaltyVouchers();
        displayAvailableVouchers(defaultVouchers);
    }
}

// Get default loyalty vouchers
function getDefaultLoyaltyVouchers() {
    return [
        {
            id: 'LOYAL50',
            title: '₹50 Off',
            description: 'Get ₹50 off on orders above ₹500',
            pointsCost: 500,
            voucherType: 'fixed',
            voucherValue: 50,
            minOrderAmount: 500,
            maxDiscount: 50,
            validityDays: 30,
            isActive: true,
            category: 'discount'
        },
        {
            id: 'LOYAL100',
            title: '₹100 Off',
            description: 'Get ₹100 off on orders above ₹1000',
            pointsCost: 1000,
            voucherType: 'fixed',
            voucherValue: 100,
            minOrderAmount: 1000,
            maxDiscount: 100,
            validityDays: 30,
            isActive: true,
            category: 'discount'
        },
        {
            id: 'FREESHIP',
            title: 'Free Shipping',
            description: 'Free shipping on any order',
            pointsCost: 300,
            voucherType: 'free_shipping',
            voucherValue: 0,
            minOrderAmount: 0,
            maxDiscount: 50,
            validityDays: 15,
            isActive: true,
            category: 'shipping'
        },
        {
            id: 'LOYAL200',
            title: '₹200 Off',
            description: 'Get ₹200 off on orders above ₹2000',
            pointsCost: 2000,
            voucherType: 'fixed',
            voucherValue: 200,
            minOrderAmount: 2000,
            maxDiscount: 200,
            validityDays: 30,
            isActive: true,
            category: 'discount'
        },
        {
            id: 'PREMIUM15',
            title: '15% Off Premium',
            description: '15% off on premium pickle collections',
            pointsCost: 1500,
            voucherType: 'percentage',
            voucherValue: 15,
            minOrderAmount: 800,
            maxDiscount: 300,
            validityDays: 30,
            isActive: true,
            category: 'premium'
        },
        {
            id: 'BIRTHDAY500',
            title: 'Birthday Special',
            description: '₹500 off for your special day',
            pointsCost: 3000,
            voucherType: 'fixed',
            voucherValue: 500,
            minOrderAmount: 1500,
            maxDiscount: 500,
            validityDays: 7,
            isActive: true,
            category: 'special'
        }
    ];
}

// Display available vouchers
function displayAvailableVouchers(vouchers) {
    const vouchersContainer = document.getElementById('availableVouchers');
    if (!vouchersContainer) return;
    
    const userPoints = window.pickliSHApp.loyaltyPoints || 0;
    
    vouchersContainer.innerHTML = `
        <div class="vouchers-section">
            <h5 class="mb-4">Redeem Your Points</h5>
            <div class="row g-3">
                ${vouchers.map(voucher => {
                    const canRedeem = userPoints >= voucher.pointsCost;
                    const categoryIcon = getVoucherCategoryIcon(voucher.category);
                    
                    return `
                        <div class="col-md-6 col-lg-4">
                            <div class="voucher-card ${!canRedeem ? 'disabled' : ''}" 
                                 onclick="${canRedeem ? `redeemLoyaltyVoucher('${voucher.id}')` : ''}">
                                <div class="voucher-header">
                                    <div class="voucher-icon">
                                        <i class="fas ${categoryIcon} fa-2x text-primary"></i>
                                    </div>
                                    <div class="voucher-cost">
                                        <strong>${voucher.pointsCost}</strong>
                                        <small>points</small>
                                    </div>
                                </div>
                                <div class="voucher-body">
                                    <h6 class="voucher-title">${voucher.title}</h6>
                                    <p class="voucher-description">${voucher.description}</p>
                                    <div class="voucher-details">
                                        <small class="text-muted">
                                            ${voucher.minOrderAmount > 0 ? `Min order: ₹${voucher.minOrderAmount}` : 'No minimum order'}
                                            <br>Valid for ${voucher.validityDays} days
                                        </small>
                                    </div>
                                </div>
                                <div class="voucher-footer">
                                    ${canRedeem ? 
                                        `<button class="btn btn-primary btn-sm w-100">Redeem Now</button>` :
                                        `<button class="btn btn-secondary btn-sm w-100" disabled>Need ${voucher.pointsCost - userPoints} more points</button>`
                                    }
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Get voucher category icon
function getVoucherCategoryIcon(category) {
    const icons = {
        discount: 'fa-percentage',
        shipping: 'fa-truck',
        premium: 'fa-crown',
        special: 'fa-gift'
    };
    return icons[category] || 'fa-ticket-alt';
}

// Redeem loyalty voucher
window.redeemLoyaltyVoucher = async function(voucherId) {
    const user = window.pickliSHApp.user;
    if (!user) {
        showNotification('Please sign in to redeem vouchers', 'error');
        return;
    }
    
    try {
        // Get voucher details
        const voucher = getDefaultLoyaltyVouchers().find(v => v.id === voucherId);
        if (!voucher) {
            showNotification('Voucher not found', 'error');
            return;
        }
        
        // Check if user has enough points
        const userPoints = window.pickliSHApp.loyaltyPoints;
        if (userPoints < voucher.pointsCost) {
            showNotification(`You need ${voucher.pointsCost - userPoints} more points to redeem this voucher`, 'error');
            return;
        }
        
        // Confirm redemption
        if (!confirm(`Redeem "${voucher.title}" for ${voucher.pointsCost} points?`)) {
            return;
        }
        
        showNotification('Redeeming voucher...', 'info');
        
        // Generate unique voucher code
        const voucherCode = generateVoucherCode(voucher.id);
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + voucher.validityDays);
        
        // Create redeemed voucher document
        const redeemedVoucherData = {
            userId: user.uid,
            userEmail: user.email,
            originalVoucherId: voucherId,
            code: voucherCode,
            title: voucher.title,
            description: voucher.description,
            type: voucher.voucherType,
            value: voucher.voucherValue,
            minOrderAmount: voucher.minOrderAmount,
            maxDiscount: voucher.maxDiscount,
            pointsCost: voucher.pointsCost,
            isActive: true,
            isUsed: false,
            redeemedAt: serverTimestamp(),
            expiresAt: expiryDate,
            usedAt: null
        };
        
        // Save redeemed voucher
        await setDoc(doc(db, 'redeemedVouchers', voucherCode), redeemedVoucherData);
        
        // Create actual voucher for checkout use
        const checkoutVoucherData = {
            type: voucher.voucherType,
            value: voucher.voucherValue,
            minOrderAmount: voucher.minOrderAmount,
            maxDiscount: voucher.maxDiscount,
            isActive: true,
            expiresAt: expiryDate,
            usageLimit: 1,
            usedCount: 0,
            createdAt: serverTimestamp(),
            createdBy: 'loyalty_program',
            userId: user.uid // Restrict to specific user
        };
        
        await setDoc(doc(db, 'vouchers', voucherCode), checkoutVoucherData);
        
        // Deduct points from user
        const userRef = doc(db, 'users', user.uid);
        const newPoints = userPoints - voucher.pointsCost;
        
        await updateDoc(userRef, {
            loyaltyPoints: newPoints,
            lastVoucherRedemption: serverTimestamp()
        });
        
        // Record points transaction
        await recordPointsTransaction(user.uid, -voucher.pointsCost, 'voucher_redemption', {
            voucherCode: voucherCode,
            voucherTitle: voucher.title
        });
        
        // Update app state
        window.pickliSHApp.loyaltyPoints = newPoints;
        
        // Show success message with voucher code
        showVoucherRedemptionSuccess(voucherCode, voucher.title);
        
        // Reload loyalty data
        loadLoyaltyData();
        
    } catch (error) {
        console.error('Error redeeming voucher:', error);
        showNotification('Error redeeming voucher. Please try again.', 'error');
    }
};

// Generate unique voucher code
function generateVoucherCode(baseId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${baseId}_${timestamp}_${random}`.toUpperCase();
}

// Show voucher redemption success modal
function showVoucherRedemptionSuccess(voucherCode, voucherTitle) {
    const modalHTML = `
        <div class="modal fade" id="voucherSuccessModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-body text-center p-4">
                        <i class="fas fa-check-circle fa-4x text-success mb-3"></i>
                        <h4 class="mb-3">Voucher Redeemed Successfully!</h4>
                        <div class="voucher-code-display mb-4">
                            <h5 class="text-primary">${voucherTitle}</h5>
                            <div class="voucher-code bg-light p-3 rounded">
                                <code class="h5">${voucherCode}</code>
                                <button class="btn btn-sm btn-outline-secondary ms-2" onclick="copyVoucherCode('${voucherCode}')">
                                    <i class="fas fa-copy"></i> Copy
                                </button>
                            </div>
                        </div>
                        <p class="text-muted mb-4">Use this code during checkout to get your discount!</p>
                        <div class="d-flex gap-2 justify-content-center">
                            <button class="btn btn-primary" onclick="showShop(); closeVoucherSuccessModal();">
                                Start Shopping
                            </button>
                            <button class="btn btn-outline-secondary" onclick="closeVoucherSuccessModal();">
                                Close
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
    const modal = new bootstrap.Modal(document.getElementById('voucherSuccessModal'));
    modal.show();
}

// Copy voucher code to clipboard
window.copyVoucherCode = function(code) {
    navigator.clipboard.writeText(code).then(() => {
        showNotification('Voucher code copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Voucher code copied to clipboard!', 'success');
    });
};

// Close voucher success modal
window.closeVoucherSuccessModal = function() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('voucherSuccessModal'));
    if (modal) {
        modal.hide();
    }
    
    const modalElement = document.getElementById('voucherSuccessModal');
    if (modalElement) {
        modalElement.remove();
    }
};

// Redeem voucher code manually
window.redeemVoucher = async function() {
    const voucherCodeInput = document.getElementById('voucherCode');
    const voucherCode = voucherCodeInput.value.trim().toUpperCase();
    
    if (!voucherCode) {
        showNotification('Please enter a voucher code', 'error');
        return;
    }
    
    const user = window.pickliSHApp.user;
    if (!user) {
        showNotification('Please sign in to redeem vouchers', 'error');
        return;
    }
    
    try {
        showNotification('Validating voucher code...', 'info');
        
        // Check if voucher exists in redeemed vouchers
        const redeemedVoucherRef = doc(db, 'redeemedVouchers', voucherCode);
        const redeemedVoucherSnap = await getDoc(redeemedVoucherRef);
        
        if (!redeemedVoucherSnap.exists()) {
            showNotification('Invalid voucher code', 'error');
            return;
        }
        
        const redeemedVoucher = redeemedVoucherSnap.data();
        
        // Check if voucher belongs to current user
        if (redeemedVoucher.userId !== user.uid) {
            showNotification('This voucher does not belong to your account', 'error');
            return;
        }
        
        // Check if voucher is already used
        if (redeemedVoucher.isUsed) {
            showNotification('This voucher has already been used', 'error');
            return;
        }
        
        // Check if voucher is expired
        if (redeemedVoucher.expiresAt && redeemedVoucher.expiresAt.toDate() < new Date()) {
            showNotification('This voucher has expired', 'error');
            return;
        }
        
        // Show voucher details
        showVoucherDetails(redeemedVoucher);
        
        // Clear input
        voucherCodeInput.value = '';
        
    } catch (error) {
        console.error('Error redeeming voucher:', error);
        showNotification('Error validating voucher code', 'error');
    }
};

// Show voucher details
function showVoucherDetails(voucher) {
    const modalHTML = `
        <div class="modal fade" id="voucherDetailsModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Voucher Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="voucher-info">
                            <h6 class="text-primary">${voucher.title}</h6>
                            <p class="mb-3">${voucher.description}</p>
                            
                            <div class="voucher-details">
                                <div class="row">
                                    <div class="col-6">
                                        <strong>Discount:</strong>
                                    </div>
                                    <div class="col-6">
                                        ${voucher.type === 'percentage' ? `${voucher.value}%` : voucher.type === 'fixed' ? `₹${voucher.value}` : 'Free Shipping'}
                                    </div>
                                </div>
                                ${voucher.minOrderAmount > 0 ? `
                                    <div class="row">
                                        <div class="col-6">
                                            <strong>Min Order:</strong>
                                        </div>
                                        <div class="col-6">
                                            ₹${voucher.minOrderAmount}
                                        </div>
                                    </div>
                                ` : ''}
                                ${voucher.maxDiscount > 0 ? `
                                    <div class="row">
                                        <div class="col-6">
                                            <strong>Max Discount:</strong>
                                        </div>
                                        <div class="col-6">
                                            ₹${voucher.maxDiscount}
                                        </div>
                                    </div>
                                ` : ''}
                                <div class="row">
                                    <div class="col-6">
                                        <strong>Expires:</strong>
                                    </div>
                                    <div class="col-6">
                                        ${formatDate(voucher.expiresAt.toDate())}
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-6">
                                        <strong>Code:</strong>
                                    </div>
                                    <div class="col-6">
                                        <code>${voucher.code}</code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="goToShopWithVoucher('${voucher.code}')">
                            Use This Voucher
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('voucherDetailsModal'));
    modal.show();
    
    // Remove modal when hidden
    modal._element.addEventListener('hidden.bs.modal', function() {
        document.getElementById('voucherDetailsModal').remove();
    });
}

// Go to shop with pre-filled voucher
window.goToShopWithVoucher = function(voucherCode) {
    // Store voucher code for auto-apply
    sessionStorage.setItem('autoApplyVoucher', voucherCode);
    
    // Close modal and navigate to shop
    const modal = bootstrap.Modal.getInstance(document.getElementById('voucherDetailsModal'));
    modal.hide();
    
    showShop();
    showNotification('Voucher ready to use! Add items to cart and proceed to checkout.', 'success');
};

// Load points history
async function loadPointsHistory(userId) {
    try {
        const pointsHistoryQuery = query(
            collection(db, 'pointsHistory'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
        
        const historySnapshot = await getDocs(pointsHistoryQuery);
        const history = historySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        displayPointsHistory(history);
        
    } catch (error) {
        console.error('Error loading points history:', error);
        // Show empty history if there's an error
        displayPointsHistory([]);
    }
}

// Display points history
function displayPointsHistory(history) {
    const historyContainer = document.getElementById('pointsHistory');
    if (!historyContainer) return;
    
    if (history.length === 0) {
        historyContainer.innerHTML = `
            <div class="points-history">
                <h6>Recent Activity</h6>
                <div class="text-center py-4">
                    <i class="fas fa-history fa-2x text-muted mb-2"></i>
                    <p class="text-muted">No recent activity</p>
                </div>
            </div>
        `;
        return;
    }
    
    historyContainer.innerHTML = `
        <div class="points-history">
            <h6>Recent Activity</h6>
            <div class="history-list">
                ${history.map(item => `
                    <div class="history-item d-flex justify-content-between align-items-center py-2 border-bottom">
                        <div class="history-details">
                            <div class="history-description">${getHistoryDescription(item)}</div>
                            <small class="text-muted">${formatDate(item.createdAt.toDate())}</small>
                        </div>
                        <div class="history-points">
                            <span class="badge bg-${item.points > 0 ? 'success' : 'danger'}">
                                ${item.points > 0 ? '+' : ''}${item.points}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Get history description based on transaction type
function getHistoryDescription(transaction) {
    const descriptions = {
        'order_purchase': `Order purchase`,
        'review_bonus': 'Review written',
        'voucher_redemption': `Voucher redeemed: ${transaction.details?.voucherTitle || 'Discount'}`,
        'welcome_bonus': 'Welcome bonus',
        'referral_bonus': 'Referral bonus',
        'birthday_bonus': 'Birthday bonus',
        'admin_adjustment': 'Admin adjustment'
    };
    
    return descriptions[transaction.type] || 'Points transaction';
}

// Record points transaction
async function recordPointsTransaction(userId, points, type, details = {}) {
    try {
        const transactionData = {
            userId: userId,
            points: points,
            type: type,
            details: details,
            createdAt: serverTimestamp()
        };
        
        // Generate transaction ID
        const transactionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await setDoc(doc(db, 'pointsHistory', transactionId), transactionData);
        
    } catch (error) {
        console.error('Error recording points transaction:', error);
    }
}

// Award points for various activities
window.awardPoints = async function(userId, points, type, details = {}) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentPoints = userData.loyaltyPoints || 0;
            const currentTier = calculateUserTier(currentPoints);
            const tierMultiplier = LOYALTY_CONFIG.tiers[currentTier].multiplier;
            
            // Apply tier multiplier
            const finalPoints = Math.round(points * tierMultiplier);
            const newTotal = currentPoints + finalPoints;
            
            // Update user points
            await updateDoc(userRef, {
                loyaltyPoints: newTotal,
                lastPointsEarned: finalPoints,
                lastPointsActivity: serverTimestamp()
            });
            
            // Record transaction
            await recordPointsTransaction(userId, finalPoints, type, details);
            
            // Update app state if it's current user
            if (window.pickliSHApp.user && window.pickliSHApp.user.uid === userId) {
                window.pickliSHApp.loyaltyPoints = newTotal;
                
                // Update loyalty display
                const loyaltyPointsElement = document.getElementById('loyaltyPoints');
                if (loyaltyPointsElement) {
                    loyaltyPointsElement.textContent = newTotal.toLocaleString();
                }
            }
            
            return finalPoints;
        }
    } catch (error) {
        console.error('Error awarding points:', error);
        return 0;
    }
};

// Check for tier upgrades
window.checkTierUpgrade = async function(userId, oldPoints, newPoints) {
    const oldTier = calculateUserTier(oldPoints);
    const newTier = calculateUserTier(newPoints);
    
    if (oldTier !== newTier) {
        // User upgraded tier - show congratulations
        showTierUpgradeNotification(newTier);
        
        // Award tier upgrade bonus
        const upgradeBonus = 100; // Base upgrade bonus
        await awardPoints(userId, upgradeBonus, 'tier_upgrade', { 
            oldTier: oldTier, 
            newTier: newTier 
        });
    }
};

// Show tier upgrade notification
function showTierUpgradeNotification(newTier) {
    const tierInfo = LOYALTY_CONFIG.tiers[newTier];
    
    const modalHTML = `
        <div class="modal fade" id="tierUpgradeModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-body text-center p-4">
                        <i class="fas fa-crown fa-4x text-${getTierColor(newTier)} mb-3"></i>
                        <h4 class="mb-3">Congratulations!</h4>
                        <p class="h5 text-${getTierColor(newTier)} mb-3">You've been upgraded to ${tierInfo.name}!</p>
                        <p class="mb-3">You now earn <strong>${tierInfo.multiplier}x</strong> points on all purchases!</p>
                        <p class="text-muted mb-4">Plus, you've earned a 100 points upgrade bonus!</p>
                        <button class="btn btn-primary" onclick="closeTierUpgradeModal();">
                            Awesome!
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('tierUpgradeModal'));
    modal.show();
}

// Close tier upgrade modal
window.closeTierUpgradeModal = function() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('tierUpgradeModal'));
    if (modal) {
        modal.hide();
    }
    
    const modalElement = document.getElementById('tierUpgradeModal');
    if (modalElement) {
        modalElement.remove();
    }
};

// Export functions for use in other modules
window.awardPoints = window.awardPoints;
window.checkTierUpgrade = window.checkTierUpgrade;
window.recordPointsTransaction = recordPointsTransaction;
