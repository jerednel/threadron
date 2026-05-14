import SwiftUI

struct SettingsView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(DomainStore.self) private var domainStore
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(InboxStore.self) private var inboxStore
    @State private var showNewDomain = false
    @State private var showNewProject = false
    @State private var showNewKey = false
    @State private var showLogoutConfirm = false
    @State private var domainToDelete: Domain?
    @State private var projectToDelete: Project?
    @State private var keyToDelete: APIKeyItem?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                List {
                    // Account
                    Section {
                        HStack {
                            Text("Email")
                                .foregroundStyle(Color.textPrimary)
                            Spacer()
                            Text(auth.currentUser?.email ?? "")
                                .foregroundStyle(Color.textDim)
                        }
                        .listRowBackground(Color.bgSurface)

                        HStack {
                            Text("Face ID")
                                .foregroundStyle(Color.textPrimary)
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { auth.biometricEnabled },
                                set: { auth.biometricEnabled = $0 }
                            ))
                            .labelsHidden()
                        }
                        .listRowBackground(Color.bgSurface)
                    } header: {
                        Text("ACCOUNT")
                            .font(.system(size: 10, design: .monospaced))
                            .tracking(1.5)
                    }

                    // Parsing
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Picker("Mode", selection: Binding(
                                get: { inboxStore.parsingMode },
                                set: { inboxStore.parsingMode = $0 }
                            )) {
                                ForEach(ParsingMode.allCases) { mode in
                                    VStack(alignment: .leading) {
                                        Text(mode.label)
                                    }
                                    .tag(mode)
                                }
                            }
                            .foregroundStyle(Color.textPrimary)
                            .listRowBackground(Color.bgSurface)

                            Text(inboxStore.parsingMode.description)
                                .font(.system(size: 11))
                                .foregroundStyle(Color.textDim)
                        }
                        .listRowBackground(Color.bgSurface)
                    } header: {
                        Text("INBOX PARSING")
                            .font(.system(size: 10, design: .monospaced))
                            .tracking(1.5)
                    }

                    // Domains
                    Section {
                        ForEach(domainStore.domains) { domain in
                            HStack {
                                Text(domain.name)
                                    .foregroundStyle(Color.textPrimary)
                                Spacer()
                                Text(domain.defaultGuardrail ?? "autonomous")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.textDim)
                            }
                            .listRowBackground(Color.bgSurface)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    domainToDelete = domain
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }

                        Button {
                            showNewDomain = true
                        } label: {
                            Text("+ Add Domain")
                                .foregroundStyle(Color.linkBlue)
                        }
                        .listRowBackground(Color.bgSurface)
                    } header: {
                        Text("DOMAINS")
                            .font(.system(size: 10, design: .monospaced))
                            .tracking(1.5)
                    }

                    // Projects
                    Section {
                        ForEach(domainStore.projects) { project in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(project.name)
                                        .foregroundStyle(Color.textPrimary)
                                    if let domain = domainStore.domains.first(where: { $0.id == project.domainId }) {
                                        Text(domain.name)
                                            .font(.system(size: 11))
                                            .foregroundStyle(Color.textDim)
                                    }
                                }
                                Spacer()
                            }
                            .listRowBackground(Color.bgSurface)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    projectToDelete = project
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }

                        Button {
                            showNewProject = true
                        } label: {
                            Text("+ Add Project")
                                .foregroundStyle(domainStore.domains.isEmpty ? Color.textDim : Color.linkBlue)
                        }
                        .disabled(domainStore.domains.isEmpty)
                        .listRowBackground(Color.bgSurface)
                    } header: {
                        Text("PROJECTS")
                            .font(.system(size: 10, design: .monospaced))
                            .tracking(1.5)
                    } footer: {
                        if domainStore.domains.isEmpty {
                            Text("Create a domain before adding projects.")
                                .foregroundStyle(Color.textDim)
                        }
                    }

                    // API Keys
                    Section {
                        ForEach(settingsStore.apiKeys) { key in
                            HStack {
                                Text(key.name)
                                    .foregroundStyle(Color.textPrimary)
                                Spacer()
                                Text(key.keyPrefix ?? "...")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundStyle(Color.textDim)
                            }
                            .listRowBackground(Color.bgSurface)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    keyToDelete = key
                                } label: {
                                    Label("Revoke", systemImage: "trash")
                                }
                            }
                        }

                        Button {
                            showNewKey = true
                        } label: {
                            Text("+ Create Key")
                                .foregroundStyle(Color.linkBlue)
                        }
                        .listRowBackground(Color.bgSurface)
                    } header: {
                        Text("API KEYS")
                            .font(.system(size: 10, design: .monospaced))
                            .tracking(1.5)
                    }

                    // Sign Out
                    Section {
                        Button {
                            showLogoutConfirm = true
                        } label: {
                            Text("Sign Out")
                                .foregroundStyle(Color.priorityUrgent)
                                .frame(maxWidth: .infinity, alignment: .center)
                        }
                        .listRowBackground(Color.bgSurface)
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Settings")
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $showNewDomain) {
                NewDomainView()
            }
            .sheet(isPresented: $showNewProject) {
                NewProjectView()
            }
            .sheet(isPresented: $showNewKey) {
                NewAPIKeyView()
            }
            .alert("Delete Domain?", isPresented: Binding(
                get: { domainToDelete != nil },
                set: { if !$0 { domainToDelete = nil } }
            )) {
                Button("Cancel", role: .cancel) { domainToDelete = nil }
                Button("Delete", role: .destructive) {
                    if let domain = domainToDelete {
                        let store = domainStore
                        Task { await store.deleteDomain(id: domain.id) }
                        HapticManager.warning()
                    }
                    domainToDelete = nil
                }
            } message: {
                Text("This will also delete all projects and tasks in this domain.")
            }
            .alert("Delete Project?", isPresented: Binding(
                get: { projectToDelete != nil },
                set: { if !$0 { projectToDelete = nil } }
            )) {
                Button("Cancel", role: .cancel) { projectToDelete = nil }
                Button("Delete", role: .destructive) {
                    if let project = projectToDelete {
                        let store = domainStore
                        Task { await store.deleteProject(id: project.id) }
                        HapticManager.warning()
                    }
                    projectToDelete = nil
                }
            } message: {
                Text("Tasks in this project will be kept and moved to no project.")
            }
            .alert("Revoke API Key?", isPresented: Binding(
                get: { keyToDelete != nil },
                set: { if !$0 { keyToDelete = nil } }
            )) {
                Button("Cancel", role: .cancel) { keyToDelete = nil }
                Button("Revoke", role: .destructive) {
                    if let key = keyToDelete {
                        let store = settingsStore
                        Task { await store.deleteKey(id: key.id) }
                        HapticManager.warning()
                    }
                    keyToDelete = nil
                }
            } message: {
                Text("Any agents using this key will lose access.")
            }
            .alert("Sign Out?", isPresented: $showLogoutConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Sign Out", role: .destructive) { auth.logout() }
            }
            .task { [settingsStore] in
                await settingsStore.fetchKeys()
            }
            .task { [domainStore] in
                await domainStore.fetchDomains()
                await domainStore.fetchProjects()
            }
        }
    }
}

