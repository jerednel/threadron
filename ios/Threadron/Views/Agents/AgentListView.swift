import SwiftUI

struct AgentListView: View {
    @Environment(AgentStore.self) private var agentStore

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                if agentStore.agents.isEmpty && !agentStore.isLoading {
                    VStack(spacing: 8) {
                        Image(systemName: "cpu")
                            .font(.system(size: 32))
                            .foregroundStyle(Color.textDim)
                        Text("No agents registered")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.textDim)
                        Text("Agents register automatically when they connect")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.textDim)
                    }
                } else {
                    List {
                        ForEach(agentStore.agents) { agent in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(agent.name)
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(Color.textPrimary)
                                    HStack(spacing: 4) {
                                        Text(agent.type)
                                            .font(.system(size: 11))
                                            .foregroundStyle(Color.textDim)
                                        if let lastSeen = agent.lastSeen {
                                            Text("· Last seen \(lastSeen.timeAgo)")
                                                .font(.system(size: 11))
                                                .foregroundStyle(Color.textDim)
                                        }
                                    }
                                }
                                Spacer()
                                Circle()
                                    .fill(statusColor(for: agent))
                                    .frame(width: 8, height: 8)
                            }
                            .listRowBackground(Color.bgSurface)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Agents")
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .refreshable {
                await refresh()
            }
            .task {
                await refresh()
            }
        }
    }

    private func refresh() async {
        await agentStore.fetchAgents()
    }

    private func statusColor(for agent: Agent) -> Color {
        guard let lastSeen = agent.lastSeen else { return .textDim }
        let seconds = -lastSeen.timeIntervalSinceNow
        if seconds < 300 { return .priorityLow }       // < 5 min = green
        if seconds < 3600 { return .priorityMedium }    // < 1 hour = yellow
        return .textDim                                  // older = gray
    }
}
