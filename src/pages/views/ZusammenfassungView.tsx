/**
 * src/pages/views/ZusammenfassungView.tsx — „Zusammenfassung“ (beamer view, outside the dashboard chrome).
 *
 * ROUTE   #/ansicht/zusammenfassung?record=<interaktion id>
 * READS   interaktionen; feedbacks; zusammenfassungen (vSQL filters kept exactly).
 * COMPOSE Vorprompt, dann alle Feedbacks der Reihe nach (älteste zuerst) mit Kürzel, zuletzt der Endprompt.
 * EDITS   zusammenfassungstext and ki_antwort are edited ON this view (autosave).
 * PURPOSE Führt alle Feedbacks einer Interaktion in ein großes, bearbeitbares Textfeld zusammen, das bildschirmfüllend mit den Teilnehmenden durchgegangen, kopiert und mit der Antwort der KI ergänzt wird.
 */
import { useEffect, useRef } from 'react';
import { useLiveRecords } from '@/hooks/useLiveRecords';
import { tx } from '@/i18n';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { flowActionFor } from '@/config/plan';
import { ViewTextEditor } from '@/components/blocks/ViewTextEditor';

export default function ZusammenfassungView() {
  const pinned = (new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('record') ?? '').replace(/["\\]/g, '');
  const interaktionen = useLiveRecords('interaktionen', { intervalMs: 0 });
  const feedbacks = useLiveRecords('feedbacks', { intervalMs: 0, query: { filter: "r.v_interaktion is not None" } });
  const zusammenfassungen = useLiveRecords('zusammenfassungen', { intervalMs: 0, query: { filter: "r.v_interaktion is not None" } });

  // the overview passes an interaktion id; a zusammenfassung id resolves to its interaktion
  const pinnedZus = zusammenfassungen.records.find(z => z.record_id === pinned) ?? null;
  const iid = interaktionen.records.some(r => r.record_id === pinned) ? pinned : (extractRecordId(pinnedZus?.fields.interaktion) ?? pinned);
  const interaktion = interaktionen.records.find(r => r.record_id === iid) ?? null;
  const loaded = !interaktionen.loading && !feedbacks.loading && !zusammenfassungen.loading;
  const anyError = [interaktionen, feedbacks, zusammenfassungen].some(x => x.error);
  const mine = zusammenfassungen.records
    .filter(z => extractRecordId(z.fields.interaktion) === iid)
    .sort((a, b) => (b.createdat ?? '').localeCompare(a.createdat ?? ''));
  const zus = mine[0] ?? null;

  const compose = () => {
    if (!loaded || !interaktion) return null;
    const fb = feedbacks.records
      .filter(f => extractRecordId(f.fields.interaktion) === iid)
      .sort((a, b) => (a.createdat ?? '').localeCompare(b.createdat ?? ''));
    const parts = [
      interaktion.fields.vorprompt,
      ...fb.map(f => `${f.fields.kuerzel ?? '—'}: ${f.fields.feedbacktext ?? ''}`),
      interaktion.fields.endprompt,
    ].filter((p): p is string => !!p && p.trim() !== '');
    return parts.join('\n\n');
  };

  // no Zusammenfassung yet → the view creates one (erstellt_am = now); compose() then fills it
  const creating = useRef<string | null>(null);
  const hasZus = !!zus;
  const reloadZus = zusammenfassungen.reload;
  useEffect(() => {
    if (!loaded || anyError || !interaktion || hasZus || creating.current === iid) return;
    creating.current = iid;
    LivingAppsService.createZusammenfassungenEntry({
      interaktion: createRecordUrl(APP_IDS.INTERAKTIONEN, iid),
      erstellt_am: new Date().toISOString().slice(0, 16),
    }).then(() => reloadZus()).catch(err => {
      console.error('[ZusammenfassungView] create zusammenfassung:', err);
      creating.current = null;
    });
  }, [loaded, anyError, interaktion, hasZus, iid, reloadZus]);

  // a stored text that holds none of the current feedbacks was never composed from them
  // (edits keep the feedback lines, so they are not touched) → compose it once on open
  const refreshed = useRef<string | null>(null);
  const zusId = zus?.record_id ?? null;
  const zusText = String(zus?.fields.zusammenfassungstext ?? '');
  useEffect(() => {
    if (!loaded || anyError || !interaktion || !zusId || !zusText.trim() || refreshed.current === zusId) return;
    const mineFb = feedbacks.records.filter(f => extractRecordId(f.fields.interaktion) === iid && (f.fields.feedbacktext ?? '').trim() !== '');
    if (mineFb.length === 0 || mineFb.some(f => zusText.includes(f.fields.feedbacktext ?? ''))) return;
    const next = compose();
    if (!next) return;
    refreshed.current = zusId;
    LivingAppsService.updateZusammenfassungenEntry(zusId, { zusammenfassungstext: next })
      .then(() => zusammenfassungen.apply(zusId, { zusammenfassungstext: next }))
      .catch(err => { console.error('[ZusammenfassungView] compose:', err); refreshed.current = null; });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per record, when its sources are ready
  }, [loaded, anyError, interaktion, zusId, zusText, feedbacks.records, iid]);

  const kiGo = zus ? flowActionFor('zusammenfassungen', 'ki_antwort', zus.record_id) : null;
  const blocked = anyError ? tx('Die Daten konnten nicht geladen werden — es wird nichts zusammengeführt oder gespeichert.') : null;

  return (
    <main className="min-h-dvh bg-background p-6 text-foreground sm:p-10">
      {!pinned && <p data-view-no-record style={{ fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' }}>{tx('Bitte über die Übersicht öffnen — diese Ansicht zeigt einen bestimmten Datensatz.')}</p>}
      {pinned && interaktion && (
        <header className="mb-6">
          <h1 className="font-semibold leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vh, 4rem)' }}>{interaktion.fields.frage}</h1>
          {interaktion.fields.erlaeuterung && (
            <p className="mt-2 whitespace-pre-line text-muted-foreground" style={{ fontSize: 'clamp(1.1rem, 2.2vh, 2.2rem)' }}>{interaktion.fields.erlaeuterung}</p>
          )}
        </header>
      )}
      {pinned && loaded && !interaktion && !anyError && (
        <p style={{ fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' }}>{tx('Interaktion nicht gefunden.')}</p>
      )}
      {zus && (
        <div className="space-y-8">
          <ViewTextEditor
            field="zusammenfassungstext"
            recordId={zus.record_id}
            value={String((zus.fields as Record<string, unknown>)['zusammenfassungstext'] ?? '')}
            save={async text => {
              await LivingAppsService.updateZusammenfassungenEntry(zus.record_id, { zusammenfassungstext: text });
              zusammenfassungen.apply(zus.record_id, { zusammenfassungstext: text });
            }}
            compose={compose}
            blocked={blocked}
          />
          <section>
            <h2 className="mb-2 font-semibold" style={{ fontSize: 'clamp(1.25rem, 2.6vh, 2.5rem)' }}>{tx('Antwort der KI')}</h2>
            <p className="min-h-[10vh] whitespace-pre-wrap rounded-md border bg-card p-4" style={{ fontSize: 'clamp(1rem, 2vh, 2rem)' }}>
              {String((zus.fields as Record<string, unknown>)['ki_antwort'] ?? '') || tx('Noch keine Antwort abgelegt.')}
            </p>
            {kiGo && (
              <button type="button" onClick={kiGo} className="mt-3 rounded-md bg-primary px-4 py-2 text-primary-foreground">{tx('Antwort der KI ablegen')}</button>
            )}
          </section>
        </div>
      )}
      {pinned && loaded && interaktion && !zus && !anyError && (
        <div className="space-y-3">
          <p style={{ fontSize: 'clamp(1.25rem, 2.4vh, 2.4rem)' }}>{tx('Für diese Interaktion gibt es noch keine Zusammenfassung.')}</p>
          <a href="#/intents/feedbacks-zusammenfassen" className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground">{tx('Zusammenfassung anlegen')}</a>
        </div>
      )}
      {[interaktionen, feedbacks, zusammenfassungen].map((x, i) => x.error && x.records.length === 0 && (
        <p key={i} role="alert" data-live-error className="mt-4 text-destructive" style={{ fontSize: 'clamp(1.5rem, 2.8vh, 3rem)' }}>
          {x.unauthorized ? tx('Bitte melde dich an, um diese Ansicht zu sehen.') : tx('Die Daten konnten nicht geladen werden.')}
        </p>
      ))}
    </main>
  );
}
