'use client';

import { useApi } from '@/hooks/use-api';
import { Check, ExternalLink, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface GcpSetupGuideProps {
  connectionId: string;
  hasOrgId: boolean;
  onRunScan: () => void;
  isScanning: boolean;
}

interface SetupStep {
  id: string;
  name: string;
  success: boolean;
  error?: string;
  actionUrl?: string;
  actionText?: string;
  requiredForScan?: boolean;
}

const AUTO_FIX_ROLES = [
  { role: 'Storage Admin', scope: 'Cloud Storage fixes' },
  { role: 'Compute Security Admin', scope: 'Firewall and network fixes' },
  { role: 'Cloud SQL Admin', scope: 'Database configuration fixes' },
  { role: 'Cloud KMS Admin', scope: 'Encryption key fixes' },
];

export function GcpSetupGuide({
  connectionId,
  hasOrgId,
  onRunScan,
  isScanning,
}: GcpSetupGuideProps) {
  const api = useApi();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupResult, setSetupResult] = useState<{
    email: string | null;
    steps: SetupStep[];
    organizationId?: string;
  } | null>(null);

  const ranRef = useRef(false);

  // Auto-run setup on first mount
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    handleAutoSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAutoSetup = async () => {
    setIsSettingUp(true);
    try {
      const resp = await api.post<{
        email: string | null;
        steps: SetupStep[];
        organizationId?: string;
      }>(`/v1/cloud-security/setup-gcp/${connectionId}`, {});

      if (resp.error) {
        toast.error(typeof resp.error === 'string' ? resp.error : 'Setup failed');
        return;
      }

      if (resp.data) {
        setSetupResult(resp.data);
        const succeeded = resp.data.steps.filter((s) => s.success).length;
        const total = resp.data.steps.length;
        if (succeeded === total) {
          toast.success('GCP setup complete — running first scan...');
          onRunScan();
        } else {
          toast.message(`${succeeded}/${total} steps completed. See details below.`);
        }
      }
    } catch {
      toast.error('Setup failed');
    } finally {
      setIsSettingUp(false);
    }
  };

  const allStepsSucceeded = setupResult?.steps.every((s) => s.success);
  const failedSteps = setupResult?.steps.filter((s) => !s.success) ?? [];
  const failedRequiredSteps = failedSteps.filter((step) => step.requiredForScan !== false);
  const failedOptionalSteps = failedSteps.filter((step) => step.requiredForScan === false);
  const hasBlockingFailures = failedRequiredSteps.length > 0;
  const failedActionableSteps = failedSteps.filter(
    (step) => step.actionUrl && step.actionText,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Get started with GCP scanning</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            OAuth signs in your account, but GCP still requires org-level IAM/API access for Security Command Center. We&apos;ll try to set it up automatically first.
          </p>
        </div>

        {/* Auto-setup in progress */}
        {!setupResult && (
          <div className="space-y-3">
            <StepRow done label="Connected via OAuth" />
            {hasOrgId && <StepRow done label="Organization detected" />}

            <div className="flex items-center justify-center gap-2 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Setting up GCP scanning...</p>
            </div>
          </div>
        )}

        {/* Setup results */}
        {setupResult && (
          <div className="space-y-2">
            <StepRow done label="Connected via OAuth" />
            {setupResult.organizationId && (
              <StepRow done label={`Organization: ${setupResult.organizationId}`} />
            )}
            {setupResult.email && (
              <StepRow done label={`Account: ${setupResult.email}`} />
            )}
            {setupResult.steps.map((step) => (
              <StepRow
                key={step.id}
                done={step.success}
                failed={!step.success}
                optional={!step.success && step.requiredForScan === false}
                label={step.name}
                error={step.error}
              />
            ))}
          </div>
        )}

        {/* Manual fallback for failed steps */}
        {setupResult && !allStepsSucceeded && (
          <div
            className={`rounded-lg border p-3 ${
              hasBlockingFailures
                ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20'
                : 'border-primary/20 bg-primary/[0.05] dark:border-primary/30 dark:bg-primary/[0.1]'
            }`}
          >
            <p
              className={`mb-2 text-xs font-medium ${
                hasBlockingFailures
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-primary'
              }`}
            >
              {hasBlockingFailures
                ? 'Some required setup steps need manual action:'
                : 'Scan can still work. The remaining steps are optional for auto-setup:'}
            </p>
            <div className="space-y-1.5">
              {failedActionableSteps.length > 0 ? (
                failedActionableSteps.map((step) => (
                  <div key={step.id} className="flex items-center justify-between">
                    <span
                      className={`text-xs ${
                        step.requiredForScan === false
                          ? 'text-primary/80'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {step.name}
                    </span>
                    <a
                      href={step.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      {step.actionText} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                ))
              ) : (
                <p
                  className={`text-xs ${
                    hasBlockingFailures
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-primary/80'
                  }`}
                >
                  {hasBlockingFailures
                    ? 'Fix the required permissions in your GCP console, then retry setup.'
                    : 'Optional setup steps can be skipped if scanning already works.'}
                </p>
              )}
            </div>
            {!hasBlockingFailures && failedOptionalSteps.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Optional steps improve automatic setup and future onboarding, but they are not required for reading findings.
              </p>
            )}
          </div>
        )}

        {/* Run scan button — only shown if setup partially failed */}
        {setupResult && !allStepsSucceeded && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleAutoSetup}
              disabled={isSettingUp}
              className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {isSettingUp ? 'Retrying setup...' : 'Retry setup'}
            </button>
            <button
              type="button"
              onClick={onRunScan}
              disabled={isScanning}
              className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {isScanning
                ? 'Scanning...'
                : hasBlockingFailures
                  ? 'Try Scanning Anyway'
                  : 'Run Scan'}
            </button>
          </div>
        )}
      </div>

      {/* Auto-fix roles info */}
      <details className="rounded-xl border">
        <summary className="cursor-pointer px-5 py-3 text-sm font-medium hover:bg-muted/30 transition-colors">
          Optional: IAM roles for auto-fix
        </summary>
        <div className="px-5 pb-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            Auto-fix requires additional IAM roles. These are only needed when applying fixes — scanning works without them.
            We&apos;ll show the exact <code className="font-mono">gcloud</code> command when a fix needs a missing permission.
          </p>
          <div className="space-y-1.5">
            {AUTO_FIX_ROLES.map((r) => (
              <div key={r.role} className="flex items-center justify-between text-xs">
                <code className="font-mono text-[11px]">{r.role}</code>
                <span className="text-muted-foreground">{r.scope}</span>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

function StepRow({
  done,
  failed,
  optional,
  label,
  error,
}: {
  done?: boolean;
  failed?: boolean;
  optional?: boolean;
  label: string;
  error?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5 ${
          done
            ? 'bg-primary/10'
            : optional
              ? 'bg-amber-100 dark:bg-amber-900/30'
              : failed
              ? 'bg-red-100 dark:bg-red-900/30'
              : 'border border-muted-foreground/30'
        }`}
      >
        {done && <Check className="h-3 w-3 text-primary" />}
        {failed && <X className={`h-3 w-3 ${optional ? 'text-amber-600' : 'text-red-500'}`} />}
      </div>
      <div>
        <p
          className={`text-sm ${
            done
              ? 'text-muted-foreground'
              : optional
                ? 'text-amber-800 dark:text-amber-300'
                : failed
                  ? 'text-foreground'
                  : 'font-medium'
          }`}
        >
          {label}
        </p>
        {error && (
          <p className={`mt-0.5 text-[11px] ${optional ? 'text-amber-700 dark:text-amber-400' : 'text-red-500'}`}>{error}</p>
        )}
      </div>
    </div>
  );
}
