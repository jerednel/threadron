import SwiftUI

struct NewDomainView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(DomainStore.self) private var domainStore

    @State private var name = ""
    @State private var guardrail: Guardrail = .autonomous
    @State private var isCreating = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgPrimary.ignoresSafeArea()

                VStack(spacing: 16) {
                    fieldGroup("NAME *") {
                        TextField("Domain name", text: $name)
                            .foregroundStyle(Color.textPrimary)
                            .textInputAutocapitalization(.never)
                    }

                    fieldGroup("DEFAULT GUARDRAIL") {
                        Picker("Guardrail", selection: $guardrail) {
                            ForEach(Guardrail.allCases) { g in
                                Text(g.label).tag(g)
                            }
                        }
                        .foregroundStyle(Color.textPrimary)
                        .pickerStyle(.menu)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Spacer()
                }
                .padding(16)
            }
            .navigationTitle("New Domain")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bgPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Color.textDim)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await create() } }
                        .foregroundStyle(!name.isEmpty ? Color.linkBlue : Color.textDim)
                        .fontWeight(.semibold)
                        .disabled(name.isEmpty || isCreating)
                }
            }
        }
    }

    private func create() async {
        isCreating = true
        if let _ = await domainStore.createDomain(name: name, guardrail: guardrail.rawValue) {
            HapticManager.success()
            dismiss()
        }
        isCreating = false
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
