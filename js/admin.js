// Admin Dashboard Module
import { db } from './firebase-config.js';
import { 
    collection, 
    doc, 
    getDocs, 
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query, 
    where, 
    orderBy,
    limit,
    startAfter,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentAdminSection = 'orders';
let currentPage = 1;
const itemsPerPage = 20;

// Initialize admin dashboard
window.initializeAdmin = async function() {
    // Check admin permissions
    const user = window.pickliSHApp.user;
    if (!user) {
        showNotification('Please sign in to access admin panel', 'error');
        return;
    }
    
    try {
        const token = await user.getIdTokenResult();
        if (!token.claims.admin) {
            showNotification('Admin privileges required', 'error');
            showHome();
            return;
        }
        
        // Load admin dashboard
        showAdminSection('orders');
        
    } catch (error) {
        console.error('Error checking admin permissions:', error);
        showNotification('Error accessing admin panel', 'error');
    }
};

// Show admin section
window.showAdminSection = function(section) {
    currentAdminSection = section;
    currentPage = 1;
    
    // Update navigation
    const navLinks = document.querySelectorAll('.admin-header .nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.textContent.toLowerCase() === section) {
            link.classList.add('active');
        }
    });
    
    // Load section content
    switch(section) {
        case 'orders':
            loadOrdersSection();
            break;
        case 'subscriptions':
            loadSubscriptionsSection();
            break;
        case 'products':
            loadProductsSection();
            break;
        case 'users':
            loadUsersSection();
            break;
        case 'vouchers':
            loadVouchersSection();
            break;
        default:
            loadOrdersSection();
    }
};

// Load orders section
async function loadOrdersSection() {
    const adminContent = document.getElementById('adminContent');
    
    adminContent.innerHTML = `
        <div class="admin-section">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>Order Management</h4>
                <div class="admin-filters">
                    <select class="form-select" id="orderStatusFilter" onchange="filterOrders()">
                        <option value="all">All Orders</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>
            
            <div class="admin-stats mb-4">
                <div class="stat-card">
                    <div class="stat-number" id="totalOrders">-</div>
                    <div class="stat-label">Total Orders</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="pendingOrders">-</div>
                    <div class="stat-label">Pending Orders</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="todayOrders">-</div>
                    <div class="stat-label">Today's Orders</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="totalRevenue">-</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="ordersTableBody">
                        <tr>
                            <td colspan="7" class="text-center">
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">Loading orders...</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div id="ordersPagination" class="d-flex justify-content-center mt-4">
                <!-- Pagination will be loaded here -->
            </div>
        </div>
    `;
    
    // Load orders data
    await loadOrdersData();
}

