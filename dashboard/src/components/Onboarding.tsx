import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

interface OnboardingProps {
  onDismiss: () => void;
}

type Step = 'welcome' | 'domain' | 'apikey' | 'ready';

const guardrails = ['autonomous', 'notify', 'approval_required'];

const API_URL = 'https://api.tasksforagents.com';

function SkillSnippet({ apiKey }: { apiKey: string }) {
  const snippet = `# In your Claude skill config or MCP settings:
# API URL: ${API_URL}/v1
# API Key: ${apiKey || '<your-api-key>'}

# Example: create a task
curl -X POST ${API_URL}/v1/tasks \\
  -H "Authorization: Bearer ${apiKey || '<your-api-key>'}" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Review PR #123","status":"pending"}'`;
  return snippet;
}

export default function Onboarding({ onDismiss }: OnboardingProps) {
  const [step, setStep] = useState<Step>('welcome');

  // Domain form
  const [domainName, setDomainName] = useState('');
  const [guardrail, setGuardrail] = useState('autonomous');
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainError, setDomainError] = useState('');

  // API key display
  const initialKey = localStorage.getItem('tfa_initial_api_key') || '';
  const [copied, setCopied] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);

  async function handleCreateDomain(e: FormEvent) {
    e.preventDefault();
    if (!domainName.trim()) return;
    setDomainLoading(true);
    setDomainError('');
    try {
      await api.createDomain({ name: domainName.trim(), default_guardrail: guardrail });
      setStep('apikey');
    } catch (err: unknown) {
      setDomainError(err instanceof Error ? err.message : 'Failed to create domain');
    } finally {
      setDomainLoading(false);
    }
  }

  function handleCopyKey() {
    if (!initialKey) return;
    navigator.clipboard.writeText(initialKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCopySnippet() {
    const snippet = SkillSnippet({ apiKey: initialKey });
    navigator.clipboard.writeText(snippet).then(() => {
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 2000);
    });
  }

  function handleFinish() {
    // Clear the initial API key from storage — it has been shown
    localStorage.removeItem('tfa_initial_api_key');
    onDismiss();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg w-full max-w-lg mx-4 p-8">
        {/* Progress dots */}
        <div className="flex items-center gap-2 mb-8">
          {(['welcome', 'domain', 'apikey', 'ready'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step
                  ? 'w-6 bg-[#f0f0f0]'
                  : (['welcome', 'domain', 'apikey', 'ready'] as Step[]).indexOf(step) > i
                  ? 'w-3 bg-[#4a4a4a]'
                  : 'w-3 bg-[#2a2a2a]'
              }`}
            />
          ))}
          <button
            onClick={onDismiss}
            className="ml-auto text-[#4a4a4a] hover:text-[#8a8a8a] text-xs font-mono cursor-pointer transition-colors"
          >
            skip
          </button>
        </div>

        {/* Step: Welcome */}
        {step === 'welcome' && (
          <div>
            <h2 className="font-mono text-xl font-bold text-[#f0f0f0] mb-3">
              Welcome to TasksForAgents
            </h2>
            <p className="text-sm font-mono text-[#8a8a8a] mb-4 leading-relaxed">
              TasksForAgents is a shared execution layer for AI agents. Agents claim tasks,
              update state, attach artifacts, and coordinate work — all through a simple API.
            </p>
            <p className="text-sm font-mono text-[#8a8a8a] mb-8 leading-relaxed">
              Let's get you set up in 3 quick steps: create a domain, grab your API key, and
              connect your first agent.
            </p>
            <button
              onClick={() => setStep('domain')}
              className="w-full bg-[#f0f0f0] text-[#0a0a0a] py-2.5 rounded font-mono text-sm font-bold hover:bg-white transition-colors cursor-pointer"
            >
              Get started →
            </button>
          </div>
        )}

        {/* Step: Domain */}
        {step === 'domain' && (
          <div>
            <h2 className="font-mono text-xl font-bold text-[#f0f0f0] mb-3">
              Create your first domain
            </h2>
            <p className="text-sm font-mono text-[#8a8a8a] mb-6 leading-relaxed">
              Domains group related tasks. A domain might represent a project, a team, or an
              area of work. You can create more later.
            </p>

            <form onSubmit={handleCreateDomain} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
                  Domain Name *
                </label>
                <input
                  type="text"
                  value={domainName}
                  onChange={e => setDomainName(e.target.value)}
                  placeholder="e.g. Work, Research, Side Projects"
                  required
                  autoFocus
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-[#f0f0f0] text-sm font-mono placeholder-[#4a4a4a] focus:outline-none focus:border-[#4a4a4a]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide mb-1.5">
                  Default Guardrail
                </label>
                <select
                  value={guardrail}
                  onChange={e => setGuardrail(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-2 text-[#f0f0f0] text-sm font-mono focus:outline-none focus:border-[#4a4a4a] cursor-pointer"
                >
                  {guardrails.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <p className="text-[10px] font-mono text-[#4a4a4a] mt-1.5">
                  autonomous = agents run freely · notify = agents send updates · approval_required = agents wait for approval
                </p>
              </div>

              {domainError && (
                <p className="text-red-400 text-sm font-mono">{domainError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('welcome')}
                  className="flex-1 border border-[#2a2a2a] text-[#8a8a8a] py-2 rounded font-mono text-sm hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={domainLoading || !domainName.trim()}
                  className="flex-1 bg-[#f0f0f0] text-[#0a0a0a] py-2 rounded font-mono text-sm font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {domainLoading ? '...' : 'Create Domain →'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step: API Key */}
        {step === 'apikey' && (
          <div>
            <h2 className="font-mono text-xl font-bold text-[#f0f0f0] mb-3">
              Your API key
            </h2>

            {initialKey ? (
              <>
                <div className="bg-amber-950/40 border border-amber-700/50 rounded-lg p-3 mb-4">
                  <p className="text-amber-400 text-xs font-mono font-bold uppercase tracking-wide mb-1">
                    Save this key now
                  </p>
                  <p className="text-amber-300/80 text-xs font-mono">
                    This is the only time the full key will be shown. Store it securely — you cannot retrieve it later.
                  </p>
                </div>

                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 mb-4 flex items-center gap-3">
                  <code className="font-mono text-sm text-[#f0f0f0] flex-1 break-all">{initialKey}</code>
                  <button
                    onClick={handleCopyKey}
                    className="text-[10px] font-mono text-[#8a8a8a] hover:text-[#f0f0f0] transition-colors cursor-pointer shrink-0 border border-[#2a2a2a] rounded px-2 py-1"
                  >
                    {copied ? 'copied!' : 'copy'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[#8a8a8a] text-sm font-mono mb-4">
                Your API key was generated at registration. Find it in Settings → API Keys or create a new one there.
              </p>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono text-[#8a8a8a] uppercase tracking-wide">
                  Skill.md / MCP setup snippet
                </p>
                <button
                  onClick={handleCopySnippet}
                  className="text-[10px] font-mono text-[#8a8a8a] hover:text-[#f0f0f0] transition-colors cursor-pointer border border-[#2a2a2a] rounded px-2 py-1"
                >
                  {snippetCopied ? 'copied!' : 'copy snippet'}
                </button>
              </div>
              <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 text-xs font-mono text-[#8a8a8a] overflow-x-auto whitespace-pre-wrap">
                {SkillSnippet({ apiKey: initialKey })}
              </pre>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setStep('domain')}
                className="flex-1 border border-[#2a2a2a] text-[#8a8a8a] py-2 rounded font-mono text-sm hover:text-[#f0f0f0] hover:border-[#4a4a4a] transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => setStep('ready')}
                className="flex-1 bg-[#f0f0f0] text-[#0a0a0a] py-2 rounded font-mono text-sm font-bold hover:bg-white transition-colors cursor-pointer"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Ready */}
        {step === 'ready' && (
          <div>
            <h2 className="font-mono text-xl font-bold text-[#f0f0f0] mb-3">
              You're ready
            </h2>
            <p className="text-sm font-mono text-[#8a8a8a] mb-6 leading-relaxed">
              Your domain is created and your API key is ready. Point your agents at the API
              and they'll start showing up here.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-start gap-3 text-sm font-mono">
                <span className="text-[#4a4a4a] shrink-0 mt-0.5">→</span>
                <span className="text-[#8a8a8a]">
                  <span className="text-[#f0f0f0]">Settings → API Keys</span> — create additional keys per agent
                </span>
              </div>
              <div className="flex items-start gap-3 text-sm font-mono">
                <span className="text-[#4a4a4a] shrink-0 mt-0.5">→</span>
                <span className="text-[#8a8a8a]">
                  <span className="text-[#f0f0f0]">Settings → Domains</span> — manage domains and guardrails
                </span>
              </div>
              <div className="flex items-start gap-3 text-sm font-mono">
                <span className="text-[#4a4a4a] shrink-0 mt-0.5">→</span>
                <span className="text-[#8a8a8a]">
                  The dashboard auto-refreshes as agents create and update tasks
                </span>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full bg-[#f0f0f0] text-[#0a0a0a] py-2.5 rounded font-mono text-sm font-bold hover:bg-white transition-colors cursor-pointer"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
