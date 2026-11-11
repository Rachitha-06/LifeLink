import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recipientsApi, type SubmitRequestPayload } from '@/api/recipients';

export function useMyRequests() {
  return useQuery({
    queryKey: ['requests', 'mine'],
    queryFn: recipientsApi.myRequests,
  });
}

export function useRequestReviewQueue(status?: string) {
  return useQuery({
    queryKey: ['requests', 'review', status],
    queryFn: () => recipientsApi.listForReview(status),
  });
}

export function useSubmitRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitRequestPayload) => recipientsApi.submitRequest(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests', 'mine'] }),
  });
}

export function useCancelRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipientsApi.updateRequest(id, { status: 'cancelled' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests', 'mine'] }),
  });
}

export function useUploadRequestDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, file }: { requestId: string; file: File }) =>
      recipientsApi.uploadDocument(requestId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests', 'mine'] }),
  });
}
