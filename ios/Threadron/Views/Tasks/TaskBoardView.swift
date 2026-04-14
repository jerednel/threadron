import SwiftUI

struct TaskBoardView: View {
    @Environment(TaskStore.self) private var taskStore
    @Environment(DomainStore.self) private var domainStore
    @Environment(InboxStore.self) private var inboxStore
    @State private var showCapture = false
    @State private var selectedTaskId: String?
    @State private var doneExpanded = false

    var body: some View {
        @Bindable var store = taskStore
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 0) {
                        // Domain filter pills
                        FilterPillsView(
                            items: domainStore.domains,
                            label: { $0.name },
                            count: { domain in taskStore.tasks.filter { $0.domainId == domain.id }.count },
                            selected: $store.selectedDomain,
                            allLabel: "All"
                        )
                        .padding(.vertical, 8)

                        // Project filter pills
                        let relevantProjects = domainStore.projects.filter { p in
                            store.selectedDomain == nil || p.domainId == store.selectedDomain?.id
                        }
                        if !relevantProjects.isEmpty {
                            FilterPillsView(
                                items: relevantProjects,
                                label: { $0.name },
                                selected: $store.selectedProject,
                                allLabel: "All Projects"
                            )
                            .padding(.bottom, 4)
                        }

                        Divider().background(Color.bgBorder).padding(.bottom, 8)

                        // Inbox awareness banner
                        if inboxStore.activeCount > 0 {
                            Button {
                                // Switch to inbox tab
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "tray.and.arrow.down")
                                        .font(.system(size: 11))
                                        .foregroundStyle(Color.ctxProposal)
                                    Text("Inbox")
                                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                        .foregroundStyle(Color.ctxProposal)
                                    Text("·")
                                        .foregroundStyle(Color.textDim)
                                    Text("\(inboxStore.activeCount) items")
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundStyle(Color.textMuted)
                                    Spacer()
                                    Text("→")
                                        .font(.system(size: 11))
                                        .foregroundStyle(Color.textDim)
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 10)
                                .background(Color.ctxProposal.opacity(0.06))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.ctxProposal.opacity(0.15), lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .padding(.horizontal, 16)
                            .padding(.bottom, 8)
                        }

                        // Active section
                        activeSection

                        // Queue section
                        queueSection

                        // Done section
                        doneSection
                    }
                    .padding(.bottom, 32)
                }
                .refreshable { await refresh() }
            }
            .navigationTitle("Tasks")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showCapture = true
                    } label: {
                        Label("Capture", systemImage: "tray.and.arrow.down.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.bgPrimary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Color.textPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $showCapture) {
                InboxCaptureView()
            }
            .navigationDestination(item: $selectedTaskId) { taskId in
                TaskDetailView(taskId: taskId)
            }
            .task { await refresh() }
            .task { await inboxStore.fetchItems() }
        }
    }

    // MARK: - Active Section
    private var activeSection: some View {
        let active = taskStore.activeTasks
        let groups = taskStore.grouped(active, projects: domainStore.projects)

        return VStack(alignment: .leading, spacing: 8) {
            SectionHeaderView(title: "ACTIVE", count: active.count)
                .padding(.horizontal, 16)

            if active.isEmpty {
                emptyState("No active tasks")
            } else {
                ForEach(groups, id: \.0) { projectName, tasks in
                    if let name = projectName {
                        Text(name)
                            .font(.system(size: 10, design: .monospaced))
                            .textCase(.uppercase)
                            .tracking(1)
                            .foregroundStyle(Color.textDim)
                            .padding(.horizontal, 18)
                            .padding(.top, 4)
                    }
                    ForEach(tasks) { task in
                        Button { selectedTaskId = task.id } label: {
                            TaskCardView(task: task)
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 16)
                    }
                }
            }
        }
        .padding(.bottom, 16)
    }

    // MARK: - Queue Section
    private var queueSection: some View {
        let queue = taskStore.queueTasks
        let groups = taskStore.grouped(queue, projects: domainStore.projects)

        return VStack(alignment: .leading, spacing: 8) {
            SectionHeaderView(title: "READY", count: queue.count)
                .padding(.horizontal, 16)

            if queue.isEmpty {
                emptyState("No pending tasks")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(groups.enumerated()), id: \.offset) { _, group in
                        let (projectName, tasks) = group
                        if let name = projectName {
                            HStack {
                                Text(name)
                                    .font(.system(size: 10, design: .monospaced))
                                    .textCase(.uppercase)
                                    .tracking(1)
                                    .foregroundStyle(Color.textDim)
                                Spacer()
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 6)
                            .background(Color.bgPrimary)
                        }
                        ForEach(tasks) { task in
                            Button { selectedTaskId = task.id } label: {
                                TaskRowView(task: task)
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { await taskStore.deleteTask(id: task.id) }
                                    HapticManager.warning()
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            if task.id != tasks.last?.id {
                                Divider().background(Color.bgBorder).padding(.leading, 14)
                            }
                        }
                    }
                }
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.bgBorder, lineWidth: 1))
                .padding(.horizontal, 16)
            }
        }
        .padding(.bottom, 16)
    }

    // MARK: - Done Section
    private var doneSection: some View {
        let done = taskStore.doneTasks

        return VStack(alignment: .leading, spacing: 8) {
            Button { withAnimation { doneExpanded.toggle() } } label: {
                HStack {
                    SectionHeaderView(title: "DONE", count: done.count)
                    Image(systemName: doneExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textDim)
                }
                .padding(.horizontal, 16)
            }
            .buttonStyle(.plain)

            if doneExpanded {
                ForEach(done) { task in
                    Button { selectedTaskId = task.id } label: {
                        HStack(spacing: 10) {
                            Text(task.title)
                                .font(.system(size: 14))
                                .strikethrough(task.status == .completed)
                                .foregroundStyle(Color.textPrimary)
                                .lineLimit(1)
                            Spacer()
                            BadgeView(text: task.status.label, color: task.status.color)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                    .opacity(0.5)
                }
            }
        }
    }

    // MARK: - Helpers
    private func emptyState(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(Color.textDim)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [6]))
                    .foregroundStyle(Color.bgBorder)
            )
            .padding(.horizontal, 16)
    }

    private func refresh() async {
        async let t: () = taskStore.fetchTasks()
        async let d: () = domainStore.fetchDomains()
        async let p: () = domainStore.fetchProjects()
        _ = await (t, d, p)
    }
}
