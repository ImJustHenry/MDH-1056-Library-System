# MDH 1056 Library System

A full-stack library management system built for **Professor Ozdemir** - room 1056 in the McDonnell Douglas Hall (MDH) at Saint Louis University.

**Live Demo:** https://mdh1056-library-frontend.onrender.com

---

## Tech Stack

| Layer      | Technology                                          |
| ---------- | --------------------------------------------------- |
| Frontend   | React 18 + Vite, react-router-dom v6                |
| Backend    | Python 3.11, Flask 3                                |
| Database   | MongoDB Atlas                                       |
| Auth       | Custom JWT HS256 - @slu.edu email verification only |
| Email      | Gmail SMTP (verification + password reset)          |
| CAPTCHA    | Google reCAPTCHA v2 (login protection)              |
| Deployment | Docker + Render (Blueprint)                         |

---

## Features

### Authentication

- Registration restricted to **@slu.edu** email addresses only
- Email verification required before first login
- **Forgot / reset password** - time-limited token sent by email
- Login protected by **reCAPTCHA v2** - blocks automated scripts
- **500 ms server-side delay** on every failed login - slows brute force without locking anyone out
- JWT issued on login (HS256, 24 hr expiry) - stateless, no sessions

### Book Catalog

- Full CRUD (admin only for add/edit/delete)
- Search by title, author, or ISBN
- Filter by availability
- Copy/quantity tracking per book

### Checkout System

- Cart-based checkout - add multiple books and check out at once
- 14-day loan period tracked per checkout
- Return flow updates availability in real time

### Admin Panel

- Check out books on behalf of any user
- View full checkout history with dates
- Terminal-style scrollable audit log - every action color-coded by type (checkout, return, add book, delete book, register, login)
- Dashboard with live stats (total books, checked out, overdue)

---

## Roles

| Role    | Permissions                                                                              |
| ------- | ---------------------------------------------------------------------------------------- |
| `user`  | Browse catalog, search/filter, add to cart, check out, view own checkouts                |
| `admin` | All user permissions + add/edit/delete books, manage all checkouts, audit log, dashboard |

> Admin role is granted at registration if the email is in `ADMIN_EMAILS` (`.env`).

---

## Project Structure

```
LibrarySystem/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # App factory, CORS
│   │   ├── config.py            # All config from .env
│   │   ├── db.py                # MongoDB connection helper
│   │   ├── email_utils.py       # Verification & reset email senders
│   │   ├── middleware/
│   │   │   └── auth.py          # @token_required, @admin_required decorators
│   │   └── routes/
│   │       ├── auth.py          # /register /verify /login /forgot-password /reset-password
│   │       ├── books.py         # CRUD + search/filter
│   │       ├── checkouts.py     # Checkout, cart-checkout, return
│   │       ├── logs.py          # Paginated audit log
│   │       └── dashboard.py     # Stats aggregation
│   ├── scripts/
│   │   └── init_db.py           # DB init + optional seed data
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── api/client.js        # Axios instance (VITE_API_URL aware)
│   │   ├── context/
│   │   │   ├── AuthContext.jsx  # Login, logout, register
│   │   │   └── CartContext.jsx  # Cart state
│   │   ├── components/
│   │   │   └── Navbar.jsx       # Sticky header, active links, cart badge
│   │   └── pages/
│   │       ├── LoginPage.jsx    # reCAPTCHA v2 integrated
│   │       ├── RegisterPage.jsx
│   │       ├── VerifyPage.jsx
│   │       ├── ForgotPasswordPage.jsx
│   │       ├── ResetPasswordPage.jsx
│   │       ├── BooksPage.jsx
│   │       ├── CartPage.jsx
│   │       ├── CheckoutsPage.jsx
│   │       ├── AdminPage.jsx    # Audit log terminal console
│   │       └── DashboardPage.jsx
│   ├── Dockerfile               # node:20-alpine build -> nginx:alpine serve
│   ├── nginx.conf               # SPA routing + static asset caching
│   └── vite.config.js
├── render.yaml                  # Render Blueprint (Docker, both services)
└── README.md
```

---

## Local Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- A MongoDB Atlas cluster
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cp .env.example .env           # fill in values (see below)
python run.py                  # runs on http://localhost:5000
```

**Seed the database (optional)**

```bash
python -m scripts.init_db --seed
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env           # optional: set Google Books API key
npm run dev                    # runs on http://localhost:5173
```

---

## Environment Variables

Create `backend/.env`:

```env
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/library
JWT_SECRET=<random 64-char hex string>
JWT_EXPIRY_HOURS=24
ALLOWED_EMAIL_DOMAIN=slu.edu
ADMIN_EMAILS=you@slu.edu

MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=your@gmail.com

FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

RECAPTCHA_SECRET=<your reCAPTCHA v2 secret key>
```

> `RECAPTCHA_SECRET` can be left empty locally - the backend skips CAPTCHA verification when the value is blank.

Create `frontend/.env` (optional for better barcode metadata reliability):

```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_BOOKS_API_KEY=<your-google-books-api-key>
```

If `VITE_GOOGLE_BOOKS_API_KEY` is empty, the app still uses Google Books anonymously, but requests can be rate-limited more easily.

### Get a Google Books API key

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Go to **APIs & Services -> Library** and enable **Books API**
4. Go to **APIs & Services -> Credentials -> Create Credentials -> API key**
5. (Recommended) Restrict the key:
   - **Application restrictions**: HTTP referrers (web sites)
   - Add your dev/prod origins (for example `http://localhost:5173/*`)
   - **API restrictions**: restrict to **Books API**
6. Paste the key into `frontend/.env` as `VITE_GOOGLE_BOOKS_API_KEY`
7. Restart the frontend dev server

---

## Deployment (Render)

The repo includes a `render.yaml` Blueprint for one-click deployment of both services via Docker.

1. Go to [render.com](https://render.com) -> **New -> Blueprint**
2. Connect the GitHub repo
3. Set the secret env vars in the Render dashboard:
   - Backend: `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAILS`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, `FRONTEND_URL`, `CORS_ORIGIN`, `RECAPTCHA_SECRET`
   - Frontend build arg: `VITE_API_URL` = your backend service URL

---

## Security

| Measure                  | Details                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------- |
| reCAPTCHA v2             | Required on login - automated scripts cannot obtain a valid token                   |
| 500 ms failure delay     | Server sleeps on wrong password - slows brute force, no lockouts or false positives |
| Generic auth errors      | Same message for wrong email or wrong password - prevents user enumeration          |
| Email domain restriction | Only `@slu.edu` addresses can register                                              |
| JWT expiry               | Tokens expire after 24 hours                                                        |
| CORS                     | Backend only accepts requests from the configured frontend origin                   |

---

## Clone

```bash
git clone https://github.com/ImJustHenry/MDH-1056-Library-System.git
```
