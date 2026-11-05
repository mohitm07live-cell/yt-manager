function sanitizeNetscapeCookies(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // Detect if someone just passed a filename
  if (/^[\w,\s-]+\.(txt|json|cookie)$/i.test(trimmed)) {
    return null;
  }

  const lines = trimmed.split(/\r?\n/);
  const sanitizedLines = ['# Netscape HTTP Cookie File', '# This is a generated file! Do not edit.', ''];
  let validCookieCount = 0;

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (l.startsWith('#')) {
      if (!l.includes('Netscape HTTP Cookie File') && !l.includes('Do not edit')) {
        sanitizedLines.push(l);
      }
      continue;
    }

    // Split either by tabs or by multiple spaces if tabs were lost during copy/paste
    let parts = l.split('\t');
    if (parts.length < 7) {
      // Try splitting by whitespace (first 6 fields never have spaces, 7th is value)
      const whitespaceParts = l.split(/\s+/);
      if (whitespaceParts.length >= 7) {
        const domain = whitespaceParts[0];
        const sub = whitespaceParts[1].toUpperCase();
        const path = whitespaceParts[2];
        const secure = whitespaceParts[3].toUpperCase();
        const expires = whitespaceParts[4];
        const name = whitespaceParts[5];
        const val = whitespaceParts.slice(6).join(' ');
        parts = [domain, sub, path, secure, expires, name, val];
      }
    }

    if (parts.length >= 7) {
      const domain = parts[0].trim();
      const sub = parts[1].trim().toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE';
      const path = parts[2].trim() || '/';
      const secure = parts[3].trim().toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE';
      const expires = parts[4].trim();
      const name = parts[5].trim();
      const val = parts.slice(6).join('\t').trim();

      if (domain && name && val) {
        sanitizedLines.push(`${domain}\t${sub}\t${path}\t${secure}\t${expires}\t${name}\t${val}`);
        validCookieCount++;
      }
    }
  }

  if (validCookieCount === 0) return null;
  return sanitizedLines.join('\n') + '\n';
}

// Test case 1: Junk string "cookies.txt"
console.log('Test "cookies.txt":', sanitizeNetscapeCookies('cookies.txt'));

// Test case 2: Spaced cookies (e.g. copied from chat where tabs became spaces)
const spaced = `
.youtube.com   TRUE   /   TRUE   1806167541   __Secure-BUCKET   CBM
.youtube.com   TRUE   /   FALSE   1827989722   APISID   QywwZMIeeWxWqBR1/AJ2zc_2ZKaZU_w8sT
`;
const sanitized = sanitizeNetscapeCookies(spaced);
console.log('Test spaced cookies valid:', sanitized !== null);
console.log('Sanitized output preview:\n', sanitized);

