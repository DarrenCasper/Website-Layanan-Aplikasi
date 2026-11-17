// Merchant profile and membership data for the storefront (#38) and the
// merchant dashboard (#37).
//
// The backend issue that adds the profile and member routes (#36) has not been
// deployed yet. The calls below follow the contract that issue describes, and
// each one recognises the backend's own "No Route Found" answer, so until the
// routes exist:
//   - the public storefront derives the store's name and counts from the
//     catalog endpoints, which already filter by merchantId, and
//   - the dashboard keeps the store profile and member list in this browser,
//     which is what the issue asks for until the endpoints land.
// Once #36 is live the real answers are used and the fallbacks go quiet.

import { ApiError, request } from './api'
import { fetchCatalogPage } from './catalog'

export type MerchantRole = 'OWNER' | 'STAFF'
export type MerchantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'

export type MerchantMember = {
  userId: string
  name: string
  email: string
  role: MerchantRole
}

export type MerchantProfile = {
  id: string
  namaToko: string
  deskripsi: string
  status: MerchantStatus
  productCount: number
  serviceCount: number
  members: MerchantMember[]
}

/** Toast passed to Explore when a non-member is sent away from a dashboard (403). */
export const NO_ACCESS_TOAST = 'Kamu tidak punya akses ke toko ini'

/** Thrown when a store does not exist or is not visible to the public. */
export class MerchantNotFoundError extends Error {
  constructor() {
    super('Toko tidak ditemukan')
    this.name = 'MerchantNotFoundError'
  }
}

/** True when the backend answered with its catch-all 404, i.e. the route is missing. */
export function isMissingRoute(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && /no route/i.test(error.message)
}

type ApiMember = {
  userId?: string
  role?: string
  user?: { id?: string; namaLengkap?: string; email?: string; username?: string }
}

type ApiMerchant = {
  id: string
  namaToko: string
  deskripsi?: string | null
  status?: string
  productCount?: number
  serviceCount?: number
  _count?: { products?: number; services?: number; members?: number }
  members?: ApiMember[]
}

function toMember(entry: ApiMember): MerchantMember {
  return {
    userId: entry.user?.id ?? entry.userId ?? '',
    name: entry.user?.namaLengkap ?? entry.user?.username ?? 'Anggota',
    email: entry.user?.email ?? '',
    role: entry.role === 'OWNER' ? 'OWNER' : 'STAFF',
  }
}

function toProfile(merchant: ApiMerchant): MerchantProfile {
  const status = merchant.status
  return {
    id: merchant.id,
    namaToko: merchant.namaToko,
    deskripsi: merchant.deskripsi ?? '',
    status: status === 'ACTIVE' || status === 'SUSPENDED' ? status : 'PENDING',
    productCount: merchant.productCount ?? merchant._count?.products ?? 0,
    serviceCount: merchant.serviceCount ?? merchant._count?.services ?? 0,
    members: (merchant.members ?? []).map(toMember),
  }
}

function unwrap<T>(response: { data?: T } | T): T {
  return response && typeof response === 'object' && 'data' in response
    ? (response as { data: T }).data
    : (response as T)
}

// --- local fallback store ----------------------------------------------------

const LOCAL_KEY = 'layap.merchants'

type LocalStore = Record<string, MerchantProfile>

function readLocal(): LocalStore {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY)
    const parsed = raw ? (JSON.parse(raw) as LocalStore) : {}

    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocal(store: LocalStore) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(store))
  } catch {
    // Storage can be unavailable; the in-memory answer is still returned.
  }
}

function saveLocal(profile: MerchantProfile): MerchantProfile {
  writeLocal({ ...readLocal(), [profile.id]: profile })
  return profile
}

// --- public storefront -------------------------------------------------------

/**
 * GET /merchants/:merchantId. A missing, pending or suspended store throws
 * MerchantNotFoundError so the page can show "Toko tidak ditemukan".
 */
