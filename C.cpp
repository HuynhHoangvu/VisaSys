#include <stdio.h>

#define IMPOSSIBLE -1

int minRefills(int x[], int n, int L) {
    int numRefills = 0;
    int currentRefill = 0;

    while (currentRefill <= n) {
        int lastRefill = currentRefill;

        // Đi xa nhất có thể trong phạm vi L
        while (currentRefill <= n && x[currentRefill + 1] - x[lastRefill] <= L) {
            currentRefill++;
        }

        // Không đi thêm được nữa → không thể tới đích
        if (currentRefill == lastRefill) {
            return IMPOSSIBLE;
        }

        // Nếu chưa tới đích thì phải đổ xăng
        if (currentRefill <= n) {
            numRefills++;
        }
    }

    return numRefills;
}

int main() {
    // Ví dụ:
    // A = 0, các trạm: 10, 20, 30, B = 40
    int x[] = {0, 10, 20, 30, 40};
    int n = 3;  // số trạm (không tính A và B)
    int L = 15; // xe đi tối đa 15 đơn vị

    int result = minRefills(x, n, L);

    if (result == IMPOSSIBLE) {
        printf("Khong the den dich\n");
    } else {
        printf("So lan do xang it nhat: %d\n", result);
    }

    return 0;
}