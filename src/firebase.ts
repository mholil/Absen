import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { AppDatabase } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Permission denied on /test/connection still proves online connectivity to Firestore
    return true;
  }
}

testFirestoreConnection();

export async function signInWithGoogleFirebase(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, type FirebaseUser };

const SECTIONS = [
  'settings',
  'classes',
  'students',
  'attendance',
  'notes',
  'bills',
  'payments',
] as const;

type SectionKey = (typeof SECTIONS)[number];

function sanitizeId(val: string): string {
  const cleaned = String(val || 'item')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : 'item';
}

function sanitizeString(val: unknown, maxLen: number, fallback = '-'): string {
  const str = String(val ?? '').trim();
  if (!str) return fallback;
  return str.slice(0, maxLen);
}

// Strip undefined properties recursively for Firestore compatibility
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

async function upsertSectionDocument(
  section: SectionKey,
  appDb: AppDatabase,
  uid: string
): Promise<void> {
  const path = `school_records/${section}`;
  const docRef = doc(db, 'school_records', section);

  const schoolName = sanitizeString(appDb.settings?.schoolName, 200, 'MADRASAH IBTIDAIYAH');
  const academicYear = sanitizeString(appDb.settings?.academicYear, 32, '2026/2027');

  const isSettings = section === 'settings';
  const rawList = isSettings ? [] : ((appDb[section] as any[]) || []).slice(0, 5000);
  const cleanRecords = stripUndefined(rawList);
  const cleanSettings = isSettings ? stripUndefined(appDb.settings) : undefined;

  let exists = false;
  try {
    const snap = await getDoc(docRef);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    const createPayload: Record<string, any> = {
      id: sanitizeId(section),
      section,
      ownerId: uid,
      schoolName,
      academicYear,
      recordCount: isSettings ? 1 : cleanRecords.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (isSettings && cleanSettings) {
      createPayload.settingsData = cleanSettings;
    } else {
      createPayload.records = cleanRecords;
    }

    try {
      await setDoc(docRef, createPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    const updatePayload: Record<string, any> = {
      ownerId: uid,
      schoolName,
      academicYear,
      recordCount: isSettings ? 1 : cleanRecords.length,
      updatedAt: serverTimestamp(),
    };
    if (isSettings && cleanSettings) {
      updatePayload.settingsData = cleanSettings;
    } else {
      updatePayload.records = cleanRecords;
    }

    try {
      await updateDoc(docRef, updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function saveDatabaseToFirestore(appDb: AppDatabase): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Silakan hubungkan akun Google Firebase terlebih dahulu.');
  }

  for (const section of SECTIONS) {
    await upsertSectionDocument(section, appDb, currentUser.uid);
  }
}

export async function loadDatabaseFromFirestore(
  baseDb: AppDatabase
): Promise<Partial<AppDatabase> | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Silakan hubungkan akun Google Firebase terlebih dahulu.');
  }

  const result: Partial<AppDatabase> = {};
  let foundAny = false;

  for (const section of SECTIONS) {
    const path = `school_records/${section}`;
    const docRef = doc(db, 'school_records', section);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        foundAny = true;
        const data = snap.data();
        if (section === 'settings' && data.settingsData) {
          result.settings = {
            ...baseDb.settings,
            ...data.settingsData,
          };
        } else if (Array.isArray(data.records)) {
          (result as any)[section] = data.records;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  return foundAny ? result : null;
}
