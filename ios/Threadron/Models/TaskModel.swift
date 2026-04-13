import Foundation

struct TaskItem: Codable, Identifiable {
    let id: String
    var title: String
    var status: TaskStatus
    let domainId: String
    var projectId: String?
    var assignee: String?
    let createdBy: String
    var priority: Priority
    var guardrail: Guardrail?
    var dependencies: [String]?
    var dueDate: Date?
    var tags: [String]?
    var metadata: [String: String]?
    var goal: String?
    var currentState: String?
    var nextAction: String?
    var blockers: [String]
    var outcomeDefinition: String?
    var confidence: Confidence?
    var claimedBy: String?
    var claimExpiresAt: Date?
    let createdAt: Date?
    let updatedAt: Date?
    var context: [ContextEntry]?
    var artifacts: [Artifact]?
}

struct TasksResponse: Codable {
    let tasks: [TaskItem]
}
