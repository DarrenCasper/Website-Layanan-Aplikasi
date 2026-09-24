import e from "cors";
import { createHash, timingSafeEqual } from "node:crypto"
import { buffer } from "node:stream/consumers";


// Define OTP purpose (3 types in this case): login/register/reset password
export type OtpPurpose = "REGISTRATION" | "PASSWORD_RESET" | "LOGIN_2FA"



// added attempts, to block bruteforcing numbers
interface OtpData {
    hash: string,
    expiresAt: number,
    attempts: number
}

export const otpCache = new Map<string, OtpData>();

// handler for memory leak, if an unused OTP was not used
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

setInterval(() => {
    const now = Date.now()
    for (const [email, records] of otpCache.entries()) {
        if (now > records.expiresAt) {
            otpCache.delete(email)
        }
    }
}, CLEANUP_INTERVAL_MS).unref()

// Create KEY 
const makeKey = (purpose: OtpPurpose, email: string) : string => {
    return `${purpose}:${email.toLowerCase().trim()}`;
}

// Create hash fast using the SHA-256 HASH
const hashOtp = (purpose: OtpPurpose, email: string, otp: string): string => {
  return createHash("sha256")
    .update(`${purpose}:${email.toLowerCase().trim()}:${otp}`)
    .digest("hex");
};

export const saveOtp = (purpose: OtpPurpose, email: string, rawOtp: string, ttlMinutes = 5): void => {
    const key = makeKey(purpose, email)
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000
    otpCache.set(key, {
        hash: hashOtp(purpose, email, rawOtp),
        expiresAt,
        attempts: 0
    })
}

type VerifyResult = {
    success: boolean;
    reason?: "EXPIRED" | "MISMATCH" | "TOO_MANY_ATTEMPTS" | "NOT_FOUND";
    remainingAttempts?: number;
}


export const verifyAndConsumeOtp = (purpose: OtpPurpose, email: string, candidateOtp: string): VerifyResult => {
    const key = makeKey(purpose, email)
    const record = otpCache.get(key)

    if (!record) {
        return { success: false, reason: "NOT_FOUND" }
    }

    if (Date.now() > record.expiresAt) {
        otpCache.delete(key)
        return { success: false, reason: "EXPIRED" }
    }

    if (record.attempts >= MAX_ATTEMPTS) {
        otpCache.delete(key)
        return { success: false, reason: "TOO_MANY_ATTEMPTS" }
    }

    // check for the hashed OTP
    const candidateHash = hashOtp(purpose, email, candidateOtp)
    const storedBuf = Buffer.from(record.hash, "hex")
    const candidateBuf = Buffer.from(candidateHash, "hex")

    const isMatch = storedBuf.length === candidateBuf.length && timingSafeEqual(storedBuf, candidateBuf)

    if (!isMatch) {
        record.attempts += 1
        const remaining = MAX_ATTEMPTS - record.attempts

        if (remaining <= 0) {
            otpCache.delete(email)
            return { success: false, reason: "TOO_MANY_ATTEMPTS", remainingAttempts: 0 }
        }

        return {
            success: false,
            reason: "MISMATCH",
            remainingAttempts: remaining
        }
    }

    otpCache.delete(email)
    return { success: true }
}