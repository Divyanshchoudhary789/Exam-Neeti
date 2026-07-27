# Exam Neeti Backend

NEET Sprint Exam Analytics Platform — Production-ready Node.js/Express backend with MongoDB Atlas and Brevo email integration.

## Quick Start (Local Development)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

3. **Fill in `.env` with your credentials:**
   - MongoDB Atlas URIs (2 databases on same cluster)
   - JWT secrets (generate with `openssl rand -hex 64`)
   - Brevo SMTP credentials (from https://app.brevo.com/settings/keys/smtp)
   - Cookie secret (generate with `openssl rand -hex 32`)

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Test the API:**
   ```bash
   curl http://localhost:10000/health
   ```

---

## Project Structure

```
backend/
├── config/          → DB connection, constants
├── controllers/     → Request handlers (8 modules)
├── middleware/      → Auth, validation, error handling
├── models/          → Mongoose schemas (10 models)
├── routes/          → API route definitions
├── services/        → Email, analytics, reports, question reconstruction
├── utils/           → Helpers (JWT, response formatters, etc.)
├── validators/      → Joi validation schemas
├── index.js         → App entry point
├── package.json     → Dependencies
├── render.yaml      → Render deployment config
└── .env.example     → Environment variables template
```

---

## Key Features

✅ JWT authentication with refresh tokens  
✅ Role-based access control (Student / Admin)  
✅ Formula-driven analytics engine (Module 3 A–F)  
✅ Question reconstruction with LRU reuse  
✅ PDF & Excel report generation (in-memory buffers)  
✅ Brevo email integration (8 templates)  
✅ Dual MongoDB databases (platform + question bank)  
✅ Rate limiting & security hardening  
✅ Render-optimized (ephemeral filesystem compatible)  

---

## Scripts

```bash
npm start       # Production (used by Render)
npm run dev     # Development with nodemon
npm run lint    # ESLint (if configured)
```

---

## Environment Variables

See `.env.example` for full list. Key variables:

- `NODE_ENV` — `development` or `production`
- `PORT` — Server port (default: 10000)
- `MONGO_URI` — Platform database connection string
- `QUESTION_BANK_MONGO_URI` — Question bank database connection string
- `JWT_SECRET` — Access token secret (min 64 chars)
- `JWT_REFRESH_SECRET` — Refresh token secret (min 64 chars)
- `BREVO_SMTP_USER` — Your Brevo account email
- `BREVO_SMTP_PASS` — Your Brevo SMTP key (not password)
- `EMAIL_FROM_ADDRESS` — Sender email (must be verified in Brevo)
- `CLIENT_URL` — Frontend URL(s) for CORS (comma-separated)
- `COOKIE_SECRET` — Cookie signing secret (min 32 chars)
- `TRUST_PROXY` — Set to `true` on Render (for rate limiting)

---

## API Documentation

**Base URL:** `/api/v1`

Full endpoint list in `STATUS.md` or `PRODUCTION_READY.md`

**Health check:**
```
GET /health
```

**Authentication:**
```
POST /api/v1/auth/login
POST /api/v1/auth/refresh-token
POST /api/v1/auth/forgot-password
PATCH /api/v1/auth/reset-password/:token
```

**Protected routes:**
All other endpoints require `Authorization: Bearer <token>` header.

---

## Deployment

**Production deployment on Render:**

Follow step-by-step guide in **`DEPLOYMENT.md`**

Quick summary:
1. Push to GitHub
2. Connect Render to your repo
3. Set environment variables in Render dashboard
4. Deploy (auto-deploys on every push to `main`)

Render config is in `render.yaml` — Render auto-detects it.

---

## Brevo Email Setup

1. Sign up at https://www.brevo.com
2. Go to Dashboard → SMTP & API → SMTP
3. Copy your SMTP login (your email) and SMTP key
4. Verify sender email or domain
5. Add credentials to `.env`:
   ```
   BREVO_SMTP_USER=your_email@example.com
   BREVO_SMTP_PASS=your_smtp_key_here
   EMAIL_FROM_ADDRESS=noreply@yourdomain.com
   ```

Free tier: 300 emails/day

---

## Database Setup

You need **2 databases** on the **same MongoDB Atlas cluster**:

1. **Platform DB** (`examneeti`)
   - Users, Batches, Sprints, Exams, Attempts, Analytics, Reports, Notifications

2. **Question Bank DB** (`questionbank`)
   - Questions (tagged for pattern slots)

Both use the same cluster, different database names:
```
mongodb+srv://user:pass@cluster.mongodb.net/examneeti
mongodb+srv://user:pass@cluster.mongodb.net/questionbank
```

---

## Security

- ✅ JWT access + refresh tokens
- ✅ bcrypt password hashing (12 rounds)
- ✅ Helmet security headers
- ✅ CORS with origin whitelist
- ✅ Rate limiting (100 req/15min, 10 req/15min for auth)
- ✅ Trust proxy for Render reverse proxy
- ✅ Input validation with Joi
- ✅ MongoDB injection protection via Mongoose

---

## Testing

**Manual testing:**
```bash
# Health check
curl http://localhost:10000/health

# Login
curl -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Get profile (replace TOKEN)
curl http://localhost:10000/api/v1/auth/me \
  -H "Authorization: Bearer TOKEN"
```

**Automated tests:** Not included in this build. Add with Jest/Mocha if needed.

---

## Monitoring

- **Render Logs:** Dashboard → Logs tab (real-time)
- **MongoDB Atlas Logs:** Performance monitoring, slow queries
- **Brevo Email Logs:** Dashboard → Statistics → Email Activity
- **NotificationLog:** Every email tracked in MongoDB

---

## Troubleshooting

**"Cannot connect to MongoDB"**
- Check Atlas network access (whitelist `0.0.0.0/0` or Render IPs)
- Verify connection string has no spaces
- Check MongoDB Atlas cluster is running

**"Brevo email not sending"**
- Verify sender email is verified in Brevo
- Check `BREVO_SMTP_PASS` is the SMTP key, not your password
- Check daily limit (300/day on free tier)

**"CORS error"**
- Add frontend URL to `CLIENT_URL` in `.env`
- Multiple origins: `CLIENT_URL=http://localhost:3000,https://prod.com`

**"Rate limit blocking all requests"**
- Set `TRUST_PROXY=true` in `.env` (for Render)
- Verify `app.set('trust proxy', 1)` is in `index.js`

**"Service sleeps on Render"**
- Free tier sleeps after 15 min inactivity
- First request after sleep takes ~30s
- Upgrade to paid plan ($7/mo) or ping `/health` every 10 min

---

## Documentation Files

- **`README.md`** — This file (quick start)
- **`DEPLOYMENT.md`** — Step-by-step Render + Brevo deployment
- **`PRODUCTION_READY.md`** — Complete feature list + what was changed for production
- **`STATUS.md`** — Module completion tracking + API reference
- **`.env.example`** — All environment variables documented

---

## License

ISC

## Author

Divyansh Choudhary

---

**For production deployment, see `DEPLOYMENT.md`**
