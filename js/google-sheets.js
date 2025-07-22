// Google Sheets and Drive Integration Module
import { db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    setDoc, 
    getDocs,
    updateDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Google API configuration
const GOOGLE_API_CONFIG = {
    apiKey: window.GOOGLE_API_KEY || 'your-google-api-key',
    clientId: window.GOOGLE_CLIENT_ID || 'your-google-client-id',
    discoveryDocs: [
        'https://sheets.googleapis.com/$discovery/rest?version=v4',
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    ],
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'
};

// Sheet configuration
const SHEETS_CONFIG = {
    products: {
        sheetId: window.PRODUCTS_SHEET_ID || 'your-products-sheet-id',
        range: 'Products!A:M', // Columns A through M
        headers: [
            'id', 'name', 'category', 'price', 'originalPrice', 'description',
            'ingredients', 'weight', 'shelfLife', 'inStock', 'featured', 'tags', 'lastUpdated'
        ]
    },
    inventory: {
        sheetId: window.INVENTORY_SHEET_ID || 'your-inventory-sheet-id',
        range: 'Inventory!A:F',
        headers: ['productId', 'currentStock', 'lowStockThreshold', 'lastRestocked', 'supplier', 'notes']
    },
    orders: {
        sheetId: window.ORDERS_SHEET_ID || 'your-orders-sheet-id',
        range: 'Orders!A:L',
        headers: [
            'orderId', 'customerEmail', 'items', 'total', 'status', 'paymentStatus',
            'createdAt', 'shippingAddress', 'phoneNumber', 'notes', 'trackingNumber', 'deliveredAt'
        ]
    }
};

let isGoogleAPIInitialized = false;
let isUserAuthenticated = false;

// Initialize Google APIs
window.initializeGoogleSheets = async function() {
    try {
        // Load Google API script if not already loaded
        if (!window.gapi) {
            await loadGoogleAPIScript();
        }
        
        // Initialize the API
        await new Promise((resolve, reject) => {
            gapi.load('client:auth2', {
                callback: resolve,
                onerror: reject
            });
        });
        
        // Initialize client
        await gapi.client.init({
            apiKey: GOOGLE_API_CONFIG.apiKey,
            clientId: GOOGLE_API_CONFIG.clientId,
            discoveryDocs: GOOGLE_API_CONFIG.discoveryDocs,
            scope: GOOGLE_API_CONFIG.scope
        });
        
        isGoogleAPIInitialized = true;
        
        // Check if user is already signed in
        const authInstance = gapi.auth2.getAuthInstance();
        isUserAuthenticated = authInstance.isSignedIn.get();
        
        console.log('Google Sheets API initialized successfully');
        
    } catch (error) {
        console.error('Error initializing Google Sheets API:', error);
        // Fall back to Firestore if Google Sheets fails
        showNotification('Using offline mode - Google Sheets integration unavailable', 'warning');
    }
};

// Load Google API script dynamically
function loadGoogleAPIScript() {
    return new Promise((resolve, reject) => {
        if (window.gapi) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Authenticate with Google
window.authenticateGoogleSheets = async function() {
    try {
        if (!isGoogleAPIInitialized) {
            await initializeGoogleSheets();
        }
        
        const authInstance = gapi.auth2.getAuthInstance();
        
        if (!authInstance.isSignedIn.get()) {
            await authInstance.signIn();
        }
        
        isUserAuthenticated = true;
        showNotification('Google Sheets connected successfully', 'success');
        
    } catch (error) {
        console.error('Error authenticating with Google:', error);
        showNotification('Failed to connect to Google Sheets', 'error');
    }
};

// Load products from Google Sheets
window.loadProductsFromSheets = async function() {
    try {
        if (!isGoogleAPIInitialized || !isUserAuthenticated) {
            console.log('Google Sheets not available, loading from Firestore');
            return await loadProductsFromFirestore();
        }
        
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SHEETS_CONFIG.products.sheetId,
            range: SHEETS_CONFIG.products.range
        });
        
        const values = response.result.values;
        if (!values || values.length < 2) {
            console.log('No products found in sheet, using default products');
            return getDefaultProducts();
        }
        
        // Convert sheet data to product objects
        const headers = values[0];
        const products = values.slice(1).map(row => {
            const product = {};
            headers.forEach((header, index) => {
                const value = row[index] || '';
                
                // Parse specific fields
                switch(header) {
                    case 'price':
                    case 'originalPrice':
                        product[header] = parseFloat(value) || 0;
                        break;
                    case 'inStock':
                    case 'featured':
                        product[header] = value.toLowerCase() === 'true';
                        break;
                    case 'tags':
                        product[header] = value ? value.split(',').map(tag => tag.trim()) : [];
                        break;
                    default:
                        product[header] = value;
                }
            });
            
            return product;
        });
        
        // Cache products in Firestore for offline access
        await cacheProductsInFirestore(products);
        
        return products;
        
    } catch (error) {
        console.error('Error loading products from sheets:', error);
        showNotification('Error loading products from Google Sheets, using cached data', 'warning');
        return await loadProductsFromFirestore();
    }
};

// Load products from Firestore (fallback)
async function loadProductsFromFirestore() {
    try {
        const productsSnapshot = await getDocs(collection(db, 'products'));
        
        if (!productsSnapshot.empty) {
            return productsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }
        
        // Return default products if no data available
        return getDefaultProducts();
        
    } catch (error) {
        console.error('Error loading products from Firestore:', error);
        return getDefaultProducts();
    }
}

// Cache products in Firestore
async function cacheProductsInFirestore(products) {
    try {
        const promises = products.map(product => {
            const productData = {
                ...product,
                lastSynced: serverTimestamp(),
                source: 'google_sheets'
            };
            
            return setDoc(doc(db, 'products', product.id), productData, { merge: true });
        });
        
        await Promise.all(promises);
        console.log('Products cached in Firestore successfully');
        
    } catch (error) {
        console.error('Error caching products in Firestore:', error);
    }
}

// Update product in Google Sheets
window.updateProductInSheets = async function(productId, updates) {
    try {
        if (!isGoogleAPIInitialized || !isUserAuthenticated) {
            throw new Error('Google Sheets not available');
        }
        
        // First, get current data to find the row
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SHEETS_CONFIG.products.sheetId,
            range: SHEETS_CONFIG.products.range
        });
        
        const values = response.result.values;
        if (!values) {
            throw new Error('No data found in products sheet');
        }
        
        const headers = values[0];
        const productRowIndex = values.findIndex((row, index) => index > 0 && row[0] === productId);
        
        if (productRowIndex === -1) {
            throw new Error('Product not found in sheet');
        }
        
        // Prepare update data
        const updateRow = [...values[productRowIndex]];
        Object.entries(updates).forEach(([key, value]) => {
            const columnIndex = headers.indexOf(key);
            if (columnIndex !== -1) {
                updateRow[columnIndex] = value;
            }
        });
        
        // Add last updated timestamp
        const lastUpdatedIndex = headers.indexOf('lastUpdated');
        if (lastUpdatedIndex !== -1) {
            updateRow[lastUpdatedIndex] = new Date().toISOString();
        }
        
        // Update the row
        const updateRange = `Products!A${productRowIndex + 1}:M${productRowIndex + 1}`;
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SHEETS_CONFIG.products.sheetId,
            range: updateRange,
            valueInputOption: 'RAW',
            resource: {
                values: [updateRow]
            }
        });
        
        // Also update in Firestore
        await updateDoc(doc(db, 'products', productId), {
            ...updates,
            lastUpdated: serverTimestamp(),
            lastSynced: serverTimestamp()
        });
        
        showNotification('Product updated in Google Sheets', 'success');
        
    } catch (error) {
        console.error('Error updating product in sheets:', error);
        
        // Fallback to Firestore only
        try {
            await updateDoc(doc(db, 'products', productId), {
                ...updates,
                lastUpdated: serverTimestamp()
            });
            showNotification('Product updated locally (sync with sheets failed)', 'warning');
        } catch (firestoreError) {
            throw new Error('Failed to update product');
        }
    }
};

