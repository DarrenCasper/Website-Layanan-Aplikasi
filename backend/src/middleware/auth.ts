import { type Request,type Response,type NextFunction} from "express"
import jwt, { type JwtPayload } from "jsonwebtoken"
import dotenv from "dotenv"


dotenv.config()


export function requireAuth(req: Request, res:Response, next: NextFunction){
    const authHeader = req.header("Authorization")

    if(!authHeader){
        return res.status(401).json({message: "Invalid Authorization Header"})
    }

    if(!authHeader.startsWith("Bearer ")){
        return res.status(401).json({message: "Invalid Authorization Header, Expected Bearer <token>"})
    }

    const token = authHeader.slice(7).trim()

    if(!token){
        return res.status(401).json({message: "Missing Token"})
    }

    const secret = process.env.JWT_TOKEN

    if(!secret){
        return res.status(401).json({message: "JWT_TOKEN is not provided yet in .env"})
    }

    try{
        const payload = jwt.verify(token,secret) as JwtPayload | string

        if(typeof payload === "object" && payload.sub){
            req.userId = payload.sub
            return next()
        }

        return res.status(401).json({message: "invalid token payload"})
    }
    catch(err){
        console.error(err)
        return res.status(500).json({message: "Internal server error"})
    }
}