// Load orders data
async function loadOrdersData() {
    try {
        // Load orders from Firestore
        const ordersQuery = query(
            collection(db, 'orders'),
            orderBy('createdAt', 'desc'),
            limit(itemsPerPage)
        );
        
        const ordersSnapshot = await getDocs(ordersQuery);
        const orders = ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Calculate statistics
        await calculateOrderStats();
        
        // Display orders
        displayOrders(orders);
        
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('ordersTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger">
                    Error loading orders. Please try again.
                </td>
            </tr>
        `;
    }
}

// Calculate order statistics
async function calculateOrderStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get all orders for statistics
        const allOrdersSnapshot = await getDocs(collection(db, 'orders'));
        const allOrders = allOrdersSnapshot.docs.map(doc => doc.data());
        
        // Calculate stats
        const totalOrders = allOrders.length;
        const pendingOrders = allOrders.filter(order => order.status === 'pending').length;
        const todayOrders = allOrders.filter(order => {
            const orderDate = order.createdAt.toDate();
            return orderDate >= today;
        }).length;
        const totalRevenue = allOrders
            .filter(order => order.status === 'delivered')
            .reduce((sum, order) => sum + order.total, 0);
        
        // Update UI
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('pendingOrders').textContent = pendingOrders;
        document.getElementById('todayOrders').textContent = todayOrders;
        document.getElementById('totalRevenue').textContent = `₹${totalRevenue.toLocaleString()}`;
        
    } catch (error) {
        console.error('Error calculating order stats:', error);
    }
}

// Display orders in table
function displayOrders(orders) {
    const tableBody = document.getElementById('ordersTableBody');
    
    if (orders.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No orders found</td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = orders.map(order => `
        <tr>
            <td>
                <strong>#${order.id.substring(0, 8).toUpperCase()}</strong>
            </td>
            <td>
                <div>${order.userEmail}</div>
                <small class="text-muted">${order.userId}</small>
            </td>
            <td>
                <small>${order.items.length} item(s)</small>
                <div class="text-muted">
                    ${order.items.slice(0, 2).map(item => item.name).join(', ')}
                    ${order.items.length > 2 ? '...' : ''}
                </div>
            </td>
            <td>
                <strong>₹${order.total}</strong>
                ${order.discountAmount > 0 ? `<br><small class="text-success">-₹${order.discountAmount}</small>` : ''}
            </td>
            <td>
                <span class="badge bg-${getOrderStatusColor(order.status)}">${order.status.toUpperCase()}</span>
            </td>
            <td>
                <div>${formatDate(order.createdAt.toDate())}</div>
                <small class="text-muted">${formatTime(order.createdAt.toDate())}</small>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="viewOrderDetails('${order.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline-success" onclick="updateOrderStatus('${order.id}')" title="Update Status">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// View order details
window.viewOrderDetails = async function(orderId) {
    try {
        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (!orderSnap.exists()) {
            showNotification('Order not found', 'error');
            return;
        }
        
        const order = orderSnap.data();
        
        const modalHTML = `
            <div class="modal fade" id="orderDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Order Details - #${orderId.substring(0, 8).toUpperCase()}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Customer Information</h6>
                                    <p><strong>Email:</strong> ${order.userEmail}</p>
                                    <p><strong>User ID:</strong> ${order.userId}</p>
                                    <p><strong>Order Date:</strong> ${formatDate(order.createdAt.toDate())}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6>Order Status</h6>
                                    <p><span class="badge bg-${getOrderStatusColor(order.status)}">${order.status.toUpperCase()}</span></p>
                                    <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
                                    ${order.paymentId ? `<p><strong>Payment ID:</strong> ${order.paymentId}</p>` : ''}
                                </div>
                            </div>
                            
                            <h6 class="mt-4">Order Items</h6>
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${order.items.map(item => `
                                            <tr>
                                                <td>${item.name}</td>
                                                <td>${item.quantity}</td>
                                                <td>₹${item.price}</td>
                                                <td>₹${item.price * item.quantity}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div class="row mt-4">
                                <div class="col-md-6">
                                    ${order.appliedVoucher ? `
                                        <h6>Applied Voucher</h6>
                                        <p><strong>Code:</strong> ${order.appliedVoucher}</p>
                                        <p><strong>Discount:</strong> ₹${order.discountAmount}</p>
                                    ` : ''}
                                </div>
                                <div class="col-md-6">
                                    <h6>Order Summary</h6>
                                    <p><strong>Subtotal:</strong> ₹${order.subtotal}</p>
                                    ${order.discountAmount > 0 ? `<p><strong>Discount:</strong> -₹${order.discountAmount}</p>` : ''}
                                    <p><strong>Total:</strong> ₹${order.total}</p>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="updateOrderStatus('${orderId}')">Update Status</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
        modal.show();
        
        // Remove modal when hidden
        modal._element.addEventListener('hidden.bs.modal', function() {
            document.getElementById('orderDetailsModal').remove();
        });
        
    } catch (error) {
        console.error('Error loading order details:', error);
        showNotification('Error loading order details', 'error');
    }
};

// Update order status
window.updateOrderStatus = async function(orderId) {
    try {
        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (!orderSnap.exists()) {
            showNotification('Order not found', 'error');
            return;
        }
        
        const order = orderSnap.data();
        
        const modalHTML = `
            <div class="modal fade" id="updateStatusModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Update Order Status</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="updateStatusForm">
                                <div class="mb-3">
                                    <label class="form-label">Current Status</label>
                                    <input type="text" class="form-control" value="${order.status}" readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">New Status</label>
                                    <select class="form-select" id="newStatus" required>
                                        <option value="">Select new status</option>
                                        <option value="pending" ${order.status === 'pending' ? 'disabled' : ''}>Pending</option>
                                        <option value="confirmed" ${order.status === 'confirmed' ? 'disabled' : ''}>Confirmed</option>
                                        <option value="shipped" ${order.status === 'shipped' ? 'disabled' : ''}>Shipped</option>
                                        <option value="delivered" ${order.status === 'delivered' ? 'disabled' : ''}>Delivered</option>
                                        <option value="cancelled" ${order.status === 'cancelled' ? 'disabled' : ''}>Cancelled</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Notes (Optional)</label>
                                    <textarea class="form-control" id="statusNotes" rows="3" placeholder="Add any notes about this status update"></textarea>
                                </div>
                                <button type="submit" class="btn btn-primary">Update Status</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('updateStatusModal'));
        modal.show();
        
        // Handle form submission
        document.getElementById('updateStatusForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const newStatus = document.getElementById('newStatus').value;
            const notes = document.getElementById('statusNotes').value;
            
            if (!newStatus) {
                showNotification('Please select a new status', 'error');
                return;
            }
            
            try {
                await updateDoc(doc(db, 'orders', orderId), {
                    status: newStatus,
                    [`${newStatus}At`]: serverTimestamp(),
                    statusNotes: notes,
                    updatedBy: window.pickliSHApp.user.email
                });
                
                showNotification('Order status updated successfully', 'success');
                modal.hide();
                loadOrdersData(); // Reload orders
                
            } catch (error) {
                console.error('Error updating order status:', error);
                showNotification('Error updating order status', 'error');
            }
        });
        
        // Remove modal when hidden
        modal._element.addEventListener('hidden.bs.modal', function() {
            document.getElementById('updateStatusModal').remove();
        });
        
    } catch (error) {
        console.error('Error loading order for status update:', error);
        showNotification('Error loading order', 'error');
    }
};

// Load subscriptions section
async function loadSubscriptionsSection() {
    const adminContent = document.getElementById('adminContent');
    
    adminContent.innerHTML = `
        <div class="admin-section">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>Subscription Management</h4>
                <div class="admin-filters">
                    <select class="form-select" id="subscriptionStatusFilter" onchange="filterSubscriptions()">
                        <option value="all">All Subscriptions</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>
            
            <div class="admin-stats mb-4">
                <div class="stat-card">
                    <div class="stat-number" id="totalSubscriptions">-</div>
                    <div class="stat-label">Total Subscriptions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="activeSubscriptions">-</div>
                    <div class="stat-label">Active Subscriptions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="monthlyRevenue">-</div>
                    <div class="stat-label">Monthly Revenue</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="churnRate">-</div>
                    <div class="stat-label">Churn Rate</div>
                </div>
            </div>
            
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Subscription ID</th>
                            <th>Customer</th>
                            <th>Plan</th>
                            <th>Price</th>
                            <th>Status</th>
                            <th>Next Delivery</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="subscriptionsTableBody">
                        <tr>
                            <td colspan="7" class="text-center">
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">Loading subscriptions...</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Load subscriptions data
    await loadSubscriptionsData();
}

// Load subscriptions data
async function loadSubscriptionsData() {
    try {
        const subscriptionsQuery = query(
            collection(db, 'subscriptions'),
            orderBy('createdAt', 'desc'),
            limit(itemsPerPage)
        );
        
        const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
        const subscriptions = subscriptionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Calculate subscription statistics
        await calculateSubscriptionStats();
        
        // Display subscriptions
        displaySubscriptions(subscriptions);
        
    } catch (error) {
        console.error('Error loading subscriptions:', error);
        document.getElementById('subscriptionsTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger">
                    Error loading subscriptions. Please try again.
                </td>
            </tr>
        `;
    }
}

// Calculate subscription statistics
async function calculateSubscriptionStats() {
    try {
        const allSubscriptionsSnapshot = await getDocs(collection(db, 'subscriptions'));
        const allSubscriptions = allSubscriptionsSnapshot.docs.map(doc => doc.data());
        
        const totalSubscriptions = allSubscriptions.length;
        const activeSubscriptions = allSubscriptions.filter(sub => sub.status === 'active').length;
        const monthlyRevenue = allSubscriptions
            .filter(sub => sub.status === 'active')
            .reduce((sum, sub) => sum + (sub.finalPrice || 0), 0);
        const cancelledThisMonth = allSubscriptions.filter(sub => {
            if (sub.status !== 'cancelled' || !sub.cancelledAt) return false;
            const cancelledDate = sub.cancelledAt.toDate();
            const thisMonth = new Date();
            thisMonth.setDate(1);
            return cancelledDate >= thisMonth;
        }).length;
        const churnRate = totalSubscriptions > 0 ? ((cancelledThisMonth / totalSubscriptions) * 100).toFixed(1) : 0;
        
        // Update UI
        document.getElementById('totalSubscriptions').textContent = totalSubscriptions;
        document.getElementById('activeSubscriptions').textContent = activeSubscriptions;
        document.getElementById('monthlyRevenue').textContent = `₹${monthlyRevenue.toLocaleString()}`;
        document.getElementById('churnRate').textContent = `${churnRate}%`;
        
    } catch (error) {
        console.error('Error calculating subscription stats:', error);
    }
}

// Display subscriptions
function displaySubscriptions(subscriptions) {
    const tableBody = document.getElementById('subscriptionsTableBody');
    
    if (subscriptions.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No subscriptions found</td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = subscriptions.map(subscription => `
        <tr>
            <td>
                <strong>#${subscription.id.substring(0, 8).toUpperCase()}</strong>
            </td>
            <td>
                <div>${subscription.userEmail}</div>
                <small class="text-muted">${subscription.userId}</small>
            </td>
            <td>
                <div>${subscription.planName}</div>
                <small class="text-muted">Every ${subscription.frequency} month(s)</small>
            </td>
            <td>
                <strong>₹${subscription.finalPrice}</strong>
            </td>
            <td>
                <span class="badge bg-${getSubscriptionStatusColor(subscription.status)}">${subscription.status.toUpperCase()}</span>
                ${subscription.pausedUntil ? '<br><small class="text-warning">Paused</small>' : ''}
            </td>
            <td>
                ${subscription.nextDelivery ? formatDate(subscription.nextDelivery.toDate()) : 'N/A'}
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="viewSubscriptionDetails('${subscription.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline-warning" onclick="adminManageSubscription('${subscription.id}')" title="Manage">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Load vouchers section
async function loadVouchersSection() {
    const adminContent = document.getElementById('adminContent');
    
    adminContent.innerHTML = `
        <div class="admin-section">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>Voucher Management</h4>
                <button class="btn btn-primary" onclick="createNewVoucher()">
                    <i class="fas fa-plus"></i> Create Voucher
                </button>
            </div>
            
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Type</th>
                            <th>Value</th>
                            <th>Usage</th>
                            <th>Status</th>
                            <th>Expires</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="vouchersTableBody">
                        <tr>
                            <td colspan="7" class="text-center">
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">Loading vouchers...</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Load vouchers data
    await loadVouchersData();
}

// Load vouchers data
async function loadVouchersData() {
    try {
        const vouchersSnapshot = await getDocs(collection(db, 'vouchers'));
        const vouchers = vouchersSnapshot.docs.map(doc => ({
            code: doc.id,
            ...doc.data()
        }));
        
        displayVouchers(vouchers);
        
    } catch (error) {
        console.error('Error loading vouchers:', error);
        document.getElementById('vouchersTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger">
                    Error loading vouchers. Please try again.
                </td>
            </tr>
        `;
    }
}

// Display vouchers
function displayVouchers(vouchers) {
    const tableBody = document.getElementById('vouchersTableBody');
    
    if (vouchers.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No vouchers found</td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = vouchers.map(voucher => `
        <tr>
            <td>
                <strong>${voucher.code}</strong>
            </td>
            <td>
                <span class="badge bg-info">${voucher.type.toUpperCase()}</span>
            </td>
            <td>
                ${voucher.type === 'percentage' ? `${voucher.value}%` : `₹${voucher.value}`}
                ${voucher.maxDiscount ? `<br><small class="text-muted">Max: ₹${voucher.maxDiscount}</small>` : ''}
            </td>
            <td>
                <div>${voucher.usedCount || 0} / ${voucher.usageLimit || '∞'}</div>
                <div class="progress" style="height: 5px;">
                    <div class="progress-bar" style="width: ${voucher.usageLimit ? (voucher.usedCount || 0) / voucher.usageLimit * 100 : 0}%"></div>
                </div>
            </td>
            <td>
                <span class="badge bg-${voucher.isActive ? 'success' : 'danger'}">
                    ${voucher.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                ${voucher.expiresAt ? formatDate(voucher.expiresAt.toDate()) : 'Never'}
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editVoucher('${voucher.code}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteVoucher('${voucher.code}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Create new voucher
window.createNewVoucher = function() {
    showVoucherModal('create');
};

// Edit voucher
window.editVoucher = async function(voucherCode) {
    try {
        const voucherSnap = await getDoc(doc(db, 'vouchers', voucherCode));
        if (voucherSnap.exists()) {
            showVoucherModal('edit', { code: voucherCode, ...voucherSnap.data() });
        }
    } catch (error) {
        console.error('Error loading voucher:', error);
        showNotification('Error loading voucher', 'error');
    }
};

// Show voucher modal
function showVoucherModal(mode, voucher = {}) {
    const isEdit = mode === 'edit';
    
    const modalHTML = `
        <div class="modal fade" id="voucherModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${isEdit ? 'Edit' : 'Create'} Voucher</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="voucherForm">
                            <div class="mb-3">
                                <label class="form-label">Voucher Code</label>
                                <input type="text" class="form-control" id="voucherCode" value="${voucher.code || ''}" ${isEdit ? 'readonly' : ''} required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Type</label>
                                <select class="form-select" id="voucherType" required>
                                    <option value="percentage" ${voucher.type === 'percentage' ? 'selected' : ''}>Percentage</option>
                                    <option value="fixed" ${voucher.type === 'fixed' ? 'selected' : ''}>Fixed Amount</option>
                                    <option value="free_shipping" ${voucher.type === 'free_shipping' ? 'selected' : ''}>Free Shipping</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Value</label>
                                <input type="number" class="form-control" id="voucherValue" value="${voucher.value || ''}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Max Discount (Optional)</label>
                                <input type="number" class="form-control" id="maxDiscount" value="${voucher.maxDiscount || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Minimum Order Amount (Optional)</label>
                                <input type="number" class="form-control" id="minOrderAmount" value="${voucher.minOrderAmount || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Usage Limit (Optional)</label>
                                <input type="number" class="form-control" id="usageLimit" value="${voucher.usageLimit || ''}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Expires At (Optional)</label>
                                <input type="datetime-local" class="form-control" id="expiresAt" value="${voucher.expiresAt ? new Date(voucher.expiresAt.toDate()).toISOString().slice(0, 16) : ''}">
                            </div>
                            <div class="mb-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="isActive" ${voucher.isActive !== false ? 'checked' : ''}>
                                    <label class="form-check-label" for="isActive">Active</label>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Voucher</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('voucherModal'));
    modal.show();
    
    // Handle form submission
    document.getElementById('voucherForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveVoucher(isEdit);
    });
    
    // Remove modal when hidden
    modal._element.addEventListener('hidden.bs.modal', function() {
        document.getElementById('voucherModal').remove();
    });
}

// Save voucher
async function saveVoucher(isEdit) {
    try {
        const voucherData = {
            type: document.getElementById('voucherType').value,
            value: parseFloat(document.getElementById('voucherValue').value),
            maxDiscount: document.getElementById('maxDiscount').value ? parseFloat(document.getElementById('maxDiscount').value) : null,
            minOrderAmount: document.getElementById('minOrderAmount').value ? parseFloat(document.getElementById('minOrderAmount').value) : null,
            usageLimit: document.getElementById('usageLimit').value ? parseInt(document.getElementById('usageLimit').value) : null,
            expiresAt: document.getElementById('expiresAt').value ? new Date(document.getElementById('expiresAt').value) : null,
            isActive: document.getElementById('isActive').checked,
            updatedAt: serverTimestamp()
        };
        
        if (!isEdit) {
            voucherData.createdAt = serverTimestamp();
            voucherData.usedCount = 0;
        }
        
        const voucherCode = document.getElementById('voucherCode').value.toUpperCase();
        
        await setDoc(doc(db, 'vouchers', voucherCode), voucherData, { merge: isEdit });
        
        showNotification(`Voucher ${isEdit ? 'updated' : 'created'} successfully`, 'success');
        
        // Close modal and reload vouchers
        const modal = bootstrap.Modal.getInstance(document.getElementById('voucherModal'));
        modal.hide();
        loadVouchersData();
        
    } catch (error) {
        console.error('Error saving voucher:', error);
        showNotification('Error saving voucher', 'error');
    }
}

// Delete voucher
window.deleteVoucher = async function(voucherCode) {
    if (!confirm(`Are you sure you want to delete voucher "${voucherCode}"?`)) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, 'vouchers', voucherCode));
        showNotification('Voucher deleted successfully', 'success');
        loadVouchersData();
    } catch (error) {
        console.error('Error deleting voucher:', error);
        showNotification('Error deleting voucher', 'error');
    }
};

// Utility functions
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

function getSubscriptionStatusColor(status) {
    const statusColors = {
        'active': 'success',
        'paused': 'warning',
        'cancelled': 'danger',
        'pending': 'info'
    };
    return statusColors[status] || 'secondary';
}

function formatTime(date) {
    return new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}
