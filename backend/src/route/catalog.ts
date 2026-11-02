import { Router, type Request, type Response } from "express"
import { requireAuth } from "../middleware/auth.ts"
import { Prisma } from "../generated/prisma/client.ts"
import { prisma } from "../lib/db.ts"
import { requireMerchantAccess } from "../middleware/merchantAccess.ts"
import { catalogSearchLimiter, catalogMutationLimiter } from "../middleware/rateLimiter.ts"

const catalogRouter = Router()

const MAX_PRICE = 2_147_483_647

class InputError extends Error { }


function readInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new InputError(`Invalid ${field} value`)
  }
  return value
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 10) {
    throw new InputError("tags must be an array containing at most 10 tags")
  }
  const names: string[] = []

  for (const tag of value) {
    if (typeof tag !== "string") {
      throw new InputError("Every tag must be a string")
    }

    const name = tag.trim().toLowerCase()

    if (!name || name.length > 20) {
      throw new InputError("Each tag must contain between 1 - 20 characters")
    }
    names.push(name)
  }
  return [...new Set(names)]
}

function readListingBody(body: unknown, quantityField: "stock" | "durationMin",) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InputError("Invalid request body")
  }

  const input = body as Record<string, unknown>

  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100) {
    throw new InputError("name must contain between 1 - 100 characters")
  }

  return {
    name: input.name.trim(),
    price: readInteger(input.price, "price"),
    quantity: readInteger(input[quantityField] ?? 0, quantityField),
    tags: normalizeTags(input.tags ?? [])
  }
}

function readQueryText(value: unknown, field: string, maxLength: number): string {
  if (value === undefined) return ""

  if (typeof value !== "string" || value.length > maxLength) {
    throw new InputError(`${field} must contain at most ${maxLength} characters`)
  }

  return value.trim()
}

function readSearchQuery(query: Request["query"]) {
  const q = readQueryText(query.q, "q", 100)
  const merchantId = readQueryText(query.merchantId, "merchantId", 191)

  const rawTags = readQueryText(query.tags, "tags", 500)
  const rawMinPrice = readQueryText(query.minPrice, "minPrice", 11) //could extend to higher digits if needed
  const rawMaxPrice = readQueryText(query.maxPrice, "maxPrice", 11)

  const minPrice = rawMinPrice ? Number(rawMinPrice) : null
  const maxPrice = rawMaxPrice ? Number(rawMaxPrice) : null
  
  if ((minPrice !== null && (!Number.isInteger(minPrice) || minPrice < 0 || minPrice > MAX_PRICE))) {
    throw new InputError("minPrice must be non-negative integers")
  } // handler for minPrice and maxPrice being non-negative numbers and a number not other types

  if((maxPrice !== null && (!Number.isInteger(maxPrice) || maxPrice < 0 || maxPrice > MAX_PRICE))) {
    throw new InputError("maxPrice must be non-negative integers")
  }

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw new InputError("minPrice cannot be greater than maxPrice")
  } // handler for minPrice being greater than maxPrice

  const tags = normalizeTags(
    rawTags.split(",").map((tag) => tag.trim()).filter(Boolean),
  )

  const page = Number(readQueryText(query.page, "page", 10) || "1")
  const limit = Number(readQueryText(query.limit, "limit", 10) || "20")

  if (!Number.isInteger(page) || page < 1 || page > 10_000) {
    throw new InputError("page must be an integer between 1 and 10000")
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new InputError("limit must be an integer between 1 and 50")
  }

  const sort = readQueryText(query.sort, "sort", 20) || "default"

  if(sort !== "default" && sort !== "price_asc" && sort !== "price_desc") {
    throw new InputError("sort must be default, price_asc or price_desc")
  }

  return { q, tags, merchantId, page, limit, minPrice, maxPrice, sort }
}

// Escape SQL LIKE special characters for literal substring searches.
function escapeSearch(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&")
}

// Both join tables require the same nested tag structure.
function buildTagLinks(tags: string[]) {
  return tags.map((name) => ({
    tag: {
      connectOrCreate: {
        where: { name },
        create: { name },
      },
    },
  }))
}

const productInclude = {
  merchant: {
    select: { id: true, namaToko: true },
  },
  productTags: {
    include: { tag: true },
  },
} satisfies Prisma.ProductInclude

const serviceInclude = {
  merchant: {
    select: { id: true, namaToko: true },
  },
  serviceTags: {
    include: { tag: true },
  },
} satisfies Prisma.ServiceInclude

function handleError(error: unknown, res: Response) {
  if (error instanceof InputError) {
    return res.status(400).json({ message: error.message })
  }

  // Concurrent requests can try to create the same new tag.
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return res.status(409).json({
      message: "A tag was created by another request. Please submit again.",
    })
  }

  console.error(error)

  return res.status(500).json({
    message: "Internal server error",
  })
}