// Add new product to Google Sheets
window.addProductToSheets = async function(productData) {
    try {
        if (!isGoogleAPIInitialized || !isUserAuthenticated) {
            throw new Error('Google Sheets not available');
        }
        
        // Get headers to ensure proper column mapping
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SHEETS_CONFIG.products.sheetId,
            range: 'Products!A1:M1'
        });
        
        const headers = response.result.values[0];
        
        // Prepare row data based on headers
        const rowData = headers.map(header => {
            switch(header) {
                case 'lastUpdated':
                    return new Date().toISOString();
                case 'tags':
                    return (productData[header] || []).join(', ');
                default:
                    return productData[header] || '';
            }
        });
        
        // Append to sheet
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SHEETS_CONFIG.products.sheetId,
            range: 'Products!A:M',
            valueInputOption: 'RAW',
            resource: {
                values: [rowData]
            }
        });
        
        // Also add to Firestore
        await setDoc(doc(db, 'products', productData.id), {
            ...productData,
            createdAt: serverTimestamp(),
            lastSynced: serverTimestamp(),
            source: 'google_sheets'
        });
        
        showNotification('Product added to Google Sheets', 'success');
        
    } catch (error) {
        console.error('Error adding product to sheets:', error);
        
        // Fallback to Firestore only
        try {
            await setDoc(doc(db, 'products', productData.id), {
                ...productData,
                createdAt: serverTimestamp()
            });
            showNotification('Product added locally (sync with sheets failed)', 'warning');
        } catch (firestoreError) {
            throw new Error('Failed to add product');
        }
    }
};

