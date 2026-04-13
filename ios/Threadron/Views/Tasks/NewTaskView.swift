import SwiftUI

struct NewTaskView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(TaskStore.self) private var taskStore
    @Environment(DomainStore.self) private var domainStore

    @State private var title = ""
    @State private var selectedDomain: Domain?
    @State private var selectedProject: Project?
    @State private var priority: Priority = .medium
    @State private var guardrail: Guardrail = .autonomous
    @State private var goal = ""
    @State private var assignee = ""
    @State private var tags = ""
    @State private var isCreating = false
    @State private var error: String?

    private var isValid: Bool {
        !title.isEmpty && selectedDomain != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        // Title
                        fieldGroup("TITLE *") {
                            TextField("Task title", text: $title)
                                .foregroundStyle(Color.textPrimary)
                        }

                        // Domain
                        fieldGroup("DOMAIN *") {
                            Picker("Domain", selection: $selectedDomain) {
                                Text("Select domain").tag(nil as Domain?)
                                ForEach(domainStore.domains) { d in
                                    Text(d.name).tag(d as Domain?)
                                }
                            }
                            .foregroundStyle(Color.textPrimary)
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        // Project + Priority
                        HStack(spacing: 12) {
                            fieldGroup("PROJECT") {
                                let projects = domainStore.projects.filter { $0.domainId == selectedDomain?.id }
                                Picker("Project", selection: $selectedProject) {
                                    Text("None").tag(nil as Project?)
                                    ForEach(projects) { p in
                                        Text(p.name).tag(p as Project?)
                                    }
                                }
                                .foregroundStyle(Color.textPrimary)
                                .pickerStyle(.menu)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            fieldGroup("PRIORITY") {
                                Picker("Priority", selection: $priority) {
                                    ForEach(Priority.allCases) { p in
                                        Text(p.rawValue).tag(p)
                                    }
                                }
                                .foregroundStyle(Color.textPrimary)
                                .pickerStyle(.menu)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }

                        // Guardrail
                        fieldGroup("GUARDRAIL") {
                            Picker("Guardrail", selection: $guardrail) {
                                ForEach(Guardrail.allCases) { g in
                                    Text(g.label).tag(g)
                                }
                            }
                            .foregroundStyle(Color.textPrimary)
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        // Goal
                        fieldGroup("GOAL") {
                            TextField("What should be achieved?", text: $goal, axis: .vertical)
                                .foregroundStyle(Color.textPrimary)
                                .lineLimit(2...5)
                        }

                        // Assignee
                        fieldGroup("ASSIGNEE") {
                            TextField("Agent or person", text: $assignee)
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.never)
                        }

                        // Tags
                        fieldGroup("TAGS") {
                            TextField("Comma-separated tags", text: $tags)
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.never)
                        }

                        if let error {
                            Text(error)
                                .font(.system(size: 13))
                                .foregroundStyle(Color.priorityUrgent)
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.textDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { await create() }
                    }
                    .foregroundStyle(isValid ? Color.linkBlue : Color.textDim)
                    .fontWeight(.semibold)
                    .disabled(!isValid || isCreating)
                }
            }
        }
    }

    @MainActor
    private func create() async {
        guard let domain = selectedDomain else { return }
        isCreating = true
        var fields: [String: Any] = [
            "title": title,
            "domain_id": domain.id,
            "status": "pending",
            "priority": priority.rawValue,
            "guardrail": guardrail.rawValue,
            "created_by": "ios-user",
        ]
        if let project = selectedProject { fields["project_id"] = project.id }
        if !goal.isEmpty { fields["goal"] = goal }
        if !assignee.isEmpty { fields["assignee"] = assignee }
        let tagList = tags.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if !tagList.isEmpty { fields["tags"] = tagList }

        if let _ = await taskStore.createTask(fields) {
            HapticManager.success()
            dismiss()
        } else {
            error = taskStore.error ?? "Failed to create task"
        }
        isCreating = false
    }

    @ViewBuilder
    private func fieldGroup(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase)
                .tracking(1.5)
                .foregroundStyle(Color.textDim)
            content()
                .padding(14)
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
        }
    }
}
