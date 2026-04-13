import SwiftUI

struct SectionHeaderView: View {
    let title: String
    var count: Int?

    var body: some View {
        HStack {
            Text(title)
                .font(.system(size: 10, design: .monospaced))
                .fontWeight(.semibold)
                .textCase(.uppercase)
                .tracking(2)
                .foregroundStyle(Color.textMuted)
            Spacer()
            if let count {
                Text("\(count) tasks")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.textDim)
            }
        }
    }
}
