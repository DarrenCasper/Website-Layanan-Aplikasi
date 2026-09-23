import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import Jwt from "jsonwebtoken";
import { prisma } from "../lib/db.ts";
import { generateOTP, sendWelcomeEmail } from "../lib/mailer.ts";
import { storeOTP, verifyOTP, clearOTP } from "../lib/otpStore.ts";
import { Prisma } from "../generated/prisma/client.ts";

const authRouter = Router();

function providedToken(userId: string, email: string) {
  const secret = process.env.JWT_TOKEN;

  if (!secret) {
    throw new Error("JWT_TOKEN is not SET");
  }
  return Jwt.sign({ sub: userId, email }, secret, { expiresIn: "7d" });
}

authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, fullname, username, department, fakultas } = req.body;

    if (!email || !password || !fullname || !username || !department || !fakultas) {
      return res.status(400).json({ message: "all parameter must be filled" });
    }

    // Strict domain check (ends with @student.its.ac.id)
    if (!email.endsWith("@student.its.ac.id")) {
      return res.status(400).json({ message: "Email must be provided using the ITS one" });
    }

    const NRP = String(email.slice(0, email.indexOf("@")));

    const passwordHashed = await bcrypt.hash(password, 10);

    // 2. Generate OTP & save ONLY in backend memory (valid for 10 mins)
    const rawOTP = generateOTP();
    await storeOTP(email, rawOTP, 10);

    // 3. Dispatch welcome email
    await sendWelcomeEmail(email, fullname || "User", rawOTP);

    const user = await prisma.user.create({
      data: {
        id: NRP,
        email: email,
        passwordHashed: passwordHashed,
        namaLengkap: fullname,
        username: username,
        departemen: department,
        fakultas: fakultas,
      },
    });

    // Send Welcome Email (non-blocking)
    sendWelcomeEmail(user.email, user.namaLengkap, rawOTP);

    const token = providedToken(user.id, email);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullname: user.namaLengkap,
        username: user.username,
        department: user.departemen,
        fakultas: user.fakultas,
        createdAt: user.createdAt,
        isVerified: false
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Prisma supplies the conflicting target fields in err.meta.target
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(", ")
        : "email or username";

      return res.status(409).json({
        message: `A user with this ${target} already exists.`,
      });
    }
    console.error(err);
    return res.status(500).json({ message: "server internal error" });
  }
});

authRouter.post("/verify-otp", async (req: Request, res: Response)=>{
  const { email, otp } = req.body;

  // Basic validation
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP code are required." });
  }

  try {
    // 1. Check if user exists in MySQL
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: "Account is already verified." });
    }

    // 2. Validate OTP against in-memory store
    const isValid: boolean = await verifyOTP(email, otp);

    if (!isValid) {
      return res.status(400).json({
        error: "Invalid or expired OTP code. Please request a new one.",
      });
    }

    // 3. Update user status in MySQL
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { isVerified: true },
      select: {
        id: true,
        email: true,
        namaLengkap: true,
        isVerified: true,
      },
    });

    return res.status(200).json({
      message: "Email successfully verified!",
      user: updatedUser,
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return res.status(500).json({ error: "Internal server error during verification." });
  }
})

authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and Password are needed" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHashed);

    if (!isValidPassword) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    const token = providedToken(user.id, user.email);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullname: user.namaLengkap,
        username: user.username,
        department: user.departemen,
        fakultas: user.fakultas,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Interal Server Error" });
  }
});

export default authRouter;