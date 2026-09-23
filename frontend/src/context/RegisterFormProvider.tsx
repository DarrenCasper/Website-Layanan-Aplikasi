import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  RegisterFormContext,
  emptyRegisterForm,
  type RegisterFormValues,
} from './registerFormContext'

// Lives in its own module so the context file can export the hook and the
// default values without tripping react-refresh's only-export-components rule.
function RegisterFormProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<RegisterFormValues>(emptyRegisterForm)

  const setField = useCallback((field: keyof RegisterFormValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }))
  }, [])

  const contextValue = useMemo(() => ({ values, setField }), [values, setField])

  return <RegisterFormContext value={contextValue}>{children}</RegisterFormContext>
}

export default RegisterFormProvider
