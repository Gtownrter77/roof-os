/** Remove comments and quoted/template contents so security gates cannot be
 * fooled by an auth marker that appears only in a comment or a string literal.
 * Code structure (identifiers, calls, punctuation) is preserved. */
export function stripCommentsAndStrings(source) {
  let out = ''
  let index = 0
  let state = 'code'
  let quote = ''
  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]
    if (state === 'code') {
      if (char === '/' && next === '/') { state = 'line'; index += 2; continue }
      if (char === '/' && next === '*') { state = 'block'; index += 2; continue }
      if (char === "'" || char === '"' || char === '`') { state = 'string'; quote = char; out += char; index += 1; continue }
      out += char
      index += 1
      continue
    }
    if (state === 'line') {
      if (char === '\n') { state = 'code'; out += '\n' }
      index += 1
      continue
    }
    if (state === 'block') {
      if (char === '*' && next === '/') { state = 'code'; index += 2; continue }
      if (char === '\n') out += '\n'
      index += 1
      continue
    }
    // string / template literal: keep delimiters and line structure only
    if (char === '\\') { index += 2; continue }
    if (char === quote) { state = 'code'; quote = ''; out += char; index += 1; continue }
    if (char === '\n') out += '\n'
    index += 1
  }
  return out
}
