import Foundation

@MainActor
@Observable
final class TaskStore {
    var tasks: [TaskItem] = []
    var selectedDomain: Domain?
    var selectedProject: Project?
    var selectedTags: Set<String> = []
    var isLoading = false
    var error: String?

    private let api = APIClient.shared

    // MARK: - Filtered views

    private var filtered: [TaskItem] {
        tasks.filter { task in
            if let domain = selectedDomain, task.domainId != domain.id { return false }
            if let project = selectedProject, task.projectId != project.id { return false }
            if !selectedTags.isEmpty {
                let taskTags = Set(task.tags ?? [])
                if selectedTags.isDisjoint(with: taskTags) { return false }
            }
            return true
        }
    }

    var activeTasks: [TaskItem] {
        filtered.filter { $0.status == .inProgress || $0.status == .blocked }
    }

    var queueTasks: [TaskItem] {
        filtered.filter { $0.status == .pending }
    }

    var doneTasks: [TaskItem] {
        filtered.filter { $0.status == .completed || $0.status == .cancelled }
    }

    var allTags: [String] {
        let tagSets = tasks.compactMap(\.tags).flatMap { $0 }
        return Array(Set(tagSets)).sorted()
    }

    func grouped(_ tasks: [TaskItem], projects: [Project]) -> [(String?, [TaskItem])] {
        let projectMap = Dictionary(uniqueKeysWithValues: projects.map { ($0.id, $0.name) })
        let grouped = Dictionary(grouping: tasks) { task -> String? in
            task.projectId.flatMap { projectMap[$0] }
        }
        return grouped.sorted { a, b in
            switch (a.key, b.key) {
            case (nil, _): return false
            case (_, nil): return true
            case let (a?, b?): return a < b
            }
        }
    }

    // MARK: - CRUD

    func fetchTasks() async {
        isLoading = true
        do {
            let response: TasksResponse = try await api.request(.listTasks)
            tasks = response.tasks
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func fetchTaskDetail(id: String) async -> TaskItem? {
        do {
            let task: TaskItem = try await api.request(.getTask(id: id))
            if let idx = tasks.firstIndex(where: { $0.id == id }) {
                tasks[idx] = task
            }
            return task
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func createTask(_ fields: [String: Any]) async -> TaskItem? {
        do {
            let task: TaskItem = try await api.request(.createTask(fields))
            tasks.append(task)
            return task
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func updateTask(id: String, fields: [String: Any]) async -> TaskItem? {
        do {
            let updated: TaskItem = try await api.request(.updateTask(id: id, fields: fields))
            if let idx = tasks.firstIndex(where: { $0.id == id }) {
                var merged = updated
                merged.context = tasks[idx].context
                merged.artifacts = tasks[idx].artifacts
                tasks[idx] = merged
            }
            return updated
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func deleteTask(id: String) async {
        do {
            try await api.requestVoid(.deleteTask(id: id))
            tasks.removeAll { $0.id == id }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func addContext(taskId: String, type: String, body: String, author: String) async -> ContextEntry? {
        do {
            let entry: ContextEntry = try await api.request(.addContext(taskId: taskId, type: type, body: body, author: author))
            if let idx = tasks.firstIndex(where: { $0.id == taskId }) {
                if tasks[idx].context == nil { tasks[idx].context = [] }
                tasks[idx].context?.append(entry)
            }
            return entry
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func addArtifact(taskId: String, fields: [String: Any]) async -> Artifact? {
        do {
            let artifact: Artifact = try await api.request(.addArtifact(taskId: taskId, fields: fields))
            if let idx = tasks.firstIndex(where: { $0.id == taskId }) {
                if tasks[idx].artifacts == nil { tasks[idx].artifacts = [] }
                tasks[idx].artifacts?.append(artifact)
            }
            return artifact
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }
}
