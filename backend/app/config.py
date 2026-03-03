import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # MongoDB
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/library")

    # JWT (HS256 — signed with this secret)
    JWT_SECRET = os.getenv("JWT_SECRET", "change-me-before-production")
    JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

    # Email domain restriction
    ALLOWED_EMAIL_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "slu.edu")
    # Comma-separated list of emails that get the admin role on registration
    ADMIN_EMAILS = [e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()]

    # SMTP (for verification emails)
    MAIL_SERVER   = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT     = int(os.getenv("MAIL_PORT", "587"))
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
    MAIL_FROM     = os.getenv("MAIL_FROM")

    # Frontend URL — used in verification email links
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # reCAPTCHA v2 — secret key for server-side token verification
    RECAPTCHA_SECRET = os.getenv("RECAPTCHA_SECRET", "")

    # CORS
    CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")
