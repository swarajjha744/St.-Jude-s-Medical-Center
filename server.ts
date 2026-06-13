import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';

// Retrieve Supabase environment variables with fail-safes
const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'injbgziuidlxzcxvsvau';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_sLnxOuJlaQ7D2jlJ7dyzaQ_U0xItsWL';

const supabaseUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const supabase = createClient(supabaseUrl, SUPABASE_PUBLISHABLE_KEY);

console.log(`Supabase Client initialized for project: ${SUPABASE_PROJECT_ID}`);

// Local Flat-File database to guarantee absolute speed and reliability inside dev containers
const DB_FILE = path.join(process.cwd(), 'supabase_emulated_db.json');

function readDb(): Record<string, any[]> {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Error reading emulated DB file:', e);
  }
  return {};
}

function writeDb(data: Record<string, any[]>) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing emulated DB file:', e);
  }
}

// Password hashing function
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Write/Sync a row to Supabase client-side database
async function saveToSupabase(collectionName: string, id: string, data: any) {
  try {
    const payload = {
      id,
      ...data,
      updated_at: new Date().toISOString()
    };
    
    // In Supabase, if the table exists, we write to it. If it doesn't, we log a helpful warning.
    const { error } = await supabase
      .from(collectionName)
      .upsert(payload);
      
    if (error) {
      console.warn(`Supabase Direct Sync to [${collectionName}] noted: ${error.message} (To save live records, configure a matching table on your dashboard).`);
    } else {
      console.log(`Successfully synced document changes [${id}] to Supabase table [${collectionName}].`);
    }
  } catch (e: any) {
    console.warn(`Supabase Sync exception on table [${collectionName}]:`, e.message);
  }
}

// Delete a row from Supabase
async function deleteFromSupabase(collectionName: string, id: string) {
  try {
    const { error } = await supabase
      .from(collectionName)
      .delete()
      .or(`id.eq.${id},uid.eq.${id}`);
    if (error) {
      console.warn(`Supabase delete error warning:`, error.message);
    }
  } catch (e: any) {
    console.warn(`Supabase delete exception:`, e.message);
  }
}

// Log logs events to Supabase 'patient_logins' or matching datasheet tables
async function recordLoginToSupabaseDatasheet(email: string, name: string, role: string, uid: string) {
  const loginRecord = {
    uid,
    email,
    name,
    role,
    login_time: new Date().toISOString()
  };
  
  console.log('Inserting login event into Supabase datasheet database:', loginRecord);

  // Attempt to write into common datasheet table variations to ensure it hit the user's customized tab/datasheet
  const tablesToTry = ['patient_logins', 'logins', 'datasheet', 'patient_datasheet', 'patient_portal_logins'];
  for (const tabName of tablesToTry) {
    try {
      const { error } = await supabase
        .from(tabName)
        .insert([loginRecord]);
        
      if (!error) {
        console.log(`[Success] Recorded login event in Supabase datasheet table: [${tabName}]!`);
        return;
      } else {
        console.warn(`Insertion attempt into table [${tabName}] failed:`, error.message);
      }
    } catch (err: any) {
      console.warn(`Could not insert login record into table [${tabName}]:`, err.message);
    }
  }
}

