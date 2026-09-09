export function Loader({ visible }: { visible: boolean }) {
  return (
    <div className={`loader ${visible ? 'is-on' : 'is-off'}`} aria-hidden={!visible}>
      <div className="loader-mark">
        <img src="/brand/konni-logo.webp" alt="KONNI MMA GYM Leipzig" className="loader-logo" />
        <i />
      </div>
    </div>
  )
}
