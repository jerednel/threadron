import SwiftUI

struct TimeAgoText: View {
    let date: Date?

    var body: some View {
        Text(date?.timeAgo ?? "")
            .font(.system(size: 10))
            .foregroundStyle(Color.textDim)
    }
}
