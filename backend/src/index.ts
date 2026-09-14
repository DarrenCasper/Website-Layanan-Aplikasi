import dotenv from 'dotenv'

dotenv.config()

import express, {type Response, type Request, type NextFunction, type ErrorRequestHandler} from 'express'
import { prisma } from "./lib/db.ts"
import authRouter from './route/auth.ts'

const PORT = process.env.PORT || 4000
const nodeEnv = process.env.NODE_ENV || 'development'

const app = express()

app.use(express.json())

// Health check
app.get("/health", async (req: Request, res: Response) => {
    try{
        await prisma.$queryRaw`SELECT 1`
        res.status(201).json({
            status: 'ok',
            db: 'up'
        })
    }
    catch(err){
        console.error(err)
        res.status(500).json({
            status: "error",
            message: "Database Connection Failed"
        })
    }
})

// error handler
const errorHandler: ErrorRequestHandler = (err: Error, _req: Request, res: Response, _next:NextFunction) => {
    console.error(err)
    res.status(503).json({
        status: 'error',
        message: err.message || "Internal Server Error"
    })
}


// Add route here if there is new endpoint for frontend
app.use("/auth", authRouter)

// 404 page handler
app.use((_req: Request, res: Response, _next:NextFunction) => {
    res.status(404).json({
        status: "error",
        message: "Page Not Found. No Route Found"
    })
})

app.use(errorHandler)

app.listen(PORT, () => {
    console.log(`The server is listening on port ${PORT} in ${nodeEnv} mode.`)
})
