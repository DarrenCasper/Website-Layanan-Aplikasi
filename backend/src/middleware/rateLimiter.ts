import rateLimit from "express-rate-limit"

export const otpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        message: "Too many password reset attempts. Please try again after 15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
})