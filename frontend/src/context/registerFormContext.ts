import { createContext, useContext } from 'react'

export type RegisterFormValues = {
  fullName: string
  email: string
  password: string
  username: string
  faculty: string
  department: string
}

export const emptyRegisterForm: RegisterFormValues = {
  fullName: '',
  email: '',
  password: '',
  username: '',
  faculty: '',
  department: '',
}

export type RegisterFormContextValue = {
  values: RegisterFormValues
  setField: (field: keyof RegisterFormValues, value: string) => void
}

// Register is split across two routes (stage 1 and stage 2), so the form state
// lives above both of them. Keeping it in a provider rather than in either page
// lets the stage 2 greeting read the name typed in stage 1, and lets the browser
// back button return to stage 1 with everything still filled in.
export const RegisterFormContext = createContext<RegisterFormContextValue | null>(null)

export function useRegisterForm() {
  const context = useContext(RegisterFormContext)

  if (!context) {
    throw new Error('useRegisterForm must be used inside a RegisterFormProvider')
  }

  return context
}