private struct NewProjectView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(DomainStore.self) private var domainStore

    @State private var name = ""
    @State private var selectedDomainId = ""
    @State private var description = ""
    @State private var isCreating = false

    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !selectedDomainId.isEmpty &&
        !isCreating
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                VStack(spacing: 16) {
                    fieldGroup("NAME *") {
                        TextField("Project name", text: $name)
                            .foregroundStyle(Color.textPrimary)
                            .textInputAutocapitalization(.words)
                    }

                    fieldGroup("DOMAIN *") {
                        Picker("Domain", selection: $selectedDomainId) {
                            ForEach(domainStore.domains) { domain in
                                Text(domain.name).tag(domain.id)
                            }
                        }
                        .foregroundStyle(Color.textPrimary)
                        .pickerStyle(.menu)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    fieldGroup("DESCRIPTION") {
                        TextField("Optional", text: $description, axis: .vertical)
                            .foregroundStyle(Color.textPrimary)
                            .lineLimit(3...6)
                    }

                    Spacer()
                }
                .padding(16)
            }
            .navigationTitle("New Project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Color.textDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await create() } }
                        .foregroundStyle(canCreate ? Color.linkBlue : Color.textDim)
                        .fontWeight(.semibold)
                        .disabled(!canCreate)
                }
            }
            .task {
                if domainStore.domains.isEmpty {
                    await domainStore.fetchDomains()
                }
                if selectedDomainId.isEmpty {
                    selectedDomainId = domainStore.domains.first?.id ?? ""
                }
            }
        }
    }

    private func create() async {
        isCreating = true
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        let project = await domainStore.createProject(
            name: trimmedName,
            domainId: selectedDomainId,
            description: trimmedDescription.isEmpty ? nil : trimmedDescription
        )
        if project != nil {
            HapticManager.success()
            dismiss()
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
