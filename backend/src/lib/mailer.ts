import nodemailer from "nodemailer";
import dotenv from "dotenv"

dotenv.config()

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  service: "Gmail",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for port 465, false for port 587
  debug: true,
  logger: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // 16-character App Password (not your normal Gmail password)
  }, // family is not a nodemailer function? use it in index.ts
});

export const sendEmail = async (to: string, subject: string, text: string) => {
  // Read process.env at execution time rather than import time
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    logger: true,
    debug: true,
  });

  return await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    text,
  });
};

// Verify credentials on startup
transporter.verify((error) => {
  if (error) {
    console.error("SMTP Configuration Error:", error);
  } else {
    console.log("SMTP Server is ready to send emails");
  }
});

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendWelcomeEmail = async (toEmail: string, fullname: string, otp: string) => {
  try {
    await transporter.sendMail({
      from: `"ITS App" <${process.env.SMTP_USER}`,
      to: toEmail,
      subject: "Welcome to ITS Service Portal",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Welcome, ${fullname}!</h2>
          <p>Thank you for registering on our application.</p>
          <p>Your account (NRP: <strong>${toEmail.split('@')[0]}</strong>) is now active.</p>
          <p>Use this following OTP code to log in<p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 16px 0;">${otp}</p>
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
      from: `"ITS App" <${process.env.SMTP_USER}`,
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