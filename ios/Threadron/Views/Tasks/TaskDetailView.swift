import SwiftUI

struct TaskDetailView: View {
    let taskId: String
    @Environment(TaskStore.self) private var taskStore
    @Environment(DomainStore.self) private var domainStore
    @State private var isEditing = false
    @State private var editTitle = ""
    @State private var editStatus: TaskStatus = .pending
    @State private var editGoal = ""
    @State private var editCurrentState = ""
    @State private var editNextAction = ""
    @State private var editOutcome = ""
    @State private var editProjectId: String?
    @State private var editBlockers: [String] = []
    @State private var editTags: [String] = []
    @State private var newBlocker = ""
    @State private var newTag = ""
    @State private var showAddContext = false
    @State private var showAddArtifact = false
    @State private var isSaving = false
    @State private var showCopied = false

    private var task: TaskItem? {
        taskStore.tasks.first { $0.id == taskId }
    }

    var body: some View {
        ZStack {
            Color.bgPrimary.ignoresSafeArea()

            if let task {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        headerSection(task)
                        statusRow(task)
                        fieldCards(task)
                        tagsSection(task)
                        metadataRow(task)
                        blockersSection(task)
                        contextTimeline(task)
                        artifactsSection(task)
                    }
                    .padding(16)
                    .padding(.bottom, 32)
                }
            } else {
                ProgressView()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(isEditing ? "Done" : "Edit") {
                    if isEditing { Task { await save() } }
                    else { enterEditMode() }
                }
                .foregroundStyle(Color.linkBlue)
            }
        }
        .sheet(isPresented: $showAddContext) {
            AddContextView(taskId: taskId)
        }
        .sheet(isPresented: $showAddArtifact) {
            AddArtifactView(taskId: taskId)
        }
        .task {
            _ = await taskStore.fetchTaskDetail(id: taskId)
        }
    }

    // MARK: - Header
    @ViewBuilder
    private func headerSection(_ task: TaskItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            if isEditing {
                TextField("Title", text: $editTitle)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.textPrimary)
            } else {
                Text(task.title)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.textPrimary)
            }

            HStack(spacing: 8) {
                Button {
                    UIPasteboard.general.string = task.id
                    HapticManager.light()
                    showCopied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { showCopied = false }
                } label: {
                    Text(showCopied ? "Copied!" : "ID: \(task.id)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Color.textDim)
                }

                if let pid = task.projectId, let project = domainStore.projects.first(where: { $0.id == pid }) {
                    Text("· \(project.name)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Color.textDim)
                }
            }
        }
    }

    // MARK: - Status Row
    @ViewBuilder
    private func statusRow(_ task: TaskItem) -> some View {
        HStack(spacing: 8) {
            if isEditing {
                Menu {
                    ForEach(TaskStatus.allCases) { status in
                        Button(status.label) { editStatus = status }
                    }
                } label: {
                    BadgeView(text: editStatus.label, color: editStatus.color)
                }
            } else {
                BadgeView(text: task.status.label, color: task.status.color)
            }
            BadgeView(text: task.priority.rawValue, color: task.priority.color)
            if let conf = task.confidence {
                BadgeView(text: "confidence: \(conf.rawValue)", color: conf.color)
            }
        }
    }

    // MARK: - Field Cards
    @ViewBuilder
    private func fieldCards(_ task: TaskItem) -> some View {
        if isEditing {
            editableFieldCard("GOAL", text: $editGoal)
            editableFieldCard("CURRENT STATE", text: $editCurrentState)
            editableFieldCard("NEXT ACTION", text: $editNextAction, textColor: .priorityLow)
            editableFieldCard("OUTCOME DEFINITION", text: $editOutcome)

            // Project picker
            fieldCard("PROJECT") {
                Picker("Project", selection: $editProjectId) {
                    Text("None").tag(nil as String?)
                    ForEach(domainStore.projects.filter { $0.domainId == task.domainId }) { p in
                        Text(p.name).tag(p.id as String?)
                    }
                }
                .pickerStyle(.menu)
                .foregroundStyle(Color.textPrimary)
            }
        } else {
            readonlyFieldCard("GOAL", value: task.goal)
            readonlyFieldCard("CURRENT STATE", value: task.currentState, color: .textMuted)
            readonlyFieldCard("NEXT ACTION", value: task.nextAction, color: .priorityLow)
            readonlyFieldCard("OUTCOME DEFINITION", value: task.outcomeDefinition)
        }
    }

    // MARK: - Tags
    @ViewBuilder
    private func tagsSection(_ task: TaskItem) -> some View {
        let tags = isEditing ? editTags : (task.tags ?? [])
        if !tags.isEmpty || isEditing {
            VStack(alignment: .leading, spacing: 8) {
                FlowLayout(spacing: 6) {
                    ForEach(tags, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text("#\(tag)")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.textMuted)
                            if isEditing {
                                Button {
                                    editTags.removeAll { $0 == tag }
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 8, weight: .bold))
                                        .foregroundStyle(Color.textDim)
                                }
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.bgSurface)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Color.bgBorder, lineWidth: 1))
                    }
                }

                if isEditing {
                    HStack {
                        TextField("Add tag", text: $newTag)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.textPrimary)
                            .textInputAutocapitalization(.never)
                        Button("Add") {
                            let tag = newTag.trimmingCharacters(in: .whitespaces)
                            if !tag.isEmpty && !editTags.contains(tag) {
                                editTags.append(tag)
                                newTag = ""
                            }
                        }
                        .foregroundStyle(Color.linkBlue)
                        .font(.system(size: 13, weight: .semibold))
                    }
                    .padding(10)
                    .background(Color.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
                }
            }
        }
    }

    // MARK: - Metadata
    @ViewBuilder
    private func metadataRow(_ task: TaskItem) -> some View {
        HStack(spacing: 16) {
            if let assignee = task.assignee, !assignee.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("ASSIGNEE")
                        .font(.system(size: 9, design: .monospaced))
                        .textCase(.uppercase).tracking(1.5)
                        .foregroundStyle(Color.textDim)
                    Text(assignee)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textPrimary)
                }
            }
            if let claimed = task.claimedBy, !claimed.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("CLAIMED BY")
                        .font(.system(size: 9, design: .monospaced))
                        .textCase(.uppercase).tracking(1.5)
                        .foregroundStyle(Color.textDim)
                    Label(claimed, systemImage: "lock.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.textPrimary)
                }
            }
            Spacer()
        }
    }

    // MARK: - Blockers
    @ViewBuilder
    private func blockersSection(_ task: TaskItem) -> some View {
        let blockers = isEditing ? editBlockers : task.blockers
        if !blockers.isEmpty || isEditing {
            VStack(alignment: .leading, spacing: 8) {
                SectionHeaderView(title: "BLOCKERS")

                ForEach(Array(blockers.enumerated()), id: \.offset) { idx, blocker in
                    HStack {
                        Text("⊘ \(blocker)")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.priorityUrgent)
                        Spacer()
                        if isEditing {
                            Button {
                                editBlockers.remove(at: idx)
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(Color.textDim)
                            }
                        }
                    }
                }

                if isEditing {
                    HStack {
                        TextField("Add blocker", text: $newBlocker)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.textPrimary)
                        Button("Add") {
                            let b = newBlocker.trimmingCharacters(in: .whitespaces)
                            if !b.isEmpty {
                                editBlockers.append(b)
                                newBlocker = ""
                            }
                        }
                        .foregroundStyle(Color.linkBlue)
                        .font(.system(size: 13, weight: .semibold))
                    }
                    .padding(10)
                    .background(Color.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
                }
            }
        }
    }

    // MARK: - Context Timeline
    @ViewBuilder
    private func contextTimeline(_ task: TaskItem) -> some View {
        let entries = (task.context ?? []).sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }

        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeaderView(title: "CONTEXT TIMELINE")
                Spacer()
                Button {
                    showAddContext = true
                } label: {
                    Text("+ Add")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.linkBlue)
                }
            }

            if entries.isEmpty {
                Text("No context entries yet")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textDim)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(entries) { entry in
                        HStack(alignment: .top, spacing: 14) {
                            // Timeline line
                            Rectangle()
                                .fill(Color.bgBorder)
                                .frame(width: 2)

                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    BadgeView(text: entry.type.label, color: entry.type.color)
                                    Text("\(entry.actorType?.rawValue ?? "agent") · \(entry.createdAt?.timeAgo ?? "")")
                                        .font(.system(size: 10))
                                        .foregroundStyle(Color.textDim)
                                }
                                Text(entry.body)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color.textMuted)
                                    .lineSpacing(4)
                            }
                            .padding(.bottom, 14)
                        }
                    }
                }
                .padding(.leading, 4)
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Artifacts
    @ViewBuilder
    private func artifactsSection(_ task: TaskItem) -> some View {
        let artifacts = task.artifacts ?? []

        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeaderView(title: "ARTIFACTS")
                Spacer()
                Button {
                    showAddArtifact = true
                } label: {
                    Text("+ Add")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.linkBlue)
                }
            }

            if artifacts.isEmpty {
                Text("No artifacts yet")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.textDim)
            } else {
                VStack(spacing: 0) {
                    ForEach(artifacts) { artifact in
                        HStack(spacing: 10) {
                            Image(systemName: artifact.type.icon)
                                .font(.system(size: 14))
                                .foregroundStyle(Color.textMuted)
                                .frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(artifact.title ?? artifact.uri ?? "Untitled")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Color.textPrimary)
                                Text(artifact.type.rawValue)
                                    .font(.system(size: 10))
                                    .foregroundStyle(Color.textDim)
                            }
                            Spacer()
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)

                        if artifact.id != artifacts.last?.id {
                            Divider().background(Color.bgBorder).padding(.leading, 48)
                        }
                    }
                }
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Helpers

    private func enterEditMode() {
        guard let task else { return }
        editTitle = task.title
        editStatus = task.status
        editGoal = task.goal ?? ""
        editCurrentState = task.currentState ?? ""
        editNextAction = task.nextAction ?? ""
        editOutcome = task.outcomeDefinition ?? ""
        editProjectId = task.projectId
        editBlockers = task.blockers
        editTags = task.tags ?? []
        isEditing = true
    }

    private func save() async {
        isSaving = true
        var fields: [String: Any] = [
            "title": editTitle,
            "status": editStatus.rawValue,
            "goal": editGoal,
            "current_state": editCurrentState,
            "next_action": editNextAction,
            "outcome_definition": editOutcome,
            "blockers": editBlockers,
            "tags": editTags,
            "_actor": "ios-user",
            "_actor_type": "human",
        ]
        if let pid = editProjectId { fields["project_id"] = pid }
        _ = await taskStore.updateTask(id: taskId, fields: fields)
        HapticManager.success()
        isEditing = false
        isSaving = false
    }

    @ViewBuilder
    private func readonlyFieldCard(_ label: String, value: String?, color: Color = .textPrimary) -> some View {
        if let value, !value.isEmpty {
            fieldCard(label) {
                Text(value)
                    .font(.system(size: 13))
                    .foregroundStyle(color)
                    .lineSpacing(4)
            }
        }
    }

    private func editableFieldCard(_ label: String, text: Binding<String>, textColor: Color = .textPrimary) -> some View {
        fieldCard(label) {
            TextField(label, text: text, axis: .vertical)
                .font(.system(size: 13))
                .foregroundStyle(textColor)
                .lineLimit(1...6)
        }
    }

    private func fieldCard(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase)
                .tracking(1.5)
                .foregroundStyle(Color.textDim)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.bgBorder, lineWidth: 1))
    }
}

// MARK: - FlowLayout for tags

struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, subview) in subviews.enumerated() {
            let point = CGPoint(x: bounds.minX + result.positions[index].x, y: bounds.minY + result.positions[index].y)
            subview.place(at: point, anchor: .topLeading, proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (positions: [CGPoint], size: CGSize) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }

        return (positions, CGSize(width: maxWidth, height: y + rowHeight))
    }
}