export async function fetchPublicMerchant(
  merchantId: string,
  signal?: AbortSignal,
): Promise<MerchantProfile> {
  try {
    const response = await request<{ data?: ApiMerchant } | ApiMerchant>(
      `/merchants/${encodeURIComponent(merchantId)}`,
      { signal },
    )
    const profile = toProfile(unwrap(response))

    if (profile.status === 'SUSPENDED') {
      throw new MerchantNotFoundError()
    }

    return profile
  } catch (error) {
    if (!isMissingRoute(error)) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
        throw new MerchantNotFoundError()
      }

      throw error
    }
  }

  // Route not deployed yet: the catalog only lists ACTIVE stores, so a store
  // with listings there is public, and its name rides along on each listing.
  const [products, services] = await Promise.all([
    fetchCatalogPage({ type: 'product', merchantId, limit: 1 }, signal),
    fetchCatalogPage({ type: 'service', merchantId, limit: 1 }, signal),
  ])
  const sample = products.items[0] ?? services.items[0]

  if (!sample) {
    // A store this browser created is still shown to its owner while the
    // backend has no profile route to ask.
    const local = readLocal()[merchantId]

    if (local) {
      return local
    }

    throw new MerchantNotFoundError()
  }

  return {
    id: merchantId,
    namaToko: sample.merchantName,
    deskripsi: readLocal()[merchantId]?.deskripsi ?? '',
    status: 'ACTIVE',
    productCount: products.pagination.total,
    serviceCount: services.pagination.total,
    members: [],
  }
}

// --- dashboard ---------------------------------------------------------------

export type CreateMerchantBody = { namaToko: string; deskripsi: string }

/** POST /create/merchant. Returns the new store with the caller as OWNER. */
export async function createMerchant(
  body: CreateMerchantBody,
  token: string,
  owner: { id: string; name: string; email: string },
): Promise<MerchantProfile> {
  const response = await request<{ data: ApiMerchant }>('/create/merchant', {
    method: 'POST',
    body: { namaToko: body.namaToko, deskripsi: body.deskripsi || undefined },
    token,
  })
  const profile = toProfile(response.data)

  if (profile.members.length === 0) {
    profile.members = [{ userId: owner.id, name: owner.name, email: owner.email, role: 'OWNER' }]
  }

  return saveLocal(profile)
}

/**
 * The stores the signed-in user belongs to: GET /merchants/mine once #36 is
 * live, otherwise the stores created from this browser.
 */
export async function fetchMyMerchants(token: string, userId: string): Promise<MerchantProfile[]> {
  try {
    const response = await request<{ data?: ApiMerchant[] } | ApiMerchant[]>('/merchants/mine', {
      token,
    })

    return unwrap(response).map(toProfile)
  } catch (error) {
    if (!isMissingRoute(error)) {
      throw error
    }
  }

  return Object.values(readLocal()).filter((profile) =>
    profile.members.some((member) => member.userId === userId),
  )
}

/** GET /merchants/:id with the caller's token, for the dashboard's own view. */
export async function fetchMyMerchant(
  merchantId: string,
  token: string,
  viewer?: { id: string; name: string; email: string },
): Promise<MerchantProfile | null> {
  try {
    const response = await request<{ data?: ApiMerchant } | ApiMerchant>(
      `/merchants/${encodeURIComponent(merchantId)}`,
      { token },
    )

    return saveLocal(toProfile(unwrap(response)))
  } catch (error) {
    if (!isMissingRoute(error)) {
      throw error
    }
  }

  const local = readLocal()[merchantId]

  if (local) {
    return local
  }

  // A store created elsewhere is not in this browser. Membership can still be
  // proven without changing anything: the catalog's access middleware answers
  // 403 to non-members before the handler runs, and for members an empty PATCH
  // of a listing that cannot exist fails validation with 400.
  if (!viewer || !(await isMerchantMember(merchantId, token))) {
    return null
  }

  let publicProfile: MerchantProfile | null = null
  try {
    publicProfile = await fetchPublicMerchant(merchantId)
  } catch {
    // Pending stores are not public yet; the dashboard still opens.
  }

  // The role cannot be known without #36, so the safer read-only role is
  // assumed; catalog management works for every member either way.
  return {
    id: merchantId,
    namaToko: publicProfile?.namaToko ?? 'Tokomu',
    deskripsi: publicProfile?.deskripsi ?? '',
    status: publicProfile ? 'ACTIVE' : 'PENDING',
    productCount: publicProfile?.productCount ?? 0,
    serviceCount: publicProfile?.serviceCount ?? 0,
    members: [{ userId: viewer.id, name: viewer.name, email: viewer.email, role: 'STAFF' }],
  }
}

