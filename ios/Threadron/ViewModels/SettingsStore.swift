import Foundation

@Observable
final class SettingsStore {
    var apiKeys: [APIKeyItem] = []
    var isLoading = false
    var error: String?

    private let api = APIClient.shared

    func fetchKeys() async {
        do {
            let response: APIKeysResponse = try await api.request(.listKeys)
            apiKeys = response.keys
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createKey(name: String?, agentId: String? = nil) async -> APIKeyCreateResponse? {
        do {
            let response: APIKeyCreateResponse = try await api.request(.createKey(name: name ?? "ios-key", agentId: agentId))
            await fetchKeys()
            return response
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func deleteKey(id: String) async {
        do {
            try await api.requestVoid(.deleteKey(id: id))
            apiKeys.removeAll { $0.id == id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
