// Reviews and Ratings Module
import { db, storage } from './firebase-config.js';
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
import { 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Global variable to track current product being reviewed
window.currentReviewProductId = null;

// Initialize review form
document.addEventListener('DOMContentLoaded', function() {
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) {
        reviewForm.addEventListener('submit', submitReview);
    }
});

// Submit review
async function submitReview(e) {
    e.preventDefault();
    
    const user = window.pickliSHApp.user;
    if (!user) {
        showNotification('Please sign in to submit a review', 'error');
        return;
    }
    
    if (!window.currentReviewProductId) {
        showNotification('No product selected for review', 'error');
        return;
    }
    
    try {
        showNotification('Submitting review...', 'info');
        
        // Get form data
        const rating = parseInt(document.querySelector('input[name="rating"]:checked')?.value);
        const reviewText = document.getElementById('reviewText').value.trim();
        const photoFiles = document.getElementById('reviewPhotos').files;
        
        // Validation
        if (!rating) {
            showNotification('Please select a rating', 'error');
            return;
        }
        
        if (!reviewText) {
            showNotification('Please write a review', 'error');
            return;
        }
        
        if (reviewText.length < 10) {
            showNotification('Review must be at least 10 characters long', 'error');
            return;
        }
        
        // Upload photos if any
        const photoUrls = [];
        if (photoFiles.length > 0) {
            showNotification('Uploading photos...', 'info');
            
            for (let i = 0; i < Math.min(photoFiles.length, 5); i++) { // Limit to 5 photos
                const file = photoFiles[i];
                
                // Validate file type and size
                if (!file.type.startsWith('image/')) {
                    showNotification(`File ${file.name} is not an image`, 'error');
                    continue;
                }
                
                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                    showNotification(`File ${file.name} is too large (max 5MB)`, 'error');
                    continue;
                }
                
                try {
                    const compressedFile = await compressImage(file, 800, 600, 0.8);
                    const photoRef = ref(storage, `reviews/${user.uid}/${Date.now()}_${i}`);
                    const uploadResult = await uploadBytes(photoRef, compressedFile);
                    const photoUrl = await getDownloadURL(uploadResult.ref);
                    photoUrls.push(photoUrl);
                } catch (uploadError) {
                    console.error('Error uploading photo:', uploadError);
                    showNotification(`Failed to upload ${file.name}`, 'error');
                }
            }
        }
        
        // Create review document
        const reviewData = {
            productId: window.currentReviewProductId,
            userId: user.uid,
            userName: user.displayName || user.email,
            userEmail: user.email,
            userAvatar: user.photoURL,
            rating: rating,
            comment: reviewText,
            photos: photoUrls,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            verified: false, // Will be verified if user actually purchased the product
            helpful: 0,
            reported: false
        };
        
        // Check if user has purchased this product
        const hasPurchased = await checkUserPurchaseHistory(user.uid, window.currentReviewProductId);
        if (hasPurchased) {
            reviewData.verified = true;
        }
        
        // Generate review ID
        const reviewId = `${window.currentReviewProductId}_${user.uid}_${Date.now()}`;
        
        // Save review to Firestore
        await setDoc(doc(db, 'reviews', reviewId), reviewData);
        
        // Update product rating
        await updateProductRating(window.currentReviewProductId);
        
        // Clear form
        document.getElementById('reviewForm').reset();
        
        // Close modal
        const reviewModal = bootstrap.Modal.getInstance(document.getElementById('reviewModal'));
        reviewModal.hide();
        
        // Show success message
        showNotification('Review submitted successfully!', 'success');
        
        // Reload product reviews if we're viewing them
        if (document.getElementById('productReviews')) {
            loadProductReviews(window.currentReviewProductId);
        }
        
        // Award loyalty points for review
        await awardReviewPoints(user.uid);
        
    } catch (error) {
        console.error('Error submitting review:', error);
        showNotification('Error submitting review. Please try again.', 'error');
    }
}

// Compress image before upload
function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // Calculate new dimensions
            let { width, height } = img;
            
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// Check if user has purchased the product
async function checkUserPurchaseHistory(userId, productId) {
    try {
        const ordersQuery = query(
            collection(db, 'orders'),
            where('userId', '==', userId),
            where('status', '==', 'delivered')
        );
        
        const ordersSnapshot = await getDocs(ordersQuery);
        
        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            if (order.items && order.items.some(item => item.id === productId)) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error checking purchase history:', error);
        return false;
    }
}

