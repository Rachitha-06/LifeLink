const {
  isCompatible,
  calcCompatibilityScore,
  requiresCrossmatch,
  findCandidates,
} = require('../src/services/matchingService');

describe('matchingService — blood compatibility', () => {
  test('O- is a universal donor', () => {
    expect(isCompatible('O-', 'AB+')).toBe(true);
    expect(isCompatible('O-', 'O-')).toBe(true);
  });

  test('AB+ can only donate to AB+', () => {
    expect(isCompatible('AB+', 'AB+')).toBe(true);
    expect(isCompatible('AB+', 'O+')).toBe(false);
  });

  test('A+ cannot donate to B+', () => {
    expect(isCompatible('A+', 'B+')).toBe(false);
  });
});

describe('matchingService — compatibility scoring', () => {
  test('exact blood match + organ match + same city scores highest', () => {
    const donor = { blood_type: 'O+', organ_type: 'Kidney', city: 'Bangalore', state: 'Karnataka' };
    const request = { blood_type: 'O+', organ_needed: 'Kidney', city: 'Bangalore', state: 'Karnataka' };
    expect(calcCompatibilityScore(donor, request)).toBe(100);
  });

  test('compatible-but-not-exact blood type scores lower than exact match', () => {
    const request = { blood_type: 'AB+', organ_needed: 'Kidney', city: 'X', state: 'Y' };
    const exactDonor = { blood_type: 'AB+', organ_type: 'Kidney', city: 'X', state: 'Y' };
    const compatibleDonor = { blood_type: 'O-', organ_type: 'Kidney', city: 'X', state: 'Y' };
    expect(calcCompatibilityScore(exactDonor, request)).toBeGreaterThan(
      calcCompatibilityScore(compatibleDonor, request)
    );
  });

  test('score never exceeds 100', () => {
    const donor = { blood_type: 'O+', organ_type: 'Blood', city: 'X', state: 'Y' };
    const request = { blood_type: 'O+', organ_needed: 'Blood', city: 'X', state: 'Y' };
    expect(calcCompatibilityScore(donor, request)).toBeLessThanOrEqual(100);
  });
});

describe('matchingService — organ-matching refinement (Milestone 4)', () => {
  test('Blood does not require crossmatch', () => {
    expect(requiresCrossmatch('Blood')).toBe(false);
    expect(requiresCrossmatch('blood')).toBe(false); // case-insensitive
  });

  test('every non-Blood organ requires crossmatch', () => {
    for (const organ of ['Kidney', 'Liver', 'Heart', 'Lungs', 'Cornea', 'Bone Marrow']) {
      expect(requiresCrossmatch(organ)).toBe(true);
    }
  });
});

describe('matchingService — candidate ranking (used by both manual run and SOS broadcast)', () => {
  const request = { request_id: 'r1', blood_type: 'O+', organ_needed: 'Kidney', city: 'Bangalore', state: 'Karnataka' };
  const donors = [
    { donation_id: 'd1', donor_id: 'u1', blood_type: 'O+', organ_type: 'Kidney', city: 'Bangalore', state: 'Karnataka' }, // best: exact + local
    { donation_id: 'd2', donor_id: 'u2', blood_type: 'O+', organ_type: 'Kidney', city: 'Mumbai', state: 'Maharashtra' }, // compatible but remote
    { donation_id: 'd3', donor_id: 'u3', blood_type: 'A+', organ_type: 'Kidney', city: 'Bangalore', state: 'Karnataka' }, // incompatible blood
    { donation_id: 'd4', donor_id: 'u4', blood_type: 'O+', organ_type: 'Liver', city: 'Bangalore', state: 'Karnataka' }, // wrong organ
  ];

  test('topN=1 returns only the single best candidate', () => {
    const result = findCandidates(request, donors, new Set(), new Set(), 1);
    expect(result).toHaveLength(1);
    expect(result[0].donor.donation_id).toBe('d1');
  });

  test('topN=3 (SOS broadcast) returns multiple ranked candidates, excluding incompatible ones', () => {
    const result = findCandidates(request, donors, new Set(), new Set(), 3);
    const ids = result.map((r) => r.donor.donation_id);
    expect(ids).toContain('d1');
    expect(ids).toContain('d2');
    expect(ids).not.toContain('d3'); // incompatible blood type
    expect(ids).not.toContain('d4'); // wrong organ
  });

  test('results are sorted by score descending', () => {
    const result = findCandidates(request, donors, new Set(), new Set(), 3);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  test('already-used donors are excluded', () => {
    const usedDonors = new Set(['d1']);
    const result = findCandidates(request, donors, new Set(), usedDonors, 3);
    expect(result.map((r) => r.donor.donation_id)).not.toContain('d1');
  });

  test('existing (donation, request) pairs are excluded', () => {
    const existingPairs = new Set(['d1:r1']);
    const result = findCandidates(request, donors, existingPairs, new Set(), 3);
    expect(result.map((r) => r.donor.donation_id)).not.toContain('d1');
  });
});
