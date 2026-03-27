import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// ===== EXISTING FUNCTION =====
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ===== SAFETY HELPERS (NEW) =====
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[SAFE_ASYNC_ERROR] ${context}`, error);
    return fallback;
  }
}

export function safeGet<T>(value: T | null | undefined, fallback: T): T {
  return value ?? fallback;
}

// ===== DATE FORMAT =====
export function formatAppDate(dateInput: any) {
  if (!dateInput) return "N/A";
  
  // Handle YYYY-MM-DD safely
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, d] = dateInput.split('-');
    return `${d}-${m}-${y}`;
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "N/A";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

// ===== TIME FORMAT =====
export function formatAppTime(dateInput: any) {
  if (!dateInput) return "N/A";

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "N/A";

  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// ===== NUMBER TO WORDS =====
export function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + ' ' + a[n % 10];
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + inWords(n % 100);
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + inWords(n % 10000000);
  };

  const integerPart = Math.floor(num);
  const words = inWords(integerPart).trim();

  return words + " Rupees Only";
}

// ===== INVOICE NUMBER =====
export function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let financialYear = "";

  if (month >= 3) {
    financialYear = `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    financialYear = `${year - 1}-${year.toString().slice(-2)}`;
  }

  const randomSuffix = Math.floor(10000 + Math.random() * 90000);

  return `${financialYear}/${randomSuffix}`;
}
// ===== FIRESTORE NORMALIZERS =====

export function normalizeStaff(data: any) {
  return {
    id: data?.id ?? "",
    name: data?.name ?? "Unknown",
    checkIn: data?.checkIn ?? null,
    checkOut: data?.checkOut ?? null,
  };
}
// ===== RETRY SYSTEM =====

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 500
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;

    await new Promise(res => setTimeout(res, delay));

    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}