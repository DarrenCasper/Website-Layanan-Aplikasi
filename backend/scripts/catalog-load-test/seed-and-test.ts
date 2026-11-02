// Catalog sort load test.
//
// Modes (hot-swappable, same file):
//   npx tsx scripts/catalog-load-test/seed-and-test.ts insert   -> creates ~1000 dummy products
//   npx tsx scripts/catalog-load-test/seed-and-test.ts test     -> verifies sort correctness + concurrent load
//   npx tsx scripts/catalog-load-test/seed-and-test.ts delete   -> removes all dummy data this script created
//
// Requires the backend dev server running (for the "test" mode, which hits the real HTTP endpoint)
// and reuses whatever DATABASE_URL is active in the environment for "insert"/"delete".

import { PrismaClient } from "../../src/generated/prisma/client.ts"

const prisma = new PrismaClient()

const BASE_URL = process.env.BASE_URL || "http://localhost:4000"
const TOTAL_PRODUCTS = 1000
const TEST_USER_ID = "LOADTEST0001"
const TEST_MERCHANT_NAME = "__LOAD_TEST_MERCHANT__"

async function ensureTestMerchant() {
  let user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: `${TEST_USER_ID}@student.its.ac.id`,
        passwordHashed: "not-a-real-login-do-not-use",
        namaLengkap: "Load Test User",
        username: "loadtestuser0001",
        departemen: "Load Test",
        fakultas: "Load Test",
      },
    })
    console.log(`Created test user ${user.id}`)
  }

  let merchant = await prisma.merchant.findFirst({
    where: { namaToko: TEST_MERCHANT_NAME },
  })

  if (!merchant) {
    merchant = await prisma.merchant.create({
      data: {
        namaToko: TEST_MERCHANT_NAME,
        status: "ACTIVE",
        members: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
    })
    console.log(`Created test merchant ${merchant.id}`)
  } else if (merchant.status !== "ACTIVE") {
    merchant = await prisma.merchant.update({
      where: { id: merchant.id },
      data: { status: "ACTIVE" },
    })
  }

  return merchant
}

async function insertDummyData(merchantId: string, count: number) {
  const existing = await prisma.product.count({ where: { merchantId } })
  if (existing > 0) {
    console.log(
      `Merchant already has ${existing} dummy products. Run "delete" first if you want a clean 1000.`,
    )
  }

  const batchSize = 200
  for (let start = 0; start < count; start += batchSize) {
    const batch = []
    const end = Math.min(start + batchSize, count)
    for (let i = start; i < end; i++) {
      batch.push({
        merchantId,
        name: `Load Test Product ${i}`,
        // Deliberately include duplicate prices so the id tie-breaker gets exercised too.
        price: Math.floor(Math.random() * 500) * 1000,
        stock: 10,
      })
    }
    await prisma.product.createMany({ data: batch })
    console.log(`Inserted ${end}/${count}`)
  }

  console.log(`Done. ${count} dummy products under merchant ${merchantId}`)
}

async function deleteDummyData(merchantId: string) {
  const result = await prisma.product.deleteMany({ where: { merchantId } })
  console.log(`Deleted ${result.count} dummy products under merchant ${merchantId}`)
}

type ProductRow = { id: string; price: number }

async function fetchAllPages(merchantId: string, sort: string, limit = 50) {
  const rows: ProductRow[] = []
  let page = 1
  while (true) {
    const url = `${BASE_URL}/catalog/products?merchantId=${merchantId}&sort=${sort}&limit=${limit}&page=${page}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Request failed (${res.status}) on page ${page}: ${await res.text()}`)
    }
    const body = await res.json()
    for (const item of body.data) {
      rows.push({ id: item.id, price: item.price })
    }
    if (page >= body.pagination.totalPages) break
    page++
  }
  return rows
}

function checkMonotonic(rows: ProductRow[], direction: "asc" | "desc") {
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!
    const cur = rows[i]!
    const ok =
      direction === "asc"
        ? prev.price < cur.price || (prev.price === cur.price && prev.id <= cur.id)
        : prev.price > cur.price || (prev.price === cur.price && prev.id >= cur.id)
    if (!ok) {
      return {
        ok: false,
        index: i,
        prev,
        cur,
      }
    }
  }
  return { ok: true as const }
}

