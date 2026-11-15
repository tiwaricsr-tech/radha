# Deployment: Vercel + Render + MongoDB Atlas

This repository contains two Vite frontends and one persistent Express backend.

## Architecture

- Vercel serves the customer storefront at `/` and the admin app at `/admin`.
- Vercel serverless proxy functions forward `/api/*` and `/uploads/*` to the Render backend.
- Render runs the Express backend as a persistent Node service.
- MongoDB Atlas stores products, users, coupons, orders, reviews, and delivery configuration.

Do not deploy the Express server itself as a Vercel Function: the app expects a long-running server and has realtime/persistent-server behavior.

## 1. Create MongoDB Atlas database

1. Create a free MongoDB Atlas cluster.
2. Create a database user and password.
3. In Network Access, allow the Render service to connect (for a quick initial setup you can allow `0.0.0.0/0`; use stricter network access controls where available).
4. Copy the Node.js connection string and replace the password and database name. Example format:
   `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/radha-swami?retryWrites=true&w=majority`

Keep the URI private.

## 2. Deploy backend on Render

1. In Render, choose **New → Blueprint** and connect this GitHub repository.
2. Select branch `deploy/vercel-render-setup` initially (after reviewing/merging the pull request, use `main`).
3. Render reads `render.yaml` and creates the `radha-swami-backend` web service.
4. Add the environment variables when prompted:
   - `MONGO_URI`: your Atlas connection string
   - `GOOGLE_CLIENT_ID`: your Google OAuth web client ID
   - `ADMIN_EMAILS`: comma-separated admin email addresses
   - `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`: optional until online payments are enabled
   - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`: optional until WhatsApp Cloud API is configured
5. Deploy. Confirm the service health endpoint works:
   `https://YOUR-RENDER-SERVICE.onrender.com/api/health`

The backend now refuses to start in production if MongoDB is unavailable; this prevents silently storing orders in an ephemeral local JSON file.

## 3. Deploy frontends on Vercel

1. In Vercel, choose **Add New → Project** and import `tiwaricsr-tech/radha`.
2. Set the production branch to `deploy/vercel-render-setup` for the initial test, or `main` after merging the pull request.
3. Set the **Root Directory** to the repository root (leave it as `./`).
4. Vercel detects `vercel.json`. The build command installs each frontend's dependencies and builds both apps into the shared `dist/` folder.
5. Add this environment variable in Vercel → Project → Settings → Environment Variables:
   - `BACKEND_URL` = the Render service origin only, e.g. `https://YOUR-RENDER-SERVICE.onrender.com` (no trailing slash and no `/api` suffix).
6. Deploy.

The frontends use same-origin relative API paths, so do not set `VITE_API_URL` in Vercel. Browser requests go to Vercel at `/api/*`; the Vercel function uses the server-only `BACKEND_URL` to reach Render.

## 4. Configure OAuth and payments

- In Google Cloud Console, add your Vercel production domain to the authorized JavaScript origins for the Google OAuth client. Use the same `GOOGLE_CLIENT_ID` in Render.
- Configure Razorpay credentials only on Render. Never put the Razorpay secret in Vercel frontend variables.
- Configure WhatsApp Cloud API credentials only on Render.

## 5. Test after deployment

- Open `/` and confirm the storefront loads.
- Open `/admin` and confirm the admin login loads.
- Open `/api/health` and confirm it returns `status: "ok"` and `storageMode: "mongodb"`.
- Create a test product and test order, then reload and confirm they remain.
- Test product images under `/uploads/*`.
- Test order updates from the admin and confirm the customer order tracker refreshes.

## Important current limitations

- The help-chat cancellation/enquiry store currently writes to `backend/data/chat.json`. That file is not MongoDB-backed and may be lost when the Render service is redeployed or restarted. Do not rely on chat enquiries/cancellation tickets for production until that store is migrated to MongoDB or a persistent disk is configured.
- Product images served from `backend/public` are part of the repository. Images uploaded dynamically to the backend filesystem would not be durable on an ephemeral host; use object storage for future admin uploads.
- The browser currently polls `/api/sync` for changes. Keep the backend on a persistent Render service; Vercel Functions are not the realtime server.
- This change configures deployment routing and builds. It does not create Vercel, Render, MongoDB, Google, Razorpay, or WhatsApp accounts, and it cannot add secrets to those accounts.