function readCatalogUpdate(
  body: unknown,
  quantityField: "stock" | "durationMin",
) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InputError("A JSON object is required")
  }

  const input = body as Record<string, unknown>
  const fields = Object.keys(input)

  const allowedFields = [
    "name",
    "description",
    "price",
    quantityField,
  ]

  if (fields.length === 0) {
    throw new InputError("Provide at least one field to update")
  }

  const unsupportedField = fields.find(
    (field) => !allowedFields.includes(field),
  )

  if (unsupportedField) {
    throw new InputError(`Cannot update field: ${unsupportedField}`)
  }

  const data: {
    name?: string
    description?: string | null
    price?: number
    stock?: number
    durationMin?: number
  } = {}

  if ("name" in input) {
    if (
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.trim().length > 100
    ) {
      throw new InputError(
        "name must contain between 1 and 100 characters",
      )
    }

    data.name = input.name.trim()
  }

  if ("description" in input) {
    if (input.description === null) {
      data.description = null
    } else {
      if (
        typeof input.description !== "string" ||
        input.description.length > 5000
      ) {
        throw new InputError(
          "description must be a string of at most 5000 characters, or null",
        )
      }

      data.description = input.description.trim() || null
    }
  }

  if ("price" in input) {
    data.price = readInteger(input.price, "price")
  }

  if (quantityField in input) {
    data[quantityField] = readInteger(
      input[quantityField],
      quantityField,
    )
  }

  return data
}

// Handle records that do not exist or belong to another merchant.
function handleMutationError(
  error: unknown,
  res: Response,
  item: "Product" | "Service",
) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return res.status(404).json({
      message: `${item} not found in this merchant`,
    })
  }

  return handleError(error, res)
}
catalogRouter.get("/products", catalogSearchLimiter, async (req: Request, res: Response) => {
  try {
    const { q, tags, merchantId, page, limit, maxPrice, minPrice, sort } = readSearchQuery(req.query)

    const priceCondition = minPrice !== null || maxPrice !== null ? {
      ...(minPrice !== null ? {gte: minPrice} : {}),
      ...(maxPrice  !== null ? {lte: maxPrice} : {}),
    }:
    undefined

    const where: Prisma.ProductWhereInput = {
      merchant: {
        status: "ACTIVE"
      }
    }

    if(priceCondition){
      where.price = priceCondition
    }

    if (merchantId) {
      where.merchantId = merchantId
    }

    if (q) {
      const search = escapeSearch(q)
      where.OR = [
        {
          name: { contains: search }
        },
        {
          productTags: {
            some: {
              tag: {
                name: { contains: search }
              }
            }
          }
        }
      ]
    }

    if (tags.length > 0) {
      where.productTags = {
        some: {
          tag: {
            name: { in: tags }
          }
        }
      }
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput[] = [ {id: "asc"}]

    if (sort === "price_asc"){
      orderBy = [
        {price: "asc"},
        {id: "asc"}
      ]
    }
    else if (sort === "price_desc") {
      orderBy = [
        {price: "desc"},
        {id: "desc"}
      ]
    }

    const [data, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.product.count({ where })
    ])

    return res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  }
  catch (err) {
    return handleError(err, res)
  }
})

