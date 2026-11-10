/**
 * Feedbacks zusammenfassen — 2-Schritt-Wizard mit Ergebnis in eigenem Tab.
 * Steps: 1) Interaktion wählen → 2) Prüfen & Zusammenfassung anlegen (Vorprompt, Feedbacks mit Kürzel, Endprompt);
 * danach Erfolgsseite: Text bearbeitbar in eigenem, bildschirmfüllendem Tab öffnen und kopieren.
 * Reads: interaktionen, feedbacks. Writes: zusammenfassungen (über den Flow-Hook useFeedbacksZusammenfassenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useMemo, useRef, useState } from 'react';
import { IconExternalLink, IconCopy } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { byIdFilter, refFilter, fieldText, fieldNumber, useLiveList } from '@/lib/journey';
import { useFeedbacksZusammenfassenFlow } from '@/lib/journey/flows/FeedbacksZusammenfassen';
import { tx } from '@/i18n';

export default function FeedbacksZusammenfassenPage() {
  const [step, setStep] = useState(1);
  // The compiled text is derived from records loaded AFTER the flow exists — compute reads it from here.
  const textRef = useRef('');

  const flow = useFeedbacksZusammenfassenFlow({
    steps: { interaktion: 1 },
    items: {
      interaktion: r => {
        const nr = fieldNumber(r, 'reihenfolge');
        const frage = fieldText(r, 'frage');
        return { id: r.id, title: nr != null ? `${nr}. ${frage}` : frage };
      },
    },
    where: { interaktion: r => r.fields.aktiv === true },
    compute: { zusammenfassungstext: () => textRef.current },
  });

  const form = flow.forms.zusammenfassungen;
  const interaktionId = (form.get('interaktion') as string | null) || '';

  const interaktionLive = useLiveList(flow.port, 'interaktionen', {
    intervalMs: 0,
    list: { filter: interaktionId ? byIdFilter(interaktionId) : undefined },
    enabled: Boolean(interaktionId),
  });
  const feedbackLive = useLiveList(flow.port, 'feedbacks', {
    intervalMs: 0,
    list: { filter: interaktionId ? refFilter('interaktion', interaktionId) : undefined, limit: 500 },
    enabled: Boolean(interaktionId),
  });

  const feedbacks = useMemo(
    () => [...feedbackLive.records].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')),
    [feedbackLive.records],
  );
  const interaktion = interaktionLive.records[0] ?? flow.picks.interaktion.recordOf(interaktionId);
  const ready = Boolean(interaktionId) && interaktionLive.loaded && feedbackLive.loaded;

  const text = useMemo(() => {
    if (!ready || !interaktion) return '';
    const parts: string[] = [];
    const vor = fieldText(interaktion, 'vorprompt').trim();
    if (vor) parts.push(vor);
    const lines = feedbacks.map(f => `${fieldText(f, 'kuerzel').trim()}: ${fieldText(f, 'feedbacktext').trim()}`);
    if (lines.length) parts.push(lines.join('\n\n'));
    const end = fieldText(interaktion, 'endprompt').trim();
    if (end) parts.push(end);
    return parts.join('\n\n');
  }, [ready, interaktion, feedbacks]);
  textRef.current = text;

  const openInTab = (content: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const doc = w.document;
    doc.title = tx('Zusammenfassung');
    doc.body.style.cssText = 'margin:0;display:flex;flex-direction:column;height:100vh;font-family:system-ui,sans-serif';
    const bar = doc.createElement('div');
    bar.style.cssText = tx('padding:8px 12px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #ddd');
    const area = doc.createElement('textarea');
    area.value = content;
    area.style.cssText = 'flex:1;width:100%;box-sizing:border-box;border:0;padding:16px;font-size:18px;line-height:1.5;resize:none;outline:none';
    const btn = doc.createElement('button');
    btn.textContent = tx('Text kopieren');
    btn.style.cssText = tx('padding:8px 14px;font-size:15px;cursor:pointer');
    const note = doc.createElement('span');
    btn.onclick = () => {
      area.select();
      const done = () => { note.textContent = tx('Kopiert!'); };
      if (w.navigator.clipboard) w.navigator.clipboard.writeText(area.value).then(done, () => { w.document.execCommand('copy'); done(); });
      else { w.document.execCommand('copy'); done(); }
    };
    bar.append(btn, note);
    doc.body.append(bar, area);
  };

  const copyText = (content: string) => {
    void navigator.clipboard?.writeText(content);
  };

  return (
    <IntentWizardShell
      title={tx('Feedbacks zusammenfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Alle Feedbacks einer Interaktion als ein Text für die KI.'),
        needs: [tx('Eine aktive Interaktion')],
      }}
    >
      <WizardStep label={tx('Interaktion')} description={tx('Zu welcher Interaktion sollen die Feedbacks zusammengeführt werden?')}>
        <EntitySelectStep
          {...flow.picks.interaktion.select}
          {...flow.pick('interaktion')}
          emptyText={tx('Keine aktive Interaktion vorhanden. Aktiviere zuerst eine Interaktion.')}
          searchPlaceholder={tx('Frage suchen …')}
        />
        <StepNav
          hideBack
          onNext={() => flow.validateStep(1)}
          nextStepLabel={tx('Prüfen')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')} needs={['interaktion']}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[
              {
                key: 'anzahl',
                label: tx('Feedbacks'),
                value: ready ? String(feedbacks.length) : tx('Wird geladen …'),
              },
            ]}
            whatHappensNext={tx('Vorprompt, alle Feedbacks mit Kürzel und der Endprompt werden zu einem Text zusammengeführt und gespeichert.')}
          >
            {ready && (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-secondary p-3 text-sm">
                {text || tx('Für diese Interaktion gibt es noch keinen Text.')}
              </pre>
            )}
          </SummaryStep>
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          title={tx('Zusammenfassung erstellt')}
          next={[
            { label: tx('Antwort der KI ablegen'), href: '#/intents/ki-antwort-ablegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Öffne den Text in eigenem Tab, bearbeite ihn und kopiere ihn in die KI.')}
        >
          <div className="mt-4 space-y-3">
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-secondary p-3 text-sm">
              {fieldText(flow.submit.result.primary, 'zusammenfassungstext') || text}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openInTab(fieldText(flow.submit.result!.primary, 'zusammenfassungstext') || text)}>
                <IconExternalLink size={16} className="shrink-0" />
                {tx('In eigenem Tab öffnen')}
              </Button>
              <Button variant="outline" onClick={() => copyText(fieldText(flow.submit.result!.primary, 'zusammenfassungstext') || text)}>
                <IconCopy size={16} className="shrink-0" />
                {tx('Text kopieren')}
              </Button>
            </div>
          </div>
        </SuccessStep>
      )}
    </IntentWizardShell>
  );
}
