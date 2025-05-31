/**
 * Format a number with thousand separators and fixed decimal digits.
 * Example: formatNumber(123456.789, 2) => "123,456.79"
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value)) return "0.00";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a number as USD currency string.
 * Example: formatUSD(1234.5) => "$1,234.50"
 */
export function formatUSD(value: number): string {
  if (isNaN(value)) return "$0.00";
  return `$${formatNumber(value, 2)}`;
}

/**
 * Format a number as SOL token string.
 * Example: formatSOL(1.23) => "1.23 SOL"
 */
export function formatSOL(value: number): string {
  return `${formatNumber(value, 2)} SOL`;
}

/**
 * Format a number as percentage.
 * Example: formatPercentage(0.1234) => "12.34%"
 */
export function formatPercentage(value: number): string {
  if (isNaN(value)) return "0.00%";
  return `${formatNumber(value * 100, 2)}%`;
}

/**
 * Format a large integer (like raw token amount) into decimal representation.
 * Useful when you want to divide by mint decimals (e.g., 6 or 9)
 * Example: formatTokenAmount(1234567890, 6) => "1,234.57"
 */
export function formatTokenAmount(
  rawAmount: number,
  decimals: number = 6,
  displayDecimals: number = 2
): string {
  const value = rawAmount / Math.pow(10, decimals);
  return formatNumber(value, displayDecimals);
}

