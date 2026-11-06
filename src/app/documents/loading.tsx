import { Skeleton } from "@/components/ui";

export default function DocumentsLoading() {
  return <main className="workspace-page documents-page" aria-busy="true" aria-label="Loading Documents">
    <span className="sr-only">Loading Documents</span>
    <header className="workspace-page-intro"><div><Skeleton style={{ width: 190, height: 28 }} /><Skeleton style={{ width: 280, marginTop: 10 }} /></div><Skeleton style={{ width: 180, height: 38 }} /></header>
    <section className="documents-summary" aria-hidden="true">{[0,1,2,3].map(item=><div className="documents-summary-item" key={item}><Skeleton style={{ width: 90 }} /><Skeleton style={{ width: 48, height: 24, marginTop: 12 }} /></div>)}</section>
    <section className="workspace-panel" aria-hidden="true"><Skeleton style={{ width: 160, height: 22, marginBottom: 20 }} />{[0,1,2,3,4].map(item=><Skeleton key={item} style={{ width: "100%", height: 42, marginBottom: 8 }} />)}</section>
  </main>;
}
