'use client';

import { useSyncExternalStore } from 'react';

// window.location chỉ tồn tại ở trình duyệt. Đọc qua useSyncExternalStore thay vì
// setState trong effect: không lệch giữa HTML dựng sẵn và lần hydrate đầu, và
// không tạo thêm một vòng render thừa.
//
// Portal là static export nên các trang này được dựng sẵn với chuỗi rỗng, rồi
// nhận giá trị thật ngay ở lần render đầu tiên phía client.

const subscribeNever = () => () => {};
const emptyString = () => '';

/** Origin hiện tại, hoặc chuỗi rỗng khi dựng sẵn. */
export function useOrigin(): string {
  return useSyncExternalStore(subscribeNever, () => window.location.origin, emptyString);
}

/** Query string hiện tại (kèm dấu ?), hoặc chuỗi rỗng khi dựng sẵn. */
export function useSearchString(): string {
  return useSyncExternalStore(subscribeNever, () => window.location.search, emptyString);
}
