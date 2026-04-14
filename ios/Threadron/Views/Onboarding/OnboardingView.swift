import SwiftUI

struct OnboardingView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(DomainStore.self) private var domainStore
    @State private var step = 0
    @State private var domainName = ""
    @State private var guardrail: Guardrail = .autonomous
    @State private var isCreating = false

    var body: some View {
        ZStack {
            Color.bgPrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress dots
                HStack(spacing: 8) {
                    ForEach(0..<4, id: \.self) { i in
                        Circle()
                            .fill(i <= step ? Color.textPrimary : Color.bgBorder)
                            .frame(width: 8, height: 8)
                    }
                }
                .padding(.top, 24)

                Spacer()

                switch step {
                case 0: welcomeStep
                case 1: domainStep
                case 2: apiKeyStep
                case 3: readyStep
                default: EmptyView()
                }

                Spacer()

                // Skip button
                if step < 3 {
                    Button("Skip Setup") {
                        finishOnboarding()
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textDim)
                    .padding(.bottom, 32)
                }
            }
            .padding(.horizontal, 24)
        }
    }

    // MARK: - Steps

    private var welcomeStep: some View {
        VStack(spacing: 16) {
            Text("threadron")
                .font(.system(size: 36, weight: .heavy))
                .tracking(-1)
                .foregroundStyle(Color.textPrimary)

            Text("Orchestrate AI agent tasks with clarity and control.")
                .font(.system(size: 15))
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            Text("Let's set up your workspace.")
                .font(.system(size: 13))
                .foregroundStyle(Color.textDim)
                .padding(.top, 8)

            primaryButton("Get Started") { step = 1 }
                .padding(.top, 24)
        }
    }

    private var domainStep: some View {
        VStack(spacing: 16) {
            Text("Create a Domain")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Color.textPrimary)

            Text("Domains organize your tasks by area (e.g., backend, infra, mobile).")
                .font(.system(size: 14))
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: 6) {
                Text("NAME")
                    .font(.system(size: 9, design: .monospaced))
                    .textCase(.uppercase).tracking(1.5)
                    .foregroundStyle(Color.textDim)
                TextField("e.g., backend", text: $domainName)
                    .foregroundStyle(Color.textPrimary)
                    .textInputAutocapitalization(.never)
                    .padding(14)
                    .background(Color.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("DEFAULT GUARDRAIL")
                    .font(.system(size: 9, design: .monospaced))
                    .textCase(.uppercase).tracking(1.5)
                    .foregroundStyle(Color.textDim)
                Picker("Guardrail", selection: $guardrail) {
                    ForEach(Guardrail.allCases) { g in
                        Text(g.label).tag(g)
                    }
                }
                .pickerStyle(.segmented)
            }

            primaryButton(isCreating ? "Creating..." : "Create Domain") {
                Task {
                    isCreating = true
                    if let _ = await domainStore.createDomain(name: domainName, guardrail: guardrail.rawValue) {
                        step = 2
                    }
                    isCreating = false
                }
            }
            .disabled(domainName.isEmpty || isCreating)
            .opacity(domainName.isEmpty ? 0.5 : 1)
            .padding(.top, 8)
        }
    }

    private var apiKeyStep: some View {
        VStack(spacing: 16) {
            Image(systemName: "key.fill")
                .font(.system(size: 32))
                .foregroundStyle(Color.priorityLow)

            Text("Your API Key")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Color.textPrimary)

            Text("Use this key to connect agents to Threadron.")
                .font(.system(size: 14))
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)

            if let key = auth.initialApiKey {
                Text(key)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(Color.textPrimary)
                    .padding(14)
                    .frame(maxWidth: .infinity)
                    .background(Color.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
                    .textSelection(.enabled)

                Button {
                    UIPasteboard.general.string = key
                    HapticManager.light()
                } label: {
                    Label("Copy Key", systemImage: "doc.on.doc")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.textPrimary)
                }
            }

            primaryButton("Next") { step = 3 }
                .padding(.top, 16)
        }
    }

    private var readyStep: some View {
        VStack(spacing: 16) {
            Text("You're All Set")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Color.textPrimary)

            VStack(alignment: .leading, spacing: 12) {
                tip("Create tasks from the Tasks tab or via the API")
                tip("Connect agents using your API key")
                tip("Monitor agent activity from the Agents tab")
            }
            .padding(.horizontal, 8)

            primaryButton("Start Using Threadron") {
                finishOnboarding()
            }
            .padding(.top, 16)
        }
    }

    // MARK: - Helpers

    private func finishOnboarding() {
        auth.onboardingComplete = true
        auth.showOnboarding = false
    }

    @ViewBuilder
    private func primaryButton(_ text: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text)
                .fontWeight(.bold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .foregroundStyle(Color.bgPrimary)
                .background(Color.textPrimary)
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    @ViewBuilder
    private func tip(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("→")
                .foregroundStyle(Color.priorityLow)
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Color.textMuted)
        }
    }
}
