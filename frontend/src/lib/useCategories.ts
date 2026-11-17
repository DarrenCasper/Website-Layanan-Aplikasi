import { useEffect, useState } from 'react'
import { MOCK_CATEGORIES, loadCategories, type Category } from './categories'

// The list is the same for every screen and changes only when an admin edits
// it, so one request per page load is shared by every caller.
let cached: Promise<Category[]> | null = null

/**
 * Categories for the filter panel and the listing form. Starts on the mock list
 * so the panel renders immediately, then swaps to live data if the API has it.
 */
export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES)

  useEffect(() => {
    let active = true

    cached ??= loadCategories()
    void cached.then((list) => {
      if (active) {
        setCategories(list)
      }
    })

    return () => {
      active = false
    }
  }, [])

  return categories
}
