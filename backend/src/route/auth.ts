import { Router, type Request, type Response} from "express"
import bcrypt from "bcryptjs"
import  Jwt  from "jsonwebtoken"
import { prisma } from "../lib/db.ts"


const authRouter