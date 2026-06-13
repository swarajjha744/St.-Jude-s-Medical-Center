import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, doc, getDoc, updateDoc, setDoc, orderBy, addDoc 
} from 'firebase/firestore';
import { 
  Calendar, User, FileText, Bell, LogOut, CheckCircle, Clock, 
  MapPin, Phone, RefreshCw, X, Shield, Plus, Heart, AlertCircle, ArrowLeft 
} from 'lucide-react';
import { Appointment, HealthRecord, Notification, UserProfile, Doctor, Department } from '../types';

interface PatientPortalProps {
  onClose?: () => void;
  doctors?: Doctor[];
  departments?: Department[];
}

export default function PatientPortal({ onClose, doctors = [], departments = [] }: PatientPortalProps) {
  const { user, profile, logout, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile' | 'appointments' | 'records' | 'notifications'>('dashboard');

  // Appointment Booking form state
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [bookingDateTime, setBookingDateTime] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Real-time data states
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Loading & Action states
  const [loadingData, setLoadingData] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Editable Profile fields
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Synchronize initial input states with loaded profile
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setDob(profile.DOB || profile.dob || '');
      setBloodGroup(profile.bloodGroup || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setEmergencyContact(profile.emergencyContact || '');
    }
  }, [profile]);

  // Real-time listeners hook
  useEffect(() => {
    if (!user) return;

    setLoadingData(true);

    // 1. Appointments Snapshot (real-time read-only)
    const appointmentsQuery = query(
      collection(db, 'appointments'),
      where('patientId', '==', user.uid)
    );
    const unsubAppointments = onSnapshot(appointmentsQuery, (snap) => {
      const list: Appointment[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Appointment);
      });
      // Sort client-side by date
      list.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      setAppointments(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'appointments');
    });

    // 2. Health Documents Metadata Snapshot (real-time)
    const recordsColRef = collection(db, 'records', user.uid, 'files');
    const unsubRecords = onSnapshot(recordsColRef, (snap) => {
      const list: HealthRecord[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as HealthRecord);
      });
      list.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      setHealthRecords(list);
      setLoadingData(false);
    }, (err) => {
      console.warn('Real-time file retrieval: path may not yet be initialized:', err);
      setLoadingData(false);
    });

    // 3. User Notifications Snapshot
    const notesColRef = collection(db, 'notifications', user.uid, 'items');
    const unsubNotes = onSnapshot(notesColRef, (snap) => {
      const list: Notification[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Notification);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(list);
    }, (err) => {
      console.warn('Notifications subcollection lookup error:', err);
    });

    return () => {
      unsubAppointments();
      unsubRecords();
      unsubNotes();
    };
  }, [user]);

  // Submit Profile update to Firestore
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setProfileSuccess(false);

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        name,
        DOB: dob,
        bloodGroup,
        phone,
        address,
        emergencyContact,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setProfileSuccess(true);
      await refreshProfile();
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setSavingProfile(false);
    }
  };

  // Mark notification as read
  const handleMarkAsRead = async (noteId: string) => {
    if (!user) return;
    try {
      const noteDocRef = doc(db, 'notifications', user.uid, 'items', noteId);
      await updateDoc(noteDocRef, { read: true });
    } catch (err) {
      console.error('Error modifying notification status:', err);
    }
  };

  // Patient self-appointment booking submission
  const handlePatientBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedDoctorId || !selectedDept || !bookingDateTime) {
      setBookingError('Please specify a valid specialty, doctor, date, and hour.');
      return;
    }

    setBookingLoading(true);
    setBookingError('');
    setBookingSuccess(false);

    try {
      const docMatched = doctors.find(d => d.id === selectedDoctorId);
      const payload: any = {
        patientId: user.uid,
        patientName: profile?.name || user.displayName || user.email?.split('@')[0] || 'Patient',
        patientEmail: user.email || '',
        doctorId: selectedDoctorId,
        doctorName: docMatched?.name || 'Clinic Specialist',
        department: selectedDept,
        dateTime: bookingDateTime,
        status: 'pending',
        notes: bookingNotes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'appointments'), payload);

      setBookingSuccess(true);
      setSelectedDoctorId('');
      setSelectedDept('');
      setBookingDateTime('');
      setBookingNotes('');
      setShowBookingForm(false);
      
      // Auto dismiss success notice after 5 seconds
      setTimeout(() => setBookingSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error booking appointment self-schedule:', err);
      setBookingError(err.message || 'The system could not schedule this appointment. Check your connection.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Calculate Profile completion metric
  const items = [name, dob, bloodGroup, phone, address, emergencyContact];
  const filledItems = items.filter(val => val !== '').length;
  const completionPercentage = Math.round((filledItems / items.length) * 100);

  const upcomingAppointments = appointments.filter(appt => appt.status === 'confirmed' || appt.status === 'pending');
  const nextAppt = upcomingAppointments[0];

  return (
    <div className="min-h-screen bg-[#FCFAF7] flex flex-col md:flex-row text-[#1A1A1A]">
      
      {/* Sidebar navigation */}
      <aside className="w-full md:w-80 bg-white border-r border-[#E4E0D9] flex flex-col p-6 space-y-8">
        {onClose && (
          <button 
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 text-xs font-semibold text-emerald-800 hover:text-emerald-950 transition-colors uppercase tracking-wider bg-stone-50 hover:bg-stone-100 p-2 border border-stone-200/65 rounded text-left cursor-pointer duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Website</span>
          </button>
        )}

        {/* Clinicial Branding */}
        <div className="flex items-baseline gap-2 pb-6 border-b border-stone-100">
          <span className="text-xl font-serif font-semibold tracking-tight text-emerald-950">St. Jude’s</span>
          <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-stone-400">Portal</span>
        </div>

        {/* Short Profile HUD */}
        <div className="p-4 bg-stone-50 border border-stone-200 rounded flex gap-4 items-center">
          <div className="h-10 w-10 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-bold text-sm tracking-tighter">
            {profile?.name ? profile.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'PT'}
          </div>
          <div>
            <h5 className="font-semibold text-xs text-stone-900 leading-tight">{profile?.name || user?.email}</h5>
            <span className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Role: Patient</span>
          </div>
        </div>

        {/* Tab buttons */}
        <nav className="flex-1 flex flex-col gap-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm text-xs font-semibold uppercase tracking-wider text-left transition-colors border-none cursor-pointer ${activeTab === 'dashboard' ? 'bg-emerald-900 text-[#FCFAF7]' : 'hover:bg-stone-50 text-stone-600'}`}
          >
            <Heart className="h-4 w-4" />
            Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab('appointments')}
            className={`flex items-center justify-between px-4 py-3 rounded-sm text-xs font-semibold uppercase tracking-wider text-left transition-colors border-none cursor-pointer ${activeTab === 'appointments' ? 'bg-emerald-900 text-[#FCFAF7]' : 'hover:bg-stone-50 text-stone-600'}`}
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4" />
              My Appointments
            </div>
            {upcomingAppointments.length > 0 && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{upcomingAppointments.length}</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('records')}
            className={`flex items-center justify-between px-4 py-3 rounded-sm text-xs font-semibold uppercase tracking-wider text-left transition-colors border-none cursor-pointer ${activeTab === 'records' ? 'bg-emerald-900 text-[#FCFAF7]' : 'hover:bg-stone-50 text-stone-600'}`}
          >
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4" />
              Health Records
            </div>
            {healthRecords.length > 0 && (
              <span className="bg-stone-100 text-stone-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{healthRecords.length}</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm text-xs font-semibold uppercase tracking-wider text-left transition-colors border-none cursor-pointer ${activeTab === 'profile' ? 'bg-emerald-900 text-[#FCFAF7]' : 'hover:bg-stone-50 text-stone-600'}`}
          >
            <User className="h-4 w-4" />
            My Profile
          </button>

          <button 
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center justify-between px-4 py-3 rounded-sm text-xs font-semibold uppercase tracking-wider text-left transition-colors border-none cursor-pointer ${activeTab === 'notifications' ? 'bg-emerald-900 text-[#FCFAF7]' : 'hover:bg-stone-50 text-stone-600'}`}
          >
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4" />
              Notifications
            </div>
            {notifications.filter(n=>!n.read).length > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{notifications.filter(n=>!n.read).length}</span>
            )}
          </button>
        </nav>

        {/* Logout session */}
        <div className="pt-6 border-t border-stone-100">
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-50 border border-stone-200 text-xs font-semibold uppercase tracking-wider hover:bg-stone-100 hover:text-stone-900 transition-colors cursor-pointer text-stone-500"
          >
            <LogOut className="h-4 w-4" />
            Sign Out Session
          </button>
        </div>
      </aside>

      {/* Primary content frame */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto max-w-5xl">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-fade-in">
            {/* Header section */}
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-800 font-semibold">Care Overview</span>
              <h1 className="text-3xl md:text-4xl font-serif text-stone-950 mt-1">Peace of mind, digitalized</h1>
              <p className="text-xs text-stone-400 mt-1">Review your upcoming health consults, diagnostics records, and notifications instantly.</p>
            </div>

            {/* Dashboard summary grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profile Completion Card */}
              <div className="p-6 bg-white border border-stone-200 rounded flex flex-col justify-between space-y-4 shadow-sm">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">Profile Health Check</h4>
                  <p className="text-2xl font-serif text-emerald-950 font-bold">{completionPercentage}% Completed</p>
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-stone-100 rounded overflow-hidden">
                    <div className="h-full bg-emerald-800 transition-all duration-550" style={{ width: `${completionPercentage}%` }}></div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('profile')}
                    className="text-[11px] font-bold uppercase text-emerald-800 hover:text-emerald-950 text-left cursor-pointer flex items-center gap-1 border-none bg-none"
                  >
                    Complete Profile Details →
                  </button>
                </div>
              </div>

              {/* Upcoming Appointments Card */}
              <div className="p-6 bg-white border border-stone-200 rounded flex flex-col justify-between space-y-4 shadow-sm">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">Clinicial Bookings</h4>
                  <p className="text-2xl font-serif text-emerald-950 font-bold">{upcomingAppointments.length} Active</p>
                </div>
                <div>
                  <button 
                    onClick={() => setActiveTab('appointments')}
                    className="text-[11px] font-bold uppercase text-emerald-800 hover:text-emerald-950 text-left cursor-pointer flex items-center gap-1 border-none bg-none"
                  >
                    View Schedule Logs →
                  </button>
                </div>
              </div>

              {/* Documents Card */}
              <div className="p-6 bg-white border border-stone-200 rounded flex flex-col justify-between space-y-4 shadow-sm">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">Secured Diagnostics</h4>
                  <p className="text-2xl font-serif text-emerald-950 font-bold">{healthRecords.length} Uploaded</p>
                </div>
                <div>
                  <button 
                    onClick={() => setActiveTab('records')}
                    className="text-[11px] font-bold uppercase text-emerald-800 hover:text-emerald-950 text-left cursor-pointer flex items-center gap-1 border-none bg-none"
                  >
                    Download Scans & Forms →
                  </button>
                </div>
              </div>
            </div>

            {/* Next visit spotlight */}
            <div className="bg-[#F5F2EC] border border-stone-200 p-6 rounded-md">
              <h3 className="font-serif text-lg text-stone-850 mb-4 border-b border-[#E4E0D9] pb-2">Your Immediate Clinical Visit</h3>
              {nextAppt ? (
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="flex gap-4 items-start">
                    <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center font-bold text-emerald-800 flex-shrink-0">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-serif italic font-medium text-stone-900">{nextAppt.doctorName || 'Assigned Doctor'}</p>
                      <p className="text-xs text-stone-500 mt-0.5">{nextAppt.department} • {new Date(nextAppt.dateTime).toLocaleString()}</p>
                      {nextAppt.notes && (
                        <p className="text-xs text-stone-600 bg-white/60 p-2 border border-stone-150 rounded mt-2 max-w-md">
                          <strong>Physician Notes:</strong> {nextAppt.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${
                      nextAppt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 
                      nextAppt.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-700'
                    }`}>
                      {nextAppt.status}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-stone-500">No active upcoming appointments listed. Once hospital staff books a session, it will display here.</p>
              )}
            </div>

            {/* Recent Notifications banner */}
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-light">Recent Health Updates</h3>
              <div className="space-y-2">
                {notifications.slice(0, 3).map((note) => (
                  <div key={note.id} className={`p-4 rounded border text-xs flex justify-between items-center bg-white ${note.read ? 'border-stone-200 opacity-75' : 'border-emerald-300 bg-emerald-50/20'}`}>
                    <div className="flex gap-3 items-center">
                      <Bell className="h-4 w-4 text-emerald-800" />
                      <span>{note.message}</span>
                    </div>
                    {!note.read && (
                      <button 
                        onClick={() => handleMarkAsRead(note.id)}
                        className="text-[10px] uppercase font-bold text-emerald-800 hover:text-emerald-950 px-2 py-1 bg-emerald-100/30 rounded border-none cursor-pointer"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                ))}
                {notifications.length === 0 && (
                  <p className="text-xs text-stone-400">No direct notifications on record.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MY PROFILE EDIT */}
        {activeTab === 'profile' && (
          <div className="space-y-8 animate-fade-in max-w-2xl">
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-800 font-semibold">User Identity</span>
              <h1 className="text-3xl font-serif text-stone-950 mt-1">My Personal Profile</h1>
              <p className="text-xs text-stone-500 mt-1">Update your secure patient coordinates. This data is fully protected by Firestore Attribute Access policies.</p>
            </div>

            {profileSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded text-xs">
                Success! Your clinical profile information has been successfully saved.
              </div>
            )}

            <form onSubmit={handleProfileUpdate} className="space-y-6 bg-white p-8 border border-stone-200 shadow-sm rounded">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-stone-500 mb-2">Patient Full Name *</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-stone-500 mb-2">Date of Birth</label>
                  <input 
                    type="date" 
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-stone-550 mb-2">Blood Group</label>
                  <select 
                    value={bloodGroup} 
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800"
                  >
                    <option value="">Select Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-stone-500 mb-2">Phone Number</label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-2.5 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-stone-550 mb-2">Permanent Address</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="H-No, Block / Sector, City, State, PIN Code"
                  className="w-full px-4 py-2.5 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-stone-550 mb-2">Emergency Contact (Name and Relationship)</label>
                <input 
                  type="text" 
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="E.g., Ramesh Kumar (Spouse) +91 98765 43211"
                  className="w-full px-4 py-2.5 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800"
                />
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  type="submit" 
                  disabled={savingProfile}
                  className="px-6 py-3 bg-emerald-900 hover:bg-emerald-800 text-stone-100 font-semibold text-xs uppercase tracking-widest border-none cursor-pointer"
                >
                  {savingProfile ? 'Writing changes...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="space-y-8 animate-fade-in text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-150 pb-4">
              <div>
                <span className="text-xs uppercase tracking-widest text-emerald-800 font-semibold font-mono">Clinic Log</span>
                <h1 className="text-3xl font-serif text-stone-950 mt-1 font-light">My Medical Appointments</h1>
                <p className="text-xs text-stone-500 mt-1">Full, verified records of your historical and upcoming bookings at our center.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBookingForm(!showBookingForm);
                  setBookingError('');
                  setBookingSuccess(false);
                }}
                className="px-4 py-2.5 bg-emerald-900 hover:bg-emerald-850 text-white rounded text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                {showBookingForm ? "Close Scheduler" : "Book New Appointment"}
              </button>
            </div>

            {bookingSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded text-xs flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span>Your appointment has been booked successfully! It is now pending medical team confirmation.</span>
              </div>
            )}

            {bookingError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded text-xs">
                {bookingError}
              </div>
            )}

            {showBookingForm && (
              <form onSubmit={handlePatientBookAppointment} className="p-6 bg-white border border-stone-200 rounded max-w-xl space-y-4 shadow-sm animate-fade-in">
                <h3 className="font-serif italic text-lg font-medium text-stone-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-emerald-800" />
                  Schedule New Consult
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-stone-400 mb-1">Clinic Specialty *</label>
                    <select
                      required
                      value={selectedDept}
                      onChange={(e) => {
                        setSelectedDept(e.target.value);
                        setSelectedDoctorId('');
                      }}
                      className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800 focus:bg-white"
                    >
                      <option value="">Select Specialty</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-stone-400 mb-1">Medical Specialist *</label>
                    <select
                      required
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800 focus:bg-white"
                    >
                      <option value="">Select Doctor</option>
                      {doctors
                        .filter(docVal => {
                          if (!selectedDept) return true;
                          // Specialty mapping
                          return docVal.specialty?.toLowerCase().includes(selectedDept.toLowerCase()) || 
                                 docVal.bio?.toLowerCase().includes(selectedDept.toLowerCase());
                        })
                        .map((docItem) => (
                          <option key={docItem.id} value={docItem.id}>{docItem.name} — {docItem.specialty}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-stone-400 mb-1">Appointment Date & Hour *</label>
                    <input
                      type="datetime-local"
                      required
                      value={bookingDateTime}
                      onChange={(e) => setBookingDateTime(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-stone-400 mb-1">Reason for Visit & Prior Symptoms *</label>
                  <textarea
                    required
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                    placeholder="Brief description of consultation request (symptoms, references)..."
                    rows={3}
                    className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800 focus:bg-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setShowBookingForm(false)}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-250 text-stone-700 font-bold text-xs uppercase tracking-wider rounded border-none cursor-pointer flex items-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="px-4 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-stone-100 font-bold text-xs uppercase tracking-wider rounded border-none cursor-pointer flex items-center"
                  >
                    {bookingLoading ? "Booking Consult..." : "Schedule Appointment"}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {appointments.map((appt) => (
                <div key={appt.id} className="p-6 bg-white border border-stone-200 rounded shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-[9px] font-bold tracking-wider rounded uppercase ${
                        appt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                        appt.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        appt.status === 'completed' ? 'bg-stone-100 text-stone-700' : 'bg-red-100 text-red-800'
                      }`}>
                        {appt.status}
                      </span>
                      <span className="text-stone-400 text-xs">/ ID: {appt.id.slice(0, 6)}</span>
                    </div>
                    <h3 className="font-serif italic text-lg font-medium text-stone-900">{appt.doctorName || 'Clinic Specialist'}</h3>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-xs text-stone-500">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {new Date(appt.dateTime).toLocaleString()}</span>
                      <span className="font-semibold text-emerald-850">{appt.department}</span>
                    </div>
                    {appt.notes && (
                      <div className="p-3 bg-stone-50 rounded text-xs text-stone-600 border border-stone-150 max-w-xl">
                        <strong>Clinical directions:</strong> {appt.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {appointments.length === 0 && (
                <div className="p-12 text-center bg-white border border-stone-200 rounded text-stone-400">
                  No appointments scheduled. Click 'Book New Appointment' above to request your first consult!
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MY HEALTH RECORDS */}
        {activeTab === 'records' && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-800 font-semibold">Folder Vault</span>
              <h1 className="text-3xl font-serif text-stone-950 mt-1">My Secure Health Records</h1>
              <p className="text-xs text-stone-500 mt-1">Diagnostic reports, lab analyses, and radiological imaging results securely uploaded for you.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {healthRecords.map((record) => (
                <div key={record.id} className="p-6 bg-white border border-stone-200 rounded flex flex-col justify-between space-y-4 shadow-sm hover:border-emerald-800/30 transition-colors">
                  <div className="space-y-1">
                    <div className="h-8 w-8 bg-emerald-50 rounded flex items-center justify-center text-emerald-850 mb-3">
                      <FileText className="h-4 w-4" />
                    </div>
                    <h3 className="font-serif text-md text-stone-900 font-semibold truncate" title={record.fileName}>{record.fileName}</h3>
                    <p className="text-[10px] text-stone-400">Uploaded on {new Date(record.uploadedAt).toLocaleDateString()} • By {record.uploadedBy}</p>
                  </div>
                  <a 
                    href={record.storageUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full py-2 bg-stone-50 hover:bg-stone-100/80 text-stone-800 border border-stone-200 text-xs font-bold uppercase tracking-wider text-center block transition-colors rounded"
                  >
                    Download / View Scans
                  </a>
                </div>
              ))}

              {healthRecords.length === 0 && (
                <div className="col-span-full p-12 text-center bg-white border border-stone-200 rounded text-stone-400">
                  No diagnostic files or health records currently uploaded. Clinicians can upload items instantly inside the Admin Portal.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-800 font-semibold font-mono">Alerts Desk</span>
              <h1 className="text-3xl font-serif text-stone-950 mt-1">Notifications Audit</h1>
              <p className="text-xs text-stone-500 mt-1">Track transactional status upgrades regarding your appointments and reports.</p>
            </div>

            <div className="space-y-3">
              {notifications.map((note) => (
                <div key={note.id} className={`p-5 rounded border flex justify-between items-center transition-all bg-white ${note.read ? 'border-stone-200 opacity-60' : 'border-emerald-200 bg-emerald-50/10'}`}>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-stone-900">{note.message}</p>
                    <p className="text-[10px] text-stone-400">{new Date(note.createdAt).toLocaleString()}</p>
                  </div>
                  {!note.read && (
                    <button 
                      onClick={() => handleMarkAsRead(note.id)}
                      className="px-3 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}

              {notifications.length === 0 && (
                <div className="p-12 text-center bg-white border border-stone-200 rounded text-stone-400">
                  No system notifications on file.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
