// Payment Processing Module with Razorpay Integration
import { db } from './firebase-config.js';
import { 
    doc, 
    setDoc, 
    updateDoc, 
    getDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Razorpay configuration
const RAZORPAY_CONFIG = {
    keyId: window.RAZORPAY_KEY_ID || 'rzp_test_your_key_id', // Should be set in environment
    currency: 'INR',
    theme: {
        color: '#e67e22'
    }
};

// Payment status constants
const PAYMENT_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded'
};

// Initialize payment for order
window.initializeOrderPayment = async function(orderData) {
    try {
        const user = window.pickliSHApp.user;
        if (!user) {
            throw new Error('User not authenticated');
        }
        
        // Generate order ID
        const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Prepare order document
        const orderDocument = {
            ...orderData,
            id: orderId,
            userId: user.uid,
            userEmail: user.email,
            status: 'pending',
            paymentStatus: PAYMENT_STATUS.PENDING,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        // Save order to Firestore
        await setDoc(doc(db, 'orders', orderId), orderDocument);
        
        // Create Razorpay order
        const razorpayOrder = await createRazorpayOrder(orderId, orderData.total);
        
        // Initialize Razorpay payment
        const paymentResult = await processRazorpayPayment(razorpayOrder, orderDocument);
        
        return paymentResult;
        
    } catch (error) {
        console.error('Error initializing payment:', error);
        throw error;
    }
};

// Create Razorpay order
async function createRazorpayOrder(orderId, amount) {
    // In a real implementation, this would call your backend API
    // For demo purposes, we're creating a mock order object
    return {
        id: `razorpay_${orderId}`,
        amount: amount * 100, // Convert to paise
        currency: RAZORPAY_CONFIG.currency,
        status: 'created'
    };
}

// Process Razorpay payment
function processRazorpayPayment(razorpayOrder, orderData) {
    return new Promise((resolve, reject) => {
        const user = window.pickliSHApp.user;
        
        const options = {
            key: RAZORPAY_CONFIG.keyId,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            name: 'Picklish Foods',
            description: `Order #${orderData.id.substring(0, 8).toUpperCase()}`,
            image: '/favicon.ico',
            order_id: razorpayOrder.id,
            
            handler: async function(response) {
                try {
                    const paymentResult = await handlePaymentSuccess(response, orderData);
                    resolve(paymentResult);
                } catch (error) {
                    reject(error);
                }
            },
            
            prefill: {
                name: user.displayName || '',
                email: user.email || '',
                contact: user.phoneNumber || ''
            },
            
            notes: {
                order_id: orderData.id,
                user_id: user.uid,
                items_count: orderData.items.length
            },
            
            theme: RAZORPAY_CONFIG.theme,
            
            modal: {
                ondismiss: function() {
                    handlePaymentCancellation(orderData.id);
                    reject(new Error('Payment cancelled by user'));
                }
            }
        };
        
        const rzp = new Razorpay(options);
        
        rzp.on('payment.failed', function(response) {
            handlePaymentFailure(response, orderData.id);
            reject(new Error(response.error.description || 'Payment failed'));
        });
        
        rzp.open();
    });
}

// Handle successful payment
async function handlePaymentSuccess(response, orderData) {
    try {
        showNotification('Payment successful! Processing order...', 'success');
        
        // Verify payment signature (in production, this should be done on server)
        const isValidSignature = await verifyPaymentSignature(response);
        
        if (!isValidSignature) {
            throw new Error('Payment signature verification failed');
        }
        
        // Update order with payment details
        const orderUpdate = {
            paymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            paymentSignature: response.razorpay_signature,
            paymentStatus: PAYMENT_STATUS.COMPLETED,
            status: 'confirmed',
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'orders', orderData.id), orderUpdate);
        
        // Process post-payment activities
        await processPostPaymentActivities(orderData);
        
        // Create payment record
        await createPaymentRecord(response, orderData);
        
        return {
            success: true,
            orderId: orderData.id,
            paymentId: response.razorpay_payment_id,
            message: 'Payment completed successfully'
        };
        
    } catch (error) {
        console.error('Error processing payment success:', error);
        
        // Update order status to payment processing failed
        await updateDoc(doc(db, 'orders', orderData.id), {
            paymentStatus: PAYMENT_STATUS.FAILED,
            status: 'payment_failed',
            paymentError: error.message,
            updatedAt: serverTimestamp()
        });
        
        throw error;
    }
}