catalogRouter.get("/services", catalogSearchLimiter, async (req: Request, res: Response) => {
  try {
    const { q, tags, merchantId, page, limit, maxPrice, minPrice, sort } = readSearchQuery(req.query)

    const priceCondition = minPrice !== null || maxPrice !== null ? {
      ...(minPrice !== null ? {gte: minPrice} : {}),
      ...(maxPrice !== null ? {lte: maxPrice} : {})
    } :
    undefined

    const where: Prisma.ServiceWhereInput = {
      merchant: {
        status: "ACTIVE",
      },
    }

    if(priceCondition){
      where.price = priceCondition
    }

    if (merchantId) {
      where.merchantId = merchantId
    }

    if (q) {
      const search = escapeSearch(q)

      where.OR = [
        {
          name: { contains: search },
        },
        {
          serviceTags: {
            some: {
              tag: {
                name: { contains: search }
              }
            }
          }
        }
      ]
    }

    if (tags.length > 0) {
      where.serviceTags = {
        some: {
          tag: {
            name: { in: tags }
          }
        }
      }
    }

    let orderBy: Prisma.ServiceOrderByWithRelationInput[] = [{ id: "asc"}]

    if (sort === "price_asc"){
      orderBy = [
        {price: "asc"},
        {id: "asc"}
      ]
    }
    else if (sort === "price_desc") {
      orderBy = [
        {price: "desc"},
        {id: "desc"}
      ]
    }
    const [data, total] = await prisma.$transaction([
      prisma.service.findMany({
        where,
        include: serviceInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.service.count({ where })
    ])

    return res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  }
  catch (err) {
    return handleError(err, res)
  }
})

// Routes for creating products or services that are protected by auth

catalogRouter.post("/merchants/:merchantId/products", requireAuth, catalogMutationLimiter, requireMerchantAccess, async (req: Request, res: Response) => {
  try {
    const merchantId = req.params.merchantId

    if (typeof merchantId !== "string") {
      return res.status(400).json({ message: "Invalid Merchant ID" })
    }

    const input = readListingBody(req.body, "stock")

    const data = await prisma.product.create({
      data: {
        merchantId,
        name: input.name,
        price: input.price,
        stock: input.quantity,
        productTags: {
          create: buildTagLinks(input.tags)
        },
      },
      include: productInclude
    })

    return res.status(201).json({
      message: "Product successfully created",
      data
    })
  }
  catch (err) {
    return handleError(err, res)
  }
})

catalogRouter.post("/merchants/:merchantId/services", requireAuth, catalogMutationLimiter, requireMerchantAccess, async (req: Request, res: Response) => {
  try {
    const merchantId = req.params.merchantId

    if (typeof merchantId !== "string") {
      return res.status(400).json({ message: "Invalid Merchant ID" })
    }

    const input = readListingBody(req.body, "durationMin")

    const data = await prisma.service.create({
      data: {
        merchantId,
        name: input.name,
        price: input.price,
        durationMin: input.quantity,
        serviceTags: {
          create: buildTagLinks(input.tags)
        },
      },
      include: serviceInclude
    })

    return res.status(201).json({
      message: "Service succesfully created",
      data,
    })
  }
  catch (err) {
    return handleError(err, res)
  }
})

// next is the update routes for products and services, which are also protected by auth

catalogRouter.patch("/merchants/:merchantId/products/:productId", requireAuth, catalogMutationLimiter, requireMerchantAccess, async (req: Request, res: Response) => {
  try{
    const {merchantId, productId} = req.params

    if (typeof merchantId !== "string" || typeof productId !== "string") {
      throw new InputError("Invalid merchant or product ID")
    }

    const updateData = readCatalogUpdate(req.body, "stock")

    const data = await prisma.product.update({
      where: {
        id: productId,
        merchantId,
      },
      data: updateData,
      include: productInclude
    })

    return res.status(200).json({
      message: "Product successfully updated",
      data,
    })
  }
  catch(err){
    return handleMutationError(err, res, "Product")
  }
})

catalogRouter.patch("/merchants/:merchantId/services/:serviceId", requireAuth, catalogMutationLimiter, requireMerchantAccess, async (req: Request, res: Response) => {
  try{
    const {merchantId, serviceId} = req.params

    if (typeof merchantId !== "string" || typeof serviceId !== "string") {
      throw new InputError("Invalid merchant or service ID")
    }

    const updateData = readCatalogUpdate(req.body, "durationMin")

    const data = await prisma.service.update({
      where: {
        id: serviceId,
        merchantId,
      },
      data: updateData,
      include: serviceInclude
    })

    return res.status(200).json({
      message: "Service successfully updated",
      data,
    })
  }
  catch(err){
    return handleMutationError(err, res, "Service")
  }
})

// last one is the delete routes for products and services, which are also protected by auth

catalogRouter.delete("/merchants/:merchantId/products/:productId", requireAuth, catalogMutationLimiter, requireMerchantAccess, async (req: Request, res: Response) => {
  try{
    const {merchantId, productId} = req.params
    
    if (typeof merchantId !== "string" || typeof productId !== "string") {
      throw new InputError("Invalid merchant or product ID")
    }

    await prisma.product.delete({
      where: {
        id: productId,
        merchantId
      }
    })

    return res.status(200).json({
      message: "Product succesfully deleted"
    })
  }
  catch(err){
    return handleMutationError(err, res, "Product")
  }
})

catalogRouter.delete("/merchants/:merchantId/services/:serviceId", requireAuth, catalogMutationLimiter, requireMerchantAccess, async (req: Request, res: Response) => {
  try{
    const {merchantId, serviceId} = req.params
    
    if (typeof merchantId !== "string" || typeof serviceId !== "string") {
      throw new InputError("Invalid merchant or service ID")
    }

    await prisma.service.delete({
      where: {
        id: serviceId,
        merchantId
      }
    })

    return res.status(200).json({
      message: "Service succesfully deleted"
    })
  }
  catch(err){
    return handleMutationError(err, res, "Service")
  }
})

export default catalogRouter