async function isMerchantMember(merchantId: string, token: string): Promise<boolean> {
  try {
    await request(
      `/catalog/merchants/${encodeURIComponent(merchantId)}/products/__membership_probe__`,
      { method: 'PATCH', body: {}, token },
    )
    return true
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return false
    }

    // 400 (validation) or 404 (no such listing) both mean the middleware let
    // the caller through.
    return error instanceof ApiError && (error.status === 400 || error.status === 404)
  }
}

/** PATCH /merchants/:id. Only the OWNER may call it. */
export async function updateMerchantProfile(
  profile: MerchantProfile,
  changes: CreateMerchantBody,
  token: string,
): Promise<MerchantProfile> {
  try {
    const response = await request<{ data?: ApiMerchant } | ApiMerchant>(
      `/merchants/${encodeURIComponent(profile.id)}`,
      { method: 'PATCH', body: changes, token },
    )

    return saveLocal({ ...toProfile(unwrap(response)), members: profile.members })
  } catch (error) {
    if (!isMissingRoute(error)) {
      throw error
    }
  }

  return saveLocal({ ...profile, ...changes })
}

/** POST /merchants/:id/members with an email or username. */
export async function addMerchantMember(
  profile: MerchantProfile,
  identifier: string,
  token: string,
): Promise<MerchantProfile> {
  try {
    const response = await request<{ data?: ApiMember } | ApiMember>(
      `/merchants/${encodeURIComponent(profile.id)}/members`,
      { method: 'POST', body: { identifier }, token },
    )

    return saveLocal({ ...profile, members: [...profile.members, toMember(unwrap(response))] })
  } catch (error) {
    if (!isMissingRoute(error)) {
      throw error
    }
  }

  // Without the endpoint there is no user directory to check against, so the
  // entry is recorded as typed and labelled as such.
  const isEmail = identifier.includes('@')
  const member: MerchantMember = {
    userId: `local-${identifier.toLowerCase()}`,
    name: isEmail ? identifier.split('@')[0] : identifier,
    email: isEmail ? identifier : '',
    role: 'STAFF',
  }

  if (profile.members.some((entry) => entry.userId === member.userId)) {
    throw new ApiError(409, 'Pengguna ini sudah menjadi anggota toko')
  }

  return saveLocal({ ...profile, members: [...profile.members, member] })
}

/** DELETE /merchants/:id/members/:userId. The OWNER cannot be removed. */
export async function removeMerchantMember(
  profile: MerchantProfile,
  userId: string,
  token: string,
): Promise<MerchantProfile> {
  try {
    await request(
      `/merchants/${encodeURIComponent(profile.id)}/members/${encodeURIComponent(userId)}`,
      { method: 'DELETE', token },
    )
  } catch (error) {
    if (!isMissingRoute(error)) {
      throw error
    }
  }

  return saveLocal({
    ...profile,
    members: profile.members.filter((member) => member.userId !== userId),
  })
}

/** Two-letter avatar initials, e.g. "Lab Komputer B201" -> "LK". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)

  return letters.toUpperCase()
}
