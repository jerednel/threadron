import SwiftUI

struct SettingsView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(DomainStore.self) private var domainStore
    @Environment(SettingsStore.self) private var settingsStore
    @State private var showNewDomain = false
    @State private var showNewKey = false
    @State private var showLogoutConfirm = false
    @State private var domainToDelete: Domain?
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
        }
    }
}
