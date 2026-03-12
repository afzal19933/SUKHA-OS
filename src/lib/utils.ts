import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Standardizes date formatting to DD:MM:YYYY across the app.
 * Handles both ISO strings and YYYY-MM-DD input strings.
 */
export function formatAppDate(dateInput: any) {
  if (!dateInput) return "N/A";
  
  // Handle YYYY-MM-DD strings directly to avoid timezone shifts
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, d] = dateInput.split('-');
    return `${d}:${m}:${y}`;
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "N/A";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}:${month}:${year}`;
}
