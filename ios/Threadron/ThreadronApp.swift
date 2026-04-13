import SwiftUI

@main
struct ThreadronApp: App {
    @State private var authManager = AuthManager()
    @State private var taskStore = TaskStore()
    @State private var domainStore = DomainStore()
    @State private var agentStore = AgentStore()
    @State private var settingsStore = SettingsStore()
    @State private var inboxStore = InboxStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isAuthenticated {
                    if authManager.showOnboarding {
                        OnboardingView()
                    } else {
                        MainTabView()
                    }
                } else {
                    LoginView()
                }
            }
            .preferredColorScheme(.dark)
            .environment(authManager)
            .environment(taskStore)
            .environment(domainStore)
            .environment(agentStore)
            .environment(settingsStore)
            .environment(inboxStore)
            .task {
                await authManager.checkExistingSession()
            }
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            TaskBoardView()
                .tabItem {
                    Label("Tasks", systemImage: "checklist")
                }

            InboxView()
                .tabItem {
                    Label("Inbox", systemImage: "tray.and.arrow.down")
                }

            AgentListView()
                .tabItem {
                    Label("Agents", systemImage: "cpu")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
        }
        .tint(.textPrimary)
    }
}
