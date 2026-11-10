/**
 * src/pages/views/QrFeedbackView.tsx — „QR-Code Feedback“ (beamer view, outside the dashboard chrome).
 *
 * ROUTE   #/ansicht/qr-feedback?record=<interaktion id>
 * LIVE    polls every 5 s: deactivating / switching the interaction updates the screen.
 * READS   interaktionen where aktiv = true (vSQL filter kept exactly).
 * SHOWS   exactly the pinned record when it is the active one; otherwise „Keine Interaktion aktiv“.
 * PURPOSE Zeigt den QR-Code zum Feedback-Formular der aktiven Interaktion bildschirmfüllend, mit Frage und Erläuterung darüber.
 */
import { useLiveRecords } from '@/hooks/useLiveRecords';
import { tx } from '@/i18n';
import { PublicPageQr } from '@/components/widgets/PublicPageQr';

export default function QrFeedbackView() {
  const pinned = (new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('record') ?? '').replace(/["\\]/g, '');
  const interaktionen = useLiveRecords('interaktionen', { intervalMs: 5000, query: { filter: "r.v_aktiv == True and r.v_aktiv == True" } });
  const active = pinned ? interaktionen.records.find(r => r.record_id === pinned) ?? null : null;

  if (interaktionen.error && interaktionen.records.length === 0) {
    return (
      <main className="min-h-dvh bg-background p-10 text-foreground">
        <p role="alert" data-live-error className="text-destructive" style={{ fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' }}>
          {interaktionen.unauthorized ? tx('Bitte melde dich an, um diese Ansicht zu sehen.') : tx('Die Daten konnten nicht geladen werden.')}
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background p-6 text-foreground sm:p-10">
      {!pinned ? (
        <p data-view-no-record style={{ fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' }}>{tx('Nichts ausgewählt — bitte über die Übersicht öffnen.')}</p>
      ) : !active ? (
        <p className="text-muted-foreground" style={{ fontSize: 'clamp(1.5rem, 3vh, 3rem)' }}>{interaktionen.loading ? '' : tx('Keine Interaktion aktiv')}</p>
      ) : (
        <>
          <h1 className="font-semibold leading-tight" style={{ fontSize: 'clamp(2rem, 5vh, 5rem)' }}>{active.fields.frage}</h1>
          {active.fields.erlaeuterung && (
            <p className="mt-3 whitespace-pre-line text-muted-foreground" style={{ fontSize: 'clamp(1.25rem, 2.6vh, 2.5rem)' }}>{active.fields.erlaeuterung}</p>
          )}
          <div className="flex flex-1 items-center justify-center pt-6">
            <PublicPageQr entity="interaktionen" recordId={active.record_id} size="56vh" linkClassName="text-base text-muted-foreground" />
          </div>
        </>
      )}
    </main>
  );
}
