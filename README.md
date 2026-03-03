# Library System

A full-stack library management system built for **Professor Sahin Ozdemir** as part of the MDH-1056 course at Saint Louis University.

**Live Demo:** https://mdh1056-library-frontend.onrender.com

## Tech Stack

| Layer    | Technology                               |
| -------- | ---------------------------------------- |
| Frontend | React (Vite)                             |
| Backend  | Python Flask                             |
| Database | MongoDB Atlas                            |
| Auth     | Custom JWT (@slu.edu email verification) |

## Auth Flow

- Registration restricted to **@slu.edu** email addresses only
- On register: a verification token is generated, stored in MongoDB, and emailed to the user
- User clicks the verification link → account marked `verified: True`
- Login returns a signed **JWT (HS256)** — no sessions
- React attaches the JWT as a `Bearer` header on every API request
- Flask decodes and validates the token on protected routes

## Roles

| Role    | Permissions                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`  | View catalog, search, filter, check out books                                                                                                 |
| `admin` | Everything a user can, plus: add/delete books, view checkout history with dates, checkout on behalf of users, view audit logs, view dashboard |

> Admin role is granted at registration if the email is listed in `ADMIN_EMAILS` in `.env`.

## Features

- **Book catalog** — search by title, author, ISBN; filter by availability
- **Checkout system** — track who has what book and when
- **Audit log** — every checkout/return action is logged
- **Dashboard** — total books vs. checked-out count
- **Admin panel** — full CRUD on books, user checkout management

## Project Structure

```
LibrarySystem/
├── backend/                  # Flask API
│   ├── app/
│   │   ├── __init__.py       # App factory
│   │   ├── config.py         # Config from .env
│   │   ├── db.py             # MongoDB connection
│   │   ├── email_utils.py    # Verification email sender
│   │   ├── middleware/
│   │   │   └── auth.py           # JWT decorators (token_required, admin_required)
│   │   └── routes/
│   │       ├── auth.py           # /register, /verify/<token>, /login
│   │       ├── books.py          # (Step 7)
│   │       ├── checkouts.py      # (Step 8)
│   │       ├── logs.py           # (Step 9)
│   │       └── dashboard.py      # (Step 10)
│   ├── requirements.txt
│   ├── .env.example
│   └── run.py
├── frontend/                 # React app (scaffolded in Step 11)
├── .gitignore
└── README.md
```

## Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # Fill in your values
python run.py
```

### Frontend (after Step 11)

```bash
cd frontend
npm install
npm run dev
```

## Roadmap

- [x] Step 1 — Project structure & config
- [x] Step 2 — MongoDB Atlas setup
- [x] Step 3 — Custom JWT auth (@slu.edu email verification)
- [x] Step 4 — MongoDB indexes & seed data
- [x] Step 5 — Book routes
- [x] Step 6 — Checkout routes
- [x] Step 7 — Log routes
- [x] Step 8 — Dashboard route
- [x] Step 9 — React app init
- [x] Step 10 — Auth flow in React (login, register, verify)
- [x] Step 11 — Book catalog page
- [x] Step 12 — Checkout flow
- [x] Step 13 — Deployed to Render
- [ ] Step 13 — Admin panel
- [ ] Step 14 — Dashboard page

## Getting Started

Clone the repository and follow setup instructions to get the project running locally.

```bash
git clone https://github.com/ImJustHenry/MDH-1056-Library-System.git
```
