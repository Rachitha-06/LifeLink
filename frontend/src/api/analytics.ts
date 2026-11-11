import { api } from '@/api/client';

export interface PublicImpactStats {
  registered_donors: number;
  lives_connected: number;
  partner_hospitals: number;
  cities_covered: number;
}

export interface DashboardTrends {
  requestsByMonth: { month: string; count: number }[];
  matchesByMonth: { month: string; count: number }[];
  requestsByUrgency: { urgency: string; count: number }[];
  requestsByOrgan: { organ: string; count: number }[];
}

export interface HospitalMapEntry {
  hospital_id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  verified_status: boolean;
  pending_requests: number;
  critical_requests: number;
}

export interface HospitalMapResponse {
  hospitals: HospitalMapEntry[];
  unassigned_requests: number;
}

export const analyticsApi = {
  // Unauthenticated — safe for the public landing page.
  publicImpact: () => api.get<PublicImpactStats>('/analytics/public-impact'),
  dashboardTrends: () => api.get<DashboardTrends>('/analytics/dashboard'),
  hospitalMap: () => api.get<HospitalMapResponse>('/analytics/hospital-map'),
};
