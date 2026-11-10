/**
 * Interaktion aktivieren — 3-Schritt-Wizard.
 * Steps: 1) Veranstaltung wählen → 2) Interaktion wählen → 3) Prüfen & aktivieren;
 * danach öffnet die Erfolgsseite den QR-Code zum Feedback-Formular in einem eigenen Tab.
 * Reads: veranstaltungen, interaktionen. Writes: interaktionen (aktiv).
 * Composes: IntentWizardShell, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IconQrcode } from '@tabler/icons-react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Button } from '@/components/ui/button';
import { useLiveList, fieldText, fieldDate, fieldRef, fieldNumber } from '@/lib/journey';
import { useInteraktionAktivierenFlow } from '@/lib/journey/flows/InteraktionAktivieren';
import { tx } from '@/i18n';

export default function InteraktionAktivierenPage() {
  const [step, setStep] = useState(1);
  const [eventId, setEventId] = useState<string | null>(null);

  const flow = useInteraktionAktivierenFlow({
    steps: { interaktionen: 2 },
    items: {
      interaktionen: r => ({
        id: r.id,
        title: `${fieldNumber(r, 'reihenfolge') ?? '?'}. ${fieldText(r, 'frage')}`,
        subtitle: fieldText(r, 'erlaeuterung') || undefined,
        status: r.fields.aktiv ? { key: 'aktiv', label: tx('Aktiv') } : undefined,
      }),
    },
    where: { interaktionen: r => !eventId || fieldRef(r, 'veranstaltung') === eventId },
  });

  const events = useLiveList(flow.port, 'veranstaltungen', { intervalMs: 0 });
  const eventItems = events.records.map(v => ({
    id: v.id,
    title: fieldText(v, 'titel'),
    subtitle: fieldDate(v, 'datum') ?? undefined,
  }));

  const qrUrl = (id: string) =>
    `${window.location.origin}${window.location.pathname}#/ansicht/qr-feedback?record=${id}`;

  return (
    <IntentWizardShell
      title={tx('Interaktion aktivieren')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{ description: tx('Genau eine Interaktion ist aktiv — danach zeigst du den QR-Code.'), needs: [tx('Die Veranstaltung'), tx('Die Interaktion, die jetzt laufen soll')] }}
    >
      <WizardStep label={tx('Veranstaltung')} description={tx('Für welche Veranstaltung willst du eine Interaktion starten?')}>
        <EntitySelectStep
          items={eventItems}
          totalCount={eventItems.length}
          loading={events.loading && !events.loaded}
          error={events.error ? events.error.message : null}
          create={false}
          avatar="none"
          searchPlaceholder={tx('Veranstaltung suchen …')}
          selectedId={eventId}
          onSelect={id => {
            if (id !== eventId) flow.forms.interaktionen.reset();
            setEventId(id);
            setStep(2);
          }}
        />
      </WizardStep>
      <WizardStep label={tx('Interaktion')} description={tx('Welche Interaktion soll jetzt aktiv sein?')}>
        {eventId ? (
          <EntitySelectStep
            {...flow.picks.interaktionen.select}
            {...flow.pick('interaktionen')}
            avatar="none"
            emptyText={tx('Diese Veranstaltung hat noch keine Interaktion.')}
          />
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
          </StepNav>
        )}
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            confirmLabel={tx('Jetzt aktivieren')}
            whatHappensNext={tx('Die gewählte Interaktion wird aktiv, die bisher aktive der Veranstaltung wird inaktiv.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          undo={flow.undo}
          title={tx('Interaktion aktiv')}
          whatHappensNext={tx('Öffne den QR-Code in einem eigenen Tab und zeige ihn auf dem Bildschirm.')}
          next={[
            { label: tx('Feedbacks zusammenfassen'), href: '#/intents/feedbacks-zusammenfassen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        >
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => window.open(qrUrl(flow.submit.result!.primary.id), '_blank', 'noopener')}
          >
            <IconQrcode size={18} className="shrink-0" />
            {tx('QR-Code in eigenem Tab öffnen')}
          </Button>
        </SuccessStep>
      )}
    </IntentWizardShell>
  );
}
