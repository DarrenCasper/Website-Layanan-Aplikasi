import Router, {type Request, type Response} from "express"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { prisma } from "../lib/db.ts"
import { saveOtp, verifyAndConsumeOtp } from "../memory/otp.ts";
import { sendOtpEmail } from "../lib/mailer.ts"
import { Prisma } from "../generated/prisma/client.ts";
import { otpRequestLimiter } from "../middleware/rateLimiter.ts"

const resetRouter = Router()


// the request handler so user puts email then generate otp here, later compare it from generate and the input of the user
resetRouter.post("/request", otpRequestLimiter, async (req: Request, res: Response) => {
    try{
        const { email } = req.body

        if(!email){
            return res.status(400).json({message: "Email is required"})
        }

        const user = await prisma.user.findUnique({where: {email}})

        if(!user){
            return res.status(200).json({message: "If that email exist in our system, an OTP has been sent."})
        }

        const otp = crypto.randomInt(100000, 999999).toString()

        // switch the ttl here if want lower expired time 
        saveOtp(email, otp, 10)

        // call function to send the OTP through the nodemailer (later)
        sendOtpEmail(email, otp)

        return res.status(200).json({
            message: "If that email exist in our system, an OTP has been sent."
        })
    }
    catch(err){
        console.error(err)
        return res.status(500).json({message: "server internal error"})
    }
})

resetRouter.post("/result", async (req: Request, res: Response) => {
    try{
        const  { email, otp, newPassword } = req.body

        if(!email || !otp || !newPassword ){
            return res.status(400).json({message: "Missing required fields"})
        }

        const isValid = verifyAndConsumeOtp(email, otp)
        if(!isValid.success){
            const messages: Record<string,string> = {
                EXPIRED: "The OTP has expired. Please request a new one.",
                MISMATCH: "Incorrect OTP code",
                TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Please request a new one",
                NOT_FOUND: "No reset found on this account"
            }
            return res.status(200).json({message: messages[isValid.reason!] || "Invalid OTP"})
        }
        

        const passwordHashed = await bcrypt.hash(newPassword, 10)

        await prisma.user.update({
            where: {email},
            data: {
                passwordHashed: passwordHashed
            }
        })

        return res.status(200).json({message: "Password succesfully changed"})
    }
    catch(err){
        console.error(err)
        if(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025"){
            return res.status(400).json({message: "User Account no longer existed or was deleted"})
        }
        return res.status(500).json({message: "server internal error"})
    }
})

export default resetRouter