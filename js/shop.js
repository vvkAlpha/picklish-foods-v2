// Shop Module - Product Management and Display
import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    query,
    where,
    orderBy 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Product categories with better naming
const PRODUCT_CATEGORIES = {
    'premium-meats': 'Premium Meats',
    'ocean-delights': 'Ocean Delights',
    'garden-fresh': 'Garden Fresh'
};

// Sample products structure - these will be loaded from Google Sheets
let products = [];
let filteredProducts = [];
let currentFilters = {
    categories: [],
    priceRange: 1000,
    sortBy: 'name'
};

// Initialize shop
window.loadShopProducts = async function() {
    try {
        showProductsLoading();
        
        // Load products from Google Sheets or Firestore
        await loadProductsFromDataSource();
        
        // Apply default filters
        filterProducts();
        
    } catch (error) {
        console.error('Error loading products:', error);
        showProductsError();
    }
};

// Load products from data source (Google Sheets + Firestore)
async function loadProductsFromDataSource() {
    try {
        // First try to load from Firestore cache
        const productsSnapshot = await getDocs(collection(db, 'products'));
        
        if (!productsSnapshot.empty) {
            products = productsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } else {
            // Fallback to default products if no data in Firestore
            products = getDefaultProducts();
        }
        
        // Store in app state
        window.pickliSHApp.products = products;
        
    } catch (error) {
        console.error('Error loading products from data source:', error);
        // Use default products as fallback
        products = getDefaultProducts();
        window.pickliSHApp.products = products;
    }
}

// Default products for demo purposes
function getDefaultProducts() {
    return [
        {
            id: 'meat-chicken-pickle',
            name: 'Spicy Chicken Pickle',
            category: 'premium-meats',
            price: 349,
            originalPrice: 399,
            description: 'Tender chicken pieces marinated in authentic spices and preserved in premium oil.',
            ingredients: 'Chicken, Red Chilli, Turmeric, Mustard Oil, Traditional Spices',
            weight: '250g',
            shelfLife: '12 months',
            rating: 4.8,
            reviewCount: 156,
            image: 'chicken-pickle.jpg',
            inStock: true,
            featured: true,
            tags: ['spicy', 'non-veg', 'traditional']
        },
        {
            id: 'meat-mutton-pickle',
            name: 'Royal Mutton Pickle',
            category: 'premium-meats',
            price: 599,
            originalPrice: 649,
            description: 'Premium mutton cooked with royal spices and preserved in mustard oil.',
            ingredients: 'Mutton, Red Chilli, Garam Masala, Mustard Oil, Aromatic Spices',
            weight: '250g',
            shelfLife: '12 months',
            rating: 4.9,
            reviewCount: 89,
            image: 'mutton-pickle.jpg',
            inStock: true,
            featured: true,
            tags: ['premium', 'non-veg', 'royal']
        },
        {
            id: 'seafood-prawn-pickle',
            name: 'Coastal Prawn Pickle',
            category: 'ocean-delights',
            price: 449,
            originalPrice: 499,
            description: 'Fresh prawns from the coast, pickled with traditional coastal spices.',
            ingredients: 'Prawns, Coconut Oil, Curry Leaves, Coastal Spices, Tamarind',
            weight: '200g',
            shelfLife: '6 months',
            rating: 4.7,
            reviewCount: 134,
            image: 'prawn-pickle.jpg',
            inStock: true,
            featured: false,
            tags: ['coastal', 'seafood', 'tangy']
        },
        {
            id: 'seafood-fish-pickle',
            name: 'Traditional Fish Pickle',
            category: 'ocean-delights',
            price: 399,
            originalPrice: 449,
            description: 'Authentic fish pickle made with traditional recipe and fresh catch.',
            ingredients: 'Fish, Mustard Oil, Fenugreek, Traditional Spices, Vinegar',
            weight: '200g',
            shelfLife: '8 months',
            rating: 4.6,
            reviewCount: 201,
            image: 'fish-pickle.jpg',
            inStock: true,
            featured: false,
            tags: ['traditional', 'seafood', 'authentic']
        },
        {
            id: 'veg-mango-pickle',
            name: 'Classic Mango Pickle',
            category: 'garden-fresh',
            price: 199,
            originalPrice: 229,
            description: 'Traditional raw mango pickle with perfect blend of spices.',
            ingredients: 'Raw Mango, Mustard Oil, Red Chilli, Turmeric, Salt, Spices',
            weight: '400g',
            shelfLife: '24 months',
            rating: 4.5,
            reviewCount: 342,
            image: 'mango-pickle.jpg',
            inStock: true,
            featured: true,
            tags: ['classic', 'vegetarian', 'tangy']
        },
        {
            id: 'veg-mixed-pickle',
            name: 'Garden Fresh Mixed Pickle',
            category: 'garden-fresh',
            price: 249,
            originalPrice: 279,
            description: 'A delightful mix of seasonal vegetables pickled to perfection.',
            ingredients: 'Mixed Vegetables, Sesame Oil, Mustard Seeds, Spices, Salt',
            weight: '350g',
            shelfLife: '18 months',
            rating: 4.4,
            reviewCount: 278,
            image: 'mixed-pickle.jpg',
            inStock: true,
            featured: false,
            tags: ['mixed', 'vegetarian', 'healthy']
        },
        {
            id: 'veg-lemon-pickle',
            name: 'Zesty Lemon Pickle',
            category: 'garden-fresh',
            price: 179,
            originalPrice: 199,
            description: 'Fresh lemons pickled with aromatic spices for that perfect zing.',
            ingredients: 'Lemon, Rock Salt, Turmeric, Red Chilli, Mustard Oil',
            weight: '300g',
            shelfLife: '15 months',
            rating: 4.3,
            reviewCount: 187,
            image: 'lemon-pickle.jpg',
            inStock: true,
            featured: false,
            tags: ['zesty', 'vegetarian', 'citrus']
        },
        {
            id: 'meat-beef-pickle',
            name: 'Hearty Beef Pickle',
            category: 'premium-meats',
            price: 529,
            originalPrice: 579,
            description: 'Slow-cooked beef with rich spices and traditional preservation methods.',
            ingredients: 'Beef, Onions, Ginger-Garlic, Garam Masala, Mustard Oil',
            weight: '250g',
            shelfLife: '12 months',
            rating: 4.7,
            reviewCount: 95,
            image: 'beef-pickle.jpg',
            inStock: false,
            featured: false,
            tags: ['hearty', 'non-veg', 'rich']
        }
    ];
}

