import { Status } from '../ui/Status'
import { useOnline, useUpdate } from '../../app/providers/AppProvider'

export function Connectivity() {
  const online = useOnline()
  return <span className={`connectivity-pill ${online ? 'is-online' : 'is-offline'}`} role="status" data-testid="offline-status"><span className="connectivity-dot" aria-hidden="true" />{online ? 'Online' : 'Offline — workouts still work'}</span>
}

export function UpdateNotice({ activeWorkout = false }: { activeWorkout?: boolean }) {
  const { updateReady, activateUpdate, dismissUpdate } = useUpdate()
  if (!updateReady) return null
  return <Status kind="info" testId="update-status"><span>A new version is ready. </span>{activeWorkout ? <span>Finish or pause your workout before updating.</span> : <button className="text-button" onClick={activateUpdate}>Update now</button>} <button className="text-button" onClick={dismissUpdate}>Later</button></Status>
}