// Verify payment signature (simplified version)
async function verifyPaymentSignature(response) {
    // In production, this verification should be done on your backend server
    // using Razorpay's webhook or payment verification API
    
    try {
        // For demo purposes, we'll assume signature is valid
        // In real implementation, you would:
        // 1. Send payment details to your backend
        // 2. Backend verifies with Razorpay
        // 3. Backend returns verification result
        
        return true;
    } catch (error) {
        console.error('Payment signature verification failed:', error);
        return false;
    }
}

// Handle payment failure
async function handlePaymentFailure(response, orderId) {
    try {
        console.error('Payment failed:', response);
        
        const errorDetails = {
            code: response.error.code,
            description: response.error.description,
            source: response.error.source,
            step: response.error.step,
            reason: response.error.reason
        };
        
        // Update order status
        await updateDoc(doc(db, 'orders', orderId), {
            paymentStatus: PAYMENT_STATUS.FAILED,
            status: 'payment_failed',
            paymentError: errorDetails,
            failedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // Create failed payment record
        await createFailedPaymentRecord(response, orderId);
        
        showNotification(`Payment failed: ${response.error.description}`, 'error');
        
    } catch (error) {
        console.error('Error handling payment failure:', error);
    }
}

// Handle payment cancellation
async function handlePaymentCancellation(orderId) {
    try {
        await updateDoc(doc(db, 'orders', orderId), {
            paymentStatus: PAYMENT_STATUS.CANCELLED,
            status: 'cancelled',
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        showNotification('Payment was cancelled', 'info');
        
    } catch (error) {
        console.error('Error handling payment cancellation:', error);
    }
}

// Process post-payment activities
async function processPostPaymentActivities(orderData) {
    try {
        const user = window.pickliSHApp.user;
        
        // Update voucher usage if applicable
        if (orderData.appliedVoucher) {
            await updateVoucherUsage(orderData.appliedVoucher, user.uid);
        }
        
        // Award loyalty points
        const pointsEarned = await awardOrderPoints(user.uid, orderData.total - (orderData.discountAmount || 0));
        
        // Update user statistics
        await updateUserOrderStats(user.uid, orderData.total);
        
        // Send order confirmation (in production, this would trigger email/SMS)
        await sendOrderConfirmation(orderData);
        
        // Check for tier upgrade
        if (window.checkTierUpgrade) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const oldPoints = (userData.loyaltyPoints || 0) - pointsEarned;
                await window.checkTierUpgrade(user.uid, oldPoints, userData.loyaltyPoints);
            }
        }
        
    } catch (error) {
        console.error('Error in post-payment processing:', error);
        // Don't throw error as payment was successful
    }
}

// Award loyalty points for order
async function awardOrderPoints(userId, orderAmount) {
    try {
        const pointsEarned = Math.floor(orderAmount * 0.1); // 1 point per ₹10
        
        if (window.awardPoints) {
            return await window.awardPoints(userId, pointsEarned, 'order_purchase', {
                orderAmount: orderAmount
            });
        }
        
        return pointsEarned;
    } catch (error) {
        console.error('Error awarding order points:', error);
        return 0;
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
            
            await updateDoc(voucherRef, updates);
        }
        
        // Mark redeemed voucher as used if it exists
        const redeemedVoucherRef = doc(db, 'redeemedVouchers', voucherCode);
        const redeemedVoucherSnap = await getDoc(redeemedVoucherRef);
        
        if (redeemedVoucherSnap.exists()) {
            await updateDoc(redeemedVoucherRef, {
                isUsed: true,
                usedAt: serverTimestamp()
            });
        }
        
    } catch (error) {
        console.error('Error updating voucher usage:', error);
    }
}

// Update user order statistics
async function updateUserOrderStats(userId, orderAmount) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            await updateDoc(userRef, {
                totalSpent: (userData.totalSpent || 0) + orderAmount,
                orderCount: (userData.orderCount || 0) + 1,
                lastOrderAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
    } catch (error) {
        console.error('Error updating user order stats:', error);
    }
}

// Create payment record
async function createPaymentRecord(response, orderData) {
    try {
        const paymentRecord = {
            orderId: orderData.id,
            userId: orderData.userId,
            paymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
            amount: orderData.total,
            currency: RAZORPAY_CONFIG.currency,
            status: PAYMENT_STATUS.COMPLETED,
            method: 'razorpay',
            createdAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'payments', response.razorpay_payment_id), paymentRecord);
        
    } catch (error) {
        console.error('Error creating payment record:', error);
    }
}

