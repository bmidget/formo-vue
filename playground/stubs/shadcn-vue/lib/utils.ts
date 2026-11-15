import { twMerge } from 'tailwind-merge'

type ClassValue = string | false | null | undefined | ClassValue[] | Record<string, unknown>

/** shadcn's `cn()`: clsx + tailwind-merge (clsx inlined: the stubs only need tailwind-merge) */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = []
  const walk = (value: ClassValue) => {
    if (!value) return
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else for (const [key, on] of Object.entries(value)) if (on) out.push(key)
  }
  inputs.forEach(walk)
  return twMerge(out.join(' '))
}
