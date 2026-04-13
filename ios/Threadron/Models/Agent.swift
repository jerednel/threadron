import Foundation

struct Agent: Codable, Identifiable {
    let id: String
    let name: String
    let type: String
    let userId: String?
    let capabilities: [String]?
    let lastSeen: Date?
    let createdAt: Date?
    let updatedAt: Date?
}

struct AgentsResponse: Codable {
    let agents: [Agent]
}
