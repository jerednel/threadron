import SwiftUI

struct NewAPIKeyView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(AgentStore.self) private var agentStore

    @State private var name = ""
    @State private var selectedAgentId: String?
    @State private var isCreating = false
    @State private var createdKey: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                VStack(spacing: 16) {
                    if let key = createdKey {
                        // Key reveal
                        VStack(spacing: 16) {
                            Image(systemName: "key.fill")
                                .font(.system(size: 32))
                                .foregroundStyle(Color.priorityLow)

                            Text("API Key Created")
                                .font(.system(size: 17, weight: .bold))
                                .foregroundStyle(Color.textPrimary)

                            Text("Copy this key now. It won't be shown again.")
                                .font(.system(size: 13))
                                .foregroundStyle(Color.textMuted)
                                .multilineTextAlignment(.center)

                            Text(key)
                                .font(.system(size: 13, design: .monospaced))
                                .foregroundStyle(Color.textPrimary)
                                .padding(14)
                                .background(Color.bgSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
                                .textSelection(.enabled)

                            Button {
                                UIPasteboard.general.string = key
                                HapticManager.light()
                            } label: {
                                Label("Copy to Clipboard", systemImage: "doc.on.doc")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Color.bgPrimary)
                                    .padding(.horizontal, 20)
                                    .padding(.vertical, 12)
                                    .background(Color.textPrimary)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                        .padding(24)
                    } else {
                        fieldGroup("NAME") {
                            TextField("Key name", text: $name)
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.never)
                        }

                        fieldGroup("AGENT (OPTIONAL)") {
                            Picker("Agent", selection: $selectedAgentId) {
                                Text("None").tag(nil as String?)
                                ForEach(agentStore.agents) { agent in
                                    Text(agent.name).tag(agent.id as String?)
                                }
                            }
                            .foregroundStyle(Color.textPrimary)
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Spacer()
                    }
                }
                .padding(16)
            }
            .navigationTitle(createdKey != nil ? "" : "New API Key")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(createdKey != nil ? "Done" : "Cancel") { dismiss() }
                        .foregroundStyle(Color.textDim)
                }
                if createdKey == nil {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Create") { Task { await create() } }
                            .foregroundStyle(Color.linkBlue)
                            .fontWeight(.semibold)
                            .disabled(isCreating)
                    }
                }
            }
        }
    }

    private func create() async {
        isCreating = true
        let keyName = name.isEmpty ? nil : name
        if let response = await settingsStore.createKey(name: keyName, agentId: selectedAgentId) {
            createdKey = response.apiKey
            HapticManager.success()
        }
        isCreating = false
    }

    @ViewBuilder
    private func fieldGroup(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase).tracking(1.5)
                .foregroundStyle(Color.textDim)
            content()
                .padding(14)
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
        }
    }
}
