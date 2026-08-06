/**
 * XSS Sanitization Utility
 *
 * Strips HTML tags and escapes special characters from user-provided text
 * to prevent Cross-Site Scripting (XSS) attacks.
 *
 * Validates: Requirements 12.4
 */

/**
 * HTML entities map for escaping dangerous characters.
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
}

/**
 * Regex to match HTML tags (opening, closing, and self-closing).
 */
const HTML_TAG_REGEX = /<[^>]*>/g

/**
 * Regex to match characters that need to be escaped for XSS prevention.
 */
const ESCAPE_REGEX = /[&<>"'`/]/g

/**
 * Strips all HTML tags from a string.
 *
 * @param input - The string to strip tags from
 * @returns The string with all HTML tags removed
 */
export function stripHtmlTags(input: string): string {
  return input.replace(HTML_TAG_REGEX, '')
}

/**
 * Escapes special HTML characters to their entity equivalents.
 *
 * @param input - The string to escape
 * @returns The string with special characters escaped
 */
export function escapeHtml(input: string): string {
  return input.replace(ESCAPE_REGEX, (char) => HTML_ENTITIES[char] || char)
}

/**
 * Full sanitization: strips HTML tags and escapes remaining special characters.
 * This is the primary function to use before storing user text in the database.
 *
 * @param input - The user-provided text to sanitize
 * @returns Sanitized text safe for storage and rendering
 */
export function sanitizeText(input: string): string {
  // First strip any HTML tags, then escape remaining special chars
  const stripped = stripHtmlTags(input)
  return escapeHtml(stripped)
}

/**
 * Sanitizes specific string fields in an object.
 * Only processes fields that are present and are strings.
 * Returns a new object with the specified fields sanitized.
 *
 * @param data - The object containing fields to sanitize
 * @param fields - Array of field names to sanitize
 * @returns A new object with the specified fields sanitized
 */
export function sanitizeFields<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): T {
  const sanitized = { ...data }

  for (const field of fields) {
    const value = sanitized[field]
    if (typeof value === 'string') {
      ;(sanitized as Record<string, unknown>)[field as string] = sanitizeText(value)
    }
  }

  return sanitized
}
