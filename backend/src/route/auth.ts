import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import Jwt from "jsonwebtoken";
import { prisma } from "../lib/db.ts";
import { sendWelcomeEmail } from "../lib/mailer.ts"; // <-- 1. Import mailer

const authRouter = Router();

function providedToken(userId: string, email: string) { // Fixed TypeScript 'String' to 'string'
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
        Fullname: user.namaLengkap,
        username: user.username,
        department: user.departemen,
        fakultas: user.fakultas,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "server internal error" });
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
    try{
        const{email, password} = req.body

        if(!email || !password){
            return res.status(400).json({message: "Email and Password are needed"})
        }
        
        const user = await prisma.user.findUnique({
            where: {email}
        })
        if(!user){
            return res.status(400).json({message: "Invalid Credentials"})
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHashed)

        if(!isValidPassword){
            return res.status(400).json({message: "Invalid Credentials"})
        }

        const token = providedToken(user.id, user.email)

        return res.status(200).json({
            token,
            user: {
                id: user.id,
                email: user.email
            }
        })
    }
    catch(err){
        console.error(err)
        return res.status(500).json({message: "Interal Server Error"})
    }
})

export default authRouter