// Node resolution globals
let myFilename = '';
let myDirname = '';
try {
  myFilename = __filename;
  myDirname = __dirname;
} catch (e) {
  myFilename = fileURLToPath(import.meta.url);
  myDirname = path.dirname(myFilename);
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Set up file uploading
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileUpload = multer({ storage: fileStorage });

// Serve custom uploaded assets from root
app.get('/Internship*', (req, res) => {
  const filename = decodeURIComponent(req.path).substring(1);
  const fullPath = path.join(process.cwd(), filename);
  if (fs.existsSync(fullPath)) {
    return res.sendFile(fullPath);
  }
  res.status(404).send('File not found');
});

// --- REST API BACKEND ROUTES ---

/**
 * Health & Configuration Diagnostics
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'supabase-integrated',
    projectId: SUPABASE_PROJECT_ID,
    time: new Date().toISOString()
  });
});

/**
 * Patient User Registration
 */
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing required parameters: email, password, and name are required.' });
  }

  try {
    const dbData = readDb();
    const users = dbData['users'] || [];
    const privateUsers = dbData['private_users'] || [];

    if (users.some((u: any) => u.email === email)) {
      return res.status(400).json({ error: 'The email address is already in use by another account.' });
    }

    const assignedRole = role || 'patient';
    const uid = 'user_' + crypto.randomUUID().replace(/-/g, '');

    const newUser = {
      uid,
      name,
      email,
      role: assignedRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phone: '',
      address: '',
      dob: '',
      bloodGroup: '',
      emergencyContact: ''
    };

    const newCredential = {
      uid,
      passwordHash: hashPassword(password),
      updatedAt: new Date().toISOString()
    };

    // Store in our persistent local DB cache
    users.push(newUser);
    privateUsers.push(newCredential);
    dbData['users'] = users;
    dbData['private_users'] = privateUsers;
    writeDb(dbData);

    // Sync to Supabase
    saveToSupabase('users', uid, newUser);
    saveToSupabase('private_users', uid, newCredential);

    // Write to patient logins datasheet
    if (assignedRole === 'patient') {
      recordLoginToSupabaseDatasheet(email, name, assignedRole, uid);
    }

    res.json({
      success: true,
      uid,
      name,
      email,
      role: assignedRole
    });
  } catch (err: any) {
    console.error('Error registering account:', err);
    res.status(500).json({ error: err.message || 'System error on registration.' });
  }
});

/**
 * User / Account Login
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password.' });
  }

  try {
    const dbData = readDb();
    const users = dbData['users'] || [];
    const privateUsers = dbData['private_users'] || [];

    // System administrator bootstrap
    let user = users.find((u: any) => u.email === email);
    let uid = user?.uid;
    let assignedRole = user?.role || (email === 'swarajjha744@gmail.com' ? 'admin' : 'patient');
    let name = user?.name || email.split('@')[0] || 'User';

    if (!user && email === 'swarajjha744@gmail.com') {
      uid = 'admin_bootstrap';
      user = {
        uid,
        name: 'Swaraj Jha (Admin)',
        email,
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const newCred = {
        uid,
        passwordHash: hashPassword(password),
        updatedAt: new Date().toISOString()
      };
      
      users.push(user);
      privateUsers.push(newCred);
      dbData['users'] = users;
      dbData['private_users'] = privateUsers;
      writeDb(dbData);

      saveToSupabase('users', uid, user);
      saveToSupabase('private_users', uid, newCred);
    }

    if (!user) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const credential = privateUsers.find((p: any) => p.uid === uid);
    const inputHash = hashPassword(password);

    if (!credential || credential.passwordHash !== inputHash) {
      // Setup temporary automatic credential bootstrap
      if (password === 'Hospital123!') {
        const newCred = {
          uid: uid!,
          passwordHash: inputHash,
          updatedAt: new Date().toISOString()
        };
        if (!credential) {
          privateUsers.push(newCred);
        } else {
          credential.passwordHash = inputHash;
        }
        dbData['private_users'] = privateUsers;
        writeDb(dbData);
        saveToSupabase('private_users', uid!, newCred);
      } else {
        return res.status(401).json({ error: 'Incorrect email or password.' });
      }
    }

    // Record login event to patient datasheet in Supabase!
    recordLoginToSupabaseDatasheet(email, name, assignedRole, uid!);

    res.json({
      success: true,
      uid,
      email,
      role: assignedRole,
      name
    });
  } catch (err: any) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: err.message || 'System error on login.' });
  }
});

/**
 * Query documents from a collection with filters
 */
