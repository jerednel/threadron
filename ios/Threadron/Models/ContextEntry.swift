import Foundation

struct ContextEntry: Codable, Identifiable {
    let id: String
    let taskId: String
    let type: ContextType
    let body: String
    let author: String
    let actorType: ActorType?
    let createdAt: Date?
    let updatedAt: Date?
}

struct ContextResponse: Codable {
    let context: [ContextEntry]
}
