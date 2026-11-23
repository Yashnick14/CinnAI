import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { onAuthStateChanged, updateProfile, type User } from "firebase/auth";
import { cloudRequest } from "../services/cloudApi";
import { firebaseConfigured } from "../config/firebase";
import { firebaseAuth } from "../services/firebaseAuth";

const Context = createContext<{
  user: User | null;
  loading: boolean;
  error: string | null;
  updateUsername: (name: string) => Promise<void>;
}>({
  user: null,
  loading: true,
  error: null,

  /** Update the signed-in user's display name through the account context. */
  updateUsername: async () => {
    throw new Error("Sign in first.");
  },
});

/** Track Firebase authentication and expose account operations to descendants. */
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);

  /** Update the signed-in user's display name through the account context. */
  async function updateUsername(name: string) {
    const current = firebaseAuth().currentUser;
    if (!current) throw new Error("Sign in first.");
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80)
      throw new Error("Use a username between 1 and 80 characters.");
    await updateProfile(current, { displayName: trimmed });
    setProfileVersion((value) => value + 1);
  }
  // Keep the signed-in profile name available to authorized admin reports.
  useEffect(() => {
    if (!user?.displayName?.trim()) return;
    void cloudRequest(
      "/profile",
      {
        method: "POST",
        body: JSON.stringify({ display_name: user.displayName.trim() }),
      },
      user.uid,
    ).catch(() => {});
  }, [user, profileVersion]);
  useEffect(() => {
    if (!firebaseConfigured) return;
    try {
      return onAuthStateChanged(
        firebaseAuth(),
        (value) => {
          setUser(value);
          setLoading(false);
        },
        () => {
          setError("Could not restore your session. Please try again.");
          setLoading(false);
        },
      );
    } catch {
      setError("Check the Firebase configuration.");
      setLoading(false);
    }
  }, []);
  return (
    <Context.Provider value={{ user, loading, error, updateUsername }}>
      {children}
    </Context.Provider>
  );
}

/** Read the shared authentication context. */
export const useAuth = () => useContext(Context);
