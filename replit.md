# Picklish Foods - E-commerce Platform

## Overview

Picklish Foods is a premium pickle and gourmet food e-commerce platform built as a single-page web application. The system features a comprehensive shopping experience with subscription services, loyalty programs, admin management, and integrated payment processing. The application uses Firebase as the backend-as-a-service platform with Google Sheets integration for data management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a modular frontend architecture with Firebase backend services:

**Frontend Architecture:**
- Single-page application (SPA) using vanilla JavaScript with ES6 modules
- Bootstrap 5 for responsive UI framework
- Font Awesome for iconography
- Modular component structure with separate JS modules for each feature

**Backend Architecture:**
- Firebase Authentication for user management
- Firestore for real-time database operations
- Firebase Storage for file uploads
- Google Sheets API integration for data synchronization
- Razorpay integration for payment processing

**Data Storage:**
- Primary: Google Firestore for real-time data
- Secondary: Google Sheets for data management and admin operations
- Local Storage: Cart persistence and user preferences

## Key Components

### Authentication System
- Google OAuth integration via Firebase Auth
- Role-based access control (admin/customer)
- Persistent login state management
- Admin privilege verification

### E-commerce Features
- Product catalog with categories and filtering
- Shopping cart with quantity management
- Order processing and tracking
- Inventory management integration

### Subscription Service
- Multiple subscription plans (monthly, quarterly, annual)
- Subscription management and billing
- Pause/resume functionality
- Customization options for subscription boxes

### Loyalty Program
- Points-based reward system
- Tier-based benefits (Bronze, Silver, Gold, Platinum)
- Referral bonuses and promotional rewards
- Voucher system integration

### Admin Dashboard
- Order management and fulfillment
- Product catalog administration
- Customer management
- Analytics and reporting
- Inventory tracking

### Payment Processing
- Razorpay integration for Indian market
- Multiple payment methods support
- Secure transaction handling
- Payment status tracking and webhooks

### Review System
- Product reviews and ratings
- Image upload support for reviews
- Moderation capabilities
- Review analytics

## Data Flow

1. **User Authentication**: Google OAuth → Firebase Auth → User document creation in Firestore
2. **Product Data**: Google Sheets → Firestore cache → Frontend display
3. **Shopping Cart**: Local storage → Order creation → Firestore → Payment processing
4. **Subscription Flow**: Plan selection → Payment → Firestore subscription record → Recurring billing
5. **Admin Operations**: Admin panel → Firestore updates → Google Sheets synchronization

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore database, Storage
- **Google Sheets API**: Data management and synchronization
- **Razorpay**: Payment gateway for Indian market

### Frontend Libraries
- **Bootstrap 5**: UI framework and responsive design
- **Font Awesome**: Icon library
- **Google APIs**: Sheets and Drive integration

### Development Tools
- ES6 Modules for code organization
- Modern JavaScript features (async/await, destructuring)
- Browser-native features (fetch API, localStorage)

## Deployment Strategy

**Static Hosting Approach:**
- Frontend deployed as static assets (HTML, CSS, JS)
- Firebase hosting recommended for seamless integration
- Environment-specific configuration via window variables
- CDN delivery for external libraries (Bootstrap, Font Awesome)

**Configuration Management:**
- Environment variables for API keys and configuration
- Conditional loading for development vs production
- Firebase project configuration per environment

**Security Considerations:**
- API keys restricted by domain/origin
- Firebase security rules for data access
- Admin role enforcement at multiple levels
- Input validation and sanitization

**Performance Optimizations:**
- Lazy loading of modules
- Local storage for cart persistence
- Firestore caching strategies
- Image optimization for product displays

The architecture prioritizes maintainability, scalability, and user experience while leveraging serverless technologies to minimize operational overhead. The modular design allows for easy feature additions and modifications without affecting core functionality.