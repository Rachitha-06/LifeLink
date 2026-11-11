import { describe, it, expect } from 'vitest';
import { donationStatusColor, requestStatusColor, matchStatusColor } from '@/lib/statusColors';
import type { DonationStatus, RequestStatus, MatchStatus } from '@/types';

// This is exactly the kind of test that would have caught the Milestone 4
// gap where MatchStatus grew a 'medical_review' value but the color map
// wasn't updated — TypeScript's Record<T, V> only enforces completeness
// at the definition site, not that future edits keep it that way if the
// type and the map ever drift out of the same file.
describe('status color mappings stay complete', () => {
  const donationStatuses: DonationStatus[] = ['pending', 'verified', 'available', 'matched', 'completed', 'rejected', 'expired'];
  const requestStatuses: RequestStatus[] = ['pending', 'reviewing', 'matched', 'completed', 'cancelled', 'expired'];
  const matchStatuses: MatchStatus[] = ['pending', 'medical_review', 'confirmed', 'in_progress', 'completed', 'failed', 'cancelled'];

  it('every DonationStatus has a badge color', () => {
    for (const status of donationStatuses) {
      expect(donationStatusColor[status]).toBeDefined();
    }
  });

  it('every RequestStatus has a badge color', () => {
    for (const status of requestStatuses) {
      expect(requestStatusColor[status]).toBeDefined();
    }
  });

  it('every MatchStatus has a badge color', () => {
    for (const status of matchStatuses) {
      expect(matchStatusColor[status]).toBeDefined();
    }
  });

  it('all color values are valid Badge colors', () => {
    const validColors = new Set(['red', 'teal', 'amber', 'green', 'gray']);
    for (const map of [donationStatusColor, requestStatusColor, matchStatusColor]) {
      for (const color of Object.values(map)) {
        expect(validColors.has(color)).toBe(true);
      }
    }
  });
});
