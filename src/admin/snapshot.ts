/** Erster Beitragsmonat. Muss zu src/brand/plans.ts FIRST_CHARGE passen. */
export const FEE_START_YM = '2026-11'

export type StockMonth = { ym: string; stock?: number }

/**
 * Jahresansicht: der Bestand ist der erste Monat ab Beitragsstart, nicht der Dezember
 * nur weil die Verträge bis Jahresende laufen.
 */
export function snapshotMonth<T extends StockMonth>(months: T[], today: string): T {
  const todayYm = String(today ?? '').slice(0, 7)
  const anchor = todayYm < FEE_START_YM ? FEE_START_YM : todayYm
  return (
    months.find((row) => row.ym >= anchor && (row.stock ?? 0) > 0) ??
    [...months].reverse().find((row) => (row.stock ?? 0) > 0 && row.ym <= todayYm) ??
    months.find((row) => row.ym === anchor) ??
    months[0]
  )
}
