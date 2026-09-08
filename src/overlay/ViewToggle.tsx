type ViewToggleProps = {
  phone: boolean
  onToggle: () => void
}

export function ViewToggle({ phone, onToggle }: ViewToggleProps) {
  return (
    <button type="button" className="view-toggle" onClick={onToggle}>
      {phone ? 'Desktop anzeigen' : 'Handy-Ansicht'}
    </button>
  )
}
