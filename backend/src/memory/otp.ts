
interface OtpData {
    Otp: string,
    expiresAt: Number
}

export const otpCache = new Map<string, OtpData>();