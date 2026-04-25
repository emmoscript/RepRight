import { create } from 'zustand';

type AuthState = {
  isLoggedIn: boolean;
  email: string | null;
  participantId: string;
  setSession: (email: string | null, participantId: string) => void;
  logout: () => void;
};

const randomParticipant = () => `P${String(Math.floor(Math.random() * 900) + 100)}`;

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  email: null,
  participantId: randomParticipant(),
  setSession: (email, participantId) => set({ isLoggedIn: !!email, email, participantId }),
  logout: () => set({ isLoggedIn: false, email: null, participantId: randomParticipant() }),
}));
