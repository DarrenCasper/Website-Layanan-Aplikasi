import { createContext, useContext } from 'react'

export type ResetFormValues = {
  email: string
}

export const emptyResetForm: ResetFormValues = {
  email: '',
}

export type ResetFormContextValue = {
  values: ResetFormValues
  setEmail: (email: string) => void
}

// The reset flow spans two routes (/forget then /forget/otp), so the email the
// user typed has to outlive the first page. Keeping it in a provider means the
// OTP page can show which address the code went to, and a reload of /forget/otp
// can still tell whether the user actually arrived from the previous step.
export const ResetFormContext = createContext<ResetFormContextValue | null>(null)

export function useResetForm() {
  const context = useContext(ResetFormContext)

  if (!context) {
    throw new Error('useResetForm must be used inside a ResetFormProvider')
  }

  return context
}
