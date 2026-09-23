import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ResetFormContext, emptyResetForm, type ResetFormValues } from './resetFormContext'

// Kept in its own module so the context file can export the hook and the
// defaults without tripping react-refresh's only-export-components rule.
function ResetFormProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<ResetFormValues>(emptyResetForm)

  const setEmail = useCallback((email: string) => {
    setValues({ email })
  }, [])

  const contextValue = useMemo(() => ({ values, setEmail }), [values, setEmail])

  return <ResetFormContext value={contextValue}>{children}</ResetFormContext>
}

export default ResetFormProvider
