export type UserRole = 'donor' | 'recipient' | 'hospital_admin' | 'admin';

export type BloodType = 'O-' | 'O+' | 'A-' | 'A+' | 'B-' | 'B+' | 'AB-' | 'AB+';

export type DonationStatus = 'pending' | 'verified' | 'available' | 'matched' | 'completed' | 'rejected' | 'expired';

export type RequestUrgency = 'critical' | 'high' | 'medium' | 'low';

export type RequestStatus = 'pending' | 'reviewing' | 'matched' | 'completed' | 'cancelled' | 'expired';

export type MatchStatus = 'pending' | 'medical_review' | 'confirmed' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface User {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  age?: number | null;
  blood_type?: BloodType | null;
  organ_type?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  hospital_id?: string | null;
  is_active: boolean;
  two_factor_enabled?: boolean;
  created_at: string;
}

export interface Hospital {
  hospital_id: string;
  name: string;
  address: string;
  city: string;
  state?: string | null;
  country: string;
  verified_status: boolean;
  hospital_type?: string | null;
}

export interface Donation {
  donation_id: string;
  donor_id: string;
  organ_type: string;
  blood_type: BloodType;
  donation_date?: string | null;
  status: DonationStatus;
  hospital_id?: string | null;
  hospital_name?: string | null;
  notes?: string | null;
  medical_report_url?: string | null;
  next_eligible_date?: string | null;
  match_id?: string | null;
  match_status?: MatchStatus | null;
  compatibility_score?: number | null;
  requires_crossmatch?: boolean | null;
  created_at: string;
}

export interface DonationRequest {
  request_id: string;
  recipient_id: string;
  organ_needed: string;
  blood_type: BloodType;
  urgency: RequestUrgency;
  request_date: string;
  status: RequestStatus;
  hospital_id?: string | null;
  hospital_name?: string | null;
  doctor_name?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  documents_url?: string | null;
  match_id?: string | null;
  match_status?: MatchStatus | null;
  compatibility_score?: number | null;
  requires_crossmatch?: boolean | null;
  created_at: string;
}

export interface Match {
  match_id: string;
  donation_id: string;
  request_id: string;
  match_date: string;
  status: MatchStatus;
  compatibility_score: number;
  matched_by: 'algorithm' | 'manual' | 'admin';
  requires_crossmatch: boolean;
  confirmed_at?: string | null;
  completed_at?: string | null;
  donor_name?: string;
  donor_blood?: BloodType;
  recipient_name?: string;
  organ_needed?: string;
  urgency?: RequestUrgency;
  hospital_name?: string | null;
}

export interface MatchHistoryEntry {
  history_id: string;
  match_id: string;
  status: string;
  changed_by: string | null;
  changed_by_name?: string | null;
  note: string | null;
  created_at: string;
}

export interface EligibilityInfo {
  bloodEligible: boolean;
  daysSinceLastBlood: number | null;
  nextBloodEligibleDate: string;
  organEligible: boolean;
  history: { donation_date: string; organ_type: string }[];
}
