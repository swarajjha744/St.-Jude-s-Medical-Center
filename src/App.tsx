import React, { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { checkAndSeedDatabase } from './lib/seeds';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { 
  Heart, Lock, LogIn, UserPlus, ArrowLeft, ShieldAlert, 
  HelpCircle, AlertTriangle, Eye, EyeOff, Loader2, X 
} from 'lucide-react';
import { Doctor, Department } from './types';
import PublicHealth from './components/PublicHealth';
import PatientPortal from './components/PatientPortal';
import StaffAdmin from './components/StaffAdmin';

export default function App() {
  const { user, profile, role, loading, login, signup, logout } = useAuth();
  
  // Custom light router
  const [currentPath, setCurrentPath] = useState(window.location.hash || window.location.pathname);

  // Sync public directories for high responsiveness
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Authentications Toggle state (Patient Portal form)
  const [isPatientLogin, setIsPatientLogin] = useState(true);
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPassword, setPatientPassword] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAuthError, setPatientAuthError] = useState('');
  const [patientAuthLoading, setPatientAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPatientPortal, setShowPatientPortal] = useState(false);

  // Authentications state (Staff Admin Form)
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffAuthError, setStaffAuthError] = useState('');
  const [staffAuthLoading, setStaffAuthLoading] = useState(false);

  // Synchronize router with window actions
  useEffect(() => {
    const handleNavigation = () => {
      // Normalize pathname to coordinate both standard paths and hashes
      const current = window.location.hash || window.location.pathname;
      setCurrentPath(current);
    };

    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation);
    return () => {
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('hashchange', handleNavigation);
    };
  }, []);

  const navigateTo = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    window.location.hash = newPath;
    setCurrentPath(newPath);
  };

  // Run initial migrations / check seeds
  useEffect(() => {
    checkAndSeedDatabase();

    // Pull doctors/depts for the landing page grid
    const unsubDocs = onSnapshot(collection(db, 'doctors'), (snap) => {
      const list: Doctor[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Doctor));
      setDoctors(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'doctors');
    });

    const unsubDepts = onSnapshot(collection(db, 'departments'), (snap) => {
      const list: Department[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Department));
      setDepartments(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'departments');
    });

    return () => {
      unsubDocs();
      unsubDepts();
    };
  }, []);

  // Handle Patient portal Auth processes
  const handlePatientAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPatientAuthError('');
    setPatientAuthLoading(true);

    try {
      if (isPatientLogin) {
        await login(patientEmail, patientPassword);
      } else {
        if (!patientName) {
          throw new Error("Patient name is required for account enrollment.");
        }
        await signup(patientEmail, patientPassword, patientName, 'patient');
      }
      setPatientEmail('');
      setPatientPassword('');
      setPatientName('');
      
      // Instantly return to main website page and spawn their Health Hub overlay
      navigateTo('/');
      setShowPatientPortal(true);
    } catch (err: any) {
      setPatientAuthError(err.message || 'Invalid login coordinates. Try again.');
    } finally {
      setPatientAuthLoading(false);
    }
  };

  // Handle Staff Auth processes
  const handleStaffAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffAuthError('');
    setStaffAuthLoading(true);

    try {
      await login(staffEmail, staffPassword);
      setStaffEmail('');
      setStaffPassword('');
    } catch (err: any) {
      setStaffAuthError(err.message || 'Staff credentials verification failed.');
    } finally {
      setStaffAuthLoading(false);
    }
  };

  // Clean Loading HUD on startup
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 text-emerald-800 animate-spin" />
        <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400">Loading Clinical Desk...</span>
      </div>
    );
  }

  // 1. HARD BLOCK SYSTEM FOR STAFF PORTAL (403 ACCESS GATED)
  // Check if pathname starts with admin and patient is logged in
  const isTargetingAdmin = currentPath.includes('admin');
  if (isTargetingAdmin && user && role === 'patient') {
    return (
      <div className="min-h-screen bg-[#111] text-stone-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full border border-red-500/30 bg-[#161616] p-8 text-center space-y-6 rounded shadow-2xl">
          <div className="mx-auto h-12 w-12 bg-red-950/45 border border-red-500 flex items-center justify-center text-red-500 rounded-full animate-pulse">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-red-500">Security Access Violation</span>
            <h1 className="text-2xl font-serif text-slate-100 italic">Workstation Gated</h1>
            <p className="text-xs text-stone-400 leading-relaxed pt-2">
              Unauthorized terminal interaction. Access path is guarded strictly for board-certified clinical practitioners, registered staff, and system managers.
            </p>
          </div>

          <div className="p-4 bg-stone-900 border border-stone-850/60 rounded text-[11px] text-stone-500 font-mono text-left space-y-1">
            <p><strong>Workstation ID:</strong> STJ-SBC-403</p>
            <p><strong>Logged Profile:</strong> {user.email}</p>
            <p><strong>System Clearance:</strong> Patients Restricted</p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button 
              onClick={() => navigateTo('portal')}
              className="w-full py-2.5 bg-emerald-900 hover:bg-emerald-800 text-[#FCFAF7] font-bold text-xs uppercase tracking-wider rounded border-none cursor-pointer"
            >
              Return to Patient Dashboard
            </button>
            <button 
              onClick={() => {
                logout();
                navigateTo('admin');
              }}
              className="w-full py-2.5 bg-transparent hover:bg-stone-900 text-stone-400 font-bold text-xs uppercase tracking-wider border border-stone-800 rounded cursor-pointer"
            >
              Exit Terminal Gating
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. STAFF ADMIN PORTAL ROUTING
  if (isTargetingAdmin) {
    // If authenticated and is clinical staff, grant access
    const hasStaffAccess = user && role && ['doctor', 'nurse', 'receptionist', 'admin'].includes(role);
    if (hasStaffAccess) {
      return <StaffAdmin />;
    }

    // Otherwise show elegant, dark clinical staff Login form
    return (
      <div className="min-h-screen bg-[#111] text-stone-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-stone-850 bg-[#161616] p-10 space-y-8 rounded shadow-2xl relative">
          <button 
            onClick={() => navigateTo('/')}
            className="absolute top-4 left-4 text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1 bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Landing
          </button>

          <div className="text-center space-y-2">
            <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-emerald-450 border border-emerald-800/60 px-2 py-0.5 bg-emerald-950/30 rounded">Clinical Intake Station</span>
            <h1 className="text-3xl font-serif mt-2 tracking-tight">Personnel Terminal</h1>
            <p className="text-xs text-stone-500">Dual-board medical panel and support credentials login portal.</p>
          </div>

          {staffAuthError && (
            <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-400 rounded text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{staffAuthError}</span>
            </div>
          )}

          <form onSubmit={handleStaffAuthSubmit} className="space-y-6 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-450 tracking-wider mb-2">Personnel Email</label>
              <input 
                type="email" 
                required
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="physician@stjudesmedical.org"
                className="w-full px-4 py-3 bg-stone-900 border border-stone-800 rounded text-xs text-stone-100 focus:outline-none focus:border-emerald-800 focus:ring-1 focus:ring-emerald-800 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-450 tracking-wider mb-2">System Password</label>
              <input 
                type="password" 
                required
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 bg-stone-900 border border-stone-800 rounded text-xs text-stone-100 focus:outline-none focus:border-emerald-800 focus:ring-1 focus:ring-emerald-800 transition-colors"
              />
            </div>

            <button 
              type="submit" 
              disabled={staffAuthLoading}
              className="w-full py-3 bg-emerald-900 hover:bg-emerald-850 text-white font-bold text-xs uppercase tracking-widest border-none cursor-pointer rounded transition-all shadow-md"
            >
              {staffAuthLoading ? 'Authenticating workstation...' : 'Decrypt & Enter Station'}
            </button>
          </form>

          <p className="text-center text-[10px] text-stone-600">
            Authorized personnel interaction logs are fully stored under central metadata records for audit accountability.
          </p>
        </div>
      </div>
    );
  }

  // 3. PATIENT PORTAL ROUTING
  const isTargetingPortal = currentPath.includes('portal');
  if (isTargetingPortal) {
    // If logged in as patient, return home and launch the slide-over overlay smoothly
    if (user) {
      setTimeout(() => {
        navigateTo('/');
        setShowPatientPortal(true);
      }, 0);
      return null;
    }

    // Otherwise, show the Editorial patient auth screens
    return (
      <div className="min-h-screen bg-[#FCFAF7] flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-stone-200 bg-white p-10 space-y-8 rounded shadow-xl relative animate-scale-up">
          <button 
            onClick={() => navigateTo('/')}
            className="absolute top-4 left-4 text-xs text-stone-400 hover:text-stone-700 font-semibold flex items-center gap-1 bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Landing
          </button>

          <div className="text-center space-y-2">
            <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-emerald-800">Secure Access</span>
            <h1 className="text-3xl font-serif font-light text-stone-900 mt-2">
              Patient Portal <br />
              <span className="italic font-normal text-emerald-950">{isPatientLogin ? 'Log In' : 'Sign Up'}</span>
            </h1>
            <p className="text-xs text-stone-500">Access your historical records and schedule consults instantly.</p>
          </div>

          {patientAuthError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-950 rounded text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span>{patientAuthError}</span>
            </div>
          )}

          <form onSubmit={handlePatientAuthSubmit} className="space-y-5 text-xs">
            {!isPatientLogin && (
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Patient Full Name *</label>
                <input 
                  type="text" 
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Mary Sterling"
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Registered Email Address</label>
              <input 
                type="email" 
                required
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                placeholder="mary@example.com"
                className="w-full px-4 py-3 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-2">Personal Security Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  required
                  value={patientPassword}
                  onChange={(e) => setPatientPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-stone-200 rounded text-xs focus:outline-none focus:border-emerald-800 transition-colors pr-10"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 bg-transparent border-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={patientAuthLoading}
              className="w-full py-3 bg-emerald-900 hover:bg-emerald-850 text-white font-bold text-xs uppercase tracking-widest border-none cursor-pointer rounded-sm shadow-md transition-all mt-4"
            >
              {patientAuthLoading ? 'Connecting database...' : isPatientLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Registration toggle option */}
          <div className="text-center text-xs mt-6 pt-6 border-t border-stone-100">
            {isPatientLogin ? (
              <p className="text-stone-605">
                New to St. Jude’s?{' '}
                <button 
                  onClick={() => { setIsPatientLogin(false); setPatientAuthError(''); }}
                  className="text-emerald-800 font-bold bg-transparent border-none cursor-pointer underline"
                >
                  Create Patient Account
                </button>
              </p>
            ) : (
              <p className="text-stone-605">
                Already registered with us?{' '}
                <button 
                  onClick={() => { setIsPatientLogin(true); setPatientAuthError(''); }}
                  className="text-emerald-800 font-bold bg-transparent border-none cursor-pointer underline"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 4. PUBLIC PATIENT-FACING LANDING PORTAL (Public view by default)
  return (
    <>
      <PublicHealth 
        onPortalCTA={() => navigateTo('portal')}
        doctors={doctors}
        departments={departments}
        user={user}
        profile={profile}
        role={role}
        logout={logout}
        onOpenPatientModule={() => setShowPatientPortal(true)}
      />

      {/* Patient Portal view as a beautiful overlay Dialog / Drawer */}
      {showPatientPortal && user && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/80 backdrop-blur-md flex justify-center items-center p-0 md:p-6 animate-fade-in">
          <div className="relative w-full max-w-7xl h-full md:h-[90vh] bg-[#FCFAF7] shadow-2xl rounded-none md:rounded-lg overflow-hidden border border-stone-200">
            {/* Overlay close X button */}
            <button
              onClick={() => setShowPatientPortal(false)}
              className="absolute top-6 right-6 md:right-8 z-55 p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 rounded-full border border-stone-200 cursor-pointer shadow-sm transition-colors duration-200 flex items-center justify-center"
              title="Close Portal"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="h-full overflow-y-auto">
              <PatientPortal 
                onClose={() => setShowPatientPortal(false)} 
                doctors={doctors} 
                departments={departments} 
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