// Create failed payment record
async function createFailedPaymentRecord(response, orderId) {
    try {
        const failedPaymentId = `failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const failedPaymentRecord = {
            orderId: orderId,
            userId: window.pickliSHApp.user?.uid,
            error: response.error,
            status: PAYMENT_STATUS.FAILED,
            method: 'razorpay',
            createdAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'failedPayments', failedPaymentId), failedPaymentRecord);
        
    } catch (error) {
        console.error('Error creating failed payment record:', error);
    }
}

// Send order confirmation
async function sendOrderConfirmation(orderData) {
    try {
        // In production, this would trigger email/SMS notifications
        // For now, we'll create a notification record
        
        const notificationData = {
            userId: orderData.userId,
            type: 'order_confirmation',
            title: 'Order Confirmed',
            message: `Your order #${orderData.id.substring(0, 8).toUpperCase()} has been confirmed and will be processed soon.`,
            orderId: orderData.id,
            read: false,
            createdAt: serverTimestamp()
        };
        
        const notificationId = `${orderData.userId}_${Date.now()}`;
        await setDoc(doc(db, 'notifications', notificationId), notificationData);
        
    } catch (error) {
        console.error('Error sending order confirmation:', error);
    }
}

// Initialize subscription payment
window.initializeSubscriptionPayment = async function(subscriptionData) {
    try {
        const user = window.pickliSHApp.user;
        if (!user) {
            throw new Error('User not authenticated');
        }
        
        // Create Razorpay order for subscription
        const razorpayOrder = await createRazorpayOrder(subscriptionData.id, subscriptionData.finalPrice);
        
        // Process subscription payment
        const paymentResult = await processSubscriptionPayment(razorpayOrder, subscriptionData);
        
        return paymentResult;
        
    } catch (error) {
        console.error('Error initializing subscription payment:', error);
        throw error;
    }
};

// Process subscription payment
function processSubscriptionPayment(razorpayOrder, subscriptionData) {
    return new Promise((resolve, reject) => {
        const user = window.pickliSHApp.user;
        
        const options = {
            key: RAZORPAY_CONFIG.keyId,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            name: 'Picklish Foods',
            description: `${subscriptionData.planName} Subscription`,
            image: '/favicon.ico',
            order_id: razorpayOrder.id,
            
            handler: async function(response) {
                try {
                    const result = await handleSubscriptionPaymentSuccess(response, subscriptionData);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            },
            
            prefill: {
                name: user.displayName || '',
                email: user.email || '',
                contact: user.phoneNumber || ''
            },
            
            notes: {
                subscription_id: subscriptionData.id,
                user_id: user.uid,
                plan_id: subscriptionData.planId
            },
            
            theme: RAZORPAY_CONFIG.theme,
            
            modal: {
                ondismiss: function() {
                    handleSubscriptionPaymentCancellation(subscriptionData.id);
                    reject(new Error('Subscription payment cancelled'));
                }
            }
        };
        
        const rzp = new Razorpay(options);
        
        rzp.on('payment.failed', function(response) {
            handleSubscriptionPaymentFailure(response, subscriptionData.id);
            reject(new Error(response.error.description || 'Subscription payment failed'));
        });
        
        rzp.open();
    });
}

// Handle successful subscription payment
async function handleSubscriptionPaymentSuccess(response, subscriptionData) {
    try {
        showNotification('Subscription payment successful! Activating subscription...', 'success');
        
        // Update subscription with payment details
        const subscriptionUpdate = {
            paymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            paymentSignature: response.razorpay_signature,
            paymentStatus: PAYMENT_STATUS.COMPLETED,
            status: 'active',
            activatedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, 'subscriptions', subscriptionData.id), subscriptionUpdate);
        
        // Create subscription payment record
        await createSubscriptionPaymentRecord(response, subscriptionData);
        
        // Award loyalty points for subscription
        const pointsEarned = await awardOrderPoints(subscriptionData.userId, subscriptionData.finalPrice);
        
        // Send subscription confirmation
        await sendSubscriptionConfirmation(subscriptionData);
        
        return {
            success: true,
            subscriptionId: subscriptionData.id,
            paymentId: response.razorpay_payment_id,
            message: 'Subscription activated successfully'
        };
        
    } catch (error) {
        console.error('Error processing subscription payment success:', error);
        
        // Update subscription status to payment failed
        await updateDoc(doc(db, 'subscriptions', subscriptionData.id), {
            paymentStatus: PAYMENT_STATUS.FAILED,
            status: 'payment_failed',
            paymentError: error.message,
            updatedAt: serverTimestamp()
        });
        
        throw error;
    }
}

