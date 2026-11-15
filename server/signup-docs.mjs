import { buildContractPdf, buildTransferNoticePdf } from './membership-pdf.mjs'

function docMeta(path, name, bytes, at) {
  return {
    path,
    name,
    type: 'application/pdf',
    size: bytes.length,
    uploadedAt: at,
  }
}

async function paymentDoc(store, record, at) {
  const bytes = Buffer.from(await buildTransferNoticePdf(record))
  const path = `${record.id}/bankueberweisung.pdf`
  await store.putDoc(path, bytes, 'application/pdf')
  return docMeta(path, 'Banküberweisung.pdf', bytes, at)
}

/** Online-Anmeldung: unterschriebener Vertrag, bei Banküberweisung zusätzlich der Zahlungsnachweis. */
export async function attachSignupDocs(store, record) {
  if (!record?.id || record.source === 'admin') return record
  const needsContract = !record.docs?.contract
  const needsPayment = record.payMethod === 'transfer' && record.plan !== 'daypass' && !record.docs?.payment
  if (!needsContract && !needsPayment) return record

  const at = new Date().toISOString()
  const added = {}
  if (needsContract) {
    const bytes = Buffer.from(await buildContractPdf(record))
    const path = `${record.id}/vertrag-online.pdf`
    await store.putDoc(path, bytes, 'application/pdf')
    added.contract = docMeta(path, 'Mitgliedsvertrag.pdf', bytes, at)
  }
  if (needsPayment) added.payment = await paymentDoc(store, record, at)

  let saved = record
  await store.update((db) => {
    const index = db.members.findIndex((row) => row.id === record.id)
    if (index < 0) return db
    const current = db.members[index]
    const docs = { ...(current.docs ?? {}) }
    if (added.contract && !current.docs?.contract) docs.contract = added.contract
    if (added.payment && !current.docs?.payment) docs.payment = added.payment
    db.members[index] = { ...current, docs, updatedAt: at }
    saved = db.members[index]
    return db
  })
  return saved
}

/** Vor-Ort-Anlage mit Banküberweisung: Hinweis in die Akte, der Vertrag bleibt zum Unterschreiben. */
export async function attachTransferNotice(store, record) {
  if (!record?.id || record.payMethod !== 'transfer' || record.plan === 'daypass' || record.docs?.payment) return record
  const at = new Date().toISOString()
  const payment = await paymentDoc(store, record, at)
  let saved = record
  await store.update((db) => {
    const index = db.members.findIndex((row) => row.id === record.id)
    if (index < 0) return db
    const current = db.members[index]
    if (current.docs?.payment) {
      saved = current
      return db
    }
    db.members[index] = {
      ...current,
      docs: { ...(current.docs ?? {}), payment },
      updatedAt: at,
    }
    saved = db.members[index]
    return db
  })
  return saved
}
