// added attempts, to block bruteforcing numbers
interface OtpData {
    otp: string,
    expiresAt: number,
    attempts: number
}

export const otpCache = new Map<string, OtpData>();

// handler for memory leak, if an unused OTP was not used
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

setInterval(() => {
    const now = Date.now()
    for(const [email, records] of otpCache.entries()){
        if(now > records.expiresAt){
            otpCache.delete(email)
        }
    }
},CLEANUP_INTERVAL_MS).unref()

export const saveOtp = (email: string, otp: string, ttlMinutes = 5) : void => {
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000
    otpCache.set(email, {
        otp, 
        expiresAt, 
        attempts: 0
    })
}

type VerifyResult = {success: boolean; reason?: "EXPIRED" | "MISMATCH" | "TOO_MANY_ATTEMPTS" | "NOT_FOUND"}


export const verifyAndConsumeOtp = (email: string, candidateOtp: string) : VerifyResult => {
    const record = otpCache.get(email)

    if(!record){
        return {success: false, reason: "NOT_FOUND"}
    }

    if(Date.now() > record.expiresAt){
        return {success: false, reason: "EXPIRED"}
    }

    if(record.attempts >= 5){
        return {success: false, reason: "TOO_MANY_ATTEMPTS"}
    }

    if(record.otp !== candidateOtp){
        record.attempts += 1
        return {success: false, reason: "MISMATCH"}
    }

    otpCache.delete(email)

    return {success: true}
}