// Filter products based on current filters
window.filterProducts = function() {
    filteredProducts = [...products];
    
    // Apply category filters
    const categoryCheckboxes = document.querySelectorAll('input[type="checkbox"]:checked');
    const selectedCategories = Array.from(categoryCheckboxes).map(cb => cb.value);
    
    if (selectedCategories.length > 0) {
        filteredProducts = filteredProducts.filter(product => 
            selectedCategories.includes(product.category)
        );
    }
    
    // Apply price filter
    const priceRange = document.getElementById('priceRange');
    if (priceRange) {
        const maxPrice = parseInt(priceRange.value);
        filteredProducts = filteredProducts.filter(product => product.price <= maxPrice);
        
        // Update price display
        document.getElementById('maxPrice').textContent = `₹${maxPrice}`;
    }
    
    // Apply sorting
    sortProducts(currentFilters.sortBy);
    
    // Display filtered products
    displayProducts(filteredProducts);
};

// Sort products
window.sortProducts = function(sortBy) {
    currentFilters.sortBy = sortBy;
    
    switch(sortBy) {
        case 'name':
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'price':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'rating':
            filteredProducts.sort((a, b) => b.rating - a.rating);
            break;
        case 'popularity':
            filteredProducts.sort((a, b) => b.reviewCount - a.reviewCount);
            break;
    }
    
    displayProducts(filteredProducts);
};

