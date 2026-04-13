import Foundation

@Observable
final class AgentStore {
    var agents: [Agent] = []
    var isLoading = false
    var error: String?

    private let api = APIClient.shared

    func fetchAgents() async {
        isLoading = true
        do {
            let response: AgentsResponse = try await api.request(.listAgents)
            agents = response.agents
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
