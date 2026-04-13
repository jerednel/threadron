import SwiftUI

struct AddArtifactView: View {
    let taskId: String
    @Environment(\.dismiss) private var dismiss
    @Environment(TaskStore.self) private var taskStore

    @State private var type: ArtifactType = .doc
    @State private var title = ""
    @State private var uri = ""
    @State private var bodyText = ""
    @State private var createdBy = ""
    @State private var isSubmitting = false

    private var isValid: Bool { !createdBy.isEmpty && (!title.isEmpty || !uri.isEmpty) }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        fieldGroup("TYPE") {
                            Picker("Type", selection: $type) {
                                ForEach(ArtifactType.allCases) { t in
                                    Label(t.rawValue, systemImage: t.icon).tag(t)
                                }
                            }
                            .foregroundStyle(Color.textPrimary)
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        fieldGroup("TITLE") {
                            TextField("Artifact title", text: $title)
                                .foregroundStyle(Color.textPrimary)
                        }

                        fieldGroup("URI") {
                            TextField("URL or path", text: $uri)
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                        }

                        fieldGroup("BODY") {
                            TextField("Content...", text: $bodyText, axis: .vertical)
                                .foregroundStyle(Color.textPrimary)
                                .lineLimit(2...6)
                        }

                        fieldGroup("CREATED BY *") {
                            TextField("Your name", text: $createdBy)
                                .foregroundStyle(Color.textPrimary)
                                .textInputAutocapitalization(.never)
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Add Artifact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Color.textDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { Task { await submit() } }
                        .foregroundStyle(isValid ? Color.linkBlue : Color.textDim)
                        .fontWeight(.semibold)
                        .disabled(!isValid || isSubmitting)
                }
            }
        }
    }

    private func submit() async {
        isSubmitting = true
        var fields: [String: Any] = [
            "type": type.rawValue,
            "created_by": createdBy,
        ]
        if !title.isEmpty { fields["title"] = title }
        if !uri.isEmpty { fields["uri"] = uri }
        if !bodyText.isEmpty { fields["body"] = bodyText }

        if let _ = await taskStore.addArtifact(taskId: taskId, fields: fields) {
            HapticManager.success()
            dismiss()
        }
        isSubmitting = false
    }

    @ViewBuilder
    private func fieldGroup(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 9, design: .monospaced))
                .textCase(.uppercase).tracking(1.5)
                .foregroundStyle(Color.textDim)
            content()
                .padding(14)
                .background(Color.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.bgBorder, lineWidth: 1))
        }
    }
}
