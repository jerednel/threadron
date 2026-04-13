import Foundation

enum HTTPMethod: String {
    case GET, POST, PATCH, DELETE
}

struct Endpoint: @unchecked Sendable {
    let path: String
    let method: HTTPMethod
    let body: [String: Any]?
    let queryItems: [URLQueryItem]?

    private init(_ path: String, _ method: HTTPMethod, body: [String: Any]? = nil, query: [URLQueryItem]? = nil) {
        self.path = path
        self.method = method
        self.body = body
        self.queryItems = query
    }

    // MARK: - Auth
    static func register(email: String, password: String, name: String) -> Endpoint {
        Endpoint("/users/register", .POST, body: ["email": email, "password": password, "name": name])
    }
    static func login(email: String, password: String) -> Endpoint {
        Endpoint("/users/login", .POST, body: ["email": email, "password": password])
    }
    static var me: Endpoint { Endpoint("/users/me", .GET) }

    // MARK: - Domains
    static var listDomains: Endpoint { Endpoint("/domains", .GET) }
    static func createDomain(name: String, guardrail: String? = nil) -> Endpoint {
        var body: [String: Any] = ["name": name]
        if let g = guardrail { body["default_guardrail"] = g }
        return Endpoint("/domains", .POST, body: body)
    }
    static func deleteDomain(id: String) -> Endpoint { Endpoint("/domains/\(id)", .DELETE) }

    // MARK: - Projects
    static func listProjects(domainId: String? = nil) -> Endpoint {
        var query: [URLQueryItem]? = nil
        if let d = domainId { query = [URLQueryItem(name: "domain_id", value: d)] }
        return Endpoint("/projects", .GET, query: query)
    }
    static func createProject(name: String, domainId: String, description: String? = nil) -> Endpoint {
        var body: [String: Any] = ["name": name, "domain_id": domainId]
        if let d = description { body["description"] = d }
        return Endpoint("/projects", .POST, body: body)
    }
    static func deleteProject(id: String) -> Endpoint { Endpoint("/projects/\(id)", .DELETE) }

    // MARK: - Tasks
    static var listTasks: Endpoint { Endpoint("/tasks", .GET) }
    static func getTask(id: String) -> Endpoint { Endpoint("/tasks/\(id)", .GET) }
    static func createTask(_ fields: [String: Any]) -> Endpoint {
        Endpoint("/tasks", .POST, body: fields)
    }
    static func updateTask(id: String, fields: [String: Any]) -> Endpoint {
        Endpoint("/tasks/\(id)", .PATCH, body: fields)
    }
    static func deleteTask(id: String) -> Endpoint { Endpoint("/tasks/\(id)", .DELETE) }

    // MARK: - Context
    static func addContext(taskId: String, type: String, body: String, author: String, actorType: String = "human") -> Endpoint {
        Endpoint("/tasks/\(taskId)/context", .POST, body: [
            "type": type, "body": body, "author": author, "actor_type": actorType
        ])
    }

    // MARK: - Artifacts
    static func addArtifact(taskId: String, fields: [String: Any]) -> Endpoint {
        Endpoint("/tasks/\(taskId)/artifacts", .POST, body: fields)
    }

    // MARK: - Agents
    static var listAgents: Endpoint { Endpoint("/agents", .GET) }

    // MARK: - API Keys
    static var listKeys: Endpoint { Endpoint("/auth/keys", .GET) }
    static func createKey(name: String?, agentId: String? = nil) -> Endpoint {
        var body: [String: Any] = [:]
        if let n = name { body["name"] = n }
        if let a = agentId { body["agent_id"] = a }
        return Endpoint("/auth/keys", .POST, body: body)
    }
    static func deleteKey(id: String) -> Endpoint { Endpoint("/auth/keys/\(id)", .DELETE) }

    // MARK: - Config
    static var listConfig: Endpoint { Endpoint("/config", .GET) }
    static func upsertConfig(key: String, value: Any) -> Endpoint {
        Endpoint("/config", .POST, body: ["key": key, "value": value])
    }
}
