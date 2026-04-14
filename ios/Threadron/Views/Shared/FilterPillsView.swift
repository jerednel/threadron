import SwiftUI

struct FilterPillsView<Item: Identifiable & Hashable>: View {
    let items: [Item]
    let label: (Item) -> String
    let count: ((Item) -> Int)?
    @Binding var selected: Item?
    let allLabel: String

    init(
        items: [Item],
        label: @escaping (Item) -> String,
        count: ((Item) -> Int)? = nil,
        selected: Binding<Item?>,
        allLabel: String = "All"
    ) {
        self.items = items
        self.label = label
        self.count = count
        self._selected = selected
        self.allLabel = allLabel
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                pillButton(isSelected: selected == nil) {
                    selected = nil
                } label: {
                    Text(allLabel).fontWeight(.semibold)
                }

                ForEach(items) { item in
                    pillButton(isSelected: selected == item) {
                        selected = (selected == item) ? nil : item
                    } label: {
                        HStack(spacing: 4) {
                            Text(label(item))
                            if let count, count(item) > 0 {
                                Text("\(count(item))")
                                    .foregroundStyle(Color.textDim)
                                    .font(.system(size: 10))
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    @ViewBuilder
    private func pillButton(isSelected: Bool, action: @escaping () -> Void, @ViewBuilder label: () -> some View) -> some View {
        Button(action: action) {
            label()
                .font(.system(size: 12))
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .foregroundStyle(isSelected ? Color.bgPrimary : Color.textMuted)
                .background(isSelected ? Color.textPrimary : Color.bgSurface)
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(isSelected ? Color.clear : Color.bgBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}
