import Foundation

struct APIKeyItem: Codable, Identifiable {
    let id: String
    let name: String
    let agentId: String?
    let keyPrefix: String?
    let createdAt: Date?
}

struct APIKeysResponse: Codable {
    let keys: [APIKeyItem]
}

struct APIKeyCreateResponse: Codable {
    let id: String
    let apiKey: String
    let name: String
    let agentId: String?
}
