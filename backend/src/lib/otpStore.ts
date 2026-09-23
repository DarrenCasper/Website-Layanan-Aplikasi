import bcrypt from "bcryptjs";

interface OTPRecord {
  otpHash: string;
  expiresAt: number;
  timer: NodeJS.Timeout;
}
const otpStore = new Map<string, OTPRecord>();

/**
 * Stores a hashed OTP in memory associated with an email address.
 * Automatically clears any existing timer for the email and sets an expiration timeout.
 *
 * @param email - The user's email address.
 * @param rawOtp - The unhashed 6-digit OTP string.
 * @param ttlMinutes - Time to live in minutes (default: 10 minutes).
 */
export const storeOTP = async (
  email: string,
  rawOtp: string,
  ttlMinutes: number = 10
): Promise<void> => {
  // Clear existing active OTP and timer if present
  clearOTP(email);

  const saltRounds = 10;
  const otpHash: string = await bcrypt.hash(rawOtp, saltRounds);
  const ttlMs: number = ttlMinutes * 60 * 1000;
  const expiresAt: number = Date.now() + ttlMs;

  // Auto-delete from map when timer fires to prevent memory leaks
  const timer: NodeJS.Timeout = setTimeout(() => {
    otpStore.delete(email);
  }, ttlMs);

  otpStore.set(email, { otpHash, expiresAt, timer });
};

/**
 * Verifies a submitted OTP against the stored hash for a given email.
 * Clears the OTP immediately upon successful verification.
 *
 * @param email - The user's email address.
 * @param rawOtp - The 6-digit OTP string submitted by the user.
 * @returns True if the OTP is valid and not expired, false otherwise.
 */
export const verifyOTP = async (
  email: string,
  rawOtp: string
): Promise<boolean> => {
  const record: OTPRecord | undefined = otpStore.get(email);

  // Return false if no record exists
  if (!record) {
    return false;
  }

  // Check if expired
  if (Date.now() > record.expiresAt) {
    clearOTP(email);
    return false;
  }

  // Compare submitted plain text OTP against the stored bcrypt hash
  const isValid: boolean = await bcrypt.compare(rawOtp, record.otpHash);

  if (isValid) {
    // Single-use guarantee: remove OTP immediately on success
    clearOTP(email);
  }

  return isValid;
};

/**
 * Helper to delete an OTP entry and cancel its cleanup timer.
 *
 * @param email - The user's email address.
 */
export const clearOTP = (email: string): void => {
  const record: OTPRecord | undefined = otpStore.get(email);
  if (record) {
    clearTimeout(record.timer);
    otpStore.delete(email);
  }
};