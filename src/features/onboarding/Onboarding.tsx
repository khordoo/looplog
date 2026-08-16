import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createDefaultBands } from '../../domain/bands'
import { profileSchema, type Profile, type ScheduleMode, type Weekday } from '../../domain/types'
import { validateScheduleSettings } from '../../domain/schedule'
import { useStorage } from '../../app/providers/AppProvider'
import { browserTimezone, isValidIanaTimezone } from '../../lib/browser'
import { nowIso } from '../../lib/ids'
import { Button, Card, Status } from '../../components/ui/Status'

const weekdays: Array<[Weekday, string]> = [[0, 'Sunday'], [1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday']]

export function Onboarding() {
  const storage = useStorage(); const navigate = useNavigate(); const activeBands = useMemo(() => createDefaultBands(), [])
  const [loaded, setLoaded] = useState(false); const [existing, setExisting] = useState<Profile>(); const [step, setStep] = useState(0); const [days, setDays] = useState<2 | 3>(3); const [mode, setMode] = useState<ScheduleMode>('flexible'); const [fixed, setFixed] = useState<Weekday[]>([1, 3, 5]); const [timezone, setTimezone] = useState(browserTimezone()); const [safety, setSafety] = useState(false); const [bandConfirmed, setBandConfirmed] = useState(false); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.resolve(storage.getProfile()).then((profile) => {
      if (cancelled) return
      if (profile && !profile.onboardingCompleted) { setExisting(profile); setTimezone(profile.timezone); setDays(profile.daysPerWeek); setMode(profile.mode); setFixed([...new Set(profile.fixedWeekdays)]); setSafety(profile.safetyAcknowledged) }
      setLoaded(true)
    }).catch(() => setLoaded(true))
    return () => { cancelled = true }
  }, [storage])

  const persist = useCallback(async (completed = false): Promise<void> => {
    const draftSettings = { timezone, daysPerWeek: days, mode, fixedWeekdays: mode === 'fixed' ? [...new Set(fixed)].sort() as Weekday[] : [] }
    if (!validateScheduleSettings(draftSettings).valid) return
    const stamp = nowIso(); const profile: Profile = { id: 'profile', timezone, daysPerWeek: days, mode, fixedWeekdays: mode === 'fixed' ? [...new Set(fixed)].sort() as Weekday[] : [], planVersion: 'v1', onboardingCompleted: completed, safetyAcknowledged: safety, createdAt: existing?.createdAt ?? stamp, updatedAt: stamp }
    const validated = profileSchema.parse(profile) as Profile
    await storage.saveProfile(validated); setExisting(validated)
  }, [days, existing?.createdAt, fixed, mode, safety, storage, timezone])

  // Keep a safe, incomplete profile so closing Safari or refreshing never loses
  // a completed onboarding step. The adapter is the only persistence seam.
  useEffect(() => {
    if (!loaded || step >= 5) return
    const timer = window.setTimeout(() => { void persist(false).catch(() => undefined) }, 0)
    return () => window.clearTimeout(timer)
  }, [loaded, persist, step])

  function toggleDay(day: Weekday) { setFixed((current) => current.includes(day) ? current.filter((item) => item !== day) : [...new Set([...current, day])].sort() as Weekday[]) }
  function changeDays(nextDays: 2 | 3) { setDays(nextDays); if (mode === 'fixed') setFixed((current) => [...new Set([...current, 1, 3, 5])].sort().slice(0, nextDays) as Weekday[]) }
  async function next() {
    setError('')
    if (step === 0 && !isValidIanaTimezone(timezone)) { setError('Enter a valid IANA timezone such as America/Toronto.'); return }
    if (step === 1 && (days !== 2 && days !== 3)) { setError('Choose two or three training days.'); return }
    if (step === 2) { const validation = validateScheduleSettings({ timezone, daysPerWeek: days, mode, fixedWeekdays: mode === 'fixed' ? fixed : [] }); if (!validation.valid) { setError(validation.errors.join(' ')); return } }
    if (step === 3 && !bandConfirmed) { setError('Confirm that you have the listed Serious Steel bands to continue.'); return }
    if (step === 4 && !safety) { setError('Please acknowledge the safety guidance before continuing.'); return }
    setSaving(true)
    try { await persist(false); setStep((value) => Math.min(5, value + 1)) } catch { setError('Your progress could not be saved. Check browser storage and try again.') } finally { setSaving(false) }
  }
  async function finish() { setError(''); setSaving(true); try { await persist(true); await storage.replaceBands(activeBands); navigate('/today', { replace: true }) } catch { setError('Onboarding could not be saved. Your incomplete progress is still safe to retry.') } finally { setSaving(false) } }

  return <div className="page narrow"><p className="eyebrow">Start here · step {step + 1} of 6</p><h2>Build your training rhythm</h2><div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={6} aria-valuenow={step + 1} aria-label={`Onboarding step ${step + 1} of 6`}><span style={{ width: `${((step + 1) / 6) * 100}%` }} /></div><Card>
    {step === 0 && <><h3>Your saved timezone</h3><p>We use this timezone for schedule dates. It defaults to the browser timezone and stays on this device.</p><label htmlFor="onboarding-timezone">Timezone<input id="onboarding-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} aria-describedby="timezone-help" /></label><p id="timezone-help" className="help">Use an IANA value such as America/Toronto.</p><aside className="status status-info"><span className="status-mark" aria-hidden="true">i</span><span><strong>Install on iPhone:</strong> Open this site in <strong>Safari</strong>, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</span></aside></>}
    {step === 1 && <><h3>How often do you want to train?</h3><div className="choice-grid"><button type="button" className={days === 2 ? 'choice selected' : 'choice'} onClick={() => changeDays(2)} aria-pressed={days === 2}>2 days<span>A → B rotation</span></button><button type="button" className={days === 3 ? 'choice selected' : 'choice'} onClick={() => changeDays(3)} aria-pressed={days === 3}>3 days<span>A → B → C rotation</span></button></div></>}
    {step === 2 && <><h3>How should days be assigned?</h3><div className="choice-grid"><button type="button" className={mode === 'flexible' ? 'choice selected' : 'choice'} onClick={() => setMode('flexible')} aria-pressed={mode === 'flexible'}>Flexible<span>Train when ready; missed days do not become overdue.</span></button><button type="button" className={mode === 'fixed' ? 'choice selected' : 'choice'} onClick={() => setMode('fixed')} aria-pressed={mode === 'fixed'}>Fixed weekdays<span>Assign workouts to weekdays you choose.</span></button></div>{mode === 'fixed' && <fieldset><legend>Select exactly {days} unique weekdays</legend><div className="weekday-grid">{weekdays.map(([day, label]) => <label key={day} className="check"><input type="checkbox" checked={fixed.includes(day)} onChange={() => toggleDay(day)} />{label}</label>)}</div></fieldset>}</>}
    {step === 3 && <><h3>Confirm your band set</h3><p>These 41-inch Serious Steel loop bands are preconfigured. Nominal ranges vary with stretch and setup; they are not fixed weights.</p><div className="band-list">{activeBands.map((band) => <div className="band-row" key={band.key}><span className={`band-dot band-${band.displayColor}`} aria-hidden="true" /><strong>{band.displayColor} #{band.number}</strong><span>{band.nominalMinLb}–{band.nominalMaxLb} lb nominal</span></div>)}</div><label className="check"><input type="checkbox" checked={bandConfirmed} onChange={(event) => setBandConfirmed(event.target.checked)} />I have this set or will use safe bodyweight alternatives.</label></>}
    {step === 4 && <><h3>Train with care</h3><p>Inspect the band for cuts, thinning, cracks, or sticky spots. Use a stable, nonslip floor, controlled motion, and a safe setup. Stop for sharp, radiating, or worsening pain. This app offers general guidance, not medical diagnosis.</p><label className="check"><input type="checkbox" checked={safety} onChange={(event) => setSafety(event.target.checked)} />I have no relevant medical restriction and understand the safety guidance.</label></>}
    {step === 5 && <><h3>You’re ready</h3><p>Your workout data remains in this browser. Export a JSON backup after your first completed workout so you can recover it if Safari website data is deleted or you change phones.</p><p><strong>Install reminder:</strong> In Safari, use <strong>Share → Add to Home Screen</strong>.</p></>}
    {error && <Status kind="error">{error}</Status>}<div className="form-actions">{step > 0 && <Button variant="secondary" disabled={saving} onClick={() => { setError(''); setStep((value) => value - 1) }}>Back</Button>}{step < 5 ? <Button onClick={() => void next()} disabled={saving}>{saving ? 'Saving…' : 'Continue'}</Button> : <Button onClick={() => void finish()} disabled={saving} data-testid="onboarding-finish">{saving ? 'Saving…' : 'Open Today'}</Button>}</div>
  </Card></div>
}
