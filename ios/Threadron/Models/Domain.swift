import Foundation

struct Domain: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let userId: String?
    let defaultGuardrail: String?
    let createdAt: Date?
    let updatedAt: Date?
}

struct DomainsResponse: Codable {
    let domains: [Domain]
}
