import { clsx, type ClassValue } from 'clsx';

/** Merges conditional class names. Thin wrapper so call sites read `cn(...)`. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
