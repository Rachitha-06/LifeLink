const { generateSecret, generateTOTP, verifyTOTP, buildOtpauthUri } = require('../src/services/twoFactorService');

// RFC 6238 Appendix B official SHA1 test vectors — the standard's own
// published example (secret = ASCII "12345678901234567890"). Cross-
// checking against these, not just round-tripping our own output, is
// what actually proves the algorithm is implemented correctly.
function base32Encode(buffer) {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) output += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  const remainder = bits.length % 5;
  if (remainder) output += ALPHABET[parseInt(bits.slice(-remainder).padEnd(5, '0'), 2)];
  return output;
}

describe('twoFactorService — RFC 6238 compliance', () => {
  const rfcSecret = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

  const vectors = [
    { time: 59, expected8: '94287082' },
    { time: 1111111109, expected8: '07081804' },
    { time: 1111111111, expected8: '14050471' },
    { time: 1234567890, expected8: '89005924' },
    { time: 2000000000, expected8: '69279037' },
  ];

  test.each(vectors)('matches official RFC vector for T=$time', ({ time, expected8 }) => {
    const counter = Math.floor(time / 30);
    expect(generateTOTP(rfcSecret, counter)).toBe(expected8.slice(-6));
  });
});

describe('twoFactorService — behavior', () => {
  test('a freshly generated secret verifies its own current code', () => {
    const secret = generateSecret();
    expect(verifyTOTP(secret, generateTOTP(secret))).toBe(true);
  });

  test('rejects an incorrect code', () => {
    const secret = generateSecret();
    const wrongCode = generateTOTP(secret) === '000000' ? '111111' : '000000';
    expect(verifyTOTP(secret, wrongCode)).toBe(false);
  });

  test('rejects non-numeric input', () => {
    const secret = generateSecret();
    expect(verifyTOTP(secret, 'abcdef')).toBe(false);
  });

  test('rejects wrong length input', () => {
    const secret = generateSecret();
    expect(verifyTOTP(secret, '12345')).toBe(false);
  });

  test('tolerates one time-step of clock drift', () => {
    const secret = generateSecret();
    const counter = Math.floor(Date.now() / 1000 / 30);
    const codeOneStepAhead = generateTOTP(secret, counter + 1);
    expect(verifyTOTP(secret, codeOneStepAhead)).toBe(true);
  });

  test('otpauth URI is well-formed and contains the secret', () => {
    const secret = generateSecret();
    const uri = buildOtpauthUri(secret, 'admin@lifelink.org');
    expect(uri).toMatch(/^otpauth:\/\/totp\/LifeLink/);
    expect(uri).toContain(`secret=${secret}`);
  });
});