// Update product rating based on reviews
async function updateProductRating(productId) {
    try {
        const reviewsQuery = query(
            collection(db, 'reviews'),
            where('productId', '==', productId)
        );
        
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviews = reviewsSnapshot.docs.map(doc => doc.data());
        
        if (reviews.length === 0) return;
        
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / reviews.length;
        
        // Update product document
        const productRef = doc(db, 'products', productId);
        await updateDoc(productRef, {
            rating: parseFloat(averageRating.toFixed(1)),
            reviewCount: reviews.length,
            updatedAt: serverTimestamp()
        });
        
    } catch (error) {
        console.error('Error updating product rating:', error);
    }
}

// Award loyalty points for writing a review
async function awardReviewPoints(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentPoints = userData.loyaltyPoints || 0;
            const reviewPoints = 10; // Points awarded for writing a review
            
            await updateDoc(userRef, {
                loyaltyPoints: currentPoints + reviewPoints,
                lastReviewAt: serverTimestamp()
            });
            
            // Update app state
            window.pickliSHApp.loyaltyPoints = currentPoints + reviewPoints;
            
            showNotification(`You earned ${reviewPoints} loyalty points for your review!`, 'success');
        }
    } catch (error) {
        console.error('Error awarding review points:', error);
    }
}

// Load product reviews (imported from shop.js)
window.loadProductReviews = async function(productId) {
    try {
        const reviewsContainer = document.getElementById('productReviews');
        if (!reviewsContainer) return;
        
        reviewsContainer.innerHTML = `
            <div class="text-center">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading reviews...</span>
                </div>
            </div>
        `;
        
        // Load reviews from Firestore
        const reviewsQuery = query(
            collection(db, 'reviews'),
            where('productId', '==', productId),
            orderBy('createdAt', 'desc')
        );
        
        const reviewsSnapshot = await getDocs(reviewsQuery);
        
        if (reviewsSnapshot.empty) {
            reviewsContainer.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-star fa-3x text-muted mb-3"></i>
                    <h6>No reviews yet</h6>
                    <p class="text-muted">Be the first to review this product!</p>
                    <button class="btn btn-primary" onclick="writeReview('${productId}')">
                        <i class="fas fa-edit"></i> Write a Review
                    </button>
                </div>
            `;
            return;
        }
        
        const reviews = reviewsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Calculate review statistics
        const totalReviews = reviews.length;
        const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;
        const ratingDistribution = calculateRatingDistribution(reviews);
        
        reviewsContainer.innerHTML = `
            <div class="reviews-summary mb-4">
                <div class="row">
                    <div class="col-md-4">
                        <div class="rating-overview text-center">
                            <div class="average-rating display-4 fw-bold text-primary">${averageRating.toFixed(1)}</div>
                            <div class="rating-stars mb-2">
                                ${generateStarRating(averageRating)}
                            </div>
                            <div class="text-muted">${totalReviews} review${totalReviews !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <div class="col-md-5">
                        <div class="rating-breakdown">
                            ${[5,4,3,2,1].map(star => `
                                <div class="d-flex align-items-center mb-1">
                                    <span class="me-2">${star}</span>
                                    <i class="fas fa-star text-warning me-2"></i>
                                    <div class="progress flex-grow-1 me-2" style="height: 8px;">
                                        <div class="progress-bar bg-warning" style="width: ${(ratingDistribution[star] || 0) / totalReviews * 100}%"></div>
                                    </div>
                                    <span class="small text-muted">${ratingDistribution[star] || 0}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="col-md-3">
                        <button class="btn btn-primary w-100" onclick="writeReview('${productId}')">
                            <i class="fas fa-edit"></i> Write a Review
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="reviews-filter mb-3">
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary active" onclick="filterReviews('all')">All</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="filterReviews('verified')">Verified Purchase</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="filterReviews('photos')">With Photos</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="filterReviews('recent')">Most Recent</button>
                </div>
            </div>
            
            <div class="reviews-list" id="reviewsList">
                ${reviews.map(review => generateReviewHTML(review)).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading reviews:', error);
        const reviewsContainer = document.getElementById('productReviews');
        if (reviewsContainer) {
            reviewsContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    Error loading reviews. Please try again.
                </div>
            `;
        }
    }
};

// Calculate rating distribution
function calculateRatingDistribution(reviews) {
    const distribution = {};
    reviews.forEach(review => {
        distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    });
    return distribution;
}

// Generate review HTML
function generateReviewHTML(review) {
    return `
        <div class="review-card mb-3" data-review-id="${review.id}">
            <div class="d-flex mb-3">
                <div class="review-avatar me-3">
                    <img src="${review.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userName)}&background=e67e22&color=fff`}" 
                         alt="${review.userName}" class="rounded-circle" width="50" height="50">
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="mb-1">
                                ${review.userName}
                                ${review.verified ? '<i class="fas fa-check-circle text-success ms-1" title="Verified Purchase"></i>' : ''}
                            </h6>
                            <div class="rating-display mb-1">
                                ${generateStarRating(review.rating)}
                            </div>
                        </div>
                        <small class="text-muted">${formatDate(review.createdAt.toDate())}</small>
                    </div>
                    <p class="review-comment mb-2">${review.comment}</p>
                    
                    ${review.photos && review.photos.length > 0 ? `
                        <div class="review-photos mb-3">
                            <div class="d-flex gap-2 flex-wrap">
                                ${review.photos.map((photo, index) => `
                                    <img src="${photo}" alt="Review photo ${index + 1}" 
                                         class="review-photo rounded cursor-pointer" 
                                         width="80" height="80" 
                                         style="object-fit: cover;"
                                         onclick="viewReviewPhoto('${photo}', ${JSON.stringify(review.photos).replace(/"/g, '&quot;')})">
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="review-actions">
                        <button class="btn btn-sm btn-outline-secondary me-2" onclick="markReviewHelpful('${review.id}')">
                            <i class="fas fa-thumbs-up"></i> Helpful (${review.helpful || 0})
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="reportReview('${review.id}')">
                            <i class="fas fa-flag"></i> Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Generate star rating HTML
function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHTML = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
        starsHTML += '<i class="fas fa-star text-warning"></i>';
    }
    
    // Half star
    if (hasHalfStar) {
        starsHTML += '<i class="fas fa-star-half-alt text-warning"></i>';
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<i class="far fa-star text-warning"></i>';
    }
    
    return starsHTML;
}