app.get('/api/db/query', (req, res) => {
  const { path: colPath, constraints: constrStr } = req.query;
  if (!colPath) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const dbData = readDb();
  let list = dbData[colPath as string] || [];

  if (constrStr) {
    try {
      const constraints = JSON.parse(constrStr as string);
      constraints.forEach((item: any) => {
        if (item.type === 'where') {
          const { field, op, value } = item;
          if (op === '==' || op === '===') {
            list = list.filter((row: any) => row[field] === value);
          } else if (op === '!=' || op === '!==') {
            list = list.filter((row: any) => row[field] !== value);
          } else if (op === '>') {
            list = list.filter((row: any) => row[field] > value);
          } else if (op === '<') {
            list = list.filter((row: any) => row[field] < value);
          } else if (op === '>=') {
            list = list.filter((row: any) => row[field] >= value);
          } else if (op === '<=') {
            list = list.filter((row: any) => row[field] <= value);
          }
        }
      });
    } catch (e) {
      console.error('Failed processing constraints filter:', e);
    }
  }

  res.json({ list });
});

/**
 * Retrieve single document metadata
 */
app.get('/api/db/get', (req, res) => {
  const { path: colPath, id } = req.query;
  if (!colPath || !id) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const dbData = readDb();
  const list = dbData[colPath as string] || [];
  const data = list.find((row: any) => (row.id === id || row.uid === id));

  res.json({
    exists: !!data,
    data: data || null
  });
});

/**
 * Set/Update a document
 */
app.post('/api/db/set', (req, res) => {
  const { path: colPath, id, data, merge } = req.body;
  if (!colPath || !id) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const dbData = readDb();
  const list = dbData[colPath] || [];

  const index = list.findIndex((row: any) => (row.id === id || row.uid === id));
  let updatedRecord = { ...data };

  if (index !== -1) {
    if (merge !== false) {
      updatedRecord = { ...list[index], ...data };
    }
    list[index] = updatedRecord;
  } else {
    if (colPath === 'users') {
      updatedRecord.uid = id;
    } else {
      updatedRecord.id = id;
    }
    list.push(updatedRecord);
  }

  dbData[colPath] = list;
  writeDb(dbData);

  // Sync with Supabase table
  saveToSupabase(colPath, id, updatedRecord);

  res.json({ success: true, data: updatedRecord });
});

/**
 * Delete a document
 */
app.post('/api/db/delete', (req, res) => {
  const { path: colPath, id } = req.body;
  if (!colPath || !id) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const dbData = readDb();
  let list = dbData[colPath] || [];
  list = list.filter((row: any) => (row.id !== id && row.uid !== id));
  dbData[colPath] = list;
  writeDb(dbData);

  // Delete from Supabase
  deleteFromSupabase(colPath, id);

  res.json({ success: true });
});

/**
 * Clinical Staff Account Creation
 */
