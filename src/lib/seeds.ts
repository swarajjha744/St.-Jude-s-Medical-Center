import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';

const SEED_DEPARTMENTS = [
  { id: 'cardio', name: 'Cardiology', description: 'Advanced heart monitoring, cardiovascular surgery, and arterial health management.', icon: 'Heart' },
  { id: 'neurology', name: 'Neurology', description: 'Comprehensive diagnostics for the brain, nervous system development, and spinal care.', icon: 'Brain' },
  { id: 'pediatrics', name: 'Pediatrics', description: 'Caring, preventative and acute medical assistance for infants, children, and teens.', icon: 'Baby' },
  { id: 'orthopedics', name: 'Orthopedics', description: 'Reputable joint reconstruction, bone health, and sports medicine therapies.', icon: 'Activity' },
  { id: 'oncology', name: 'Oncology', description: 'Targeted tumor treatments, modern chemotherapy center, and compassionate oncology counseling.', icon: 'ShieldAlert' }
];

const SEED_DOCTORS = [
  { id: 'elena-vasquez', name: 'Dr. Elena Vasquez', specialty: 'Cardiology', bio: 'Board-certified cardiologist with over 15 years perfecting non-invasive cardiovascular procedures.', photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400', departmentId: 'cardio' },
  { id: 'marcus-chen', name: 'Dr. Marcus Chen', specialty: 'Neurology', bio: 'Pioneering researcher in neural connectivity and stroke prevention therapies.', photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400', departmentId: 'neurology' },
  { id: 'sarah-jenkins', name: 'Dr. Sarah Jenkins', specialty: 'Pediatrics', bio: 'Holistic juvenile healthcare practitioner specializing in wellness growth metrics.', photoUrl: '/Internship task 4 sample 3.jpg', departmentId: 'pediatrics' },
  { id: 'robert-patel', name: 'Dr. Robert Patel', specialty: 'Orthopedics', bio: 'Expert joint restoration consultant and sports reconstructive therapist.', photoUrl: '/Internship task 4 sample 4.jpg', departmentId: 'orthopedics' },
  { id: 'priya-sharma', name: 'Dr. Priya Sharma', specialty: 'Oncology', bio: 'Chief Oncologist and pioneer in immunotherapeutics and customized tumor treatment oncology mapping.', photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400', departmentId: 'oncology' },
  { id: 'alistair-vance', name: 'Dr. Alistair Vance', specialty: 'Cardiology', bio: 'Expert in interventional cardiology, focusing on advanced non-surgical valve replacements and coronary stent placement.', photoUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400', departmentId: 'cardio' },
  { id: 'kenji-sato', name: 'Dr. Kenji Sato', specialty: 'Pediatrics', bio: 'Highly acclaimed pediatrician and infant developmental delay oncologist with a focus on early speech support.', photoUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=400', departmentId: 'pediatrics' },
  { id: 'john-martinez', name: 'Dr. John Martinez', specialty: 'Neurology', bio: 'Board-certified neurologist specializing in neuro-ophthalmology, vestibular diagnostics, and optical nerve health.', photoUrl: 'https://images.unsplash.com/photo-1550831107-1553da8c8464?auto=format&fit=crop&q=80&w=400', departmentId: 'neurology' },
  { id: 'aravind-swamy', name: 'Dr. Aravind Swamy', specialty: 'Oncology', bio: 'Academic oncology investigator specializing in target radiation dosing, surgical tumor resection, and early cancer screening.', photoUrl: '/Internship task 4 sample 2.avif', departmentId: 'oncology' },
  { id: 'rebecca-kline', name: 'Dr. Rebecca Kline', specialty: 'Orthopedics', bio: 'Orthopedic surgeon specializing in pediatric spine treatments, joint preservation, and minimally invasive knee arthroscopy.', photoUrl: '/Internship task 4 sample 1.jpg', departmentId: 'orthopedics' }
];

export async function checkAndSeedDatabase() {
  try {
    // 1. Check departments
    const deptSnap = await getDocs(collection(db, 'departments'));
    if (deptSnap.empty) {
      console.log('Seeding departments...');
      const batch = writeBatch(db);
      SEED_DEPARTMENTS.forEach((dept) => {
        const docRef = doc(db, 'departments', dept.id);
        batch.set(docRef, dept);
      });
      await batch.commit();
    }

    // 2. Check doctors
    const docSnap = await getDocs(collection(db, 'doctors'));
    if (docSnap.empty) {
      console.log('Seeding doctors...');
      const batch = writeBatch(db);
      SEED_DOCTORS.forEach((docData) => {
        const docRef = doc(db, 'doctors', docData.id);
        batch.set(docRef, docData);
      });
      await batch.commit();
    } else {
      // Always pull dynamic updates from seeds to ensure photoUrl and bios remain in absolute sync
      const batch = writeBatch(db);
      SEED_DOCTORS.forEach((docData) => {
        const docRef = doc(db, 'doctors', docData.id);
        batch.set(docRef, docData, { merge: true });
      });
      // Delete old ID 'sophia-martinez' to avoid orphans
      const oldDocRef = doc(db, 'doctors', 'sophia-martinez');
      batch.delete(oldDocRef);
      await batch.commit();
    }
  } catch (error) {
    console.info('Client-side data seeding skipped (database is managed and seeded server-side):', error);
  }
}
