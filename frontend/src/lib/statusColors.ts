import type { DonationStatus, RequestStatus, MatchStatus } from '@/types';

type BadgeColor = 'red' | 'teal' | 'amber' | 'green' | 'gray';

export const donationStatusColor: Record<DonationStatus, BadgeColor> = {
  pending: 'gray',
  verified: 'teal',
  available: 'green',
  matched: 'amber',
  completed: 'green',
  rejected: 'red',
  expired: 'red',
};

export const requestStatusColor: Record<RequestStatus, BadgeColor> = {
  pending: 'gray',
  reviewing: 'amber',
  matched: 'teal',
  completed: 'green',
  cancelled: 'red',
  expired: 'red',
};

export const matchStatusColor: Record<MatchStatus, BadgeColor> = {
  pending: 'gray',
  medical_review: 'amber',
  confirmed: 'teal',
  in_progress: 'amber',
  completed: 'green',
  failed: 'red',
  cancelled: 'red',
};
