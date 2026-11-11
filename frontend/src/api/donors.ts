import { api } from '@/api/client';
import type { Donation, EligibilityInfo, BloodType, DonationStatus } from '@/types';

export interface RegisterDonationPayload {
  organ_type: string;
  blood_type: string;
  hospital_id?: string;
  notes?: string;
}

interface MyDonationsResponse {
  donations: Donation[];
  page: number;
  limit: number;
  total: number;
}

/** Shape returned by the admin/hospital review list — a donor+donation
 * join, distinct from the plain Donation record a donor sees for
 * themselves via myDonations(). */
export interface DonorReviewItem {
  user_id: string;
  name: string;
  age?: number | null;
  blood_type: BloodType;
  organ_type?: string | null;
  city?: string | null;
  phone?: string | null;
  donation_id: string;
  status: DonationStatus;
  donation_date?: string | null;
  next_eligible_date?: string | null;
  hospital_name?: string | null;
}

export const donorsApi = {
  registerDonation: (payload: RegisterDonationPayload) =>
    api.post<{ message: string; donation: Donation }>('/donors/register', payload),

  myDonations: (page = 1, limit = 10) =>
    api.get<MyDonationsResponse>(`/donors/my-donations?page=${page}&limit=${limit}`),

  eligibility: (userId: string) => api.get<EligibilityInfo>(`/donors/eligibility/${userId}`),

  // Admin/hospital review queue — not paginated with a total count on
  // the backend yet, so this fetches a generous single page rather than
  // building pagination UI against an endpoint that can't report totals.
  listForReview: (status?: string) =>
    api.get<{ donors: DonorReviewItem[] }>(`/donors?limit=50${status ? `&status=${status}` : ''}`),

  verifyDonation: (donationId: string, status: 'verified' | 'rejected', notes?: string) =>
    api.patch<{ message: string; donation: Donation }>(`/donors/${donationId}/verify`, { status, notes }),

  uploadDocument: async (donationId: string, file: File) => {
    // File upload needs FormData/multipart, not JSON — bypasses the
    // shared `api` client's JSON body serialization for this one call.
    const token = (await import('@/store/authStore')).useAuthStore.getState().token;
    const formData = new FormData();
    formData.append('document', file);

    const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/donors/${donationId}/documents`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    return data as { message: string; donation: Donation };
  },
};
