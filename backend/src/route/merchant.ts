import { prisma } from "../lib/db.ts"
import { Router, type Request, type Response} from  "express"
import { requireAuth } from "../middleware/auth.ts"
import { MerchantRole } from "../generated/prisma/enums.ts"

const merchantRouter = Router()

merchantRouter.post("/merchant", requireAuth, async (req: Request, res: Response) => {
    try{
        const { namaToko, deskripsi } = req.body

        const userId = req.userId

        if(!namaToko){
            return res.status(401).json({message: "Merchant Store must have a name"})
        }

        if(!userId){
            return res.status(401).json({message: "Unauthorized"})
        }

        const newMerchant = await prisma.merchant.create({
            data: {
                namaToko: namaToko,
                deskripsi: deskripsi,
                members: {
                    create: {
                        userId: userId,
                        role: MerchantRole.OWNER
                    },
                },
            },
            include:{
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                namaLengkap: true,
                                email: true
                            }
                        }
                    }
                }
            }
        })
        return res.status(201).json({
            message: "Merchant succesfully Created",
            data: newMerchant,
        })
    }
    catch(err){
        console.error(err)
        return res.status(500).json({message: "internal server error"})
    }
})

export default merchantRouter