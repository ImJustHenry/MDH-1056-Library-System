import sendgrid
from sendgrid.helpers.mail import Mail
from flask import current_app


def _send(to_email: str, subject: str, html_body: str) -> None:
    """Send an email via SendGrid HTTP API."""
    sg = sendgrid.SendGridAPIClient(api_key=current_app.config["SENDGRID_API_KEY"])
    message = Mail(
        from_email=current_app.config["MAIL_FROM"],
        to_emails=to_email,
        subject=subject,
        html_content=html_body,
    )
    sg.send(message)


def send_verification_email(to_email: str, token: str) -> None:
    """Send an HTML verification email via SendGrid."""
    frontend_url = current_app.config["FRONTEND_URL"]
    verify_url = f"{frontend_url}/verify-email?token={token}"

    html_body = f"""
    <html>
      <body style="font-family:sans-serif;color:#333;">
        <h2 style="color:#003087;">MDH 1056 Library System</h2>
        <p>Thanks for registering! Click the button below to verify your
           <strong>{to_email}</strong> address.</p>
        <a href="{verify_url}"
           style="display:inline-block;padding:12px 24px;background:#003087;
                  color:#fff;text-decoration:none;border-radius:4px;">
          Verify Email
        </a>
        <p style="margin-top:20px;font-size:12px;color:#888;">
          Or copy this link into your browser:<br>
          <a href="{verify_url}">{verify_url}</a><br><br>
          This link expires in 24 hours. If you did not register, ignore this email.
        </p>
      </body>
    </html>
    """

    _send(to_email, "Verify your MDH 1056 Library account", html_body)


def send_reset_email(to_email: str, token: str) -> None:
    """Send an HTML password reset email via SendGrid."""
    frontend_url = current_app.config["FRONTEND_URL"]
    reset_url = f"{frontend_url}/reset-password?token={token}"

    html_body = f"""
    <html>
      <body style="font-family:sans-serif;color:#333;">
        <h2 style="color:#003087;">MDH 1056 Library System</h2>
        <p>We received a request to reset the password for <strong>{to_email}</strong>.</p>
        <a href="{reset_url}"
           style="display:inline-block;padding:12px 24px;background:#003087;
                  color:#fff;text-decoration:none;border-radius:4px;">
          Reset Password
        </a>
        <p style="margin-top:20px;font-size:12px;color:#888;">
          Or copy this link into your browser:<br>
          <a href="{reset_url}">{reset_url}</a><br><br>
          This link expires in 1 hour. If you did not request a reset, ignore this email.
        </p>
      </body>
    </html>
    """

    _send(to_email, "Reset your MDH 1056 Library password", html_body)
