import Foundation

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let name: String?
    let createdAt: Date?
}

struct AuthResponse: Codable {
    let user: User
    let token: String
    let apiKey: String?
    let apiKeyPrefix: String?
}

struct MeResponse: Codable {
    let user: User
    let apiKeys: [APIKeyInfo]
    let domains: [DomainSummary]

    struct APIKeyInfo: Codable, Identifiable {
        let id: String
        let name: String
        let keyPrefix: String
        let createdAt: Date?
    }

    struct DomainSummary: Codable, Identifiable {
        let id: String
        let name: String
        let createdAt: Date?
    }
}
