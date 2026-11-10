/**
 * Antwort der KI ablegen — 3-Schritt-Wizard.
 * Steps: 1) Zusammenfassung wählen → 2) Antwort der KI einfügen → 3) Prüfen & ablegen.
 * Reads: zusammenfassungen (interaktion, zusammenfassungstext, ki_antwort, erstellt_am). Writes: zusammenfassungen.ki_antwort (update).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText } from '@/lib/journey';
import { useKiAntwortAblegenFlow } from '@/lib/journey/flows/KiAntwortAblegen';
import { tx } from '@/i18n';

function shorten(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max).trim()} …` : text;
}

export default function KiAntwortAblegenPage() {
  const [step, setStep] = useState(1);
  const flow = useKiAntwortAblegenFlow({
    steps: { zusammenfassungen: 1, ki_antwort: 2 },
    items: {
      zusammenfassungen: (r, ctx) => ({
        id: r.id,
        title: ctx.ref('interaktion') ?? tx('Zusammenfassung'),
        subtitle: shorten(fieldText(r, 'zusammenfassungstext')) || undefined,
      }),
    },
  });

  return (
    <IntentWizardShell
      title={tx('Antwort der KI ablegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Trage die Antwort des Chatbots bei der Zusammenfassung ein.'),
        needs: [tx('Die Antwort der KI als Text')],
      }}
    >
      <WizardStep label={tx('Zusammenfassung')} description={tx('Zu welcher Zusammenfassung gehört die Antwort?')}>
        <EntitySelectStep
          {...flow.picks.zusammenfassungen.select}
          {...flow.pick('zusammenfassungen')}
          searchPlaceholder={tx('Zusammenfassung suchen …')}
        />
      </WizardStep>
      <WizardStep
        label={tx('Antwort der KI')}
        description={tx('Füge die Antwort des Chatbots hier ein.')}
        needs={['zusammenfassungen']}
      >
        <div className="space-y-4">
          <Bound form={flow.forms.zusammenfassungen} name="ki_antwort" rows={10} />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Die Antwort wird bei der gewählten Zusammenfassung abgelegt.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Feedbacks zusammenfassen'), href: '#/intents/feedbacks-zusammenfassen' },
            { label: tx('Interaktion aktivieren'), href: '#/intents/interaktion-aktivieren' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
