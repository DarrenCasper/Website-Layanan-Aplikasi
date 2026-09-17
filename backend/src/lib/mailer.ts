import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendWelcomeEmail = async (toEmail: string, fullname: string) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: toEmail,
      subject: "Welcome to ITS Service Portal",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Welcome, ${fullname}!</h2>
          <p>Thank you for registering on our application.</p>
          <p>Your account (NRP: <strong>${toEmail.split('@')[0]}</strong>) is now active.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Email sending failed:", error);
    // Do not throw error here so user registration still completes even if mail fails
  }
};

export const sendOtpEmail = async (toEmail: string, otp: string) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: toEmail,
      subject: "Your OTP Code for Password Reset",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Use the following One-Time Password (OTP) to reset your password:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 16px 0;">${otp}</p>
          <p>This code will expire shortly. If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Email sending failed:", error);
  }
};