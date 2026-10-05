import { type Request, type Response, type NextFunction } from "express"
import { prisma } from "../lib/db.ts"

export async function requireMerchantAccess(req: Request, res: Response, next: NextFunction) {
    const userId = req.userId
    const merchantId = req.params.merchantId

    if (!userId) {
        return res.status(401).json({ message: "You must log in first!"})
    }

    if(typeof merchantId !== "string" || !merchantId) {
        return res.status(400).json({ message: "Merchant ID is required" })
    }

    try{
        const membership = await prisma.merchantMember.findUnique({
            where: {
                userId_merchantId: {
                    userId,
                    merchantId,
                },
            },
            select: {
                role: true,
                merchant: {
                    select: {
                        status: true,
                    }
                }
            }
        })

        if(!membership || (membership.role !== "OWNER" && membership.role !== "STAFF")) {
            return res.status(403).json({message: "You are not an owner or staff member of this merchant"})
        }

        if(membership.merchant.status === "SUSPENDED") {
            return res.status(403).json({message: "This merchant is suspended"})
        }

        return next()
    }
    catch(err){
        console.error(err)
        return res.status(500).json({message: "Internal server error"})
    }
}