// View review photo in modal
window.viewReviewPhoto = function(photoUrl, allPhotos) {
    const photos = JSON.parse(allPhotos.replace(/&quot;/g, '"'));
    const currentIndex = photos.indexOf(photoUrl);
    
    const modalHTML = `
        <div class="modal fade" id="photoViewerModal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Review Photo ${currentIndex + 1} of ${photos.length}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img src="${photoUrl}" alt="Review photo" class="img-fluid rounded" style="max-height: 70vh;">
                        
                        ${photos.length > 1 ? `
                            <div class="photo-navigation mt-3">
                                <button class="btn btn-outline-secondary me-2" onclick="navigatePhoto(-1)" ${currentIndex === 0 ? 'disabled' : ''}>
                                    <i class="fas fa-chevron-left"></i> Previous
                                </button>
                                <button class="btn btn-outline-secondary" onclick="navigatePhoto(1)" ${currentIndex === photos.length - 1 ? 'disabled' : ''}>
                                    Next <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                            
                            <div class="photo-thumbnails mt-3 d-flex justify-content-center gap-2">
                                ${photos.map((photo, index) => `
                                    <img src="${photo}" alt="Thumbnail ${index + 1}" 
                                         class="thumbnail ${index === currentIndex ? 'active' : ''}" 
                                         width="60" height="60" 
                                         style="object-fit: cover; cursor: pointer; border: 2px solid ${index === currentIndex ? '#e67e22' : 'transparent'};"
                                         onclick="switchPhoto('${photo}', ${index})">
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Store photos data for navigation
    window.currentPhotoData = { photos, currentIndex };
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('photoViewerModal'));
    modal.show();
    
    // Remove modal when hidden
    modal._element.addEventListener('hidden.bs.modal', function() {
        document.getElementById('photoViewerModal').remove();
        delete window.currentPhotoData;
    });
};

// Navigate photos in viewer
window.navigatePhoto = function(direction) {
    const { photos, currentIndex } = window.currentPhotoData;
    const newIndex = currentIndex + direction;
    
    if (newIndex >= 0 && newIndex < photos.length) {
        window.currentPhotoData.currentIndex = newIndex;
        switchPhoto(photos[newIndex], newIndex);
    }
};

// Switch to specific photo
window.switchPhoto = function(photoUrl, index) {
    const modalImg = document.querySelector('#photoViewerModal img');
    const modalTitle = document.querySelector('#photoViewerModal .modal-title');
    const { photos } = window.currentPhotoData;
    
    modalImg.src = photoUrl;
    modalTitle.textContent = `Review Photo ${index + 1} of ${photos.length}`;
    
    // Update thumbnails
    document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
        thumb.style.border = i === index ? '2px solid #e67e22' : '2px solid transparent';
    });
    
    // Update navigation buttons
    const prevBtn = document.querySelector('#photoViewerModal .btn:has(.fa-chevron-left)');
    const nextBtn = document.querySelector('#photoViewerModal .btn:has(.fa-chevron-right)');
    
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === photos.length - 1;
    
    window.currentPhotoData.currentIndex = index;
};

// Mark review as helpful
window.markReviewHelpful = async function(reviewId) {
    if (!window.pickliSHApp.user) {
        showNotification('Please sign in to mark reviews as helpful', 'error');
        return;
    }
    
    try {
        const reviewRef = doc(db, 'reviews', reviewId);
        const reviewSnap = await getDoc(reviewRef);
        
        if (reviewSnap.exists()) {
            const review = reviewSnap.data();
            const currentHelpful = review.helpful || 0;
            
            await updateDoc(reviewRef, {
                helpful: currentHelpful + 1,
                helpfulUsers: [...(review.helpfulUsers || []), window.pickliSHApp.user.uid]
            });
            
            // Update UI
            const helpfulBtn = document.querySelector(`[onclick="markReviewHelpful('${reviewId}')"]`);
            if (helpfulBtn) {
                helpfulBtn.innerHTML = `<i class="fas fa-thumbs-up"></i> Helpful (${currentHelpful + 1})`;
                helpfulBtn.disabled = true;
                helpfulBtn.classList.add('btn-success');
                helpfulBtn.classList.remove('btn-outline-secondary');
            }
            
            showNotification('Thank you for your feedback!', 'success');
        }
    } catch (error) {
        console.error('Error marking review as helpful:', error);
        showNotification('Error processing your feedback', 'error');
    }
};

// Report review
window.reportReview = async function(reviewId) {
    if (!window.pickliSHApp.user) {
        showNotification('Please sign in to report reviews', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to report this review?')) {
        return;
    }
    
    try {
        const reviewRef = doc(db, 'reviews', reviewId);
        await updateDoc(reviewRef, {
            reported: true,
            reportedBy: window.pickliSHApp.user.uid,
            reportedAt: serverTimestamp()
        });
        
        showNotification('Review reported. Thank you for helping us maintain quality.', 'success');
        
        // Update UI
        const reportBtn = document.querySelector(`[onclick="reportReview('${reviewId}')"]`);
        if (reportBtn) {
            reportBtn.innerHTML = '<i class="fas fa-flag"></i> Reported';
            reportBtn.disabled = true;
            reportBtn.classList.add('btn-danger');
            reportBtn.classList.remove('btn-outline-danger');
        }
        
    } catch (error) {
        console.error('Error reporting review:', error);
        showNotification('Error reporting review', 'error');
    }
};

// Filter reviews
window.filterReviews = function(filterType) {
    const reviewsList = document.getElementById('reviewsList');
    const reviews = reviewsList.querySelectorAll('.review-card');
    
    // Update filter buttons
    document.querySelectorAll('.reviews-filter .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    reviews.forEach(reviewCard => {
        let show = false;
        
        switch(filterType) {
            case 'all':
                show = true;
                break;
            case 'verified':
                show = reviewCard.querySelector('.fa-check-circle') !== null;
                break;
            case 'photos':
                show = reviewCard.querySelector('.review-photos') !== null;
                break;
            case 'recent':
                // Show reviews from last 30 days
                const reviewDate = new Date(reviewCard.querySelector('.text-muted').textContent);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                show = reviewDate >= thirtyDaysAgo;
                break;
        }
        
        reviewCard.style.display = show ? 'block' : 'none';
    });
};

// Load user reviews for profile page
window.loadUserReviews = async function() {
    const profileContent = document.getElementById('profileContent');
    const user = window.pickliSHApp.user;
    
    if (!user) return;
    
    try {
        profileContent.innerHTML = `
            <div class="reviews-section">
                <h4>My Reviews</h4>
                <div class="text-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading reviews...</span>
                    </div>
                </div>
            </div>
        `;
        
        const userReviewsQuery = query(
            collection(db, 'reviews'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        
        const reviewsSnapshot = await getDocs(userReviewsQuery);
        
        if (reviewsSnapshot.empty) {
            profileContent.innerHTML = `
                <div class="reviews-section">
                    <h4>My Reviews</h4>
                    <div class="text-center py-5">
                        <i class="fas fa-star fa-3x text-muted mb-3"></i>
                        <h6>No reviews yet</h6>
                        <p class="text-muted">Start shopping and share your experience!</p>
                        <button class="btn btn-primary" onclick="showShop()">Browse Products</button>
                    </div>
                </div>
            `;
            return;
        }
        
        const reviews = reviewsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Load product details for each review
        const reviewsWithProducts = await Promise.all(
            reviews.map(async (review) => {
                try {
                    const productSnap = await getDoc(doc(db, 'products', review.productId));
                    return {
                        ...review,
                        product: productSnap.exists() ? productSnap.data() : null
                    };
                } catch (error) {
                    console.error('Error loading product for review:', error);
                    return { ...review, product: null };
                }
            })
        );
        
        profileContent.innerHTML = `
            <div class="reviews-section">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h4>My Reviews (${reviews.length})</h4>
                    <div class="review-stats">
                        <span class="badge bg-primary">${reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0} avg rating</span>
                    </div>
                </div>
                
                <div class="user-reviews-list">
                    ${reviewsWithProducts.map(review => `
                        <div class="review-card mb-4">
                            <div class="row">
                                <div class="col-md-3">
                                    ${review.product ? `
                                        <div class="product-info">
                                            <div class="product-image mb-2" style="background: linear-gradient(135deg, #e67e22, #f39c12); height: 80px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">
                                                <i class="fas fa-pepper-hot fa-2x"></i>
                                            </div>
                                            <h6 class="mb-1">${review.product.name}</h6>
                                            <small class="text-muted">${review.product.category}</small>
                                        </div>
                                    ` : `
                                        <div class="text-muted">Product not found</div>
                                    `}
                                </div>
                                <div class="col-md-9">
                                    <div class="review-content">
                                        <div class="d-flex justify-content-between align-items-start mb-2">
                                            <div class="rating-display">
                                                ${generateStarRating(review.rating)}
                                                ${review.verified ? '<i class="fas fa-check-circle text-success ms-2" title="Verified Purchase"></i>' : ''}
                                            </div>
                                            <small class="text-muted">${formatDate(review.createdAt.toDate())}</small>
                                        </div>
                                        <p class="mb-2">${review.comment}</p>
                                        
                                        ${review.photos && review.photos.length > 0 ? `
                                            <div class="review-photos mb-3">
                                                ${review.photos.map(photo => `
                                                    <img src="${photo}" alt="Review photo" class="review-photo me-2" width="60" height="60" onclick="viewReviewPhoto('${photo}', ${JSON.stringify(review.photos).replace(/"/g, '&quot;')})">
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                        
                                        <div class="review-stats">
                                            <small class="text-muted">
                                                <i class="fas fa-thumbs-up"></i> ${review.helpful || 0} helpful
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading user reviews:', error);
        profileContent.innerHTML = `
            <div class="reviews-section">
                <h4>My Reviews</h4>
                <div class="error-message">
                    Error loading reviews. Please try again.
                </div>
            </div>
        `;
    }
};
