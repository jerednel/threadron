import Foundation

struct Artifact: Codable, Identifiable {
    let id: String
    let taskId: String
    let type: ArtifactType
    let uri: String?
    let body: String?
    let title: String?
    let createdBy: String
    let metadata: [String: String]?
    let createdAt: Date?
}

struct ArtifactsResponse: Codable {
    let artifacts: [Artifact]
}