// Sync orders to Google Sheets
window.syncOrderToSheets = async function(orderData) {
    try {
        if (!isGoogleAPIInitialized || !isUserAuthenticated) {
            console.log('Google Sheets not available for order sync');
            return;
        }
        
        // Prepare order data for sheets
        const orderRow = [
            orderData.id,
            orderData.userEmail,
            JSON.stringify(orderData.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price
            }))),
            orderData.total,
            orderData.status,
            orderData.paymentStatus,
            orderData.createdAt ? new Date(orderData.createdAt.toDate()).toISOString() : new Date().toISOString(),
            orderData.shippingAddress || '',
            orderData.phoneNumber || '',
            orderData.notes || '',
            orderData.trackingNumber || '',
            orderData.deliveredAt ? new Date(orderData.deliveredAt.toDate()).toISOString() : ''
        ];
        
        // Append to orders sheet
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SHEETS_CONFIG.orders.sheetId,
            range: 'Orders!A:L',
            valueInputOption: 'RAW',
            resource: {
                values: [orderRow]
            }
        });
        
        console.log('Order synced to Google Sheets successfully');
        
    } catch (error) {
        console.error('Error syncing order to sheets:', error);
        // Don't throw error as this is not critical
    }
};

// Load inventory data from Google Sheets
window.loadInventoryFromSheets = async function() {
    try {
        if (!isGoogleAPIInitialized || !isUserAuthenticated) {
            console.log('Google Sheets not available for inventory');
            return {};
        }
        
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SHEETS_CONFIG.inventory.sheetId,
            range: SHEETS_CONFIG.inventory.range
        });
        
        const values = response.result.values;
        if (!values || values.length < 2) {
            return {};
        }
        
        const headers = values[0];
        const inventory = {};
        
        values.slice(1).forEach(row => {
            const productId = row[0];
            if (productId) {
                inventory[productId] = {};
                headers.forEach((header, index) => {
                    const value = row[index] || '';
                    
                    switch(header) {
                        case 'currentStock':
                        case 'lowStockThreshold':
                            inventory[productId][header] = parseInt(value) || 0;
                            break;
                        default:
                            inventory[productId][header] = value;
                    }
                });
            }
        });
        
        return inventory;
        
    } catch (error) {
        console.error('Error loading inventory from sheets:', error);
        return {};
    }
};

