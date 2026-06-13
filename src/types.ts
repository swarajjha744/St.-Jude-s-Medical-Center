export type UserRole = 'patient' | 'doctor' | 'nurse' | 'receptionist' | 'admin';

export interface UserProfile {
  uid: string;
  role: UserRole;
  name: string;
  email: string;
  DOB?: string;
  bloodGroup?: string;
  phone?: string;
  address?: string;
  emergencyContact?: string;
  createdAt?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  patientEmail?: string;
  doctorId: string;
  doctorName?: string;
  department: string; // e.g. Cardiology
  dateTime: string; // ISO String
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface HealthRecord {
  id: string;
  patientUid: string;
  fileName: string;
  storageUrl: string;
  uploadedBy: string; // Staff member name or UID
  uploadedAt: string;
}

export interface Notification {
  id: string;
  message: string;
  type: string; // 'appointment' | 'record' | 'system'
  read: boolean;
  createdAt: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  photoUrl: string;
  departmentId: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
}

export interface Staff {
  uid: string;
  name: string;
  role: 'doctor' | 'nurse' | 'receptionist' | 'admin';
  email: string;
  createdAt: string;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  submittedAt: string;
}
