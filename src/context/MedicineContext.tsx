import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import * as svc from '../services/medicineService';
import { storage } from '../services/storage';
import { setWidgetMedicines } from '../services/widgetService';
import type {
  DoctorVisit, DoseLog, DoseStatus, FamilyProfile, Medicine,
} from '../types/medicine';

const ACTIVE_PROFILE_KEY = 'medicine_active_profile_v1';

interface MedicineContextValue {
  profiles: FamilyProfile[];
  medicines: Medicine[];
  logs: DoseLog[];
  loaded: boolean;
  /** Currently selected profile; medicines are filtered to it. */
  activeProfileId: string | null;
  setActiveProfile: (id: string) => Promise<void>;
  /** Medicines belonging to the active profile. */
  profileMedicines: Medicine[];
  profileLogs: DoseLog[];
  /** Reloads everything; resolves with the fresh profile list. */
  refresh: () => Promise<FamilyProfile[]>;

  addMedicine: (input: svc.MedicineInput) => Promise<void>;
  editMedicine: (id: string, patch: Partial<svc.MedicineInput>) => Promise<void>;
  removeMedicine: (id: string) => Promise<void>;

  recordDose: (input: {
    medicineId: string; date: string; scheduledMinutes: number | null;
    status: DoseStatus; note?: string;
  }) => Promise<void>;
  clearDose: (medicineId: string, date: string, minutes: number | null) => Promise<void>;
  snooze: (input: {
    medicineId: string; date: string; scheduledMinutes: number | null; minutes: number;
  }) => Promise<void>;
  changeStock: (medicineId: string, delta: number) => Promise<void>;

  addProfile: (input: Partial<svc.ProfileInput> & { name: string }) => Promise<void>;
  editProfile: (id: string, patch: Partial<svc.ProfileInput>) => Promise<void>;
  removeProfile: (id: string) => Promise<boolean>;

  visits: DoctorVisit[];
  addVisit: (input: svc.VisitInput) => Promise<void>;
  editVisit: (id: string, patch: Partial<svc.VisitInput> & { completed?: boolean }) => Promise<void>;
  removeVisit: (id: string) => Promise<void>;
  /** Visits belonging to the active profile. */
  profileVisits: DoctorVisit[];
}

const MedicineContext = createContext<MedicineContextValue | undefined>(undefined);

