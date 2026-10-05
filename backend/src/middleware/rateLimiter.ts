import rateLimit from "express-rate-limit"
import { type Request } from "express"

export const otpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        message: "Too many password reset attempts. Please try again after 15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
})

// Public, unauthenticated search/list endpoints. Keyed by IP since there is no caller identity.
export const catalogSearchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: {
        message: "Too many catalog search requests. Please slow down and try again shortly."
    },
    standardHeaders: true,
    legacyHeaders: false,
})

// Authenticated create/update/delete endpoints. Must run after requireAuth so req.userId is set;
// keyed by user id so one IP (e.g. a campus NAT) can't throttle every other student on it.
export const catalogMutationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: {
        message: "Too many catalog changes. Please slow down and try again shortly."
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.userId ?? req.ip ?? "unknown",
})