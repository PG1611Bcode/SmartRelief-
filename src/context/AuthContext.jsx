import { createContext, useContext, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

/**
 * Update a user's role in Firestore.
 * Called from the admin panel — not from component body directly.
 */
export async function setUserRole(uid, newRole) {
  await updateDoc(doc(db, 'users', uid), { 
    role: newRole,
    updatedAt: serverTimestamp() 
  });
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading
  const [role, setRole] = useState(null);
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  // Stable refs — survive re-renders, safe in async callbacks
  const timeoutRef = useRef(null);
  const isMounted = useRef(true);
  // Fix D: holds the current onSnapshot unsubscribe fn — called on user change + unmount
  const snapshotUnsubRef = useRef(null);

  useEffect(() => {
    isMounted.current = true;

    const unsub = onAuthStateChanged(auth, (user) => {
      // Clean up any previous snapshot listener before setting up a new one
      if (snapshotUnsubRef.current) {
        snapshotUnsubRef.current();
        snapshotUnsubRef.current = null;
      }

      if (user) {
        if (isMounted.current) {
          setCurrentUser(user);
          setRoleLoading(true);
        }

        // Hard timeout fallback — fires if Firestore never responds within 5s
        timeoutRef.current = setTimeout(() => {
          console.warn('[AuthContext] Role fetch timed out — defaulting to requester.');
          if (isMounted.current) {
            setRole('requester');
            setIsVolunteer(false);
            setRoleLoading(false);
          }
        }, 5000);

        // Fix D: real-time listener — fires on initial load AND on every subsequent change.
        // ChooseRole's updateDoc triggers this automatically — no manual refreshRole needed.
        const userRef = doc(db, 'users', user.uid);
        const unsubSnapshot = onSnapshot(
          userRef,
          (docSnap) => {
            // Cancel the timeout — Firestore responded
            clearTimeout(timeoutRef.current);

            if (docSnap.exists()) {
              // Doc exists — read role
              if (isMounted.current) {
                const data = docSnap.data();
                const rawRole = data.role ?? 'requester';
                const cleanRole = typeof rawRole === 'string' ? rawRole.trim() : rawRole;
                setRole(cleanRole);
                setIsVolunteer(data.is_volunteer === true || cleanRole === 'volunteer');
                setRoleLoading(false);
              }
            } else {
              // No doc — do NOT write anything. Let /choose-role handle it.
              console.log('[AuthContext] No role doc found for user — redirecting to /choose-role.');
              if (isMounted.current) {
                setRole(null);
                setIsVolunteer(false);
                setRoleLoading(false);
              }
            }
          },
          (err) => {
            // Snapshot error — safe fallback
            console.error('[AuthContext] Firestore snapshot error:', err);
            if (err.code === 'permission-denied') {
              toast.error('Database access denied. Check Firebase Security Rules.');
            } else {
              toast.error('Failed to sync user data. Please refresh.');
            }
            clearTimeout(timeoutRef.current);
            if (isMounted.current) {
              setRole('requester');
              setIsVolunteer(false);
              setRoleLoading(false);
            }
          }
        );

        // Store unsubscribe so we can tear it down on next user change or unmount
        snapshotUnsubRef.current = unsubSnapshot;
      } else {
        // Signed out — clear everything
        clearTimeout(timeoutRef.current);
        if (isMounted.current) {
          setCurrentUser(null);
          setRole(null);
          setIsVolunteer(false);
          setRoleLoading(false);
        }
      }
    });

    return () => {
      isMounted.current = false;
      unsub();
      clearTimeout(timeoutRef.current);
      // Also tear down any active snapshot listener on unmount
      if (snapshotUnsubRef.current) {
        snapshotUnsubRef.current();
        snapshotUnsubRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ currentUser, role, isVolunteer, roleLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