export function MedicineProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [visits, setVisits] = useState<DoctorVisit[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  /**
   * False once the provider unmounts. Every mutation refreshes, so a write that
   * resolves after teardown would otherwise set state on a dead tree and keep
   * it reachable.
   */
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const refresh = useCallback(async () => {
    const [profs, meds, doseLogs, docVisits] = await Promise.all([
      svc.getProfiles(), svc.getMedicines(), svc.getDoseLogs(), svc.getVisits(),
    ]);
    if (!mountedRef.current) return profs;

    setProfiles(profs);
    setMedicines(meds);
    setLogs(doseLogs);
    setVisits(docVisits);
    // Push today's doses to the home widget; failures are non-critical.
    svc.todayWidgetDoses().then(setWidgetMedicines).catch(() => {});
    return profs;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const fallback = await svc.ensureDefaultProfile();
        const profs = await refresh();
        if (!alive) return;

        const stored = await storage.getSetting<string | null>(ACTIVE_PROFILE_KEY, null);
        const valid = stored && profs.some(p => p.id === stored) ? stored : fallback.id;
        if (alive) setActiveProfileId(valid);

        // Android drops pending alarms on reboot and app update, so re-arm the
        // rolling horizon every launch.
        await svc.rescheduleAllMedicineReminders();
        await svc.scheduleExpiryReminders();
        await svc.rescheduleAllVisitReminders();
      } catch {
        // Leaves empty lists rather than blocking the screen.
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [refresh]);

  const setActiveProfile = useCallback(async (id: string) => {
    setActiveProfileId(id);
    // Applied optimistically; a failed write only means it won't survive a
    // restart, and these are called fire-and-forget from onPress handlers.
    try { await storage.setSetting(ACTIVE_PROFILE_KEY, id); } catch { /* ignore */ }
  }, []);

  const profileMedicines = useMemo(
    () => medicines.filter(m => m.profileId === activeProfileId),
    [activeProfileId, medicines],
  );

  const profileVisits = useMemo(
    () => visits.filter(v => v.profileId === activeProfileId),
    [activeProfileId, visits],
  );

  const profileLogs = useMemo(
    () => logs.filter(l => l.profileId === activeProfileId),
    [activeProfileId, logs],
  );

  /**
   * Runs a write then refreshes. Failures are swallowed: these are invoked
   * fire-and-forget from onPress handlers, where a rejection would surface as
   * an unhandled promise rather than anything the user can act on.
   */
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    try { await fn(); await refresh(); } catch { /* state stays as it was */ }
  }, [refresh]);

  const addMedicine = useCallback(async (input: svc.MedicineInput) => {
    await run(() => svc.createMedicine(input));
  }, [run]);

  const editMedicine = useCallback(async (id: string, patch: Partial<svc.MedicineInput>) => {
    await run(() => svc.updateMedicine(id, patch));
  }, [run]);

  const removeMedicine = useCallback(async (id: string) => {
    await run(() => svc.deleteMedicine(id));
  }, [run]);

  const recordDose = useCallback(async (input: {
    medicineId: string; date: string; scheduledMinutes: number | null;
    status: DoseStatus; note?: string;
  }) => {
    if (!activeProfileId) return;
    await run(() => svc.logDose({ ...input, profileId: activeProfileId }));
  }, [activeProfileId, run]);

  const clearDose = useCallback(async (
    medicineId: string, date: string, minutes: number | null,
  ) => {
    await run(() => svc.clearDoseLog(medicineId, date, minutes));
  }, [run]);

  const snooze = useCallback(async (input: {
    medicineId: string; date: string; scheduledMinutes: number | null; minutes: number;
  }) => {
    if (!activeProfileId) return;
    await run(() => svc.snoozeDose({ ...input, profileId: activeProfileId }));
  }, [activeProfileId, run]);

  const changeStock = useCallback(async (medicineId: string, delta: number) => {
    await run(() => svc.adjustStock(medicineId, delta));
  }, [run]);

  const addProfile = useCallback(async (
    input: Partial<svc.ProfileInput> & { name: string },
  ) => {
    await run(() => svc.createProfile(input));
  }, [run]);

  const editProfile = useCallback(async (id: string, patch: Partial<svc.ProfileInput>) => {
    await run(() => svc.updateProfile(id, patch));
  }, [run]);

  const addVisit = useCallback(async (input: svc.VisitInput) => {
    await run(() => svc.createVisit(input));
  }, [run]);

  const editVisit = useCallback(async (
    id: string, patch: Partial<svc.VisitInput> & { completed?: boolean },
  ) => {
    await run(() => svc.updateVisit(id, patch));
  }, [run]);

  const removeVisit = useCallback(async (id: string) => {
    await run(() => svc.deleteVisit(id));
  }, [run]);

  const removeProfile = useCallback(async (id: string) => {
    const ok = await svc.deleteProfile(id).catch(() => false);
    if (!ok) return false;
    const profs = await refresh();
    // Fall back to the default profile if the active one just went away.
    if (id === activeProfileId) {
      const next = profs.find(p => p.isDefault) ?? profs[0];
      if (next) await setActiveProfile(next.id);
    }
    return true;
  }, [activeProfileId, refresh, setActiveProfile]);

  const value = useMemo<MedicineContextValue>(() => ({
    profiles, medicines, logs, loaded, activeProfileId, setActiveProfile,
    profileMedicines, profileLogs, refresh,
    addMedicine, editMedicine, removeMedicine,
    recordDose, clearDose, snooze, changeStock,
    addProfile, editProfile, removeProfile,
    visits, profileVisits, addVisit, editVisit, removeVisit,
  }), [
    activeProfileId, addMedicine, addProfile, changeStock, clearDose, editMedicine,
    editProfile, loaded, logs, medicines, profileLogs, profileMedicines, profiles,
    recordDose, refresh, removeMedicine, removeProfile, setActiveProfile, snooze,
    visits, profileVisits, addVisit, editVisit, removeVisit,
  ]);

  return <MedicineContext.Provider value={value}>{children}</MedicineContext.Provider>;
}

export function useMedicine(): MedicineContextValue {
  const ctx = useContext(MedicineContext);
  if (!ctx) throw new Error('useMedicine must be used inside MedicineProvider');
  return ctx;
}
