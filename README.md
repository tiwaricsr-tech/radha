# Radha Swami — Full-Stack E-Commerce Ordering System

Complete separated full-stack e-commerce ordering platform for a Sweets & Snacks shop built with **React**, **Node.js**, **Express**, **MongoDB (Mongoose)**, and **Socket.IO + SSE Real-Time Sync**.

---

## Project Folder Structure (3 Separate Apps)

```text
/home/user
├── admin-dashboard-design.png   # High-res UI design mockup of the Admin Dashboard
├── backend/                     # Node.js + Express + MongoDB (Mongoose) + Real-Time Server (Port 5000)
│   ├── models/                  # Mongoose Schemas: User, Product, Coupon, Order, Review, DeliveryConfig
│   ├── routes/                  # Modular REST API routes (auth, products, coupons, orders, reviews, delivery, analytics)
│   ├── services/store.js        # MongoDB repository + automatic persistent JSON fallback when MONGO_URI is offline
│   ├── middleware/auth.js       # Google OAuth + JWT authentication & admin role guard
│   ├── data/seedData.js         # Initial Sweets & Snacks catalog, coupons, orders & reviews
│   ├── public/images/           # Studio product food photography
│   └── server.js                # Express + Socket.IO + SSE (/api/stream) entrypoint
├── admin-dashboard/             # Separate React + Vite Admin Dashboard App (Port 5174)
│   └── src/                     # Overview, Live Incoming Orders, Products CRUD, Coupons, Revenue Chart, Reviews, Delivery Rules
└── customer-frontend/           # Separate React + Vite Customer Storefront App (Port 5173)
    └── src/                     # Menu, Full/Half/Weight Variant Picker, Google Login, Cart, Distance Checkout, Live Order Tracker
```

---

## Key Features Implemented

### 1. Separate Admin Dashboard (`admin-dashboard/` — Port `5174`)
- **Google Login** (`/api/auth/google`): Supports real Google Identity Services (`GOOGLE_CLIENT_ID`) + 1-click Google Admin Demo Chooser (`admin@shreemithai.in`).
- **Product & Portion/Weight Pricing Management**: Add, edit, toggle stock, or delete sweets & snacks with independent prices for **Full**, **Half**, **250g**, **500g**, and **1kg**.
- **Coupon Management**: Create, pause/activate, and delete percentage (`%`) or flat (`₹`) promo coupons (`FESTIVE20`, `FIRST50`, `ROYAL150`).
- **Live Incoming Orders**: Real-time incoming order feed with customer details, distance fee breakdown, and 1-click status progression (`Accept` → `Prepare` → `Out for Delivery` → `Delivered`).
- **Revenue Tracking & Analytics**: Live Today's Revenue KPI, All-Time Revenue, 7-day smooth SVG revenue chart, and Top-Selling Sweets & Snacks leaderboard.
- **Customer Reviews**: Read verified customer ratings & comments and publish official store owner replies.
- **Delivery & Payment Controls**: Configure distance-based delivery charges, free-delivery threshold, store open/paused status, and enable or disable Cash on Delivery. Disabling COD removes it from checkout and is enforced by the order API.
- **Help Requests**: Review and resolve customer chat enquiries.
- **Cancellation Requests**: Review customer cancellation requests, inspect the related order, and approve or reject them from the dedicated dashboard section.

### 2. Separate Customer Website (`customer-frontend/` — Port `5173`)
- **Clean Menu & Search**: Category filters (`Sweets`, `Hot Snacks`, `Bengali & Dairy Sweets`, `Namkeen & Savory`), instant search, Veg badges, and prep times.
- **Full, Half & Weight Options**: Every item dynamically lets customers pick **Full**, **Half**, **250g**, **500g**, or **1kg** with live price updates.
- **Google Login**: Customer Google sign-in modal with persistent JWT sessions.
- **Cart, Promo Coupons & Distance-Based Checkout**: Interactive locality/distance selector calculating delivery charges, coupon validation, Razorpay checkout for online payments, and Cash on Delivery.
- **Live Order Tracking**: 5-stage live order tracker (`Order Placed` → `Accepted` → `Preparing` → `Out for Delivery` → `Delivered`) that updates **instantly without page refresh** when Admin updates an order.
- **Help Chat Agent**: The Help button in the header and the floating chat control can track orders, answer payment questions, collect issue reports, and submit cancellation requests for admin approval.

### 3. Instant Real-Time Sync (`backend/` — Port `5000`)
- Every Admin mutation (`POST/PUT/DELETE /api/products`, `/api/coupons`, `/api/delivery`, `PATCH /api/orders/:id/status`, `PATCH /api/reviews/:id/reply`) updates the database and broadcasts immediately over **Socket.IO + SSE (`/api/stream`)** so connected customer browsers reflect changes in real time.

### Razorpay Setup
- Add your Razorpay **Key ID** and **Key Secret** to `backend/.env` as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Use Razorpay test-mode keys for development; never expose the Key Secret in frontend code.
- Restart the backend after changing the keys. Online checkout remains unavailable until both keys are configured.
- The backend calculates the checkout total, creates the Razorpay order, verifies the payment signature and captured payment, and only then records the paid order. Cash on Delivery remains available without Razorpay.

### WhatsApp Order Confirmations
- WhatsApp confirmations are sent to the customer's Indian mobile number only when they enter a valid number and explicitly select the opt-in checkbox at checkout. The order can still be placed if WhatsApp is unavailable or not configured.
- The order confirmation is sent after an admin assigns a delivery-agent phone number from the order card. The message includes the order number, total, payment method, and assigned agent number.
- The storefront shows the opt-in control only when the backend reports WhatsApp as configured. Secret-free API endpoints are available at `GET /api/whatsapp/status` and `GET /api/whatsapp/validate-phone?phone=...`.
- Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_TEMPLATE_NAME` in `backend/.env`. Optionally set `WHATSAPP_TEMPLATE_LANGUAGE` and `WHATSAPP_GRAPH_API_VERSION`; restart the backend after changing these values.
- Create and get approval for a Meta WhatsApp Cloud API template whose body has exactly five text placeholders, in this order: customer name, order number, amount, payment method, and delivery-agent phone. For example: `Hi {{1}}, thank you for order {{2}} worth {{3}}. Payment: {{4}}. Your delivery agent contact is {{5}}.`
- Keep the access token private in `backend/.env`; never put it in frontend code or share it in chat.

### Help Chat Agent
- The rule-based support agent does not require an external AI key. It uses `POST /api/chat/start` and `POST /api/chat/message`; admin actions are protected by the existing admin authentication.
- Customers can track orders, report late/missing/quality issues, ask about payment, or request cancellation. Cancellation requests remain pending until an admin approves them from **Cancellation Requests**.
- Chat tickets and cancellation requests (including contact information submitted for support) are stored in `backend/data/chat.json`. Keep this file private and back it up with the rest of the order data.

---

## Running Locally

### 1. Backend (`Port 5000`)
```bash
cd backend
cp .env.example .env   # Set MONGO_URI (MongoDB Atlas or local mongod) & GOOGLE_CLIENT_ID
npm install
npm run dev
```

### 2. Admin Dashboard (`Port 5174`)
```bash
cd admin-dashboard
npm install
npm run dev
```

### 3. Customer Website (`Port 5173`)
```bash
cd customer-frontend
npm install
npm run dev
```
