import Foundation

@MainActor
@Observable
final class InboxStore {
    var items: [InboxItem] = []
    var isLoading = false
    var error: String?

    private let api = APIClient.shared

    var unprocessedItems: [InboxItem] { items.filter { $0.status == .unprocessed } }
    var processingItems: [InboxItem] { items.filter { $0.status == .processing } }
    var parsedItems: [InboxItem] { items.filter { $0.status == .parsed } }
    var recentItems: [InboxItem] { items.filter { $0.status == .promoted || $0.status == .rejected } }
    var errorItems: [InboxItem] { items.filter { $0.status == .error } }

    var activeCount: Int {
        items.filter { $0.status != .promoted && $0.status != .rejected }.count
    }

    var parsingMode: ParsingMode {
        get { ParsingMode.stored }
        set { ParsingMode.stored = newValue }
    }

    func fetchItems() async {
        isLoading = true
        do {
            let response: InboxResponse = try await api.request(.listInbox)
            items = response.items
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
        // Auto-parse unprocessed items if local/hybrid mode
        await autoParseUnprocessed()
    }

    func capture(rawText: String, domainId: String? = nil) async -> InboxItem? {
        do {
            let item: InboxItem = try await api.request(.captureInbox(rawText: rawText, domainId: domainId))
            items.insert(item, at: 0)

            // Auto-parse locally if mode is on-device or hybrid
            if parsingMode == .onDevice || parsingMode == .hybrid {
                await parseLocally(id: item.id)
            }

            return items.first(where: { $0.id == item.id }) ?? item
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    /// Process an unprocessed item locally
    func parseLocally(id: String) async {
        guard let item = items.first(where: { $0.id == id }) else { return }

        // Mark as processing
        _ = await updateItem(id: id, fields: ["status": "processing"])

        // Run local parser
        let result = LocalParser.parse(item.rawText)

        // Update with parsed results
        var fields: [String: Any] = [
            "status": "parsed",
            "parsed_title": result.title,
            "parsed_confidence": String(format: "%.2f", result.confidence),
        ]
        if let next = result.nextAction { fields["parsed_next_action"] = next }
        if let project = result.project { fields["parsed_project"] = project }

        _ = await updateItem(id: id, fields: fields)
    }

    /// Auto-parse any unprocessed items based on parsing mode
    func autoParseUnprocessed() async {
        guard parsingMode == .onDevice || parsingMode == .hybrid else { return }
        for item in unprocessedItems {
            await parseLocally(id: item.id)
        }
    }

    func updateItem(id: String, fields: [String: Any]) async -> InboxItem? {
        do {
            let item: InboxItem = try await api.request(.updateInboxItem(id: id, fields: fields))
            if let idx = items.firstIndex(where: { $0.id == id }) {
                items[idx] = item
            }
            return item
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func promote(id: String, title: String? = nil, nextAction: String? = nil, domainId: String? = nil, projectId: String? = nil, owner: String? = nil) async -> PromoteResponse? {
        do {
            var fields: [String: Any] = [:]
            if let t = title { fields["title"] = t }
            if let n = nextAction { fields["next_action"] = n }
            if let d = domainId { fields["domain_id"] = d }
            if let p = projectId { fields["project_id"] = p }
            if let o = owner { fields["owner"] = o }

            let response: PromoteResponse = try await api.request(.promoteInboxItem(id: id, fields: fields))
            if let idx = items.firstIndex(where: { $0.id == id }) {
                items[idx] = response.inboxItem
            }
            return response
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func reject(id: String) async {
        _ = await updateItem(id: id, fields: ["status": "rejected"])
    }

    func deleteItem(id: String) async {
        do {
            try await api.requestVoid(.deleteInboxItem(id: id))
            items.removeAll { $0.id == id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
