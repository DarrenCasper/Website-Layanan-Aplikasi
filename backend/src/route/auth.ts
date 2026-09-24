import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import Jwt from "jsonwebtoken";
import { prisma } from "../lib/db.ts";
import { sendWelcomeEmail } from "../lib/mailer.ts";
import { Prisma } from "../generated/prisma/client.ts";
import { verifyAndConsumeOtp, type OtpPurpose } from "../memory/otp.ts"

const authRouter = Router();


const ALLOWED_PURPOSES: OtpPurpose[] = ["REGISTRATION", "LOGIN_2FA"]

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
    sendWelcomeEmail(user.email, user.namaLengkap);

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

authRouter.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const { email, otp, purpose } = req.body || {}

    if (!email || !otp || !purpose) {
      return res.status(400).json({ message: "Email and OTP code are required" })
    }

    if (!ALLOWED_PURPOSES.includes(purpose)) {
      return res.status(400).json({
        message: `Invalida purpose. Must be one of: ${ALLOWED_PURPOSES.join(", ")}`
      })
    }

    const normalizeEmail = email.toLowerCase().trim()

    const result = verifyAndConsumeOtp(purpose, normalizeEmail, otp)

    if (!result.success) {
      const messages: Record<string, string> = {
        EXPIRED: "The OTP has expired. Please request a new one.",
        MISMATCH: `Incorrect OTP code. ${result.remainingAttempts ?? 0} attempts left.`,
        TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Request a new OTP.",
        NOT_FOUND: "No active verification code found for this action.",
      };

      const status = result.reason === "TOO_MANY_ATTEMPTS" ? 429 : 400
      return res.status(status).json({
        message: messages[result.reason!] || "Invalid OTP"
      })
    }

    switch (purpose) {
      case "REGISTRATION": {
        const user = await prisma.user.update({
          where: { email: normalizeEmail },
          data: { isVerified: true },
          select: { id: true, email: true, isVerified: true }
        })

        return res.status(200).json({
          message: "Email succesfully verified. You can now Log in.",
          user
        })
      }
      case "LOGIN_2FA": {
        const user = await prisma.user.findUnique({
          where: { email: normalizeEmail },
          select: { id: true, email: true, isVerified: true }
        })

        if (!user) {
          return res.status(404).json({ message: "User account not found." })
        }

        if(!process.env.JWT_SECRET){
          return res.status(500).json({message: "JWT secret is not configured"})
        }

        const token = Jwt.sign(
          { userId: user.id, email: user.email },
          process.env.JWT_SECRET!,
          { expiresIn: "7d" }
        )

        return res.status(200).json({
          message: "Login successfull",
          token,
          user
        })
      }
    }
  }
  catch(err){
    console.error(err)
    return res.status(500).json({message: "Internal server error"})
  }
})

export default authRouter;