---
description: How to deploy Mujic backend to Railway and build the production APK
---

# Deploying Mujic Backend & Building Android APK

Follow these steps to deploy your backend to Railway and build the production APK from your React Native project.

---

## Part 1: Deploying the Backend to Railway

### 1. Database & Redis Services
1. Log in to [Railway.app](https://railway.app).
2. Click **New Project** → **Provision PostgreSQL** to spin up a production database instance.
3. Click **New** (top-right of canvas) → **Database** → **Add Redis** to spin up a production Redis instance.

### 2. Deploying the Node.js app
1. Click **New** → **GitHub Repo** → select your `Mujic` repository.
2. In the service settings:
   - Under **General**, set **Root Directory** to `backend`.
   - Railway will automatically detect the `Dockerfile` inside the `backend` folder and write a build plan.
3. Go to **Variables** and add these variables (copy from your local `.env`):
   - `DATABASE_URL`: Click the reference button next to variable field, and link to your PostgreSQL database's connection string (e.g. `${{ Postgres.DATABASE_URL }}`).
   - `REDIS_URL`: Link to your Redis connection string (e.g. `${{ Redis.REDIS_URL }}`).
   - `JWT_ACCESS_SECRET`: Generate a random 32-byte hex string.
   - `JWT_REFRESH_SECRET`: Generate a random 32-byte hex string.
   - `TEMP_CACHE_KEY`: Generate a random 32-byte hex string.
   - `PORT`: `3000`
   - `NODE_ENV`: `production`
   - `API_URL`: Use the domain name Railway supplies under **Settings** → **Domains** (e.g. `https://mujic-production.up.railway.app`).
   - `CORS_ORIGIN`: `*`
   - `CF_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`: (Provide if using Cloudflare R2 for uploads, else leave empty to fall back to local disk storage).
4. Save variables. Railway will automatically deploy the service.

> [!NOTE]
> Database migrations will automatically run on every deploy because the container's `start.sh` script executes `npx prisma migrate deploy` prior to running the app server.

---

## Part 2: Building the Release APK

### 1. Update the Server API URL
Open `frontend/src/constants/config.ts` and set your Production domain:
```typescript
export const API_URL = 'https://your-railway-app-domain.up.railway.app';
```

### 2. Build the Android Release APK
Open a terminal in the root folder and run:
```powershell
cd frontend/android
./gradlew assembleRelease
```

Once the compilation completes, the release-ready APK is generated at:
`frontend/android/app/build/outputs/apk/release/app-release.apk`

Copy this APK to your phone or share the file to start playing in production!