// Handle subscription payment failure
async function handleSubscriptionPaymentFailure(response, subscriptionId) {
    try {
        await updateDoc(doc(db, 'subscriptions', subscriptionId), {
            paymentStatus: PAYMENT_STATUS.FAILED,
            status: 'payment_failed',
            paymentError: response.error,
            failedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        showNotification(`Subscription payment failed: ${response.error.description}`, 'error');
        
    } catch (error) {
        console.error('Error handling subscription payment failure:', error);
    }
}

// Handle subscription payment cancellation
async function handleSubscriptionPaymentCancellation(subscriptionId) {
    try {
        await updateDoc(doc(db, 'subscriptions', subscriptionId), {
            paymentStatus: PAYMENT_STATUS.CANCELLED,
            status: 'cancelled',
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        showNotification('Subscription payment was cancelled', 'info');
        
    } catch (error) {
        console.error('Error handling subscription payment cancellation:', error);
    }
}

// Create subscription payment record
async function createSubscriptionPaymentRecord(response, subscriptionData) {
    try {
        const paymentRecord = {
            subscriptionId: subscriptionData.id,
            userId: subscriptionData.userId,
            paymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
            amount: subscriptionData.finalPrice,
            currency: RAZORPAY_CONFIG.currency,
            status: PAYMENT_STATUS.COMPLETED,
            method: 'razorpay',
            type: 'subscription',
            planId: subscriptionData.planId,
            createdAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'subscriptionPayments', response.razorpay_payment_id), paymentRecord);
        
    } catch (error) {
        console.error('Error creating subscription payment record:', error);
    }
}

// Send subscription confirmation
async function sendSubscriptionConfirmation(subscriptionData) {
    try {
        const notificationData = {
            userId: subscriptionData.userId,
            type: 'subscription_confirmation',
            title: 'Subscription Activated',
            message: `Your ${subscriptionData.planName} subscription has been activated successfully!`,
            subscriptionId: subscriptionData.id,
            read: false,
            createdAt: serverTimestamp()
        };
        
        const notificationId = `${subscriptionData.userId}_sub_${Date.now()}`;
        await setDoc(doc(db, 'notifications', notificationId), notificationData);
        
    } catch (error) {
        console.error('Error sending subscription confirmation:', error);
    }
}

// Refund payment
window.processRefund = async function(paymentId, orderId, amount, reason) {
    try {
        // In production, this would call Razorpay's refund API
        const refundData = {
            paymentId: paymentId,
            orderId: orderId,
            amount: amount * 100, // Convert to paise
            reason: reason,
            status: 'processing',
            requestedAt: serverTimestamp(),
            requestedBy: window.pickliSHApp.user?.uid
        };
        
        const refundId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(doc(db, 'refunds', refundId), refundData);
        
        // Update order status
        await updateDoc(doc(db, 'orders', orderId), {
            refundStatus: 'processing',
            refundRequestedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        showNotification('Refund request submitted successfully', 'success');
        
        return {
            success: true,
            refundId: refundId,
            message: 'Refund request processed'
        };
        
    } catch (error) {
        console.error('Error processing refund:', error);
        throw error;
    }
};

// Get payment status
window.getPaymentStatus = async function(paymentId) {
    try {
        const paymentRef = doc(db, 'payments', paymentId);
        const paymentSnap = await getDoc(paymentRef);
        
        if (paymentSnap.exists()) {
            return paymentSnap.data();
        }
        
        return null;
    } catch (error) {
        console.error('Error getting payment status:', error);
        return null;
    }
};

// Export payment-related constants and functions
window.PAYMENT_STATUS = PAYMENT_STATUS;
window.initializeOrderPayment = window.initializeOrderPayment;
window.initializeSubscriptionPayment = window.initializeSubscriptionPayment;
window.processRefund = window.processRefund;
window.getPaymentStatus = window.getPaymentStatus;
