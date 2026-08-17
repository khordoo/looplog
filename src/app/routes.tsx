import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useStorage } from './providers/AppProvider'
import { Shell } from '../components/layout/Shell'
import { Onboarding } from '../features/onboarding/Onboarding'
import { Today } from '../features/today/Today'
import { Workout } from '../features/workout/Workout'
import { ExerciseDetail, ExerciseLibrary } from '../features/exercises/Exercises'
import { History, HistoryDetail } from '../features/history/History'
import { BandsSettings, BackupSettings, ResetSettings, ScheduleSettings, Settings, StorageSettings, SubstitutionSettings } from '../features/settings/Settings'
import { DeskReset } from '../features/desk-reset/DeskReset'
import { SessionDetail } from '../features/sessions/SessionSummary'
import { CustomExerciseForm } from '../features/exercises/CustomExerciseForm'

function Bootstrap() {
  const storage = useStorage(); const [destination, setDestination] = useState<string>();
  useEffect(() => { void storage.getProfile().then((profile) => setDestination(profile?.onboardingCompleted ? '/today' : '/onboarding')) }, [storage])
  return destination ? <Navigate to={destination} replace /> : <div className="page" data-testid="route-loading" role="status">Loading your private training space…</div>
}

export function AppRoutes() {
  return <Routes><Route element={<Shell />}><Route path="/" element={<Bootstrap />} /><Route path="/onboarding" element={<Onboarding />} /><Route path="/today" element={<Today />} /><Route path="/desk-reset" element={<DeskReset />} /><Route path="/workout/:sessionId" element={<Workout />} /><Route path="/sessions/:workoutKey" element={<SessionRoute />} /><Route path="/exercises" element={<ExerciseLibrary />} /><Route path="/exercises/custom/new" element={<CustomExerciseForm />} /><Route path="/exercises/custom/:id" element={<CustomExerciseForm />} /><Route path="/exercises/:exerciseId" element={<ExerciseDetail />} /><Route path="/history" element={<History />} /><Route path="/history/:sessionId" element={<HistoryDetail />} /><Route path="/settings" element={<Settings />} /><Route path="/settings/schedule" element={<ScheduleSettings />} /><Route path="/settings/bands" element={<BandsSettings />} /><Route path="/settings/substitutions" element={<SubstitutionSettings />} /><Route path="/settings/backups" element={<BackupSettings />} /><Route path="/settings/storage" element={<StorageSettings />} /><Route path="/settings/reset" element={<ResetSettings />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes>
}

function SessionRoute() {
  const { workoutKey: routeKey } = useParams<{ workoutKey: string }>()
  const raw = routeKey?.toUpperCase()
  const workoutKey = raw === 'B' || raw === 'C' ? raw : 'A'
  return <SessionDetail workoutKey={workoutKey} />
}
