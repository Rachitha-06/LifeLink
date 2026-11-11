import { api } from '@/api/client';
import type { DonationRequest } from '@/types';

export interface SubmitRequestPayload {
  organ_needed: string;
  blood_type: string;
  urgency: string;
  hospital_id?: string;
  doctor_name?: string;
  diagnosis?: string;
  notes?: string;
}

export interface RequestReviewItem extends DonationRequest {
  patient_name: string;
  phone?: string | null;
  city?: string | null;
}

export const recipientsApi = {
  submitRequest: (payload: SubmitRequestPayload) =>
    api.post<{ message: string; request: DonationRequest }>('/recipients/request', payload),

  myRequests: () => api.get<DonationRequest[]>('/recipients/my-requests'),

  updateRequest: (id: string, payload: { status?: string; notes?: string }) =>
    api.patch<{ message: string; request: DonationRequest }>(`/recipients/request/${id}`, payload),

  // Admin/hospital review queue
  listForReview: (status?: string) =>
    api.get<RequestReviewItem[]>(`/recipients${status ? `?status=${status}` : ''}`),

  uploadDocument: async (requestId: string, file: File) => {
    // Same reasoning as donorsApi.uploadDocument — multipart bypasses the
    // shared client's JSON serialization.
    const { useAuthStore } = await import('@/store/authStore');
    const token = useAuthStore.getState().token;
    const formData = new FormData();
    formData.append('document', file);

    const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/recipients/request/${requestId}/documents`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    return data as { message: string; request: DonationRequest };
  },
};
