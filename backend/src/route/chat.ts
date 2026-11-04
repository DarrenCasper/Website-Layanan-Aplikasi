import { Router, type Request, type Response } from "express"
import { prisma } from "../lib/db.ts"
import { Prisma } from "../generated/prisma/client.ts"
import { requireAuth } from "../middleware/auth.ts"


const chatRouter = Router()


async function findAccesibleConversation(conversationId: string, userId: string) {
    return prisma.conversation.findFirst({
        where: {
            id: conversationId,

            OR: [
                {buyerId: userId},
                {merchant: {
                    members: {
                        some: {
                            userId: userId,
                            role: {
                                in: ["OWNER", "STAFF"]
                            }
                        }
                    }
                }}
            ]
        },
        select: {
            id: true,
            merchant: {
                select: {
                    status: true
                }
            }
        }
    })
}


chatRouter.post("/conversation", requireAuth, async (req: Request, res: Response) => {
    try {
        const buyerId = req.userId

        if (!buyerId) {
            return res.status(401).json({ message: "You must log in first!" })
        }

        const rawMerchantId = req.body?.merchantId

        if (typeof rawMerchantId !== "string" || rawMerchantId.length > 191 || !rawMerchantId.trim()) {
            return res.status(400).json({ message: "Invalid merchant ID" })
        }

        const merchantId = rawMerchantId.trim()

        const merchant = await prisma.merchant.findUnique({
            where: { id: merchantId },
            select: {
                id: true,
                status: true,
            }
        })

        if (!merchant) {
            return res.status(404).json({ message: "Merchant not found" })
        }

        if (merchant.status !== "ACTIVE") {
            return res.status(403).json({ message: "Merchant is not active" })
        }

        const membership = await prisma.merchantMember.findUnique({
            where: {
                userId_merchantId: {
                    userId: buyerId,
                    merchantId
                }
            },
            select: {
                id: true
            }
        })

        if (membership) {
            return res.status(400).json({ message: "You cannot start a buyer-seller chat with a merchant you are a member of" })
        }

        const conversationWhere = {
            buyerId_merchantId: {
                buyerId,
                merchantId
            }
        }

        const existing = await prisma.conversation.findUnique({
            where: conversationWhere
        })

        if (existing) {
            return res.status(200).json({ message: "Conversation already exists", data: existing })
        }

        try {
            const conversation = await prisma.conversation.create({
                data: {
                    buyerId,
                    merchantId
                }
            })
            return res.status(201).json({ message: "Conversation created", data: conversation })
        }
        catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                const existingAfterConflict = await prisma.conversation.findUnique({
                    where: conversationWhere
                })

                if (existingAfterConflict) {
                    return res.status(200).json({ message: "Conversation already exists", data: existingAfterConflict })
                }
            }
            throw err
        }
    }
    catch (err) {
        console.error("Failed to open conversation", err)
        return res.status(500).json({ message: "server internal error" })
    }
})

chatRouter.post("/conversation/:conversationId/messages", requireAuth, async (req: Request, res: Response) => {
    try {
        const senderId = req.userId

        if(!senderId) {
            return res.status(401).json({message: "You must log in first!"})
        }

        const rawConversationId = req.params?.conversationId

        if(typeof rawConversationId !== "string" || rawConversationId.length > 191 || !rawConversationId.trim()) {
            return res.status(400).json({message: "Invalid conversation ID"})
        }

        const conversationId = rawConversationId.trim()

        const rawBody = req.body?.body

        if(typeof rawBody !== "string") {
            return res.status(400).json({message: "Message body cannot be empty"})
        }

        const body = rawBody.trim()

        if(body.length === 0 || body.length > 2000) {
            return res.status(400).json({message: "Message body must be between 1 and 2000 characters"})
        }

        const conversation = await findAccesibleConversation(conversationId, senderId)

        if(!conversation) {
            return res.status(404).json({message: "Conversation not found"})
        }

        if(conversation.merchant.status !== "ACTIVE") {
            return res.status(403).json({message: "Messaging is not allowed with this merchant"})
        }

        const message = await prisma.$transaction(async (tx) => {
            await tx.conversation.update({
                where: { id: conversationId },
                data: {
                    updatedAt: new Date()
                }
            })

            return tx.message.create({
                data: {
                    conversationId,
                    senderId,
                    body
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            namaLengkap: true
                        }
                    }
                }
            })
        })

        return res.status(201).json({message: "Message sent", data: message})
    }
    catch (err) {
        console.error("Failed to send message", err)
        return res.status(500).json({ message: "Server internal error" })
    }
})



export default chatRouter