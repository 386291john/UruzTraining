import { describe, it, expect } from 'vitest'
import {
  stripHtmlTags,
  escapeHtml,
  sanitizeText,
  sanitizeFields,
} from '@/lib/utils/sanitize'

describe('stripHtmlTags', () => {
  it('should remove simple HTML tags', () => {
    expect(stripHtmlTags('<b>bold</b>')).toBe('bold')
    expect(stripHtmlTags('<p>paragraph</p>')).toBe('paragraph')
  })

  it('should remove self-closing tags', () => {
    expect(stripHtmlTags('text<br/>more')).toBe('textmore')
    expect(stripHtmlTags('line<hr />end')).toBe('lineend')
  })

  it('should remove tags with attributes', () => {
    expect(stripHtmlTags('<a href="http://evil.com">click</a>')).toBe('click')
    expect(stripHtmlTags('<img src="x" onerror="alert(1)">')).toBe('')
  })

  it('should remove script tags and their content markers', () => {
    expect(stripHtmlTags('<script>alert("xss")</script>')).toBe('alert("xss")')
  })

  it('should handle nested tags', () => {
    expect(stripHtmlTags('<div><span>text</span></div>')).toBe('text')
  })

  it('should return empty string for empty input', () => {
    expect(stripHtmlTags('')).toBe('')
  })

  it('should return unchanged text if no tags present', () => {
    expect(stripHtmlTags('plain text')).toBe('plain text')
  })
})

describe('escapeHtml', () => {
  it('should escape ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('should escape less than', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b')
  })

  it('should escape greater than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b')
  })

  it('should escape double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;')
  })

  it('should escape single quotes', () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s")
  })

  it('should escape forward slash', () => {
    expect(escapeHtml('a/b')).toBe('a&#x2F;b')
  })

  it('should escape backtick', () => {
    expect(escapeHtml('`code`')).toBe('&#96;code&#96;')
  })

  it('should escape multiple special chars in one string', () => {
    expect(escapeHtml('<script>"xss"</script>')).toBe(
      '&lt;script&gt;&quot;xss&quot;&lt;&#x2F;script&gt;'
    )
  })

  it('should return unchanged text if no special chars', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('sanitizeText', () => {
  it('should strip tags and escape remaining special chars', () => {
    expect(sanitizeText('<b>bold & "quoted"</b>')).toBe(
      'bold &amp; &quot;quoted&quot;'
    )
  })

  it('should handle XSS attack vectors', () => {
    const xss = '<script>document.cookie</script>'
    const result = sanitizeText(xss)
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('</script>')
  })

  it('should handle event handler attributes after tag stripping', () => {
    const xss = '<img src=x onerror=alert(1)>'
    const result = sanitizeText(xss)
    expect(result).not.toContain('<img')
    expect(result).not.toContain('onerror')
  })

  it('should preserve normal text content', () => {
    expect(sanitizeText('Juan Pérez')).toBe('Juan Pérez')
    expect(sanitizeText('Observación normal sin HTML')).toBe(
      'Observación normal sin HTML'
    )
  })

  it('should handle empty string', () => {
    expect(sanitizeText('')).toBe('')
  })
})

describe('sanitizeFields', () => {
  it('should sanitize specified string fields', () => {
    const data = {
      full_name: '<b>John</b>',
      observations: '<script>xss</script>',
      age: 25,
    }

    const result = sanitizeFields(data, ['full_name', 'observations'])

    expect(result.full_name).toBe('John')
    expect(result.observations).toBe('xss')
    expect(result.age).toBe(25)
  })

  it('should not modify non-string fields', () => {
    const data = {
      name: 'test',
      count: 42,
      active: true,
      metadata: null,
    }

    const result = sanitizeFields(data, ['name', 'count', 'active', 'metadata'] as any)

    expect(result.count).toBe(42)
    expect(result.active).toBe(true)
    expect(result.metadata).toBe(null)
  })

  it('should not modify fields not in the list', () => {
    const data = {
      full_name: '<b>John</b>',
      email: '<script>evil</script>',
    }

    const result = sanitizeFields(data, ['full_name'])

    expect(result.full_name).toBe('John')
    expect(result.email).toBe('<script>evil</script>')
  })

  it('should return a new object without mutating original', () => {
    const data = { name: '<b>test</b>' }
    const result = sanitizeFields(data, ['name'])

    expect(result.name).toBe('test')
    expect(data.name).toBe('<b>test</b>')
  })

  it('should handle fields that do not exist on the object', () => {
    const data = { name: 'test' }
    const result = sanitizeFields(data, ['name', 'missing' as any])

    expect(result.name).toBe('test')
    expect((result as any).missing).toBeUndefined()
  })
})
