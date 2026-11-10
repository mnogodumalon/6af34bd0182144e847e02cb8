import { useEffect, useMemo, useRef, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import { Button } from '@/components/ui/button';
import { Bound } from '@/components/blocks/Bound';
import { FieldErrorSummary } from '@/components/blocks/FieldErrorSummary';
import { LoadProblem } from '@/components/blocks/LoadProblem';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  loadPublicPagesConfig, prepareChallenge,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useStepForm, useJourneySubmit, useLiveList, useVisitorKey,
  fieldText, PUBLIC_MIN_INTERVAL_MS,
} from '@/lib/journey';
import { tx } from '@/i18n';

const SLUG = 'feedback-geben';

function newKennung(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function FeedbackForm({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const kuerzel = useVisitorKey({ length: 5 });
  const live = useLiveList(port, 'interaktionen', { intervalMs: Math.max(20000, PUBLIC_MIN_INTERVAL_MS) });
  const active = live.records[0] ?? null;
  const activeId = active?.id ?? null;

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  const kennungRef = useRef<string>(newKennung());

  const f = useStepForm('feedbacks', {
    fields: ['feedbacktext', 'kuerzel', 'interaktion', 'absende_kennung'],
    required: { feedbacktext: true, kuerzel: false, interaktion: false, absende_kennung: false },
    autoComplete: true,
    messages: { feedbacktext: tx('Bitte schreib dein Feedback.') },
  });

  const submit = useJourneySubmit(
    port,
    [{
      key: 'feedback',
      entity: 'feedbacks',
      form: f,
      primary: true,
      values: () => ({
        interaktion: activeIdRef.current ?? '',
        kuerzel,
        absende_kennung: kennungRef.current,
      }),
    }],
    {
      draftKey: SLUG,
      check: async () => {
        const id = activeIdRef.current;
        if (!id) return tx('Gerade ist keine Frage geöffnet.');
        // the list is scoped to the active question — still first in it = still current
        const now = await port.list('interaktionen');
        if (now[0]?.id !== id) return tx('Inzwischen ist eine andere Frage dran.');
        return null;
      },
    },
  );

  // a fresh identifier for the NEXT feedback once this one went through
  useEffect(() => {
    if (submit.result) kennungRef.current = newKennung();
  }, [submit.result]);

  const createAppId = page.endpoints?.find(e => e.op === 'create')?.app_id;
  const warm = () => {
    if (createAppId) prepareChallenge(cfg, page, 'POST', `/apps/${createAppId}/records`);
  };

  if (!live.loaded && live.error) return <LoadProblem onRetry={live.reload} />;

  if (submit.result) {
    return (
      <SuccessStep
        result={submit.result}
        title={tx('Danke für dein Feedback!')}
        submit={submit}
        restartLabel={tx('Noch ein Feedback schreiben')}
        actions={{ copy: false, print: false }}
        next={[{ label: tx('Zur Abschlussbewertung'), href: '#/public/abschlussbewertung' }]}
      >
        <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground">{tx('Dein Kürzel')}</p>
          <p className="text-3xl font-bold tracking-widest">{kuerzel}</p>
        </div>
      </SuccessStep>
    );
  }

  if (!live.loaded) return <p className="text-sm text-muted-foreground">{tx('Lädt …')}</p>;

  if (!active) {
    return (
      <p className="text-center text-muted-foreground py-6">
        {tx('Gerade ist keine Frage geöffnet. Diese Seite aktualisiert sich von selbst.')}
      </p>
    );
  }

  const send = async () => {
    if (!f.validate(['feedbacktext'])) return;
    await submit.run();
  };

  return (
    <form
      className="space-y-5"
      onFocus={warm}
      onSubmit={e => { e.preventDefault(); void send(); }}
    >
      <div className="space-y-1">
        <p className="text-lg font-semibold whitespace-pre-line">{fieldText(active, 'frage')}</p>
        {fieldText(active, 'erlaeuterung') && (
          <p className="text-sm text-muted-foreground whitespace-pre-line">{fieldText(active, 'erlaeuterung')}</p>
        )}
      </div>
      <Bound form={f} name="feedbacktext" rows={5} />
      <FieldErrorSummary forms={[f]} />
      {submit.offline && (
        <p className="text-sm text-muted-foreground">{tx('Keine Verbindung — dein Feedback ist gesichert und wird gesendet, sobald du wieder online bist.')}</p>
      )}
      {submit.error && !submit.offline && (
        <p role="alert" className="text-sm text-destructive">{submit.error.message || tx('Das hat nicht geklappt. Bitte versuche es noch einmal.')}</p>
      )}
      <Button type="submit" className="w-full" disabled={submit.submitting}>
        {submit.submitting ? tx('Wird gesendet …') : tx('Feedback absenden')}
      </Button>
    </form>
  );
}

export default function FeedbackGeben() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
    });
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }

  return (
    <PublicShell title={page.title} description={page.description}>
      <FeedbackForm cfg={cfg} page={page} />
    </PublicShell>
  );
}
