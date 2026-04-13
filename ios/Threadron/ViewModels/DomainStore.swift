import Foundation

@Observable
final class DomainStore {
    var domains: [Domain] = []
    var projects: [Project] = []
    var isLoading = false
    var error: String?

    private let api = APIClient.shared

    func fetchDomains() async {
        isLoading = true
        do {
            let response: DomainsResponse = try await api.request(.listDomains)
            domains = response.domains
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func fetchProjects() async {
        do {
            let response: ProjectsResponse = try await api.request(.listProjects())
            projects = response.projects
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createDomain(name: String, guardrail: String?) async -> Domain? {
        do {
            let domain: Domain = try await api.request(.createDomain(name: name, guardrail: guardrail))
            domains.append(domain)
            return domain
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func deleteDomain(id: String) async {
        do {
            try await api.requestVoid(.deleteDomain(id: id))
            domains.removeAll { $0.id == id }
            projects.removeAll { $0.domainId == id }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createProject(name: String, domainId: String, description: String? = nil) async -> Project? {
        do {
            let project: Project = try await api.request(.createProject(name: name, domainId: domainId, description: description))
            projects.append(project)
            return project
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func projectsForDomain(_ domainId: String) -> [Project] {
        projects.filter { $0.domainId == domainId }
    }
}
