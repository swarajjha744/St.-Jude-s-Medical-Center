import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, doc, getDocs, addDoc, updateDoc, deleteDoc, setDoc 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Calendar, User, FileText, Bell, Lock, TrendingUp, Search, 
  Plus, Edit, Trash2, Upload, Users, Stethoscope, Briefcase, 
  Clock, CheckCircle, AlertCircle, RefreshCw, BarChart, ChevronRight, X 
} from 'lucide-react';
import { 
  BarChart as RechartBarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { Appointment, Doctor, Department, Staff, UserProfile, HealthRecord } from '../types';

export default function StaffAdmin() {
  const { user, role, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'appointments' | 'patients' | 'doctors' | 'departments' | 'staff' | 'analytics'>('dashboard');

  // Real-time server state collections
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<UserProfile[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  // Local utility UI states
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Appointment Modal/Form state
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [appPatientId, setAppPatientId] = useState('');
  const [appDoctorId, setAppDoctorId] = useState('');
  const [appDept, setAppDept] = useState('');
  const [appDateTime, setAppDateTime] = useState('');
  const [appStatus, setAppStatus] = useState<'pending' | 'confirmed' | 'completed' | 'cancelled'>('pending');
  const [appNotes, setAppNotes] = useState('');

  // Patient Focus State
  const [selectedPatient, setSelectedPatient] = useState<UserProfile | null>(null);
  const [patientRecords, setPatientRecords] = useState<HealthRecord[]>([]);
  const [patientApps, setPatientApps] = useState<Appointment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  // Doctor Form State
  const [docModelOpen, setDocModelOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docName, setDocName] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('');
  const [docBio, setDocBio] = useState('');
  const [docPhoto, setDocPhoto] = useState('');
  const [docDeptId, setDocDeptId] = useState('');

  // Department Form State
  const [deptModelOpen, setDeptModelOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptIcon, setDeptIcon] = useState('Heart');

  // Staff Form State (Admin Only)
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<'doctor' | 'nurse' | 'receptionist' | 'admin'>('nurse');
  const [savingStaff, setSavingStaff] = useState(false);

  // Auto-clear notices
  const showFlash = (type: 'success' | 'error', text: string) => {
    setNotificationMsg({ type, text });
    setTimeout(() => setNotificationMsg(null), 5000);
  };

  // 1. Initial real-time sync binders
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // Patients collection (users with role === patient)
    const qPatients = query(collection(db, 'users'), where('role', '==', 'patient'));
    const unsubPatients = onSnapshot(qPatients, (snap) => {
      const list: UserProfile[] = [];
      snap.forEach(d => list.push({ ...d.data() } as UserProfile));
      setPatients(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    // Main appointments listener
    const unsubAppointments = onSnapshot(collection(db, 'appointments'), (snap) => {
      const list: Appointment[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Appointment));
      setAppointments(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'appointments');
    });

    // Doctors listener
    const unsubDoctors = onSnapshot(collection(db, 'doctors'), (snap) => {
      const list: Doctor[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Doctor));
      setDoctors(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'doctors');
    });

    // Departments listener
    const unsubDepts = onSnapshot(collection(db, 'departments'), (snap) => {
      const list: Department[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Department));
      setDepartments(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'departments');
    });

    // Staff list (only read if authorized)
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snap) => {
      const list: Staff[] = [];
      snap.forEach(d => list.push({ uid: d.id, ...d.data() } as Staff));
      setStaffList(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'staff');
    });

    return () => {
      unsubPatients();
      unsubAppointments();
      unsubDoctors();
      unsubDepts();
      unsubStaff();
    };
  }, [user]);

  // Load focused patient details (Appts, files)
  useEffect(() => {
    if (!selectedPatient) return;

    // Load static appointments for this patient
    const pAppts = appointments.filter(a => a.patientId === selectedPatient.uid);
    setPatientApps(pAppts);

    // Sync records sub-collection
    const unsubRecs = onSnapshot(collection(db, 'records', selectedPatient.uid, 'files'), (snap) => {
      const list: HealthRecord[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as HealthRecord));
      setPatientRecords(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `records/${selectedPatient.uid}/files`);
    });

    return () => unsubRecs();
  }, [selectedPatient, appointments]);

  // 2. APPOINTMENTS SUBMIT HANDLER (CREATE / UPDATE)
  const handleApptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appPatientId || !appDoctorId || !appDept || !appDateTime) {
      showFlash('error', 'Please fill in all mandatory fields.');
      return;
    }

    const patientMatched = patients.find(p => p.uid === appPatientId);
    const doctorMatched = doctors.find(d => d.id === appDoctorId);

    const payload: any = {
      patientId: appPatientId,
      patientName: patientMatched?.name || 'Unknown Patient',
      patientEmail: patientMatched?.email || '',
      doctorId: appDoctorId,
      doctorName: doctorMatched?.name || 'Clinic Specialist',
      department: appDept,
      dateTime: appDateTime,
      status: appStatus,
      notes: appNotes,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingAppId) {
        // Edit existing appointment
        const docRef = doc(db, 'appointments', editingAppId);
        await updateDoc(docRef, payload);

        // Notify client
        const noticeRef = collection(db, 'notifications', appPatientId, 'items');
        await addDoc(noticeRef, {
          message: `Your appointment with ${payload.doctorName} has been rescheduled to ${new Date(appDateTime).toLocaleString()} (${appStatus}).`,
          type: 'appointment',
          read: false,
          createdAt: new Date().toISOString()
        });

        showFlash('success', 'Successfully updated appointment.');
      } else {
        // Create new appointment
        payload.createdAt = new Date().toISOString();
        payload.createdBy = user?.uid || '';
        
        await addDoc(collection(db, 'appointments'), payload);

        // Create user notification
        const noticeRef = collection(db, 'notifications', appPatientId, 'items');
        await addDoc(noticeRef, {
          message: `Specialist consult scheduled with ${payload.doctorName} on ${new Date(appDateTime).toLocaleString()}.`,
          type: 'appointment',
          read: false,
          createdAt: new Date().toISOString()
        });

        showFlash('success', 'Successfully booked new consult.');
      }
      setAppModalOpen(false);
      resetAppForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'appointments');
    }
  };

  const startEditAppt = (appt: Appointment) => {
    setEditingAppId(appt.id);
    setAppPatientId(appt.patientId);
    setAppDoctorId(appt.doctorId);
    setAppDept(appt.department);
    setAppDateTime(appt.dateTime);
    setAppStatus(appt.status);
    setAppNotes(appt.notes || '');
    setAppModalOpen(true);
  };

  const deleteAppt = async (id: string, patientId: string) => {
    if (!window.confirm('Confirm delete of this clinic appointment?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', id));
      
      // Notify user
      const noticeRef = collection(db, 'notifications', patientId, 'items');
      await addDoc(noticeRef, {
        message: 'Your upcoming medical consult has been cancelled by the hospital administration.',
        type: 'appointment',
        read: false,
        createdAt: new Date().toISOString()
      });
      
      showFlash('success', 'Appointment successfully cancelled.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `appointments/${id}`);
    }
  };

  const resetAppForm = () => {
    setEditingAppId(null);
    setAppPatientId('');
    setAppDoctorId('');
    setAppDept('');
    setAppDateTime('');
    setAppStatus('pending');
    setAppNotes('');
  };

  // 3. SECURE PHYSICAL FILE UPLOAD TO FIREBASE STORAGE
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !fileToUpload) return;

    setUploadingFile(true);
    try {
      const patientUid = selectedPatient.uid;
      const fileName = fileToUpload.name;
      
      // Upload straight to storage bucket path: 'records/{patientUid}/{fileName}'
      const storageRef = ref(storage, `records/${patientUid}/${fileName}`);
      const uploadResult = await uploadBytes(storageRef, fileToUpload);
      
      // Obtain down-link url
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      // Write metadata mirroring to Firestore 'records/{patientUid}/files/{id}'
      const filesSubColRef = collection(db, 'records', patientUid, 'files');
      await addDoc(filesSubColRef, {
        fileName,
        storageUrl: downloadUrl,
        uploadedBy: user?.displayName || user?.email || 'Clinical Staff',
        uploadedAt: new Date().toISOString()
      });

      // Write notification for patient
      const notifyRef = collection(db, 'notifications', patientUid, 'items');
      await addDoc(notifyRef, {
        message: `New medical record uploaded: "${fileName}". View the document under your Health Records.`,
        type: 'record',
        read: false,
        createdAt: new Date().toISOString()
      });

      showFlash('success', 'Health file successfully uploaded and archived.');
      setFileToUpload(null);
    } catch (err) {
      console.error('File Upload Crash:', err);
      showFlash('error', 'Filing failed: Verify Firestore rules or files availability.');
    } finally {
      setUploadingFile(false);
    }
  };

  // 4. DOCTOR MUTATIVE ACTIONS
  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName || !docSpecialty || !docDeptId) {
      showFlash('error', 'Doctor Name, Specialty, and Department Code are mandatory.');
      return;
    }

    const payload = {
      name: docName,
      specialty: docSpecialty,
      bio: docBio,
      photoUrl: docPhoto || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=450',
      departmentId: docDeptId
    };

    try {
      if (editingDocId) {
        await updateDoc(doc(db, 'doctors', editingDocId), payload);
        showFlash('success', 'Doctor details saved.');
      } else {
        const generatedId = docName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await setDoc(doc(db, 'doctors', generatedId), payload);
        showFlash('success', 'Doctor profile instantiated.');
      }
      setDocModelOpen(false);
      resetDocForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'doctors');
    }
  };

  const deleteDoctor = async (id: string) => {
    if (!window.confirm('Delete doctor profile?')) return;
    try {
      await deleteDoc(doc(db, 'doctors', id));
      showFlash('success', 'Doctor profile deleted.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `doctors/${id}`);
    }
  };

  const resetDocForm = () => {
    setEditingDocId(null);
    setDocName('');
    setDocSpecialty('');
    setDocBio('');
    setDocPhoto('');
    setDocDeptId('');
  };

  // 5. DEPARTMENT MUTATIVE ACTIONS
  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName) return;

    const payload = {
      name: deptName,
      description: deptDesc,
      icon: deptIcon
    };

    try {
      if (editingDeptId) {
        await updateDoc(doc(db, 'departments', editingDeptId), payload);
        showFlash('success', 'Department details updated.');
      } else {
        const idGenerated = deptName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await setDoc(doc(db, 'departments', idGenerated), payload);
        showFlash('success', 'New Medical Ward setup complete.');
      }
      setDeptModelOpen(false);
      resetDeptForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'departments');
    }
  };

  const deleteDept = async (id: string) => {
    if (!window.confirm('Delete this clinical ward?')) return;
    try {
      await deleteDoc(doc(db, 'departments', id));
      showFlash('success', 'Ward successfully closed.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `departments/${id}`);
    }
  };

  const resetDeptForm = () => {
    setEditingDeptId(null);
    setDeptName('');
    setDeptDesc('');
    setDeptIcon('Heart');
  };

  // 6. STAFF CUSTOM CREATOR & REMOVER (EXPRESS SERVER INTERACTION APIs)
  const handleStaffInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail || !staffName || !staffRole) {
      showFlash('error', 'All staff invitation dimensions must be populated.');
      return;
    }

    setSavingStaff(true);
    try {
      const idToken = await user?.getIdToken();
      const response = await fetch('/api/admin/create-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ email: staffEmail, name: staffName, role: staffRole })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Server rejected staff account enrollment.');
      }

      showFlash('success', `Staff account created! Temporary password: ${body.password}`);
      setStaffModalOpen(false);
      setStaffEmail('');
      setStaffName('');
    } catch (err: any) {
      showFlash('error', err.message || 'Invitation failed: check authorization clearance.');
    } finally {
      setSavingStaff(false);
    }
  };

  const handleStaffDelete = async (staffUid: string) => {
    if (staffUid === user?.uid) {
      showFlash('error', 'Deletion aborted: You cannot delete your current active session.');
      return;
    }

    if (!window.confirm('Revoke credentials and erase staff profile permanently?')) return;

    try {
      const idToken = await user?.getIdToken();
      const response = await fetch('/api/admin/delete-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ uid: staffUid })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Server rejected profile deletion.');
      }

      showFlash('success', 'Staff account access revoked.');
    } catch (err: any) {
      showFlash('error', err.message || 'Error revoking permissions.');
    }
  };

  // 7. ANALYTICS METRIC BUILDERS
  const getAnalyticsByWardData = () => {
    const counts: { [ward: string]: number } = {};
    departments.forEach(d => { counts[d.name] = 0; });
    appointments.forEach(a => {
      const nameMatch = departments.find(d => d.id === a.department || d.name === a.department);
      const k = nameMatch ? nameMatch.name : a.department;
      counts[k] = (counts[k] || 0) + 1;
    });

    return Object.keys(counts).map(k => ({
      name: k,
      Appointments: counts[k]
    }));
  };

  const getAnalyticsByStatusData = () => {
    const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    appointments.forEach(a => {
      if (a.status in counts) counts[a.status]++;
    });

    return [
      { name: 'Pending', value: counts.pending, color: '#D97706' },
      { name: 'Confirmed', value: counts.confirmed, color: '#047857' },
      { name: 'Completed', value: counts.completed, color: '#2563EB' },
      { name: 'Cancelled', value: counts.cancelled, color: '#DC2626' }
    ];
  };

  // Search filtering lists
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredAppointments = appointments.filter(a =>
    a.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.doctorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FCFAF7] flex flex-col md:flex-row text-[#1A1A1A]">
      
      {/* Clinicial Administration Side Rail */}
      <aside className="w-full md:w-80 bg-[#1A1A1A] text-stone-300 flex flex-col p-6 space-y-8">
        <div className="flex items-baseline gap-2 pb-6 border-b border-stone-800">
          <span className="text-xl font-serif font-semibold tracking-tight text-emerald-400">St. Jude’s</span>
          <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-stone-500">Clinical Desk</span>
        </div>

        {/* Staff details */}
        <div className="p-4 bg-stone-900 border border-stone-800 rounded flex gap-4 items-center">
          <div className="h-9 w-9 bg-emerald-700 text-stone-100 rounded-full flex items-center justify-center font-bold text-xs uppercase">
            {role ? role.slice(0, 2) : 'ST'}
          </div>
          <div>
            <h5 className="font-semibold text-xs text-stone-100 truncate">{user?.email}</h5>
            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">{role} Control Point</span>
          </div>
        </div>

        {/* Panel tabs */}
        <nav className="flex-1 flex flex-col gap-1 text-xs">
          <button 
            onClick={() => { setActiveTab('dashboard'); setSearchTerm(''); }}
            className={`flex items-center gap-3 px-4 py-3 rounded text-left font-semibold uppercase tracking-wider border-none bg-transparent cursor-pointer transition-colors ${activeTab === 'dashboard' ? 'bg-emerald-900 text-white' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'}`}
          >
            <TrendingUp className="h-4 w-4" />
            Control Dashboard
          </button>

          <button 
            onClick={() => { setActiveTab('appointments'); setSearchTerm(''); }}
            className={`flex items-center gap-3 px-4 py-3 rounded text-left font-semibold uppercase tracking-wider border-none bg-transparent cursor-pointer transition-colors ${activeTab === 'appointments' ? 'bg-emerald-900 text-white' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'}`}
          >
            <Calendar className="h-4 w-4" />
            Bookings CRM
          </button>

          <button 
            onClick={() => { setActiveTab('patients'); setSearchTerm(''); setSelectedPatient(null); }}
            className={`flex items-center gap-3 px-4 py-3 rounded text-left font-semibold uppercase tracking-wider border-none bg-transparent cursor-pointer transition-colors ${activeTab === 'patients' ? 'bg-emerald-900 text-white' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'}`}
          >
            <Users className="h-4 w-4" />
            Files Explorer
          </button>

          <button 
            onClick={() => { setActiveTab('doctors'); setSearchTerm(''); }}
            className={`flex items-center gap-3 px-4 py-3 rounded text-left font-semibold uppercase tracking-wider border-none bg-transparent cursor-pointer transition-colors ${activeTab === 'doctors' ? 'bg-emerald-900 text-white' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'}`}
          >
            <Stethoscope className="h-4 w-4" />
            Doctor Registry
          </button>

          <button 
            onClick={() => { setActiveTab('departments'); setSearchTerm(''); }}
            className={`flex items-center gap-3 px-4 py-3 rounded text-left font-semibold uppercase tracking-wider border-none bg-transparent cursor-pointer transition-colors ${activeTab === 'departments' ? 'bg-emerald-900 text-white' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'}`}
          >
            <Briefcase className="h-4 w-4" />
            Wards & Clinics
          </button>

          {role === 'admin' && (
            <button 
              onClick={() => { setActiveTab('staff'); setSearchTerm(''); }}
              className={`flex items-center gap-3 px-4 py-3 rounded text-left font-semibold uppercase tracking-wider border-none bg-transparent cursor-pointer transition-colors ${activeTab === 'staff' ? 'bg-emerald-900 text-white' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'}`}
            >
              <Lock className="h-4 w-4" />
              Staff Credentials
            </button>
          )}

          <button 
            onClick={() => { setActiveTab('analytics'); setSearchTerm(''); }}
            className={`flex items-center gap-3 px-4 py-3 rounded text-left font-semibold uppercase tracking-wider border-none bg-transparent cursor-pointer transition-colors ${activeTab === 'analytics' ? 'bg-emerald-900 text-white' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-900'}`}
          >
            <BarChart className="h-4 w-4" />
            Reports & Analytics
          </button>
        </nav>

        {/* Terminate Session */}
        <div className="pt-6 border-t border-stone-850">
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 border border-stone-800 text-xs font-semibold uppercase tracking-wider text-stone-450 hover:bg-stone-800 hover:text-white cursor-pointer"
          >
            Sign Out Session
          </button>
        </div>
      </aside>

      {/* Main Control View */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto max-w-7xl">
        
        {/* Flash Notifications */}
        {notificationMsg && (
          <div className={`p-4 mb-6 rounded text-xs flex justify-between items-center shadow-lg border ${notificationMsg.type === 'success' ? 'bg-emerald-50 text-emerald-950 border-emerald-300' : 'bg-red-50 text-red-950 border-red-350'}`}>
            <span className="font-medium">{notificationMsg.text}</span>
            <button onClick={() => setNotificationMsg(null)} className="text-xs bg-transparent border-none font-bold uppercase cursor-pointer">OK</button>
          </div>
        )}

        {/* TAB 1: CONTROL DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-fade-in">
            {/* HUD Title */}
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-800 font-semibold font-mono">Central HUD</span>
              <h1 className="text-3xl md:text-4xl font-serif text-stone-950 mt-1">St. Jude's Clinical System</h1>
              <p className="text-xs text-stone-400 mt-1">Real-time status snapshot of active patient care registries, queues, and documentation.</p>
            </div>

            {/* KPI Counts Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-6 bg-white border border-stone-200 shadow-sm flex flex-col justify-between rounded">
                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400">Total Consults Logged</span>
                <span className="text-4xl font-serif font-bold text-emerald-950 mt-2">{appointments.length}</span>
              </div>
              <div className="p-6 bg-white border border-stone-200 shadow-sm flex flex-col justify-between rounded">
                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400">Active Patient Files</span>
                <span className="text-4xl font-serif font-bold text-emerald-950 mt-2">{patients.length}</span>
              </div>
              <div className="p-6 bg-white border border-stone-200 shadow-sm flex flex-col justify-between rounded">
                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400">Registry Practitioners</span>
                <span className="text-4xl font-serif font-bold text-emerald-950 mt-2">{doctors.length}</span>
              </div>
              <div className="p-6 bg-white border border-stone-200 shadow-sm flex flex-col justify-between rounded">
                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400">Active Medical Wards</span>
                <span className="text-4xl font-serif font-bold text-emerald-950 mt-2">{departments.length}</span>
              </div>
            </div>

            {/* Patient Search shortcut form */}
            <div className="p-8 bg-stone-100 rounded-sm border border-stone-200 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="space-y-1 w-full md:w-3/5">
                <h3 className="font-serif text-lg">Retrieve Patient Dossier</h3>
                <p className="text-xs text-stone-500">Quick-search patients by name or email, access documentation metadata archives, and dispatch files.</p>
              </div>
              <div className="flex gap-2 w-full md:w-2/5">
                <input 
                  type="text"
                  placeholder="E.g., Julianne Vance"
                  className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded text-xs focus:outline-none focus:border-emerald-800"
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setActiveTab('patients');
                  }}
                />
              </div>
            </div>

            {/* Daily schedule pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Emergency / Action alert board */}
              <div className="p-6 bg-white border border-stone-200 rounded">
                <h3 className="font-serif text-lg mb-4 text-emerald-950">Daily Clinical Alerts</h3>
                <div className="space-y-3 text-xs">
                  <div className="p-4 border-l-4 border-amber-500 bg-amber-50 text-amber-950 rounded">
                    <strong>Pending Records Check:</strong> Ensure all diagnostic logs for yesterday's oncology surgeries are fully written.
                  </div>
                  <div className="p-4 border-l-4 border-blue-500 bg-blue-50 text-blue-950 rounded">
                    <strong>Vite Synchronization Check:</strong> Express API server is active and reporting status green.
                  </div>
                </div>
              </div>

              {/* Doctors scheduled */}
              <div className="p-6 bg-white border border-stone-200 rounded">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif text-lg text-emerald-950">Active Registries</h3>
                  <button onClick={() => setActiveTab('doctors')} className="text-xs font-bold uppercase text-emerald-800">Manage Panel →</button>
                </div>
                <div className="space-y-3">
                  {doctors.slice(0, 3).map(docItem => (
                    <div key={docItem.id} className="flex justify-between items-center p-3 bg-stone-50 border border-stone-100 rounded">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-stone-200 rounded-full overflow-hidden">
                          <img src={docItem.photoUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-stone-900">{docItem.name}</p>
                          <p className="text-[10px] text-stone-400 capitalize">{docItem.specialty} Specialist</p>
                        </div>
                      </div>
                      <span className="text-[9px] uppercase font-bold text-stone-400">{docItem.departmentId} Ward</span>
                    </div>
                  ))}
                  {doctors.length === 0 && <p className="text-xs text-stone-400">Doctor registry empty.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BOOKINGS CRM (APPOINTMENTS) */}
        {activeTab === 'appointments' && (
          <div className="space-y-8 animate-fade-in">
            {/* Header toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-xs uppercase tracking-widest text-emerald-800 font-semibold font-mono">Registry Log</span>
                <h1 className="text-3xl font-serif text-stone-950 mt-1">Bookings & Consults CRM</h1>
                <p className="text-xs text-stone-400 mt-1">Process scheduler bookings, assign doctors, log notes, and keep patient alerts synchronized.</p>
              </div>
              <button 
                onClick={() => { resetAppForm(); setAppModalOpen(true); }}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-900 hover:bg-emerald-850 text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow border-none cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Book New Session
              </button>
            </div>

            {/* List Appointments with interactive edits */}
            <div className="bg-white border border-stone-200 rounded shadow-sm overflow-hidden">
              <div className="p-4 border-b border-stone-200 bg-stone-50 flex gap-2">
                <Search className="h-4 w-4 text-stone-400 self-center" />
                <input 
                  type="text" 
                  placeholder="Search bookings by Doctor, Patient Name, or Ward..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-none text-xs text-[#1A1A1A] focus:outline-none"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50/50 text-stone-400 font-bold uppercase border-b border-stone-200">
                      <th className="p-4">Consult Target / Patient</th>
                      <th className="p-4">Practitioner / Specialty</th>
                      <th className="p-4">DateTime Slot</th>
                      <th className="p-4">Registry Ward</th>
                      <th className="p-4">Docket Status</th>
                      <th className="p-4 text-right">Administrative Clearance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((appt) => (
                      <tr key={appt.id} className="border-b border-stone-100 hover:bg-[#FCFAF7] transition-colors">
                        <td className="p-4 font-semibold text-stone-900">
                          <div>
                            <p>{appt.patientName || 'Anonymous'}</p>
                            <span className="text-[10px] text-stone-400 font-mono">UID: {appt.patientId.slice(0, 8)}...</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <p>{appt.doctorName}</p>
                          <span className="text-[10px] text-stone-400">{appt.department} Oncology</span>
                        </td>
                        <td className="p-4 font-mono font-medium text-stone-600">
                          {new Date(appt.dateTime).toLocaleString()}
                        </td>
                        <td className="p-4 font-semibold text-emerald-850">{appt.department}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 text-[9px] font-bold tracking-wider rounded uppercase ${
                            appt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                            appt.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                            appt.status === 'completed' ? 'bg-stone-100 text-stone-700' : 'bg-red-100 text-red-850'
                          }`}>
                            {appt.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => startEditAppt(appt)} 
                              className="p-1.5 hover:bg-stone-100 text-stone-600 rounded border border-transparent hover:border-stone-200 bg-transparent cursor-pointer"
                              title="Edit Consult"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => deleteAppt(appt.id, appt.patientId)} 
                              className="p-1.5 hover:bg-red-50 text-red-650 rounded border border-transparent hover:border-red-100 bg-transparent cursor-pointer"
                              title="Cancel Consult"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAppointments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-stone-400">No scheduled consultations logged.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* APPOINTMENT BOOKING FORM / MODAL CARD */}
            {appModalOpen && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white border border-stone-200 shadow-2xl p-8 max-w-lg w-full rounded relative animate-scale-up">
                  <button 
                    onClick={() => { setAppModalOpen(false); resetAppForm(); }}
                    className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 bg-transparent border-none cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  <h3 className="font-serif text-xl text-emerald-950 mb-6">{editingAppId ? 'Change Consultation Parameters' : 'Register New Consultation'}</h3>

                  <form onSubmit={handleApptSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Patient Dossier *</label>
                      <select 
                        required
                        value={appPatientId}
                        onChange={(e) => setAppPatientId(e.target.value)}
                        className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none focus:border-emerald-800"
                      >
                        <option value="">Choose Patient</option>
                        {patients.map(p => (
                          <option key={p.uid} value={p.uid}>{p.name} ({p.email || 'No email'})</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Assigned Doctor *</label>
                        <select 
                          required
                          value={appDoctorId}
                          onChange={(e) => setAppDoctorId(e.target.value)}
                          className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none focus:border-emerald-800"
                        >
                          <option value="">Choose Practitioner</option>
                          {doctors.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Registry Ward *</label>
                        <select 
                          required
                          value={appDept}
                          onChange={(e) => setAppDept(e.target.value)}
                          className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none focus:border-emerald-800"
                        >
                          <option value="">Choose Specialty</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Schedule Date/Time *</label>
                        <input 
                          type="datetime-local" 
                          required
                          value={appDateTime}
                          onChange={(e) => setAppDateTime(e.target.value)}
                          className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Consult Status</label>
                        <select 
                          value={appStatus}
                          onChange={(e) => setAppStatus(e.target.value as any)}
                          className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs"
                        >
                          <option value="pending">Pending Invitation</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Clinical Docket Notes</label>
                      <textarea 
                        rows={4}
                        value={appNotes}
                        onChange={(e) => setAppNotes(e.target.value)}
                        placeholder="Directions, prep work, or clinical concerns..."
                        className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                      <button 
                        type="button" 
                        onClick={() => { setAppModalOpen(false); resetAppForm(); }}
                        className="px-4 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-550 rounded font-semibold cursor-pointer"
                      >
                        Abort
                      </button>
                      <button 
                        type="submit" 
                        className="px-5 py-2 bg-emerald-900 hover:bg-emerald-850 text-white border-none rounded font-semibold cursor-pointer"
                      >
                        {editingAppId ? 'Apply Amendments' : 'Secure Booking'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FILE EXPLORER (PATIENTS SEARCH & FILES UPLOAD) */}
        {activeTab === 'patients' && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-800 font-semibold">Vault Dossiers</span>
              <h1 className="text-3xl font-serif text-stone-950 mt-1">Patients Directories & Diagnostics</h1>
              <p className="text-xs text-stone-400 mt-1">Dispatch diagnostic health records straight to storage, review patient medical DOB/emergency contact files, and schedule logs.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: search + list */}
              <div className="lg:col-span-5 bg-white border border-stone-200 rounded overflow-hidden shadow-sm">
                <div className="p-4 border-b border-stone-200 bg-stone-550 flex gap-2">
                  <Search className="h-4 w-4 text-stone-400 self-center" />
                  <input 
                    type="text" 
                    placeholder="Filter patients by name/email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-transparent border-none text-xs focus:outline-none text-[#1A1A1A]"
                  />
                </div>
                <div className="divide-y divide-stone-100 max-h-[500px] overflow-y-auto">
                  {filteredPatients.map(patient => (
                    <div 
                      key={patient.uid} 
                      onClick={() => setSelectedPatient(patient)}
                      className={`p-4 text-xs cursor-pointer hover:bg-stone-50 transition-colors flex justify-between items-center ${selectedPatient?.uid === patient.uid ? 'bg-emerald-50/20 border-r-4 border-emerald-800' : ''}`}
                    >
                      <div>
                        <p className="font-semibold text-stone-850 text-sm">{patient.name}</p>
                        <p className="text-stone-400 mt-0.5">{patient.email}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-stone-300" />
                    </div>
                  ))}
                  {filteredPatients.length === 0 && (
                    <p className="p-6 text-center text-stone-450">No patient files found.</p>
                  )}
                </div>
              </div>

              {/* Right Column: details + file upload */}
              <div className="lg:col-span-7 space-y-6">
                {selectedPatient ? (
                  <div className="bg-white border border-stone-200 rounded p-8 space-y-8 shadow-sm">
                    {/* Patient Master coordinates */}
                    <div className="border-b border-stone-100 pb-5">
                      <h3 className="font-serif text-2xl text-stone-900 mb-2">{selectedPatient.name}</h3>
                      <p className="text-xs text-stone-400">Authenticated via Firebase UID: <span className="font-mono">{selectedPatient.uid}</span></p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-xs text-stone-600 bg-stone-50 p-4 border border-stone-150 rounded">
                        <div>
                          <span className="block font-bold text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Date of Birth</span>
                          <span className="font-mono">{selectedPatient.DOB || selectedPatient.dob || 'Not entered'}</span>
                        </div>
                        <div>
                          <span className="block font-bold text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Blood Type</span>
                          <span className="font-medium text-emerald-850">{selectedPatient.bloodGroup || 'Unknown'}</span>
                        </div>
                        <div>
                          <span className="block font-bold text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Contact</span>
                          <span>{selectedPatient.phone || 'No phone'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs text-stone-600">
                        <div>
                          <span className="block font-bold text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Residential Address</span>
                          <span>{selectedPatient.address || 'No address logged.'}</span>
                        </div>
                        <div>
                          <span className="block font-bold text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Emergency Contact</span>
                          <span>{selectedPatient.emergencyContact || 'None listed.'}</span>
                        </div>
                      </div>
                    </div>

                    {/* UPLOAD FORM (Staff uploads straight to records/{patientUid}/{filename}) */}
                    <div className="bg-[#F5F2EC] border border-[#E4E0D9] p-6 rounded-md space-y-4">
                      <h4 className="font-serif text-md text-emerald-950 font-semibold flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Archive Diagnostic health Record
                      </h4>
                      <p className="text-[10px] text-stone-500">File is processed client-side and saved straight to Firebase Storage, registering metadata securely.</p>

                      <form onSubmit={handleFileUpload} className="space-y-4">
                        <div className="border border-dashed border-stone-300 bg-white/75 rounded p-4 text-center cursor-pointer hover:bg-stone-50 relative">
                          <input 
                            type="file" 
                            required
                            onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <p className="text-xs font-semibold text-stone-605">
                            {fileToUpload ? `Selected: ${fileToUpload.name}` : "Click to select or drag clinical PDF/Image here"}
                          </p>
                          <span className="text-[10px] text-stone-400">File formats: PDF, PNG, JPG (Max 5MB)</span>
                        </div>

                        {fileToUpload && (
                          <div className="flex justify-end gap-2">
                            <button 
                              type="button" 
                              onClick={() => setFileToUpload(null)}
                              className="px-3 py-1.5 bg-white border border-stone-300 text-stone-600 rounded text-xs cursor-pointer"
                            >
                              Reset
                            </button>
                            <button 
                              type="submit" 
                              disabled={uploadingFile}
                              className="px-4 py-1.5 bg-emerald-955 text-white border-none rounded text-xs font-bold cursor-pointer hover:bg-emerald-850"
                            >
                              {uploadingFile ? 'Uploading bytes...' : 'Complete Filing'}
                            </button>
                          </div>
                        )}
                      </form>
                    </div>

                    {/* METADATA FILES ARCHIVE LIST */}
                    <div className="space-y-4">
                      <h4 className="font-serif text-md text-emerald-950 font-semibold">Archived Documents ({patientRecords.length})</h4>
                      <div className="space-y-2 text-xs">
                        {patientRecords.map(docId => (
                          <div key={docId.id} className="p-3 bg-stone-50 border border-stone-150 rounded flex justify-between items-center gap-4">
                            <div className="flex gap-2 items-center">
                              <FileText className="h-4 w-4 text-emerald-800 flex-shrink-0" />
                              <div>
                                <p className="font-semibold text-stone-900 truncate max-w-xs">{docId.fileName}</p>
                                <span className="text-[9px] text-stone-400">Filed by {docId.uploadedBy} on {new Date(docId.uploadedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <a 
                              href={docId.storageUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="px-3 py-1 bg-white border border-stone-250 text-[#1A1A1A] font-semibold rounded text-[10px] uppercase hover:bg-stone-100 tracking-wider"
                            >
                              Open Scans
                            </a>
                          </div>
                        ))}
                        {patientRecords.length === 0 && (
                          <p className="text-xs text-stone-400 italic">No historical diagnostic documents on microfilm for this patient.</p>
                        )}
                      </div>
                    </div>

                    {/* APPOINTMENT LOGS FOR ACTIVE PATIENT */}
                    <div className="space-y-4">
                      <h4 className="font-serif text-md text-emerald-950 font-semibold">Scheduled consults ({patientApps.length})</h4>
                      <div className="space-y-2 text-xs">
                        {patientApps.map(appt => (
                          <div key={appt.id} className="p-4 bg-stone-50/50 border border-stone-150 rounded flex justify-between items-center">
                            <div>
                              <p className="font-semibold text-stone-900">{appt.doctorName}</p>
                              <p className="text-[10px] text-stone-450">{appt.department} • {new Date(appt.dateTime).toLocaleString()}</p>
                            </div>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${
                              appt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                              appt.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-700'
                            }`}>
                              {appt.status}
                            </span>
                          </div>
                        ))}
                        {patientApps.length === 0 && (
                          <p className="text-xs text-stone-400 italic">No scheduled consultations logged for this patient.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-16 text-center bg-white border border-stone-200 rounded text-stone-400">
                    No patient dossier selected. Direct-search or select a key patient folder from the left index panel to inspect archives.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DOCTOR REGISTRY */}
        {activeTab === 'doctors' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-xs uppercase tracking-widest text-emerald-800 font-semibold">Practitioners Panel</span>
                <h1 className="text-3xl font-serif text-stone-950 mt-1">Doctor Registries Management</h1>
                <p className="text-xs text-stone-400 mt-1">Configure specialist doctors on staff, specialties, photo references, and bio outlines.</p>
              </div>
              <button 
                onClick={() => { resetDocForm(); setDocModelOpen(true); }}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-900 hover:bg-emerald-850 text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow border-none cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Register Practitioner
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {doctors.map(d => (
                <div key={d.id} className="bg-white border border-stone-200 rounded shadow-sm flex flex-col justify-between overflow-hidden">
                  <div className="aspect-video bg-stone-100 overflow-hidden">
                    <img src={d.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">{d.specialty}</span>
                      <h3 className="font-serif text-lg text-stone-950 mt-1">{d.name}</h3>
                      <p className="text-xs text-stone-500 leading-relaxed mt-2">{d.bio}</p>
                      <span className="inline-block px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider bg-stone-50 border border-stone-150 rounded mt-3 text-stone-500">
                        Ward ID: {d.departmentId}
                      </span>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-stone-50">
                      <button 
                        onClick={() => {
                          setEditingDocId(d.id);
                          setDocName(d.name);
                          setDocSpecialty(d.specialty);
                          setDocBio(d.bio);
                          setDocPhoto(d.photoUrl);
                          setDocDeptId(d.departmentId);
                          setDocModelOpen(true);
                        }}
                        className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 font-semibold rounded text-xs cursor-pointer"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => deleteDoctor(d.id)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-750 border border-red-150 rounded text-xs font-semibold cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {doctors.length === 0 && <p className="text-xs text-stone-400">Doctor registry is empty.</p>}
            </div>

            {/* DOCTOR CREATE/EDIT MODAL FORM */}
            {docModelOpen && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white border border-stone-200 shadow-2xl p-8 max-w-lg w-full rounded relative animate-scale-up">
                  <button onClick={() => { setDocModelOpen(false); resetDocForm(); }} className="absolute top-4 right-4 text-stone-400 hover:text-stone-750 bg-transparent border-none cursor-pointer">
                    <X className="h-5 w-5" />
                  </button>

                  <h3 className="font-serif text-xl text-emerald-950 mb-6">{editingDocId ? 'Update Practitioner' : 'Add New Practitioner'}</h3>

                  <form onSubmit={handleDoctorSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold mb-2">Doctor Full Name *</label>
                      <input 
                        type="text" 
                        required
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        placeholder="Dr. Elena Vasquez"
                        className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none focus:border-emerald-800"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold mb-2">Specialty *</label>
                        <input 
                          type="text" 
                          required
                          value={docSpecialty}
                          onChange={(e) => setDocSpecialty(e.target.value)}
                          placeholder="Cardiology / Neurology"
                          className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none focus:border-emerald-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold mb-2">Ward Assignment *</label>
                        <select 
                          value={docDeptId}
                          required
                          onChange={(e) => setDocDeptId(e.target.value)}
                          className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs"
                        >
                          <option value="">Choose Ward</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold mb-2">Practitioner Photo URL</label>
                      <input 
                        type="text" 
                        value={docPhoto}
                        onChange={(e) => setDocPhoto(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold mb-2">Short Professional Bio</label>
                      <textarea 
                        rows={4}
                        value={docBio}
                        onChange={(e) => setDocBio(e.target.value)}
                        placeholder="Clinical board honors, dual certification background, active research areas..."
                        className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                      <button type="button" onClick={() => { setDocModelOpen(false); resetDocForm(); }} className="px-4 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-550 rounded font-semibold cursor-pointer">
                        Cancel
                      </button>
                      <button type="submit" className="px-5 py-2 bg-emerald-900 hover:bg-emerald-850 text-white border-none rounded font-semibold cursor-pointer">
                        {editingDocId ? 'Apply changes' : 'Instantiate profile'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: DEPARTMENT MANAGEMENT */}
        {activeTab === 'departments' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-xs uppercase tracking-widest text-emerald-800 font-semibold font-mono">Operations</span>
                <h1 className="text-3xl font-serif text-stone-950 mt-1">Medical Wards & Clinics</h1>
                <p className="text-xs text-stone-400 mt-1">Add, edit, or remove operational clinical medical departments and specialized wards in our facilities.</p>
              </div>
              <button 
                onClick={() => { resetDeptForm(); setDeptModelOpen(true); }}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-900 hover:bg-emerald-850 text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow border-none cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Open Medical Ward
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {departments.map(d => (
                <div key={d.id} className="p-6 bg-white border border-stone-200 shadow-sm rounded flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <span className="text-[10px] text-stone-400 font-mono font-bold uppercase tracking-wider">Ward ID: {d.id}</span>
                    <h3 className="font-serif text-xl font-bold text-stone-950">{d.name}</h3>
                    <p className="text-xs text-stone-605 leading-relaxed">{d.description}</p>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t border-stone-50">
                    <button 
                      onClick={() => {
                        setEditingDeptId(d.id);
                        setDeptName(d.name);
                        setDeptDesc(d.description);
                        setDeptIcon(d.icon);
                        setDeptModelOpen(true);
                      }}
                      className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 font-semibold rounded text-xs cursor-pointer"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => deleteDept(d.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-750 border border-red-150 rounded text-xs font-semibold cursor-pointer"
                    >
                      Close Ward
                    </button>
                  </div>
                </div>
              ))}
              {departments.length === 0 && <p className="text-xs text-stone-400">No departments specified on network database.</p>}
            </div>

            {/* DEPARTMENT CONTROL FORM / MODAL */}
            {deptModelOpen && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white border border-stone-200 shadow-2xl p-8 max-w-lg w-full rounded relative animate-scale-up">
                  <button onClick={() => { setDeptModelOpen(false); resetDeptForm(); }} className="absolute top-4 right-4 text-stone-400 hover:text-stone-750 bg-transparent border-none cursor-pointer">
                    <X className="h-5 w-5" />
                  </button>

                  <h3 className="font-serif text-xl text-emerald-950 mb-6">{editingDeptId ? 'Amend Medical Ward' : 'Open New Clinical Ward'}</h3>

                  <form onSubmit={handleDeptSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold mb-2">Ward Name *</label>
                      <input 
                        type="text" 
                        required
                        value={deptName}
                        onChange={(e) => setDeptName(e.target.value)}
                        placeholder="Pediatrics / Oncology"
                        className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none focus:border-emerald-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold mb-2">Ward Vector Icon Class</label>
                      <select 
                        value={deptIcon}
                        onChange={(e) => setDeptIcon(e.target.value)}
                        className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs"
                      >
                        <option value="Heart">Heart (Cardio)</option>
                        <option value="Brain">Brain (Neurology)</option>
                        <option value="Baby">Baby (Pediatrics)</option>
                        <option value="Activity">Pulse (Orthopedia)</option>
                        <option value="ShieldAlert">Shield (Oncology)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold mb-2">Ward Responsibilities Description</label>
                      <textarea 
                        rows={4}
                        required
                        value={deptDesc}
                        onChange={(e) => setDeptDesc(e.target.value)}
                        placeholder="Clinical scope, hybrid lab setups, active diagnostic scopes..."
                        className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                      <button type="button" onClick={() => { setDeptModelOpen(false); resetDeptForm(); }} className="px-4 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-550 rounded font-semibold cursor-pointer">
                        Cancel
                      </button>
                      <button type="submit" className="px-5 py-2 bg-emerald-900 hover:bg-emerald-850 text-white border-none rounded font-semibold cursor-pointer">
                        {editingDeptId ? 'Save Changes' : 'Open Ward'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: STAFF MANAGEMENT (ADMIN ACCESS LEVEL ONLY) */}
        {activeTab === 'staff' && role === 'admin' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-xs uppercase tracking-widest text-[#DC2626] font-bold font-mono">Security Gate</span>
                <h1 className="text-3xl font-serif text-stone-950 mt-1">Staff Auth Credentials Matrix</h1>
                <p className="text-xs text-stone-400 mt-1">Administrative credentials cockpit. Trigger raw Firebase Auth user accounts, write claims roles, or wipe users server-side.</p>
              </div>
              <button 
                onClick={() => setStaffModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 bg-[#DC2626] hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow border-none cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Invite Clinical Staff
              </button>
            </div>

            <div className="bg-white border border-stone-200 rounded shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 font-bold uppercase border-b border-stone-200 text-stone-400">
                    <th className="p-4">Staff Member</th>
                    <th className="p-4">Email Address</th>
                    <th className="p-4">Access Credentials Designation</th>
                    <th className="p-4">Creation Date</th>
                    <th className="p-4 text-right">Emergency Revocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {staffList.map(st => (
                    <tr key={st.uid} className="hover:bg-red-50/10 transition-colors">
                      <td className="p-4 font-semibold text-stone-900">{st.name}</td>
                      <td className="p-4 text-stone-520 font-mono">{st.email}</td>
                      <td className="p-4 font-bold text-emerald-800 uppercase tracking-wide">
                        {st.role}
                      </td>
                      <td className="p-4 text-stone-400">{st.createdAt ? new Date(st.createdAt).toLocaleDateString() : 'N/A'}</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleStaffDelete(st.uid)}
                          className="px-3 py-1.5 bg-red-100 text-red-750 hover:bg-red-200 rounded border-none font-bold uppercase tracking-wider text-[9px] cursor-pointer"
                        >
                          Revoke Access
                        </button>
                      </td>
                    </tr>
                  ))}
                  {staffList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-stone-400">No staff credentials documented. Setup the cloud connection database.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* STAFF INVITE USER ACCOUNT CREATOR FORM */}
            {staffModalOpen && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white border border-stone-200 shadow-2xl p-8 max-w-sm w-full rounded relative animate-scale-up">
                  <button onClick={() => setStaffModalOpen(false)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-750 bg-transparent border-none cursor-pointer">
                    <X className="h-5 w-5" />
                  </button>

                  <h3 className="font-serif text-xl text-red-650 mb-6 flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Register Staff Account
                  </h3>

                  <form onSubmit={handleStaffInvite} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Staff Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="E.g., Nurse Jenny Parker"
                        className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Staff Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        placeholder="jenny@stjudesmedical.org"
                        className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Authorized Claims Role</label>
                      <select 
                        value={staffRole} 
                        onChange={(e) => setStaffRole(e.target.value as any)}
                        className="w-full px-3 py-2 bg-[#FCFAF7] border border-stone-300 rounded text-xs"
                      >
                        <option value="doctor">Doctor (Specialist)</option>
                        <option value="nurse">Nurse (Practitioner)</option>
                        <option value="receptionist">Receptionist / Admisson</option>
                        <option value="admin">Main Administrator</option>
                      </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                      <button type="button" onClick={() => setStaffModalOpen(false)} className="px-4 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-550 rounded font-semibold cursor-pointer">
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={savingStaff}
                        className="px-5 py-2 bg-[#DC2626] hover:bg-red-750 text-white border-none rounded font-semibold cursor-pointer"
                      >
                        {savingStaff ? 'Verifying with SDK...' : 'Provision Auth Account'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: REPORTS & ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-10 animate-fade-in">
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-800 font-semibold font-mono">Statistical Engine</span>
              <h1 className="text-3xl font-serif text-stone-950 mt-1">Operational Analytics & Reports</h1>
              <p className="text-xs text-stone-400 mt-1">Interactive charting engine reporting appointment distributions across specialized units and clinical statuses.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Grouped by Wards (Bar Chart) */}
              <div className="p-8 bg-white border border-stone-200 rounded shadow-sm space-y-4">
                <h3 className="font-serif text-lg text-emerald-950 font-semibold">Consultations by Ward</h3>
                <p className="text-[11px] text-stone-400">Appointment distributions grouped by medical specialty wards.</p>
                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartBarChart data={getAnalyticsByWardData()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" stroke="#78716c" fontSize={10} tickLine={false} />
                      <YAxis stroke="#78716c" fontSize={10} tickLine={false} />
                      <Tooltip cursor={{ fill: '#F5F5FA' }} />
                      <Legend iconType="circle" />
                      <Bar dataKey="Appointments" fill="#047857" radius={[4, 4, 0, 0]} barSize={40} />
                    </RechartBarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grouped by Status (Pie Chart) */}
              <div className="p-8 bg-white border border-stone-200 rounded shadow-sm space-y-4">
                <h3 className="font-serif text-lg text-emerald-950 font-semibold">Booking Docket Ratios</h3>
                <p className="text-[11px] text-stone-400">Total consultations split according to progress statuses on file.</p>
                <div className="h-80 w-full pt-4 flex flex-col sm:flex-row items-center justify-around">
                  <div className="h-64 w-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getAnalyticsByStatusData()}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {getAnalyticsByStatusData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend list */}
                  <div className="space-y-2 text-xs">
                    {getAnalyticsByStatusData().map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full inline-block" style={{ backgroundColor: entry.color }}></span>
                        <span className="font-medium text-stone-700">{entry.name}:</span>
                        <span className="font-bold text-stone-950">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
