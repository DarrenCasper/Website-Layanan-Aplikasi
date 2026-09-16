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