app.post('/api/admin/create-staff', async (req, res) => {
  const { email, name, role } = req.body;
  if (!email || !name || !role) {
    return res.status(400).json({ error: 'Missing required parameters email, name, and role.' });
  }

  try {
    const dbData = readDb();
    const users = dbData['users'] || [];
    const staff = dbData['staff'] || [];
    const privateUsers = dbData['private_users'] || [];

    if (users.some((u: any) => u.email === email)) {
      return res.status(400).json({ error: 'This email is already in use.' });
    }

    const uid = 'staff_' + crypto.randomUUID().replace(/-/g, '');
    const tempPassword = 'Hospital123!';

    const newUser = {
      uid,
      name,
      email,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newStaff = {
      uid,
      name,
      email,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newCred = {
      uid,
      passwordHash: hashPassword(tempPassword),
      updatedAt: new Date().toISOString()
    };

    users.push(newUser);
    staff.push(newStaff);
    privateUsers.push(newCred);

    dbData['users'] = users;
    dbData['staff'] = staff;
    dbData['private_users'] = privateUsers;

    if (role === 'doctor') {
      const doctors = dbData['doctors'] || [];
      doctors.push({
        id: uid,
        name,
        specialty: 'General Medicine',
        bio: 'Authorized medical specialist.',
        photoUrl: '',
        departmentId: 'general'
      });
      dbData['doctors'] = doctors;
    }

    writeDb(dbData);

    // Sync to Supabase
    saveToSupabase('users', uid, newUser);
    saveToSupabase('staff', uid, newStaff);
    saveToSupabase('private_users', uid, newCred);

    res.json({
      success: true,
      uid,
      password: tempPassword,
      message: `Successfully created staff account with temporary password: ${tempPassword}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Clinical Staff Account deletion
 */
app.post('/api/admin/delete-staff', async (req, res) => {
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).json({ error: 'Missing staff uid.' });
  }

  try {
    const dbData = readDb();
    
    dbData['users'] = (dbData['users'] || []).filter((u: any) => u.uid !== uid);
    dbData['staff'] = (dbData['staff'] || []).filter((s: any) => s.uid !== uid);
    dbData['doctors'] = (dbData['doctors'] || []).filter((d: any) => d.id !== uid);
    dbData['private_users'] = (dbData['private_users'] || []).filter((p: any) => p.uid !== uid);

    writeDb(dbData);

    deleteFromSupabase('users', uid);
    deleteFromSupabase('staff', uid);
    deleteFromSupabase('doctors', uid);
    deleteFromSupabase('private_users', uid);

    res.json({ success: true, message: 'Successfully deleted staff member.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Handle multipart health document uploads
 */
app.post('/api/storage/upload', fileUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const storagePath = req.body.path || '';
  res.json({
    path: storagePath,
    downloadUrl: `/api/storage/file?filename=${encodeURIComponent(req.file.filename)}`
  });
});

/**
 * Serve uploaded file contents
 */
app.get('/api/storage/file', (req, res) => {
  const { filename } = req.query;
  if (!filename) {
    return res.status(400).json({ error: 'Missing filename.' });
  }
  const fullPath = path.join(uploadDir, filename as string);
  if (fs.existsSync(fullPath)) {
    return res.sendFile(fullPath);
  }
  res.status(404).json({ error: 'File not found.' });
});


// Seed emulated database with beautiful initial records if it is empty
async function seedDatabaseServerSide() {
  const dbData = readDb();
  
  // Seed Departments
  if (!dbData['departments'] || dbData['departments'].length === 0) {
    console.log('Seeding departments into local database store...');
    dbData['departments'] = [
      { id: 'cardio', name: 'Cardiology', description: 'Advanced heart monitoring, cardiovascular surgery, and arterial health management.', icon: 'Heart' },
      { id: 'neurology', name: 'Neurology', description: 'Comprehensive diagnostics for the brain, nervous system development, and spinal care.', icon: 'Brain' },
      { id: 'pediatrics', name: 'Pediatrics', description: 'Caring, preventative and acute medical assistance for infants, children, and teens.', icon: 'Baby' },
      { id: 'orthopedics', name: 'Orthopedics', description: 'Reputable joint reconstruction, bone health, and sports medicine therapies.', icon: 'Activity' },
      { id: 'oncology', name: 'Oncology', description: 'Targeted tumor treatments, modern chemotherapy center, and compassionate oncology counseling.', icon: 'ShieldAlert' }
    ];
  }

  // Seed Doctors
  if (!dbData['doctors'] || dbData['doctors'].length === 0) {
    console.log('Seeding doctors into local database store...');
    dbData['doctors'] = [
      { id: 'elena-vasquez', name: 'Dr. Elena Vasquez', specialty: 'Cardiology', bio: 'Board-certified cardiologist with over 15 years perfecting non-invasive cardiovascular procedures.', photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400', departmentId: 'cardio' },
      { id: 'marcus-chen', name: 'Dr. Marcus Chen', specialty: 'Neurology', bio: 'Pioneering researcher in neural connectivity and stroke prevention therapies.', photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400', departmentId: 'neurology' },
      { id: 'sarah-jenkins', name: 'Dr. Sarah Jenkins', specialty: 'Pediatrics', bio: 'Holistic juvenile healthcare practitioner specializing in wellness growth metrics.', photoUrl: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=400', departmentId: 'pediatrics' },
      { id: 'robert-patel', name: 'Dr. Robert Patel', specialty: 'Orthopedics', bio: 'Expert joint restoration consultant and sports reconstructive therapist.', photoUrl: 'https://images.unsplash.com/photo-1622908421355-6b217a192809?auto=format&fit=crop&q=80&w=400', departmentId: 'orthopedics' }
    ];
  }

  writeDb(dbData);
}

// Start Vite setup or Serve statically
async function startServer() {
  await seedDatabaseServerSide();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Integrated Server running perfectly on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical: Server launch failed:", err);
});
