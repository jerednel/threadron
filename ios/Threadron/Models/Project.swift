import Foundation

struct Project: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let domainId: String
    let description: String?
    let createdAt: Date?
    let updatedAt: Date?
}

struct ProjectsResponse: Codable {
    let projects: [Project]
}
