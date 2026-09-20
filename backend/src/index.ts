import dotenv from 'dotenv'

dotenv.config()

import express, {type Response, type Request, type NextFunction, type ErrorRequestHandler} from 'express'
import { prisma } from "./lib/db.ts"
import authRouter from './route/auth.ts'
import merchantRouter from './route/merchant.ts'
import resetRouter from "./route/reset.ts"
import cors from "cors"

const PORT = process.env.PORT || 4000
const nodeEnv = process.env.NODE_ENV || 'development'

const app = express()


// Cors handling origin
if(!process.env.ALLOWED_ORIGINS){
    throw new Error("Allowed origins is not set")
}
const allowedOrigins = (process.env.ALLOWED_ORIGINS).split(",").map((origin) => origin.trim()).filter(Boolean)

app.use(cors({origin: allowedOrigins.includes("*") ? "*" : allowedOrigins}))


app.use(express.json())

import { transporter } from "./lib/mailer"; // Adjust path if needed

app.get("/test-email", async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_USER, // Sends a test email to yourself
      subject: "ITS Service - SMTP Test",
      text: "If you receive this, your Nodemailer setup is 100% working!",
    });

    console.log("Message sent ID:", info.messageId);
    res.json({ status: "success", messageId: info.messageId });
  } catch (error) {
    console.error("Email send failed:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Health check
app.get("/health", async (req: Request, res: Response) => {
    try{
        await prisma.$queryRaw`SELECT 1`
        res.status(201).json({
            status: 'ok',
            db: 'up'
        })
    }
    catch(err){
        console.error(err)
        res.status(500).json({
            status: "error",
            message: "Database Connection Failed"
        })
    }
})

// error handler
const errorHandler: ErrorRequestHandler = (err: Error, _req: Request, res: Response, _next:NextFunction) => {
    console.error(err)
    res.status(503).json({
        message: "An unexpected error occured",
        ...(nodeEnv === "development" && {error: err.message, stack: err.stack})
    })
}


// Add route here if there is new endpoint for frontend
app.use("/auth", authRouter)
app.use("/create", merchantRouter)
app.use("/reset", resetRouter)

// 404 page handler
app.use((_req: Request, res: Response, _next:NextFunction) => {
    res.status(404).json({
        status: "error",
        message: "Page Not Found. No Route Found"
    })
})

app.use(errorHandler)

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

app.get("/", (req, res) => {
  res.json({ message: "API is running..." });
});
