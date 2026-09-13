export function Loader({ visible }: { visible: boolean }) {
  return (
    <div className={`loader ${visible ? 'is-on' : 'is-off'}`} aria-hidden={!visible}>
      <div className="loader-mark">
        <img src="/brand/konni-logo-ui.webp" alt="KONNI MMA GYM Leipzig" className="loader-logo" width={880} height={935} />
        <i />
      </div>
    </div>
  )
}
