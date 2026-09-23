// Thin typed wrapper around the Layap backend API.
//
// The backend lives on a different origin during development, so requests go to
// a relative /api prefix that Vite's dev server proxies to the backend (see
// vite.config.ts). A production build points VITE_API_URL at the deployed API
// origin instead, which bypasses the proxy entirely.

function normaliseBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim()

// Falling back on an empty string as well as undefined keeps a blank
// VITE_API_URL from producing request URLs with no path prefix at all.
export const API_BASE_URL = normaliseBaseUrl(configuredBaseUrl ? configuredBaseUrl : '/api')

/** Error carrying the HTTP status plus the backend's own `message` when present. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type AuthUser = {
  id: string
  email: string
  fullname: string
  username: string
  department: string
  fakultas: string
  createdAt: string
}

export type AuthResponse = {
  token: string
  user: AuthUser
}

export type MessageResponse = {
  message: string
}

export type RegisterBody = {
  email: string
  password: string
  fullname: string
  username: string
  department: string
  fakultas: string
}

export type LoginBody = {
  email: string
  password: string
}

export type ResetRequestBody = {
  email: string
}

export type ResetResultBody = {
  email: string
  otp: string
  newPassword: string
}

// POST /reset/result answers 200 for both a completed reset and a rejected OTP,
// so the body is the only thing that separates the two. This is the exact string
// the backend sends on a real password change.
export const RESET_PASSWORD_SUCCESS_MESSAGE = 'Password succesfully changed'

// The backend rejects any registration email outside this domain, so the form
// checks it up front rather than spending a round trip on a guaranteed failure.
export const ITS_STUDENT_EMAIL_DOMAIN = '@student.its.ac.id'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
}

// Reading the raw text first keeps a non-JSON error page (a proxy failure, say)
// from throwing a parse error that would hide the real status.
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()

  if (text.length === 0) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function extractMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message

    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  }

  return `Permintaan gagal dengan status ${status}`
}

/** Sends a JSON request and throws ApiError for any non-2xx response. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options

  const headers: Record<string, string> = { Accept: 'application/json' }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // A transport failure has no HTTP status, so 0 marks it as "never reached".
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi Anda.')
  }

  const payload = await readJson(response)

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, response.status))
  }

  return payload as T
}

/** POST /auth/register - email must end with @student.its.ac.id. */
export function registerUser(body: RegisterBody): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', { method: 'POST', body })
}

/** POST /auth/login */
export function loginUser(body: LoginBody): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', { method: 'POST', body })
}

/** POST /reset/request - always answers generically so accounts cannot be probed. */
export function requestPasswordReset(body: ResetRequestBody): Promise<MessageResponse> {
  return request<MessageResponse>('/reset/request', { method: 'POST', body })
}

/** POST /reset/result - check the returned message, not the status. */
export function resetPassword(body: ResetResultBody): Promise<MessageResponse> {
  return request<MessageResponse>('/reset/result', { method: 'POST', body })
}

/**
 * Turns a thrown value into something worth showing the user. ApiError already
 * carries the backend's own wording, so anything else is genuinely unexpected.
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  return 'Terjadi kesalahan tak terduga. Silakan coba lagi.'
}
