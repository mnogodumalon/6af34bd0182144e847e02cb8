import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  useVisitorKey,
  fieldText,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { tx } from '@/i18n';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { Checkbox } from '@/components/ui/checkbox';
import type { JourneyPort } from '@/lib/journey';

const SLUG = 'abschlussbewertung';

export default function Abschlussbewertung() {
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
      <Wizard cfg={cfg} page={page} />
    </PublicShell>
  );
}

function Wizard({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const port: JourneyPort = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const visitorKey = useVisitorKey();
  const [step, setStep] = useState(1);

  const search = useRecordSearch(port, 'veranstaltungen', {
    searchFields: ['titel'],
    orderby: ['datum desc'],
    toItem: r => ({
      id: r.id,
      title: fieldText(r, 'titel'),
      subtitle: fieldText(r, 'datum') || undefined,
    }),
  });

  const f = useStepForm('abschlussbewertungen', {
    fields: ['veranstaltung', 'besonders_toll', 'verbesserungen', 'referenzstatement', 'email', 'einwilligung'],
    required: { veranstaltung: true },
    steps: { veranstaltung: 1, besonders_toll: 2, verbesserungen: 2, referenzstatement: 2, email: 3, einwilligung: 3 },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    port,
    [{
      key: 'bewertung',
      entity: 'abschlussbewertungen',
      form: f,
      primary: true,
      values: () => ({ kuerzel: visitorKey }),
    }],
    { draftKey: SLUG },
  );

  const steps = [
    { label: tx('Veranstaltung'), heading: tx('Welche Veranstaltung bewertest du?') },
    { label: tx('Deine Bewertung'), heading: tx('Was war toll, was geht besser?') },
    { label: tx('E-Mail (freiwillig)'), heading: tx('Möchtest du deine E-Mail hinterlassen?') },
    { label: tx('Prüfen'), heading: tx('Alles richtig?') },
  ];

  const mailWithoutConsent = !!f.get('email') && !f.get('einwilligung');
  const picked = f.get('veranstaltung') as string | null;

  return (
    <IntentWizardShell
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[f]}
      draftKey={SLUG}
    >
      {step === 1 && (
        <>
          <EntitySelectStep
            {...search.select}
            id={f.fieldId('veranstaltung')}
            selectedId={picked}
            onSelect={id => f.set('veranstaltung', id, search.labelOf(id))}
            invalid={!!f.error('veranstaltung')}
            avatar="none"
            create={false}
          />
          <StepNav hideBack onNext={() => f.validate(['veranstaltung'])} nextStepLabel={tx('Deine Bewertung')} />
        </>
      )}
      {step === 2 && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {tx('Am besten formulierst du am Ende ein Referenzstatement, das wir weitergeben dürfen.')}
          </p>
          <div className="space-y-5">
            <Bound form={f} name="besonders_toll" rows={4} />
            <Bound form={f} name="verbesserungen" rows={4} />
            <Bound form={f} name="referenzstatement" rows={4} />
          </div>
          <StepNav onBack={() => setStep(1)} nextStepLabel={tx('E-Mail')} onNext={() => true} />
        </>
      )}
      {step === 3 && (
        <>
          <div className="space-y-5">
            <Bound form={f} name="email" />
            <Field form={f} name="einwilligung" hideLabel>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox {...f.checkbox('einwilligung')} />
                <span>
                  {tx('Ich willige ein, dass meine E-Mail-Adresse zusammen mit meinem Kürzel für eine persönliche Auswertung gespeichert wird.')}
                </span>
              </label>
            </Field>
            {mailWithoutConsent && (
              <p className="text-sm text-muted-foreground">{tx('Ohne Häkchen speichern wir deine E-Mail nicht.')}</p>
            )}
          </div>
          <StepNav
            onBack={() => setStep(2)}
            nextStepLabel={tx('Prüfen')}
            nextLabel={f.get('email') ? undefined : tx('Nein, danke — weiter')}
            onNext={() => true}
          />
        </>
      )}
      {step === 4 && !submit.done && (
        <SummaryStep
          forms={[f]}
          submit={submit}
          items={[{ key: 'kuerzel', label: tx('Dein Kürzel'), value: visitorKey }]}
          whatHappensNext={tx('Danke! Mit deinem Kürzel kannst du deine Bewertung später wiederfinden.')}
        />
      )}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          title={tx('Danke für deine Bewertung!')}
          whatHappensNext={tx('Dein Kürzel für diese Veranstaltung lautet: ') + visitorKey}
        >
          <p className="mt-4 text-sm">
            <Link to="/public/feedback-geben" className="font-medium text-primary underline">
              {tx('Zum Feedback zur aktiven Interaktion')}
            </Link>
          </p>
        </SuccessStep>
      )}
    </IntentWizardShell>
  );
}
