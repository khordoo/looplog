import { Status } from '../ui/Status'
import { useOnline, useUpdate } from '../../app/providers/AppProvider'

export function Connectivity() {
  const online = useOnline()
  return <Status kind={online ? 'success' : 'warning'} testId="offline-status">{online ? 'Online — local data is ready' : 'Offline — workouts and written guides still work'}</Status>
}

export function UpdateNotice({ activeWorkout = false }: { activeWorkout?: boolean }) {
  const { updateReady, activateUpdate, dismissUpdate } = useUpdate()
  if (!updateReady) return null
  return <Status kind="info" testId="update-status"><span>A new version is ready. </span>{activeWorkout ? <span>Finish or pause your workout before updating.</span> : <button className="text-button" onClick={activateUpdate}>Update now</button>} <button className="text-button" onClick={dismissUpdate}>Later</button></Status>
}
