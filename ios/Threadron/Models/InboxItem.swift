import Foundation

enum InboxStatus: String, Codable, CaseIterable, Identifiable {
    case unprocessed, processing, parsed, promoted, rejected, error
    var id: String { rawValue }
}

struct ParsedInbox: Codable {
    let title: String?
    let nextAction: String?
    let project: String?
    let owner: String?
    let blockers: [String]?
    let confidence: Double?
}

struct InboxItem: Codable, Identifiable {
    let id: String
    var rawText: String
    let source: String
    var status: InboxStatus
    var domainId: String?
    var parsed: ParsedInbox?
    var promotedTaskId: String?
    var error: String?
    let createdBy: String
    let createdAt: Date?
    let updatedAt: Date?
}

struct InboxResponse: Codable {
    let items: [InboxItem]
}

struct PromoteResponse: Codable {
    let inboxItem: InboxItem
    let task: TaskItem
}
