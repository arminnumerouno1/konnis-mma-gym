import { COPY } from '../brand/copy'

export function Loader({ visible }: { visible: boolean }) {
  return (
    <div className={`loader ${visible ? 'is-on' : 'is-off'}`} aria-hidden={!visible}>
      <div className="loader-mark">
        <span>{COPY.gymName}</span>
        <i />
      </div>
    </div>
  )
}
