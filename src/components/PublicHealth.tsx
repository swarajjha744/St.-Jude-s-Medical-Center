import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Heart, Brain, Baby, Activity, ShieldAlert,
  ChevronDown, ChevronUp, Check, Mail, Phone, MapPin, 
  Clock, ArrowRight, ShieldCheck, Stethoscope, Award,
  LogOut, Calendar, Lock, Search, Star, Calculator, HelpCircle
} from 'lucide-react';
import { Doctor, Department } from '../types';

interface PublicHealthProps {
  onPortalCTA: () => void;
  doctors: Doctor[];
  departments: Department[];
  user: any;
  profile: any;
  role: string | null;
  logout: () => Promise<void>;
  onOpenPatientModule: () => void;
}

export default function PublicHealth({ 
  onPortalCTA, 
  doctors, 
  departments,
  user,
  profile,
  role,
  logout,
  onOpenPatientModule
}: PublicHealthProps) {
  // Contact state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSuccess, setContactSuccess] = useState(false);
  const [submittingContact, setSubmittingContact] = useState(false);

  // Doctor Filter and Search state
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('All');
  const [searchDoctorQuery, setSearchDoctorQuery] = useState<string>('');

  // Treatment Cost Estimator state
  const [estimateDept, setEstimateDept] = useState<string>('cardio');
  const [estimateRoom, setEstimateRoom] = useState<string>('deluxe');
  const [estimateDays, setEstimateDays] = useState<number>(3);
  const [estimateInsurance, setEstimateInsurance] = useState<string>('Star Health');

  // Testimonials
  const testimonials = [
    {
      id: 1,
      name: "Rohan Advani",
      recovery: "Complex Coronary Angioplasty",
      text: "Dr. Elena Vasquez and Dr. Vance gave me a new lease on life. The hybrid operating theater and seamless cash-free clearing with Niva Bupa made this difficult operation feel entirely secure.",
      rating: 5,
      date: "May 2026"
    },
    {
      id: 2,
      name: "Meera Krishnan",
      recovery: "Brain Tumour Resection",
      text: "Diagnosed with standard oligodendroglioma, Dr. Marcus Chen performed microscopic precision surgery in May. Unbelievable clinical expertise, and the personal ICU recovery room look out over premium fields.",
      rating: 5,
      date: "April 2026"
    },
    {
      id: 3,
      name: "Vikram Malhotra",
      recovery: "Total Knee Orthoscopy",
      text: "Under Dr. Patel my partial joint reconstruction was extremely successful. The motion rehab unit has me walking completely painless within four short weeks of my operation date.",
      rating: 5,
      date: "June 2026"
    }
  ];

  // FAQ Accordion State
  const [openFAQIndex, setOpenFAQIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "How can I book an appointment with a specialist?",
      a: "Registered patients can book and view appointments directly from our safe Patient Portal. Unregistered patients can sign up for an account via the 'Patient Portal' option in seconds with email and password."
    },
    {
      q: "What credentials do St. Jude's medical staff hold?",
      a: "Every doctor on our panel is board-certified, holding international credentials from recognized Ivy League or royal medical colleges, with at least 8 years of clinical experience."
    },
    {
      q: "Do you offer cashless admission with Indian health insurance providers?",
      a: "Yes, we offer complete cashless treatment with all major Indian health insurance underwriters including Star Health, Niva Bupa, ICICI Lombard, HDFC ERGO, SBI General, and Bajaj Allianz, making admission claim processes absolutely smooth."
    },
    {
      q: "Is emergency service operational 24/7?",
      a: "Absolutely. Our level-1 Emergency Trauma Ward and critical care ambulance dispatch services operate 24 hours a day, 365 days a year with standard high-priority response teams."
    },
    {
      q: "How can I access my diagnostic imaging and historical lab reports?",
      a: "All lab operations, MRI scans, and physical care records are securely uploaded directly to your patient profile in the portal by our staff. You can view, print, or download them at your convenience."
    }
  ];

  const services = [
    { name: "Complex Cardiac Care", desc: "Coronary interventions, pediatric clinical surgery, and preventive heart audits." },
    { name: "Minimally Invasive Neurosurgery", desc: "Precision microscopic spinal release and non-invasive brain vascular treatments." },
    { name: "Neonatal Critical Support", desc: "Comprehensive infant incubators and active monitoring pediatric care wards." },
    { name: "Advanced Joint Arthroplasty", desc: "Custom computer-guided hip & knee replacements for full physical recovery." },
    { name: "Targeted Cancer Therapeutics", desc: "Immuno-oncology cocktails, precise radiation scheduling, and support counseling." }
  ];

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) return;

    setSubmittingContact(true);
    try {
      await addDoc(collection(db, 'contactSubmissions'), {
        name: contactName,
        email: contactEmail,
        phone: contactPhone,
        message: contactMessage,
        submittedAt: new Date().toISOString()
      });
      setContactSuccess(true);
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'contactSubmissions');
    } finally {
      setSubmittingContact(false);
    }
  };

  const getIcon = (name: string) => {
    switch (name) {
      case 'Heart': return <Heart className="h-6 w-6 text-emerald-800" />;
      case 'Brain': return <Brain className="h-6 w-6 text-emerald-800" />;
      case 'Baby': return <Baby className="h-6 w-6 text-emerald-800" />;
      case 'Activity': return <Activity className="h-6 w-6 text-emerald-800" />;
      default: return <Stethoscope className="h-6 w-6 text-emerald-800" />;
    }
  };

  // Filter and Search calculations
  const filteredDoctors = doctors.filter((docItem) => {
    const matchesSpecialty = selectedSpecialty === 'All' || docItem.specialty.toLowerCase() === selectedSpecialty.toLowerCase();
    const matchesQuery = docItem.name.toLowerCase().includes(searchDoctorQuery.toLowerCase()) || 
                         docItem.bio.toLowerCase().includes(searchDoctorQuery.toLowerCase()) ||
                         docItem.specialty.toLowerCase().includes(searchDoctorQuery.toLowerCase());
    return matchesSpecialty && matchesQuery;
  });

  // Cost estimation calculations
  const estimateCost = () => {
    let deptPrice = 12000; // Base diagnostics and specialist setup in INR
    if (estimateDept === 'cardio') deptPrice = 45000;
    else if (estimateDept === 'neurology') deptPrice = 58000;
    else if (estimateDept === 'pediatrics') deptPrice = 16000;
    else if (estimateDept === 'orthopedics') deptPrice = 38000;
    else if (estimateDept === 'oncology') deptPrice = 72000;

    let roomPricePerDay = 4500;
    if (estimateRoom === 'icu') roomPricePerDay = 15000;
    else if (estimateRoom === 'deluxe') roomPricePerDay = 9000;
    else if (estimateRoom === 'general') roomPricePerDay = 3500;

    const rawTotal = deptPrice + (roomPricePerDay * estimateDays);
    
    // Insurance coverages
    let coverPercent = 0.85;
    if (estimateInsurance === 'Star Health') coverPercent = 0.90;
    else if (estimateInsurance === 'Niva Bupa') coverPercent = 0.95;
    else if (estimateInsurance === 'ICICI Lombard') coverPercent = 0.88;
    else if (estimateInsurance === 'HDFC ERGO & TPAs') coverPercent = 0.92;

    const insuranceCovered = Math.round(rawTotal * coverPercent);
    const patientPay = Math.round(rawTotal * (1 - coverPercent));

    return {
      rawTotal,
      insuranceCovered,
      patientPay,
      currency: "₹"
    };
  };

  return (
    <div id="home" className="flex flex-col bg-[#FCFAF7] min-h-screen text-[#1A1A1A]">
      {/* Editorial Header Navigation */}
      <header className="flex items-center justify-between px-6 md:px-12 py-6 border-b border-stone-200 bg-[#FCFAF7] sticky top-0 z-40 backdrop-blur-sm">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-serif font-semibold tracking-tight text-emerald-950">St. Jude’s</span>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400">Medical Center</span>
        </div>
        <nav className="flex gap-4 md:gap-8 items-center">
          <a href="#specialties" className="hidden md:inline text-sm font-medium hover:text-emerald-800 transition-colors">Specialties</a>
          <a href="#doctors" className="hidden md:inline text-sm font-medium hover:text-emerald-800 transition-colors">Doctors</a>
          <a href="#facilities" className="hidden md:inline text-sm font-medium hover:text-emerald-800 transition-colors">Infrastructure</a>
          <a href="#estimator" className="hidden md:inline text-sm font-medium hover:text-emerald-800 transition-colors">Cost Estimator</a>
          <a href="#contact" className="hidden md:inline text-sm font-medium hover:text-emerald-800 transition-colors">Contact</a>
          
          {user ? (
            <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 p-2 rounded-sm shadow-sm md:gap-4">
              <span className="text-xs font-medium text-stone-700 hidden sm:inline">
                Welcome, <strong className="text-emerald-950">{profile?.name || user.email?.split('@')[0]}</strong>
              </span>
              
              {/* Show Admin Portal button for swarajjha744@gmail.com or users with admin role */}
              {user.email === 'swarajjha744@gmail.com' || role === 'admin' ? (
                <a 
                  href="#admin"
                  className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                >
                  <Lock className="h-3 w-3 text-amber-700" />
                  <span>Admin Panel</span>
                </a>
              ) : (
                <button 
                  onClick={onOpenPatientModule}
                  className="px-3 py-1.5 bg-emerald-900 hover:bg-emerald-800 text-[#FCFAF7] rounded text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>My Health Hub</span>
                </button>
              )}
              
              <button 
                onClick={async () => {
                  await logout();
                  window.location.hash = '';
                }}
                className="p-1 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 rounded text-[10px] uppercase font-bold tracking-wider hover:border-stone-300 transition-all border border-transparent cursor-pointer"
                title="Sign Out"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button 
              onClick={onPortalCTA}
              className="px-5 py-2 bg-emerald-900 hover:bg-emerald-800 text-stone-100 text-xs font-semibold uppercase tracking-widest transition-colors rounded-sm shadow-sm cursor-pointer"
            >
              Patient Portal
            </button>
          )}
        </nav>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col">
        {/* Editorial Hero Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-stone-200">
          <div className="lg:col-span-7 p-8 md:p-16 flex flex-col justify-center border-r border-[#E4E0D9]">
            <div className="space-y-4 mb-8">
              <span className="text-xs uppercase tracking-[0.34em] font-bold text-emerald-800">Established 1984</span>
              <h1 className="text-4xl md:text-7xl font-serif font-light leading-[1.0] text-stone-900">
                The Standard of <br />
                <span className="italic font-normal text-emerald-950">Precision</span> Care.
              </h1>
            </div>
            <p className="text-lg text-stone-600 max-w-xl leading-relaxed mb-12">
              Combining advanced micro-diagnostic technology with an unyielding commitment to human well-being. We do not just treat symptoms; we understand the individual.
            </p>

            {/* Quick CTAs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
              <div 
                onClick={() => user ? onOpenPatientModule() : onPortalCTA()} 
                className="p-6 bg-emerald-900 text-stone-50 flex flex-col justify-between aspect-video md:aspect-square group cursor-pointer hover:bg-emerald-950 transition-all shadow-md"
              >
                <span className="text-2xl font-serif font-light">01</span>
                <div>
                  <h3 className="text-lg font-medium mb-1 flex items-center gap-1">
                    Book Consult <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </h3>
                  <p className="text-xs text-stone-300">Secure digital appointment booking with elite clinical physicians.</p>
                </div>
              </div>
              <div 
                onClick={() => user ? onOpenPatientModule() : onPortalCTA()} 
                className="p-6 border border-stone-300 flex flex-col justify-between aspect-video md:aspect-square cursor-pointer hover:bg-stone-100 transition-all"
              >
                <span className="text-2xl font-serif text-stone-300">02</span>
                <div>
                  <h3 className="text-lg font-medium mb-1">Access Documents</h3>
                  <p className="text-xs text-stone-500">View diagnostic scans, health reports, and prescription histories.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Right Column: Hospital performance stats */}
          <div className="lg:col-span-5 bg-stone-100/50 p-8 md:p-16 flex flex-col justify-between space-y-12">
            <div>
              <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-stone-400 mb-10">Clinical Performance</h2>
              <div className="space-y-12">
                <div className="flex items-baseline gap-4">
                  <span className="text-5xl md:text-6xl font-serif text-emerald-950">98%</span>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-800">Patient Recovery Rate</h4>
                    <p className="text-xs text-stone-500 uppercase tracking-tight">Post-operative evaluations 2025</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-5xl md:text-6xl font-serif text-emerald-950">142</span>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-800">Specialized Surgeons</h4>
                    <p className="text-xs text-stone-500 uppercase tracking-tight">Dual-board medical panel certified</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-5xl md:text-6xl font-serif text-emerald-950">12m</span>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-800">Average ER Response</h4>
                    <p className="text-xs text-stone-500 uppercase tracking-tight">Rapid admissions triage guarantee</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick quote highlight */}
            <div className="bg-white p-6 shadow-xl shadow-stone-200/50 rounded-lg border border-stone-100/80">
              <p className="text-sm font-serif italic text-stone-700 mb-4">
                "Our stay at St. Jude's was characterized by phenomenal empathy, flawless communication, and incredibly precise surgical execution."
              </p>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-bold text-xs">
                  MH
                </div>
                <div>
                  <h5 className="text-xs font-semibold">Julianne Vance</h5>
                  <p className="text-[10px] text-stone-400">Cardiovascular Patient, 2025</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Departments & Specialties */}
        <section id="specialties" className="py-20 px-6 md:px-16 border-b border-stone-200 scroll-mt-12">
          <div className="max-w-7xl mx-auto">
            <div className="mb-12">
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-emerald-800">Elite Expertise</span>
              <h2 className="text-3xl md:text-5xl font-serif font-light text-stone-900 mt-2">Departments & Specialties</h2>
              <div className="h-[1px] w-20 bg-emerald-800 mt-4"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {departments.length > 0 ? (
                departments.map((dept) => (
                  <div key={dept.id} className="p-8 bg-[#FCFAF7] border border-stone-200 hover:border-emerald-800/50 transition-all rounded-sm flex flex-col justify-between space-y-6">
                    <div>
                      <div className="h-12 w-12 bg-emerald-100/50 rounded-full flex items-center justify-center mb-6">
                        {getIcon(dept.icon)}
                      </div>
                      <h3 className="text-xl font-serif text-stone-900 mb-2">{dept.name}</h3>
                      <p className="text-sm text-stone-600 leading-relaxed">{dept.description}</p>
                    </div>
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-400">Premium Medical Ward</span>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-12 text-center text-stone-400">Loading department information...</div>
              )}
            </div>
          </div>
        </section>

        {/* Services Showcase */}
        <section className="py-20 px-6 md:px-16 bg-[#F5F2EC] border-b border-stone-200">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5 space-y-6">
              <span className="text-xs uppercase tracking-[0.25em] font-bold text-stone-400">State-Of-The-Art care</span>
              <h2 className="text-3xl md:text-5xl font-serif font-semibold text-emerald-950">Clinical Treatments & Procedures</h2>
              <p className="text-sm text-stone-600 leading-relaxed">
                St. Jude’s employs top-tier diagnostic imaging, nuclear therapies, and advanced surgical procedures. High density equipment sets us apart.
              </p>
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                  <span className="text-xs font-semibold uppercase tracking-wider">FDA-approved procedures</span>
                </div>
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-emerald-700" />
                  <span className="text-xs font-semibold uppercase tracking-wider">JCI International Accreditation</span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-7 bg-white p-8 md:p-12 border border-stone-200 shadow-sm space-y-6">
              {services.map((serv, index) => (
                <div key={index} className="flex gap-6 pb-6 border-b border-stone-100 last:border-b-0 last:pb-0">
                  <span className="text-emerald-800 font-serif font-bold text-lg">0{index + 1}</span>
                  <div>
                    <h4 className="font-semibold text-stone-950 text-sm mb-1">{serv.name}</h4>
                    <p className="text-xs text-stone-600 leading-relaxed">{serv.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Doctors Grid */}
        <section id="doctors" className="py-20 px-6 md:px-16 border-b border-stone-200 scroll-mt-12">
          <div className="max-w-7xl mx-auto">
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-emerald-800">Clinical Leadership</span>
                <h2 className="text-3xl md:text-5xl font-serif font-light text-stone-900 mt-2">Our Elite Practitioners</h2>
                <div className="h-[1px] w-20 bg-emerald-800 mt-4"></div>
              </div>
              <p className="text-xs text-stone-500 max-w-sm italic mt-2 md:mt-0 leading-relaxed">
                St. Jude's recruits and maintains an elite medical panel of internationally accredited, board-certified clinical researchers.
              </p>
            </div>

            {/* Interactive Filter & Search Toggles */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-6 border-b border-stone-100">
              <div className="flex flex-wrap gap-2">
                {['All', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Oncology'].map((spec) => (
                  <button
                    key={spec}
                    onClick={() => setSelectedSpecialty(spec)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      selectedSpecialty === spec
                        ? 'bg-emerald-900 text-stone-100 shadow'
                        : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {spec}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search doctor names or bios..."
                  value={searchDoctorQuery}
                  onChange={(e) => setSearchDoctorQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-stone-200 text-stone-800 text-xs rounded focus:outline-none focus:ring-1 focus:ring-emerald-800 focus:border-emerald-800 transition-all rounded-sm shadow-sm"
                />
                {searchDoctorQuery && (
                  <button
                    onClick={() => setSearchDoctorQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 hover:text-stone-700 uppercase font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredDoctors.length > 0 ? (
                filteredDoctors.map((docItem) => (
                  <div key={docItem.id} className="bg-white border border-stone-200 overflow-hidden flex flex-col justify-between group rounded-sm shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="overflow-hidden aspect-square bg-stone-100 relative">
                      <img 
                        src={docItem.photoUrl || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400"} 
                        alt={docItem.name} 
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                          docItem.id === 'rebecca-kline' || docItem.id === 'sarah-jenkins' || docItem.id === 'robert-patel' || docItem.id === 'elena-vasquez' || docItem.id === 'aravind-swamy' || docItem.id === 'john-martinez'
                            ? 'ring-4 ring-emerald-800/15 contrast-105 brightness-[1.02] shadow-inner border border-emerald-800/30' 
                            : ''
                        }`}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs px-2 py-1 text-[9px] font-bold tracking-widest text-emerald-950 uppercase border border-stone-200">
                        Active Panel
                      </div>
                    </div>
                    <div className="p-6">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">{docItem.specialty}</span>
                      <h3 className="text-lg font-serif text-stone-900 mt-1">{docItem.name}</h3>
                      <p className="text-xs text-stone-600 mt-2 line-clamp-4 leading-relaxed">{docItem.bio}</p>
                    </div>
                    <div className="px-6 pb-6 pt-0">
                      <button 
                        onClick={() => user ? onOpenPatientModule() : onPortalCTA()} 
                        className="text-xs font-semibold uppercase text-emerald-800 hover:text-emerald-950 tracking-wider flex items-center gap-1 transition-all py-1 border-b border-transparent hover:border-emerald-950 cursor-pointer"
                      >
                        Request Consult <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-16 text-center text-stone-500 font-serif italic bg-white border border-stone-200 rounded p-8 flex flex-col items-center justify-center gap-3">
                  <span className="font-sans text-xs uppercase tracking-wider font-semibold text-[#8C8C8C]">Zero Results Found</span>
                  <p className="text-sm text-stone-600 max-w-sm">No clinical practitioners found matching "{searchDoctorQuery}" under "{selectedSpecialty}" department.</p>
                  <button 
                    onClick={() => { setSelectedSpecialty('All'); setSearchDoctorQuery(''); }}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer mt-2"
                  >
                    Reset Filter Criteria
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Infrastructure & Insurance Details */}
        <section id="facilities" className="py-20 px-6 md:px-16 bg-[#F5F2EC] border-b border-stone-200">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Facilities Inf */}
            <div className="space-y-6">
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-emerald-800">Facilities & Infrastructure</span>
              <h2 className="text-3xl font-serif text-stone-950">A Sanctuary of Healing & Precision</h2>
              <p className="text-sm text-stone-600 leading-relaxed">
                Our infrastructure is designed as an healing oasis rather than a clinical confinement. Every recovery room features panoramic garden views, HEPA-filtered clean air cycles, and comprehensive personal control consoles.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="p-4 bg-white/70 rounded border border-stone-200">
                  <h4 className="font-semibold text-xs uppercase tracking-wider mb-2">Hybrid operating theaters</h4>
                  <p className="text-xs text-stone-500 leading-relaxed">Surgical wings supported dynamically by Siemens 3D robotic diagnostics.</p>
                </div>
                <div className="p-4 bg-white/70 rounded border border-stone-200">
                  <h4 className="font-semibold text-xs uppercase tracking-wider mb-2">ICU isolation suites</h4>
                  <p className="text-xs text-stone-500 leading-relaxed">Equipped with non-contact vitals monitoring and specialized ventilation arrays.</p>
                </div>
              </div>
            </div>

            {/* Insurance Info */}
            <div className="space-y-6 bg-white p-8 md:p-10 border border-stone-200 shadow-sm rounded-sm">
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-emerald-800">Insurance & Billing Guidance</span>
              <h2 className="text-2xl font-serif text-stone-950">Seamless Institutional Billing</h2>
              <p className="text-sm text-stone-600 leading-relaxed">
                We advocate for clear, non-cryptic accounting. Our billing desks work directly with premium insurance providers to manage authorization pipelines before you arrive.
              </p>
              <div className="pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">Accepted Indian Partners</h4>
                <div className="grid grid-cols-2 gap-3 text-sm font-semibold text-[#1A1A1A]">
                  <div className="p-3 bg-stone-50 border border-stone-100 rounded text-center">Star Health</div>
                  <div className="p-3 bg-stone-50 border border-stone-100 rounded text-center">Niva Bupa</div>
                  <div className="p-3 bg-stone-50 border border-stone-100 rounded text-center">ICICI Lombard</div>
                  <div className="p-3 bg-stone-50 border border-stone-100 rounded text-center font-serif text-emerald-900">HDFC ERGO & TPAs</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Treatment & Stay Estimator Section */}
        <section id="estimator" className="py-20 px-6 md:px-16 bg-white border-b border-stone-200 scroll-mt-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              {/* Left explanation info */}
              <div className="lg:col-span-4 space-y-6">
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-emerald-800">Financial Transparency</span>
                <h2 className="text-3xl font-serif text-stone-900">Treatment & Care Estimator</h2>
                <div className="h-[1px] w-16 bg-emerald-800"></div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  In line with St. Jude’s commitment to transparent care accounting, select your treatment department, recovery suite preferences, and insurance coverage. Get an immediate estimate of total hospital costs and covered policy portions instantly.
                </p>
                <div className="p-4 bg-stone-50 border border-stone-200 rounded text-xs space-y-2 text-stone-600">
                  <p className="font-semibold text-stone-900">Disclaimer & T&C:</p>
                  <p>Estimates include standard consultation, nursing diagnostics, typical ICU/ward amenities, and essential pharmaceuticals. Surgical complexities or custom prosthetic implants are subject to final bedside audit.</p>
                </div>
              </div>

              {/* Right Interactive Card */}
              <div className="lg:col-span-8 bg-[#FCFAF7] border border-stone-200 p-6 md:p-8 rounded shadow-md grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Inputs */}
                <div className="space-y-5">
                  <h3 className="text-stone-950 font-serif font-semibold text-base flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-emerald-800" />
                    Estimate Parameters
                  </h3>
                  
                  {/* Select Specialty */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-stone-500">Treatment Department</label>
                    <select
                      value={estimateDept}
                      onChange={(e) => setEstimateDept(e.target.value)}
                      className="w-full bg-white border border-stone-300 text-stone-800 text-xs rounded p-2 focus:ring-1 focus:ring-emerald-800 focus:outline-none cursor-pointer"
                    >
                      <option value="cardio">Cardiology (₹45,000 Base Specialist Cost)</option>
                      <option value="neurology">Neurology (₹58,000 Base Specialist Cost)</option>
                      <option value="pediatrics">Pediatrics (₹16,000 Base Specialist Cost)</option>
                      <option value="orthopedics">Orthopedics (₹38,000 Base Specialist Cost)</option>
                      <option value="oncology">Oncology (₹72,000 Base Specialist Cost)</option>
                    </select>
                  </div>

                  {/* Select Stay Tier */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-stone-500">Stay Room Tier</label>
                    <select
                      value={estimateRoom}
                      onChange={(e) => setEstimateRoom(e.target.value)}
                      className="w-full bg-white border border-stone-300 text-stone-800 text-xs rounded p-2 focus:ring-1 focus:ring-emerald-800 focus:outline-none cursor-pointer"
                    >
                      <option value="icu">ICU Isolation Suite (₹15,000 / Day)</option>
                      <option value="deluxe">Deluxe Private Suite (₹9,000 / Day)</option>
                      <option value="general">General Twin Ward (₹3,500 / Day)</option>
                    </select>
                  </div>

                  {/* Stay Duration */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-stone-500">Stay Duration</label>
                      <span className="text-xs text-stone-700 font-semibold">{estimateDays} {estimateDays === 1 ? 'Day' : 'Days'}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="14"
                      value={estimateDays}
                      onChange={(e) => setEstimateDays(parseInt(e.target.value))}
                      className="w-full accent-emerald-850 cursor-pointer"
                    />
                  </div>

                  {/* Select Insurance */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-stone-500">Insurance Underwriter</label>
                    <select
                      value={estimateInsurance}
                      onChange={(e) => setEstimateInsurance(e.target.value)}
                      className="w-full bg-white border border-stone-300 text-stone-800 text-xs rounded p-2 focus:ring-1 focus:ring-emerald-800 focus:outline-none cursor-pointer"
                    >
                      <option value="Niva Bupa">Niva Bupa (Est. 95% cashless coverage)</option>
                      <option value="HDFC ERGO & TPAs">HDFC ERGO Premium (Est. 92% coverage)</option>
                      <option value="Star Health">Star Health Core (Est. 90% coverage)</option>
                      <option value="ICICI Lombard">ICICI Lombard Care (Est. 88% coverage)</option>
                    </select>
                  </div>
                </div>

                {/* Outputs Display */}
                <div className="bg-emerald-950 text-emerald-105 p-6 rounded flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] text-emerald-300 border-b border-emerald-800/40 pb-2">Institutional Estimate</h4>
                    
                    <div className="flex justify-between text-xs text-emerald-250 font-medium">
                      <span>Total Estimated Cost:</span>
                      <span className="text-stone-100">{estimateCost().currency}{estimateCost().rawTotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-250 font-medium">
                      <span>Insurance Share ({estimateInsurance}):</span>
                      <span className="text-[#A7F3D0]">- {estimateCost().currency}{estimateCost().insuranceCovered.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="h-[1px] bg-emerald-800/60 my-2"></div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-emerald-200">Patient Pay Portion:</span>
                      <span className="text-xl font-serif font-bold text-white">
                        {estimateCost().currency}{estimateCost().patientPay.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-emerald-900/50 p-3 rounded border border-emerald-800 text-[11px] text-emerald-100 leading-relaxed">
                      Your chosen partner, <strong className="text-white">{estimateInsurance}</strong>, supports <strong>Cashless Pre-Authorization</strong> at our clinical billing desk.
                    </div>
                    <button
                      onClick={() => user ? onOpenPatientModule() : onPortalCTA()}
                      className="w-full py-2.5 bg-[#FCFAF7] hover:bg-stone-100 text-[#1A1A1A] text-xs font-bold uppercase tracking-wider rounded transition-colors text-center cursor-pointer block border border-stone-200 shadow-sm"
                    >
                      Pre-Authorize Admissions
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recovery Testimonials Section */}
        <section className="py-20 px-6 md:px-16 bg-[#F5F2EC] border-b border-stone-200">
          <div className="max-w-7xl mx-auto">
            <div className="mb-12 text-center">
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-emerald-800">Patient Recovery Stories</span>
              <h2 className="text-3xl md:text-5xl font-serif font-light text-stone-900 mt-2">Healing & Triumphs</h2>
              <div className="h-[1px] w-20 bg-emerald-800 mx-auto mt-4"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((test) => (
                <div key={test.id} className="bg-white border border-stone-200 p-8 rounded-sm shadow-sm flex flex-col justify-between group hover:border-emerald-800/30 transition-all duration-300">
                  <div className="space-y-4">
                    <div className="flex gap-1">
                      {[...Array(test.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-stone-700 font-serif italic text-sm leading-relaxed">
                      "{test.text}"
                    </p>
                  </div>
                  <div className="pt-6 mt-6 border-t border-stone-100 flex justify-between items-end">
                    <div>
                      <h4 className="font-semibold text-stone-900 text-xs uppercase tracking-wider">{test.name}</h4>
                      <p className="text-[10px] text-emerald-800 font-bold tracking-wide mt-0.5">{test.recovery}</p>
                    </div>
                    <span className="text-[10px] text-stone-400 font-mono">{test.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* News & Health Tips Section */}
        <section className="py-20 px-6 md:px-16 border-b border-stone-200">
          <div className="max-w-7xl mx-auto">
            <div className="mb-12">
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-emerald-800">Health Insights</span>
              <h2 className="text-3xl md:text-5xl font-serif font-light text-stone-900 mt-2">News & Health Tips</h2>
              <div className="h-[1px] w-20 bg-emerald-800 mt-4"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-[#FCFAF7] border border-stone-200 p-8 rounded flex flex-col justify-between hover:border-emerald-800/30 transition-all">
                <div>
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Cardiology • May 28, 2026</span>
                  <h3 className="text-xl font-serif font-semibold mt-2 text-stone-950">Modern Non-Invasive Diagnostics for Heart Health</h3>
                  <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                    Our team outlines some key steps you can take today to screen for early arterial hardening using our quick clinic evaluation programs.
                  </p>
                </div>
                <button onClick={onPortalCTA} className="text-xs font-bold uppercase text-emerald-800 hover:text-emerald-950 mt-6 text-left">Read Full Tip</button>
              </div>

              <div className="bg-[#FCFAF7] border border-stone-200 p-8 rounded flex flex-col justify-between hover:border-emerald-800/30 transition-all">
                <div>
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Neurology • Apr 14, 2026</span>
                  <h3 className="text-xl font-serif font-semibold mt-2 text-stone-950">Sleep Hygiene: Deep Brain Cleansing cycles</h3>
                  <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                    Unlocking natural cerebrospinal fluid release during sleep is heavily linked to stroke avoidance and improved mental baseline retention.
                  </p>
                </div>
                <button onClick={onPortalCTA} className="text-xs font-bold uppercase text-emerald-800 hover:text-emerald-950 mt-6 text-left">Read Full Tip</button>
              </div>

              <div className="bg-[#FCFAF7] border border-stone-200 p-8 rounded flex flex-col justify-between hover:border-emerald-800/30 transition-all">
                <div>
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Hospital News • Mar 02, 2026</span>
                  <h3 className="text-xl font-serif font-semibold mt-2 text-stone-950">St. Jude's Expands Robotic Outpatient Surgical Center</h3>
                  <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                    We have successfully opened four new hybrid operating theater rooms designed exclusively for fast-release keyhole laparoscopic procedures.
                  </p>
                </div>
                <button onClick={onPortalCTA} className="text-xs font-bold uppercase text-emerald-800 hover:text-emerald-950 mt-6 text-left">Read Full Tip</button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Accordions */}
        <section className="py-20 px-6 md:px-16 bg-[#F5F2EC] border-b border-stone-200">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-emerald-800">Patient Resources</span>
              <h2 className="text-3xl font-serif text-[#1A1A1A] mt-2">Frequently Asked Questions</h2>
              <p className="text-xs text-stone-500 mt-2">Everything you need to know about our admissions, booking, and medical procedures.</p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => {
                const isOpen = openFAQIndex === index;
                return (
                  <div key={index} className="bg-white border border-stone-200 rounded overflow-hidden">
                    <button 
                      onClick={() => setOpenFAQIndex(isOpen ? null : index)}
                      className="w-full flex justify-between items-center px-6 py-4 text-left font-serif font-semibold text-stone-850 hover:bg-stone-50 transition-colors"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-emerald-800" /> : <ChevronDown className="h-4 w-4 text-emerald-800" />}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 pt-2 border-t border-stone-50 text-xs text-stone-600 leading-relaxed bg-[#FCFAF7]">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contact Us Form and Embed Maps */}
        <section id="contact" className="py-20 px-6 md:px-16 scroll-mt-12 bg-white">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16">
            {/* Form Left */}
            <div className="lg:col-span-7 space-y-8">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-emerald-800">Connect With Us</span>
                <h2 className="text-3xl md:text-4xl font-serif text-stone-950 mt-1">Submit an Inquiry</h2>
                <p className="text-xs text-stone-500 mt-2">Have a general question, support request, or want to explore our care units? Write to us directly and our relations coordinator will respond within 2 hours.</p>
              </div>

              {contactSuccess ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded flex items-center gap-3">
                  <Check className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm">Thank You for Contacting Us</h4>
                    <p className="text-xs text-stone-600 mt-1">Your response has been written directly to our secure firestore. Our operations desk will email or call you shortly.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-stone-500 mb-2">Your Name *</label>
                      <input 
                        type="text" 
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-4 py-3 bg-[#FCFAF7] border border-stone-200 rounded text-sm focus:outline-none focus:border-emerald-800 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-stone-500 mb-2">Email Address *</label>
                      <input 
                        type="email" 
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full px-4 py-3 bg-[#FCFAF7] border border-stone-200 rounded text-sm focus:outline-none focus:border-emerald-800 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-stone-500 mb-2">Phone Number (Optional)</label>
                    <input 
                      type="text" 
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-3 bg-[#FCFAF7] border border-stone-200 rounded text-sm focus:outline-none focus:border-emerald-800 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-stone-500 mb-2">Your Message *</label>
                    <textarea 
                      required
                      rows={5}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Please write down details about your inquiry..."
                      className="w-full px-4 py-3 bg-[#FCFAF7] border border-stone-200 rounded text-sm focus:outline-none focus:border-emerald-800 transition-colors"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={submittingContact}
                    className="px-6 py-3 bg-emerald-900 border-none hover:bg-emerald-850 text-white font-semibold text-xs uppercase tracking-widest cursor-pointer transition-colors"
                  >
                    {submittingContact ? "Sending..." : "Submit Inquiry"}
                  </button>
                </form>
              )}
            </div>

            {/* Address Info & Map Right */}
            <div className="lg:col-span-5 space-y-8">
              <div className="space-y-6">
                <h3 className="font-serif text-xl border-b border-stone-200 pb-3">Institutional Contacts</h3>
                <div className="flex gap-4 items-start text-stone-700">
                  <MapPin className="h-5 w-5 text-emerald-800 flex-shrink-0" />
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wider">Main Campus</h5>
                    <p className="text-xs text-stone-500 leading-relaxed">Palam Marg, Vasant Vihar, New Delhi, Delhi 110057, India</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start text-stone-700">
                  <Phone className="h-5 w-5 text-emerald-800 flex-shrink-0" />
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wider">Patient Care Phone</h5>
                    <p className="text-xs text-stone-500 leading-relaxed">+91 11 4123 4567 (Triage Desk)</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start text-stone-700">
                  <Mail className="h-5 w-5 text-emerald-800 flex-shrink-0" />
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wider">General Enquiries</h5>
                    <p className="text-xs text-stone-500 leading-relaxed">contact@stjudesmedical.org</p>
                  </div>
                </div>
              </div>

              {/* Real Google map placeholder mock view */}
              <div className="h-64 border border-stone-200 bg-stone-100 rounded overflow-hidden relative shadow-inner">
                {/* Embedded dynamic iframe for Google Maps */}
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3504.264257121287!2d77.1601235!3d28.5618567!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390d1dee2ab88a3b%3A0x6ca332cf5e6bf984!2sVasant+Vihar%2C+New+Delhi%2C+Delhi!5e0!3m2!1sen!2sin!4v1655000000000"
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  style={{ border: 0 }} 
                  allowFullScreen={false} 
                  tabIndex={0}
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Editorial Footer Bottom Ribbon */}
      <footer className="border-t border-stone-200 flex flex-col md:flex-row gap-6 md:gap-0 items-center justify-between px-10 py-8 bg-white text-stone-600 text-xs mt-auto">
        <div className="flex flex-col md:flex-row gap-10">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-stone-400">ER Admittance Weight</span>
            <span className="text-xs font-medium text-stone-800 font-mono tracking-tight">Active wait time: ~12 mins</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-stone-400">Clinical Pharmacy</span>
            <span className="text-xs font-medium text-stone-800">Operational 24/7 (Emergency Dispatch)</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[10px] uppercase font-bold text-stone-400">Quality Assured Institutional Trust</span>
          <div className="flex gap-4">
            <div className="h-8 px-3 border border-stone-200 text-[10px] uppercase font-semibold text-stone-450 flex items-center justify-center bg-stone-50 rounded-sm">
              Joint Comm. Cert
            </div>
            <div className="h-8 px-3 border border-stone-200 text-[10px] uppercase font-semibold text-stone-450 flex items-center justify-center bg-stone-50 rounded-sm">
              Grade A Patient Saftey
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
