import SwiftUI

struct InboxView: View {
    @Environment(InboxStore.self) private var inboxStore
    @Environment(DomainStore.self) private var domainStore
    @State private var showCapture = false
    @State private var recentExpanded = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        // Unprocessed + Processing + Error
                        let active = inboxStore.unprocessedItems + inboxStore.processingItems + inboxStore.errorItems
                        if !active.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                SectionHeaderView(title: "UNPROCESSED", count: active.count)
                                    .padding(.horizontal, 16)

                                ForEach(active) { item in
                                    InboxItemView(
                                        item: item,
                                        onPromote: { Task { await promote(item) } },
                                        onReject: { Task { await inboxStore.reject(id: item.id); HapticManager.warning() } }
                                    )
                                    .padding(.horizontal, 16)
                                }
                            }
                        }

                        // Parsed / Ready to Review
                        let parsed = inboxStore.parsedItems
                        if !parsed.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                SectionHeaderView(title: "READY TO REVIEW", count: parsed.count)
                                    .padding(.horizontal, 16)

                                ForEach(parsed) { item in
                                    InboxItemView(
                                        item: item,
                                        onPromote: { Task { await promote(item) } },
                                        onReject: { Task { await inboxStore.reject(id: item.id); HapticManager.warning() } }
                                    )
                                    .padding(.horizontal, 16)
                                }
                            }
                        }

                        // Empty state
                        if inboxStore.items.filter({ $0.status != .promoted && $0.status != .rejected }).isEmpty && !inboxStore.isLoading {
                            VStack(spacing: 8) {
                                Image(systemName: "tray")
                                    .font(.system(size: 32))
                                    .foregroundStyle(Color.textDim)
                                Text("Inbox is empty")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.textDim)
                                Text("Capture raw thoughts — structure comes later")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.textDim)
                            }
                            .padding(.top, 40)
                        }

                        // Recent (promoted / rejected) — collapsed
                        let recent = inboxStore.recentItems
                        if !recent.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Button { withAnimation { recentExpanded.toggle() } } label: {
                                    HStack {
                                        SectionHeaderView(title: "RECENT", count: recent.count)
                                        Image(systemName: recentExpanded ? "chevron.down" : "chevron.right")
                                            .font(.system(size: 12))
                                            .foregroundStyle(Color.textDim)
                                    }
                                    .padding(.horizontal, 16)
                                }
                                .buttonStyle(.plain)

                                if recentExpanded {
                                    ForEach(recent.prefix(10)) { item in
                                        InboxItemView(
                                            item: item,
                                            onPromote: {},
                                            onReject: {}
                                        )
                                        .padding(.horizontal, 16)
                                    }
                                }
                            }
                        }
                    }
                    .padding(.vertical, 8)
                    .padding(.bottom, 32)
                }
                .refreshable { await inboxStore.fetchItems() }
            }
            .navigationTitle("Inbox")
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showCapture = true
                    } label: {
                        Text("+ Capture")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.bgPrimary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Color.textPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
            .sheet(isPresented: $showCapture) {
                InboxCaptureView()
            }
            .task { await inboxStore.fetchItems() }
        }
    }

    private func promote(_ item: InboxItem) async {
        // Use parsed fields if available, otherwise just raw text as title
        let domainId = item.domainId ?? domainStore.domains.first?.id
        guard let domainId else {
            inboxStore.error = "No domain available. Create a domain first."
            return
        }

        if let _ = await inboxStore.promote(
            id: item.id,
            title: item.parsed?.title,
            nextAction: item.parsed?.nextAction,
            domainId: domainId,
            owner: item.parsed?.owner
        ) {
            HapticManager.success()
        }
    }
}
