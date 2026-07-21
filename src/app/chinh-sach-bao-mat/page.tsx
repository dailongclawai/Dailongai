import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ZaloButton from "@/components/ZaloButton";

export const metadata: Metadata = {
  title: "Chính sách bảo mật | Đại Long",
  description:
    "Chính sách bảo mật của Công ty TNHH Công nghệ và Y tế Đại Long — cam kết bảo vệ dữ liệu cá nhân khách hàng theo Nghị định 13/2023/NĐ-CP.",
  alternates: { canonical: "/chinh-sach-bao-mat" },
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <Header />
      <ZaloButton />
      <main className="min-h-screen pt-24 sm:pt-28 pb-24 px-5 sm:px-8 lg:px-12 2xl:px-20">
        <article className="max-w-3xl mx-auto prose prose-invert prose-headings:font-headline">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tighter mb-4 font-headline">
            Chính sách bảo mật
          </h1>
          <p className="text-secondary text-sm uppercase tracking-[0.2em] mb-8">
            Cập nhật lần cuối: 09/05/2026
          </p>

          <p>
            Công ty TNHH Công nghệ và Y tế Đại Long (sau đây gọi là &ldquo;Đại Long&rdquo;,
            &ldquo;chúng tôi&rdquo;) cam kết bảo vệ dữ liệu cá nhân của khách hàng truy
            cập website <strong>dailongai.com</strong> theo Nghị định 13/2023/NĐ-CP về
            Bảo vệ dữ liệu cá nhân và các quy định pháp luật Việt Nam liên quan.
          </p>

          <h2>1. Phạm vi áp dụng</h2>
          <p>
            Chính sách này áp dụng cho mọi khách hàng, đối tác truy cập website
            dailongai.com, sử dụng biểu mẫu liên hệ, đăng ký tư vấn, mua sản phẩm
            Zhi Dun CEO hoặc trao đổi qua kênh Zalo OA chính thức của Đại Long.
          </p>

          <h2>2. Dữ liệu cá nhân thu thập</h2>
          <ul>
            <li>
              <strong>Thông tin liên hệ:</strong> họ tên, số điện thoại, địa chỉ email,
              địa chỉ giao hàng (khi khách điền form tư vấn hoặc đặt mua).
            </li>
            <li>
              <strong>Thông tin sức khỏe (nếu có):</strong> mô tả triệu chứng, mục đích
              sử dụng thiết bị laser trị liệu — chỉ thu thập khi khách chủ động cung cấp
              để được tư vấn phù hợp.
            </li>
            <li>
              <strong>Dữ liệu kỹ thuật:</strong> địa chỉ IP, loại trình duyệt, thiết bị,
              thời gian truy cập, trang đã xem, thông qua Google Analytics và Cloudflare.
            </li>
            <li>
              <strong>Cookie & pixel quảng cáo:</strong> Google Ads, Facebook Pixel,
              Eclick để đo lường hiệu quả quảng cáo.
            </li>
          </ul>

          <h2>3. Mục đích sử dụng dữ liệu</h2>
          <ul>
            <li>Liên hệ tư vấn sản phẩm, dịch vụ theo yêu cầu của khách.</li>
            <li>Xử lý đơn hàng, giao hàng, bảo hành, chăm sóc sau bán.</li>
            <li>Cải thiện chất lượng website, sản phẩm và trải nghiệm người dùng.</li>
            <li>
              Gửi thông tin khuyến mãi, cập nhật sản phẩm — chỉ khi khách đã đồng ý.
            </li>
            <li>Tuân thủ nghĩa vụ pháp lý (kế toán, thuế, khiếu nại).</li>
          </ul>

          <h2>4. Bên thứ ba được chia sẻ dữ liệu</h2>
          <p>
            Đại Long chỉ chia sẻ dữ liệu cá nhân với các đơn vị sau, trong phạm vi cần
            thiết để vận hành dịch vụ:
          </p>
          <ul>
            <li>
              <strong>Đối tác vận chuyển:</strong> Giao Hàng Nhanh, Viettel Post (chỉ
              tên, SĐT, địa chỉ giao hàng).
            </li>
            <li>
              <strong>Nền tảng quảng cáo & phân tích:</strong> Google (Analytics, Ads),
              Meta (Facebook Pixel), Zalo OA, Eclick.
            </li>
            <li>
              <strong>Hạ tầng kỹ thuật:</strong> Cloudflare (CDN, hosting), Supabase
              (cơ sở dữ liệu), Anthropic, OpenAI (AI hỗ trợ tư vấn).
            </li>
            <li>
              <strong>Cơ quan nhà nước:</strong> khi có yêu cầu hợp pháp bằng văn bản.
            </li>
          </ul>
          <p>
            Đại Long <strong>không bán, không cho thuê</strong> dữ liệu cá nhân của
            khách hàng cho bất kỳ bên thứ ba nào vì mục đích thương mại.
          </p>

          <h2>5. Thời gian lưu trữ</h2>
          <ul>
            <li>Dữ liệu liên hệ: 03 năm kể từ lần tương tác cuối, hoặc đến khi khách yêu cầu xóa.</li>
            <li>Dữ liệu đơn hàng: 10 năm theo Luật Kế toán Việt Nam.</li>
            <li>Cookie phân tích: tối đa 24 tháng.</li>
          </ul>

          <h2>6. Quyền của chủ thể dữ liệu</h2>
          <p>Theo Nghị định 13/2023/NĐ-CP, khách hàng có quyền:</p>
          <ul>
            <li>Được biết về việc xử lý dữ liệu cá nhân của mình.</li>
            <li>Yêu cầu truy cập, chỉnh sửa, xoá dữ liệu cá nhân.</li>
            <li>Hạn chế hoặc phản đối việc xử lý dữ liệu.</li>
            <li>Rút lại sự đồng ý đã cung cấp bất cứ lúc nào.</li>
            <li>Khiếu nại với cơ quan có thẩm quyền nếu quyền bị xâm phạm.</li>
          </ul>

          <h3>6.1. Quy trình yêu cầu xoá dữ liệu cá nhân</h3>
          <p>
            Khách hàng có thể yêu cầu Đại Long xoá toàn bộ dữ liệu cá nhân theo
            <strong> Điều 16 Nghị định 13/2023/NĐ-CP</strong> bằng một trong các kênh:
          </p>
          <ul>
            <li>
              <strong>Email:</strong>{" "}
              <a href="mailto:dongoclong@dailongai.com?subject=%5BXOA%20DU%20LIEU%5D">
                dongoclong@dailongai.com
              </a>{" "}
              với tiêu đề <code>[XOA DU LIEU]</code>.
            </li>
            <li>
              <strong>Hotline:</strong> 0935 999 922 (giờ làm việc 9:00 – 22:00).
            </li>
            <li>
              <strong>Zalo OA Đại Long:</strong> nhắn tin trực tiếp với từ khoá
              &ldquo;Yêu cầu xoá dữ liệu&rdquo;.
            </li>
          </ul>
          <p>Quy trình xử lý:</p>
          <ol>
            <li>
              <strong>Tiếp nhận &amp; xác minh danh tính:</strong> Đại Long yêu cầu khách
              cung cấp ≥1 dấu hiệu xác thực (số điện thoại đã đăng ký, email đã liên hệ,
              hoặc câu trả lời xác minh) để tránh yêu cầu giả mạo.
            </li>
            <li>
              <strong>Rà soát dữ liệu:</strong> Đại Long tra cứu toàn bộ hệ thống lưu
              trữ (cơ sở dữ liệu Zalo, hồ sơ tư vấn, dữ liệu trên hạ tầng đối tác) để
              xác định phạm vi dữ liệu cần xoá.
            </li>
            <li>
              <strong>Thực thi xoá:</strong> Xoá vĩnh viễn dữ liệu trong các kho lưu
              trữ thuộc quyền kiểm soát của Đại Long.
            </li>
            <li>
              <strong>Thông báo hoàn tất:</strong> Đại Long phản hồi khách hàng qua
              kênh đã yêu cầu trong vòng <strong>30 ngày</strong> kể từ ngày tiếp nhận
              yêu cầu hợp lệ.
            </li>
          </ol>
          <p>
            <strong>Ngoại lệ KHÔNG xoá</strong> theo Điều 17.1 Nghị định 13/2023:
            dữ liệu giao dịch tài chính / hợp đồng (lưu theo Luật Kế toán),
            dữ liệu phục vụ thi hành quyết định của cơ quan nhà nước có thẩm quyền,
            dữ liệu nhật ký kiểm toán phục vụ chứng minh tuân thủ. Đại Long sẽ phản hồi
            rõ lý do nếu không thể thực hiện xoá toàn bộ.
          </p>

          <h2>7. Bảo mật dữ liệu</h2>
          <p>
            Đại Long áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ dữ
            liệu cá nhân, gồm: mã hoá kết nối HTTPS/TLS, kiểm soát truy cập theo vai trò,
            sao lưu định kỳ, giám sát bảo mật 24/7. Tuy nhiên, không có hệ thống nào
            tuyệt đối an toàn — khách hàng có trách nhiệm bảo vệ thông tin đăng nhập của mình.
          </p>

          <h2>8. Cookie</h2>
          <p>
            Website sử dụng cookie để ghi nhớ thiết lập, đo lường hiệu quả quảng cáo và
            cải thiện trải nghiệm. Khách hàng có thể tắt cookie qua cài đặt trình duyệt;
            một số tính năng có thể không hoạt động đầy đủ khi tắt cookie.
          </p>

          <h2>9. Trẻ em dưới 16 tuổi</h2>
          <p>
            Website không hướng đến trẻ em dưới 16 tuổi. Trường hợp phát hiện dữ liệu
            của trẻ em được thu thập không có sự đồng ý của cha mẹ hoặc người giám hộ,
            chúng tôi sẽ xóa ngay khi nhận được thông báo.
          </p>

          <h2>10. Cập nhật chính sách</h2>
          <p>
            Đại Long có thể cập nhật Chính sách bảo mật này theo thời gian. Phiên bản
            mới nhất luôn được công bố tại trang này kèm ngày cập nhật.
          </p>

          <h2>11. Liên hệ</h2>
          <p>
            Mọi yêu cầu liên quan đến dữ liệu cá nhân, vui lòng gửi đến:
          </p>
          <ul>
            <li>
              <strong>Công ty TNHH Công nghệ và Y tế Đại Long</strong>
            </li>
            <li>Địa chỉ: 165 Yên Lãng, Đống Đa, Hà Nội</li>
            <li>Hotline: 0935 999 922</li>
            <li>Email: <a href="mailto:dongoclong@dailongai.com">dongoclong@dailongai.com</a></li>
          </ul>
        </article>
      </main>
      <Footer />
    </>
  );
}
