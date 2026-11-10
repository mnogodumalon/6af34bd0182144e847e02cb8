import { useMemo, useState } from 'react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor, countOf, viewHref } from '@/config/plan';
import type { Interaktionen } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { Button } from '@/components/ui/button';
import { IconCalendarEvent, IconMessage, IconPlus, IconQrcode, IconSparkles, IconCircleCheck, IconStar } from '@tabler/icons-react';

// Composition: hub-and-spoke on Veranstaltungen. No widget covers "ordered steps of an event with
// exactly one active" (Kanban needs a status lookup, Calendar is time-shaped), so the primary surface
// is a hand-built event → interaction list. No urgent signal → no hero; the active step IS the signal.
// Layout: variant "split", slim StatStrip, aside = Letzte Zusammenfassungen + Abschlussbewertungen.
// Mobile: event cards stack, interaction rows wrap their actions below the question.
export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { veranstaltungen, interaktionen, feedbacks, zusammenfassungen, setInteraktionen, fetchAll } = data;
  const clock = useClock();
  const [onlyOpen, setOnlyOpen] = useState(false);

  const advanceActivate = (i: Interaktionen): string | void => {
    if (i.fields.aktiv) return;
    const vId = extractRecordId(i.fields.veranstaltung);
    const siblings = interaktionen.filter(x => x.record_id !== i.record_id && x.fields.aktiv && extractRecordId(x.fields.veranstaltung) === vId);
    const snapshot = interaktionen;
    const sibIds = new Set(siblings.map(s => s.record_id));
    setInteraktionen(list => list.map(x => x.record_id === i.record_id
      ? { ...x, fields: { ...x.fields, aktiv: true } }
      : sibIds.has(x.record_id) ? { ...x, fields: { ...x.fields, aktiv: false } } : x));
    Promise.all([
      ...siblings.map(s => LivingAppsService.updateInteraktionenEntry(s.record_id, { aktiv: false })),
      LivingAppsService.updateInteraktionenEntry(i.record_id, { aktiv: true }),
    ])
      .then(() => undoToast(tx`„${i.fields.frage ?? ''}“ ist jetzt aktiv`, () => {
        setInteraktionen(snapshot);
        void Promise.all([
          LivingAppsService.updateInteraktionenEntry(i.record_id, { aktiv: false }),
          ...siblings.map(s => LivingAppsService.updateInteraktionenEntry(s.record_id, { aktiv: true })),
        ]).catch(() => fetchAll());
      }))
      .catch(() => { setInteraktionen(snapshot); fetchAll(); });
  };

  const crud = useEntityCrud(data, {
    footer: (top) => top.type === 'interaktionen' && !top.record.fields.aktiv
      ? { label: tx('Aktivieren & QR-Code öffnen'), onClick: () => { window.open(viewHref('qr-feedback', top.record.record_id), '_blank'); advanceActivate(top.record); } }
      : undefined,
  });

  const feedbackCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of feedbacks) {
      const id = extractRecordId(f.fields.interaktion);
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [feedbacks]);

  const events = useMemo(() => [...veranstaltungen]
    .sort((a, b) => (b.fields.datum ?? '').localeCompare(a.fields.datum ?? ''))
    .map(v => {
      const steps = interaktionen
        .filter(i => extractRecordId(i.fields.veranstaltung) === v.record_id)
        .sort((a, b) => (a.fields.reihenfolge ?? 0) - (b.fields.reihenfolge ?? 0));
      return { v, steps, active: steps.find(s => s.fields.aktiv) ?? null };
    }), [veranstaltungen, interaktionen]);

  const withoutActive = events.filter(e => !e.active);
  const shown = onlyOpen ? withoutActive : events;
  const activeOnes = events.filter(e => e.active);

  const latestSummaries = [...zusammenfassungen]
    .sort((a, b) => (b.createdat ?? '').localeCompare(a.createdat ?? ''));
  const latestRatings = [...crud.enriched.abschlussbewertungen]
    .sort((a, b) => (b.createdat ?? '').localeCompare(a.createdat ?? ''));

  const frageOf = (interaktionId: string | null) => interaktionen.find(i => i.record_id === interaktionId)?.fields.frage ?? '—';

  let context: string;
  if (veranstaltungen.length === 0) context = tx('Lege deine erste Veranstaltung an und bereite die Interaktionen vor.');
  else if (activeOnes.length > 0) {
    const names = namen(activeOnes.map(e => e.v.fields.titel ?? ''));
    const n = activeOnes.reduce((s, e) => s + (feedbackCount.get(e.active!.record_id) ?? 0), 0);
    context = tx`Aktiv: ${names} — ${countOf('feedbacks', n, appLabel('feedbacks'))} zur aktiven Interaktion.`;
  } else {
    const names = namen(events.map(e => e.v.fields.titel ?? ''));
    context = tx`Noch keine Interaktion aktiv — wähle bei ${names} die nächste aus.`;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.veranstaltungen.canWrite && (
          <Button onClick={() => crud.veranstaltungen.openCreate({})} className="w-full sm:w-auto">
            <IconPlus size={16} className="shrink-0" /> {tx('Neue Veranstaltung')}
          </Button>
        )}
      </header>

      <DashboardGrid
        variant="split"
        kpis={veranstaltungen.length > 0 ? (
          <StatStrip>
            <StatStripItem
              title={tx('Ohne aktive Interaktion')}
              value={withoutActive.length}
              icon={<IconCalendarEvent size={16} className="text-muted-foreground" />}
              tone={withoutActive.length > 0 ? 'warning' : 'default'}
              onClick={() => setOnlyOpen(o => !o)}
              active={onlyOpen}
            />
          </StatStrip>
        ) : undefined}
        aside={
          <>
            <WorkList
              title={tx('Letzte Zusammenfassungen')}
              icon={<IconSparkles size={16} className="text-muted-foreground" />}
              items={latestSummaries.map(z => {
                const iid = extractRecordId(z.fields.interaktion);
                const go = !z.fields.ki_antwort ? flowActionFor('zusammenfassungen', 'ki_antwort', z.record_id) : null;
                return {
                  id: z.record_id,
                  title: frageOf(iid),
                  secondLine: z.fields.ki_antwort
                    ? <span className="font-medium text-emerald-600">{tx('KI-Antwort abgelegt')}</span>
                    : <span className="font-medium text-amber-600">{tx('KI-Antwort fehlt')}</span>,
                  action: go ? { label: tx('Antwort ablegen'), onClick: go } : undefined,
                };
              })}
              onItemClick={id => { const z = zusammenfassungen.find(r => r.record_id === id); if (z) crud.zusammenfassungen.openDetail(z); }}
              empty={{ text: tx('Noch keine Zusammenfassung — starte sie bei einer Interaktion.') }}
              max={4}
            />
            <WorkList
              title={appLabel('abschlussbewertungen')}
              icon={<IconStar size={16} className="text-muted-foreground" />}
              items={latestRatings.map(a => ({
                id: a.record_id,
                title: a.fields.referenzstatement || a.fields.besonders_toll || '—',
                secondLine: <span className="text-muted-foreground">{a.veranstaltungName}{a.fields.kuerzel ? ` · ${a.fields.kuerzel}` : ''}</span>, // i18n-exempt
              }))}
              onItemClick={id => { const a = abschlussFind(id); if (a) crud.abschlussbewertungen.openDetail(a); }}
              empty={{ text: tx('Noch keine Abschlussbewertung eingegangen.') }}
              max={4}
            />
          </>
        }
        primary={
          <div className="space-y-4">
            {events.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
                <IconCalendarEvent size={48} className="text-muted-foreground" />
                <p className="text-muted-foreground">{tx('Noch keine Veranstaltung — lege sie an, dann folgen die Interaktionen.')}</p>
                {crud.veranstaltungen.canWrite && (
                  <Button onClick={() => crud.veranstaltungen.openCreate({})}>{tx('Erste Veranstaltung anlegen')}</Button>
                )}
              </div>
            )}
            {events.length > 0 && shown.length === 0 && (
              <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">{tx('Bei jeder Veranstaltung ist eine Interaktion aktiv.')}</p>
            )}
            {shown.map(({ v, steps, active }) => (
              <section key={v.record_id} className="overflow-hidden rounded-xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <button type="button" onClick={() => crud.veranstaltungen.openDetail(v)} className="min-w-0 text-left">
                    <h2 className="truncate text-base font-semibold">{v.fields.titel}</h2>
                    <p className="text-xs text-muted-foreground">{v.fields.datum ? formatDate(v.fields.datum) : '—'}</p>
                  </button>
                  {crud.interaktionen.canWrite && (
                    <Button variant="outline" size="sm" onClick={() => crud.interaktionen.openCreate({ veranstaltung: v.record_id, reihenfolge: steps.length + 1 })}>
                      <IconPlus size={14} className="shrink-0" /> {tx('Interaktion')}
                    </Button>
                  )}
                </div>
                {steps.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-muted-foreground">{tx('Noch keine Interaktion — lege den ersten Schritt an.')}</p>
                ) : (
                  <ul className="divide-y">
                    {steps.map(s => {
                      const n = feedbackCount.get(s.record_id) ?? 0;
                      const isActive = !!s.fields.aktiv;
                      return (
                        <li key={s.record_id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${isActive ? 'bg-primary/5' : ''}`}>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{s.fields.reihenfolge ?? '–'}</span>
                          <button type="button" onClick={() => crud.interaktionen.openDetail(s)} className="min-w-0 flex-1 basis-48 text-left">
                            <p className="line-clamp-2 text-sm font-medium">{s.fields.frage}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                              {isActive && <span className="inline-flex items-center gap-1 font-medium text-primary"><IconCircleCheck size={13} className="shrink-0" />{tx('Aktiv')}</span>}
                              <span className="inline-flex items-center gap-1"><IconMessage size={13} className="shrink-0" />{countOf('feedbacks', n, appLabel('feedbacks'))}</span>
                            </p>
                          </button>
                          {crud.interaktionen.canWrite && (
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={viewHref('qr-feedback', s.record_id)}
                                target="_blank"
                                rel="noopener"
                                onClick={() => { advanceActivate(s); }}
                                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${isActive ? 'border bg-background hover:bg-muted' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                              >
                                <IconQrcode size={14} className="shrink-0" /> {isActive ? tx('QR-Code zeigen') : tx('Aktivieren')}
                              </a>
                              <a
                                href={`#/ansicht/zusammenfassung?record=${s.record_id}`}
                                target="_blank"
                                rel="noopener"
                                className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted"
                              >
                                <IconSparkles size={14} className="shrink-0" /> {tx('Zusammenfassen')}
                              </a>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {steps.length > 0 && !active && (
                  <p className="border-t bg-amber-50 px-4 py-2 text-xs text-amber-700">{tx('Keine Interaktion aktiv — Teilnehmende sehen noch nichts.')}</p>
                )}
              </section>
            ))}
          </div>
        }
      />
      {crud.surfaces}
    </div>
  );

  function abschlussFind(id: string) {
    return data.abschlussbewertungen.find(a => a.record_id === id);
  }
}