// Update inventory in Google Sheets
window.updateInventoryInSheets = async function(productId, stockChange, notes = '') {
    try {
        if (!isGoogleAPIInitialized || !isUserAuthenticated) {
            console.log('Google Sheets not available for inventory update');
            return;
        }
        
        // Get current inventory data
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SHEETS_CONFIG.inventory.sheetId,
            range: SHEETS_CONFIG.inventory.range
        });
        
        const values = response.result.values;
        if (!values) {
            throw new Error('No inventory data found');
        }
        
        const headers = values[0];
        const productRowIndex = values.findIndex((row, index) => index > 0 && row[0] === productId);
        
        if (productRowIndex === -1) {
            // Add new inventory record
            const newRow = [
                productId,
                Math.max(0, stockChange), // currentStock
                10, // default lowStockThreshold
                new Date().toISOString(), // lastRestocked
                '', // supplier
                notes // notes
            ];
            
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: SHEETS_CONFIG.inventory.sheetId,
                range: SHEETS_CONFIG.inventory.range,
                valueInputOption: 'RAW',
                resource: {
                    values: [newRow]
                }
            });
        } else {
            // Update existing record
            const currentRow = [...values[productRowIndex]];
            const currentStock = parseInt(currentRow[1]) || 0;
            const newStock = Math.max(0, currentStock + stockChange);
            
            currentRow[1] = newStock; // currentStock
            currentRow[3] = new Date().toISOString(); // lastRestocked
            if (notes) {
                currentRow[5] = notes; // notes
            }
            
            const updateRange = `Inventory!A${productRowIndex + 1}:F${productRowIndex + 1}`;
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: SHEETS_CONFIG.inventory.sheetId,
                range: updateRange,
                valueInputOption: 'RAW',
                resource: {
                    values: [currentRow]
                }
            });
        }
        
        console.log('Inventory updated in Google Sheets');
        
    } catch (error) {
        console.error('Error updating inventory in sheets:', error);
        // Don't throw error as this is not critical
    }
};

// Create backup of data to Google Drive
window.createDataBackup = async function() {
    try {
        if (!isGoogleAPIInitialized || !isUserAuthenticated) {
            throw new Error('Google Drive not available');
        }
        
        showNotification('Creating data backup...', 'info');
        
        // Collect all data
        const backupData = {
            timestamp: new Date().toISOString(),
            products: await loadProductsFromFirestore(),
            orders: await getOrdersForBackup(),
            subscriptions: await getSubscriptionsForBackup(),
            users: await getUsersForBackup()
        };
        
        // Create backup file content
        const backupContent = JSON.stringify(backupData, null, 2);
        const blob = new Blob([backupContent], { type: 'application/json' });
        
        // Upload to Google Drive
        const metadata = {
            name: `picklish_backup_${new Date().toISOString().split('T')[0]}.json`,
            parents: ['your-backup-folder-id'] // Configure this in production
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);
        
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({
                'Authorization': `Bearer ${gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
            }),
            body: form
        });
        
        if (response.ok) {
            showNotification('Data backup created successfully', 'success');
        } else {
            throw new Error('Backup upload failed');
        }
        
    } catch (error) {
        console.error('Error creating backup:', error);
        showNotification('Failed to create data backup', 'error');
    }
};

// Helper functions for data collection
async function getOrdersForBackup() {
    try {
        const ordersSnapshot = await getDocs(collection(db, 'orders'));
        return ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting orders for backup:', error);
        return [];
    }
}

async function getSubscriptionsForBackup() {
    try {
        const subscriptionsSnapshot = await getDocs(collection(db, 'subscriptions'));
        return subscriptionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting subscriptions for backup:', error);
        return [];
    }
}

async function getUsersForBackup() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        return usersSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            // Remove sensitive data from backup
            email: undefined,
            phoneNumber: undefined
        }));
    } catch (error) {
        console.error('Error getting users for backup:', error);
        return [];
    }
}

// Default products function (moved from shop.js)
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
            inStock: true,
            featured: false,
            tags: ['coastal', 'seafood', 'tangy']
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
            inStock: true,
            featured: true,
            tags: ['classic', 'vegetarian', 'tangy']
        }
    ];
}

// Initialize Google Sheets when the module loads
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're in admin or if specifically requested
    if (window.location.hash === '#admin' || window.pickliSHApp?.currentView === 'admin') {
        initializeGoogleSheets();
    }
});
