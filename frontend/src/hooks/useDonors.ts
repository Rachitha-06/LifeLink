import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { donorsApi, type RegisterDonationPayload } from '@/api/donors';
import { useAuthStore } from '@/store/authStore';

export function useMyDonations(page = 1, limit = 10) {
  return useQuery({
    queryKey: ['donations', 'mine', page, limit],
    queryFn: () => donorsApi.myDonations(page, limit),
    placeholderData: (prev) => prev, // keeps old page visible while the next loads, no flash to skeleton
  });
}

export function useEligibility() {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ['eligibility', userId],
    queryFn: () => donorsApi.eligibility(userId!),
    enabled: !!userId,
  });
}

export function useRegisterDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterDonationPayload) => donorsApi.registerDonation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['eligibility'] });
    },
  });
}

export function useDonorReviewQueue(status?: string) {
  return useQuery({
    queryKey: ['donors', 'review', status],
    queryFn: () => donorsApi.listForReview(status),
  });
}

export function useVerifyDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ donationId, status, notes }: { donationId: string; status: 'verified' | 'rejected'; notes?: string }) =>
      donorsApi.verifyDonation(donationId, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donors', 'review'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useUploadDonationDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ donationId, file }: { donationId: string; file: File }) =>
      donorsApi.uploadDocument(donationId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['donations', 'mine'] }),
  });
}