function checkNoDuplicatesAndFullCoverage(rows: ProductRow[], expectedCount: number) {
  const ids = new Set(rows.map((r) => r.id))
  return {
    totalFetched: rows.length,
    uniqueIds: ids.size,
    expectedCount,
    hasDuplicatesOrGaps: rows.length !== ids.size || ids.size !== expectedCount,
  }
}

async function testSortCorrectness(merchantId: string, expectedCount: number) {
  console.log("\n--- Sort correctness ---")

  for (const sort of ["price_asc", "price_desc"] as const) {
    const direction = sort === "price_asc" ? "asc" : "desc"
    const rows = await fetchAllPages(merchantId, sort)
    const monotonic = checkMonotonic(rows, direction)
    const coverage = checkNoDuplicatesAndFullCoverage(rows, expectedCount)

    console.log(`sort=${sort}:`)
    console.log(`  fetched ${coverage.totalFetched} rows across pagination, ${coverage.uniqueIds} unique ids (expected ${expectedCount})`)
    console.log(`  no duplicates/gaps across page boundaries: ${!coverage.hasDuplicatesOrGaps}`)
    console.log(`  globally ${direction === "asc" ? "non-decreasing" : "non-increasing"}: ${monotonic.ok}`)
    if (!monotonic.ok) {
      console.log(`  BROKEN at index ${monotonic.index}: prev=${JSON.stringify(monotonic.prev)} cur=${JSON.stringify(monotonic.cur)}`)
    }
  }

  const defaultRows = await fetchAllPages(merchantId, "default")
  const defaultCoverage = checkNoDuplicatesAndFullCoverage(defaultRows, expectedCount)
  console.log(`sort=default: fetched ${defaultCoverage.totalFetched}, no duplicates/gaps: ${!defaultCoverage.hasDuplicatesOrGaps}`)
}

async function testConcurrentLoad(merchantId: string, concurrency: number) {
  console.log(`\n--- Concurrent load: ${concurrency} simultaneous requests (same IP, so the per-IP search rate limiter WILL kick in above 60/min -- that's expected and separate from correctness) ---`)

  const url = `${BASE_URL}/catalog/products?merchantId=${merchantId}&sort=price_asc&limit=50`
  const start = Date.now()

  const results = await Promise.all(
    Array.from({ length: concurrency }, async () => {
      const t0 = Date.now()
      try {
        const res = await fetch(url)
        const ms = Date.now() - t0
        return { status: res.status, ms }
      } catch (err) {
        return { status: -1, ms: Date.now() - t0, error: (err as Error).message }
      }
    }),
  )

  const totalMs = Date.now() - start
  const byStatus = new Map<number, number>()
  for (const r of results) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)
  }
  const okTimes = results.filter((r) => r.status === 200).map((r) => r.ms)
  const errors = results.filter((r) => r.status === -1)

  console.log(`  total wall time for ${concurrency} requests: ${totalMs}ms`)
  console.log(`  status breakdown:`, Object.fromEntries(byStatus))
  if (okTimes.length > 0) {
    console.log(`  200-OK latency (ms): min=${Math.min(...okTimes)} max=${Math.max(...okTimes)} avg=${(okTimes.reduce((a, b) => a + b, 0) / okTimes.length).toFixed(1)}`)
  }
  if (errors.length > 0) {
    console.log(`  network-level errors (server unreachable/crashed, not HTTP error codes):`, errors.slice(0, 3))
  }
  console.log(`  server still responsive after burst: ${await (await fetch(`${BASE_URL}/health`)).ok}`)
}

async function main() {
  const mode = process.argv[2]
  const merchant = await ensureTestMerchant()

  if (mode === "insert") {
    await insertDummyData(merchant.id, TOTAL_PRODUCTS)
  } else if (mode === "delete") {
    await deleteDummyData(merchant.id)
  } else if (mode === "test") {
    const count = await prisma.product.count({ where: { merchantId: merchant.id } })
    if (count === 0) {
      console.log('No dummy data found. Run with "insert" first.')
    } else {
      await testSortCorrectness(merchant.id, count)
      console.log("\nWaiting 65s for the per-IP search rate limiter window to reset before the concurrency burst...")
      await new Promise((r) => setTimeout(r, 65_000))
      await testConcurrentLoad(merchant.id, 100)
    }
  } else {
    console.log("Usage: npx tsx scripts/catalog-load-test/seed-and-test.ts <insert|test|delete>")
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