// Display products in grid
function displayProducts(productsToShow) {
    const productsGrid = document.getElementById('productsGrid');
    
    if (!productsGrid) return;
    
    if (productsToShow.length === 0) {
        productsGrid.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-search fa-3x text-muted mb-3"></i>
                <h5>No products found</h5>
                <p class="text-muted">Try adjusting your filters to see more products.</p>
                <button class="btn btn-primary" onclick="clearFilters()">Clear Filters</button>
            </div>
        `;
        return;
    }
    
    productsGrid.innerHTML = productsToShow.map(product => `
        <div class="col-lg-4 col-md-6 col-sm-12">
            <div class="card product-card h-100" onclick="viewProduct('${product.id}')">
                <div class="product-image">
                    <i class="fas fa-pepper-hot"></i>
                    ${!product.inStock ? '<div class="out-of-stock-overlay">Out of Stock</div>' : ''}
                    ${product.featured ? '<div class="featured-badge">Featured</div>' : ''}
                </div>
                <div class="card-body">
                    <div class="product-category text-uppercase">${PRODUCT_CATEGORIES[product.category]}</div>
                    <h5 class="card-title">${product.name}</h5>
                    <p class="card-text">${product.description}</p>
                    <div class="product-rating mb-2">
                        ${generateStarRating(product.rating)}
                        <small class="text-muted">(${product.reviewCount} reviews)</small>
                    </div>
                    <div class="product-price mb-3">
                        <span class="current-price">₹${product.price}</span>
                        ${product.originalPrice > product.price ? 
                            `<span class="original-price text-decoration-line-through text-muted ms-2">₹${product.originalPrice}</span>
                            <span class="discount-badge ms-2">${Math.round((1 - product.price/product.originalPrice) * 100)}% OFF</span>`
                            : ''
                        }
                    </div>
                    <div class="product-actions">
                        <button class="btn btn-primary ${!product.inStock ? 'disabled' : ''}" 
                                onclick="event.stopPropagation(); addToCart('${product.id}')"
                                ${!product.inStock ? 'disabled' : ''}>
                            <i class="fas fa-shopping-cart"></i> 
                            ${product.inStock ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                        <button class="btn btn-outline-secondary ms-2" 
                                onclick="event.stopPropagation(); addToWishlist('${product.id}')">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
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

// View product details
window.viewProduct = function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const modal = document.getElementById('productModal');
    const modalTitle = document.getElementById('productModalTitle');
    const modalBody = document.getElementById('productModalBody');
    
    modalTitle.textContent = product.name;
    
    modalBody.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <div class="product-image-large">
                    <i class="fas fa-pepper-hot fa-10x text-primary"></i>
                </div>
            </div>
            <div class="col-md-6">
                <div class="product-category text-uppercase mb-2">${PRODUCT_CATEGORIES[product.category]}</div>
                <h4>${product.name}</h4>
                <div class="product-rating mb-3">
                    ${generateStarRating(product.rating)}
                    <span class="ms-2">${product.rating}/5 (${product.reviewCount} reviews)</span>
                </div>
                <div class="product-price mb-3">
                    <span class="h4 text-primary">₹${product.price}</span>
                    ${product.originalPrice > product.price ? 
                        `<span class="text-decoration-line-through text-muted ms-2">₹${product.originalPrice}</span>
                        <span class="badge bg-success ms-2">${Math.round((1 - product.price/product.originalPrice) * 100)}% OFF</span>`
                        : ''
                    }
                </div>
                <p class="mb-3">${product.description}</p>
                <div class="product-details mb-3">
                    <strong>Weight:</strong> ${product.weight}<br>
                    <strong>Shelf Life:</strong> ${product.shelfLife}<br>
                    <strong>Ingredients:</strong> ${product.ingredients}
                </div>
                <div class="quantity-selector mb-3">
                    <label class="form-label">Quantity:</label>
                    <div class="input-group" style="width: 150px;">
                        <button class="btn btn-outline-secondary" onclick="changeQuantity(-1)">-</button>
                        <input type="number" class="form-control text-center" id="productQuantity" value="1" min="1" max="10">
                        <button class="btn btn-outline-secondary" onclick="changeQuantity(1)">+</button>
                    </div>
                </div>
                <div class="product-actions">
                    <button class="btn btn-primary btn-lg ${!product.inStock ? 'disabled' : ''}" 
                            onclick="addToCartWithQuantity('${product.id}')"
                            ${!product.inStock ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart"></i> 
                        ${product.inStock ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                    <button class="btn btn-outline-primary btn-lg ms-2" onclick="addToWishlist('${product.id}')">
                        <i class="far fa-heart"></i> Wishlist
                    </button>
                </div>
                <div class="mt-3">
                    <small class="text-muted">
                        Tags: ${product.tags.map(tag => `<span class="badge bg-light text-dark">${tag}</span>`).join(' ')}
                    </small>
                </div>
            </div>
        </div>
        <div class="row mt-4">
            <div class="col-12">
                <ul class="nav nav-tabs" role="tablist">
                    <li class="nav-item">
                        <a class="nav-link active" data-bs-toggle="tab" href="#reviews-tab">Reviews</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" data-bs-toggle="tab" href="#shipping-tab">Shipping Info</a>
                    </li>
                </ul>
                <div class="tab-content mt-3">
                    <div class="tab-pane fade show active" id="reviews-tab">
                        <div id="productReviews">Loading reviews...</div>
                    </div>
                    <div class="tab-pane fade" id="shipping-tab">
                        <h6>Shipping Information</h6>
                        <ul>
                            <li>Free shipping on orders above ₹500</li>
                            <li>Delivery within 3-5 business days</li>
                            <li>Express delivery available</li>
                            <li>Cash on delivery available</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Show modal
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Load product reviews
    loadProductReviews(productId);
};

// Change quantity in product modal
window.changeQuantity = function(delta) {
    const quantityInput = document.getElementById('productQuantity');
    const currentValue = parseInt(quantityInput.value);
    const newValue = Math.max(1, Math.min(10, currentValue + delta));
    quantityInput.value = newValue;
};

// Add to cart with quantity from modal
window.addToCartWithQuantity = function(productId) {
    const quantity = parseInt(document.getElementById('productQuantity').value);
    addToCart(productId, quantity);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
    modal.hide();
};

// Add product to cart
window.addToCart = function(productId, quantity = 1) {
    const product = products.find(p => p.id === productId);
    if (!product || !product.inStock) return;
    
    // Get current cart
    let cart = window.pickliSHApp.cart;
    
    // Check if product already in cart
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category,
            image: product.image,
            quantity: quantity
        });
    }
    
    // Update cart in app state and localStorage
    window.pickliSHApp.cart = cart;
    localStorage.setItem('picklish_cart', JSON.stringify(cart));
    
    // Update cart UI
    updateCartUI();
    
    // Show success message
    showNotification(`${product.name} added to cart!`, 'success');
};

// Add to wishlist
window.addToWishlist = function(productId) {
    // TODO: Implement wishlist functionality
    showNotification('Added to wishlist!', 'success');
};

// Clear all filters
window.clearFilters = function() {
    // Uncheck all category filters
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    // Reset price range
    const priceRange = document.getElementById('priceRange');
    if (priceRange) {
        priceRange.value = 1000;
        document.getElementById('maxPrice').textContent = '₹1000';
    }
    
    // Reset sorting
    currentFilters.sortBy = 'name';
    
    // Apply filters
    filterProducts();
};

// Load product reviews
async function loadProductReviews(productId) {
    try {
        const reviewsContainer = document.getElementById('productReviews');
        
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
                    <p class="text-muted">No reviews yet. Be the first to review this product!</p>
                    <button class="btn btn-primary" onclick="writeReview('${productId}')">Write a Review</button>
                </div>
            `;
            return;
        }
        
        const reviews = reviewsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        reviewsContainer.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6>Customer Reviews (${reviews.length})</h6>
                <button class="btn btn-outline-primary btn-sm" onclick="writeReview('${productId}')">
                    Write a Review
                </button>
            </div>
            ${reviews.map(review => `
                <div class="review-item mb-3 p-3 border rounded">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <strong>${review.userName || 'Anonymous'}</strong>
                            <div class="rating-display">
                                ${generateStarRating(review.rating)}
                            </div>
                        </div>
                        <small class="text-muted">${formatDate(review.createdAt.toDate())}</small>
                    </div>
                    <p class="mb-0">${review.comment}</p>
                    ${review.photos && review.photos.length > 0 ? `
                        <div class="review-photos mt-2">
                            ${review.photos.map(photo => `
                                <img src="${photo}" alt="Review photo" class="review-photo me-2" onclick="viewReviewPhoto('${photo}')">
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        `;
        
    } catch (error) {
        console.error('Error loading reviews:', error);
        document.getElementById('productReviews').innerHTML = `
            <div class="error-message">
                Error loading reviews. Please try again.
            </div>
        `;
    }
}

// Write review
window.writeReview = function(productId) {
    if (!window.pickliSHApp.user) {
        showNotification('Please sign in to write a review', 'error');
        return;
    }
    
    // Store product ID for review submission
    window.currentReviewProductId = productId;
    
    // Show review modal
    const reviewModal = new bootstrap.Modal(document.getElementById('reviewModal'));
    reviewModal.show();
};

// Show loading state
function showProductsLoading() {
    const productsGrid = document.getElementById('productsGrid');
    if (productsGrid) {
        productsGrid.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading products...</span>
                </div>
                <p class="mt-3">Loading premium pickles...</p>
            </div>
        `;
    }
}

// Show error state
function showProductsError() {
    const productsGrid = document.getElementById('productsGrid');
    if (productsGrid) {
        productsGrid.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                <h5>Error Loading Products</h5>
                <p class="text-muted">Unable to load products. Please try again.</p>
                <button class="btn btn-primary" onclick="loadShopProducts()">Retry</button>
            </div>
        `;
    }
}

// Update cart UI
function updateCartUI() {
    const cartBadge = document.getElementById('cartBadge');
    const cart = window.pickliSHApp.cart;
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    if (cartBadge) {
        cartBadge.textContent = totalItems;
        cartBadge.style.display = totalItems > 0 ? 'inline' : 'none';
    }
}

// Initialize shop when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('productsGrid')) {
        loadShopProducts();
    }
});
