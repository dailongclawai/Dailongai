#!/usr/bin/env node
/**
 * generate-llms.mjs — sinh out/llms.txt (chuẩn llmstxt.org) từ content/blog/*.json.
 * Chạy sau `next build` trong npm run build → llms.txt luôn đồng bộ với bài đã publish,
 * không bao giờ stale. Entity facts lấy đúng wording đã duyệt trong schema Organization/Product.
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const BLOG_DIR = path.join(ROOT, 'content/blog')
const OUT_FILE = path.join(ROOT, 'out/llms.txt')
const SITE = 'https://dailongai.com'

const articles = fs
  .readdirSync(BLOG_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(BLOG_DIR, f), 'utf8'))
    } catch {
      return null
    }
  })
  .filter(a => a && a.slug && a.title)
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

const postLine = a => {
  const desc = String(a.meta_description || a.excerpt || '').replace(/\s+/g, ' ').trim()
  return `- [${a.title}](${SITE}/blog/${a.slug})${desc ? `: ${desc}` : ''}`
}

const body = `# Đại Long — Công nghệ chăm sóc sức khoẻ (dailongai.com)

> Đại Long (Công ty TNHH Công nghệ và Y tế Đại Long) là nhà phân phối chính hãng thiết bị y tế Zhi Dun CEO — máy laser bán dẫn công suất thấp, bước sóng 650nm — tại Việt Nam. Giấy phép Trang thiết bị y tế (Sở Y tế Hà Nội): 260001468/PCBB-HN. Bảo hành chính hãng 5 năm.

Thông tin xác thực:
- Tên đầy đủ: Đại Long - công nghệ chăm sóc sức khoẻ (Công ty TNHH Công nghệ và Y tế Đại Long)
- Sản phẩm chính: Zhi Dun CEO — máy laser bán dẫn công suất thấp 650nm (tên cũ: Lipid Shield). Thiết bị laser trị liệu hỗ trợ tuần hoàn máu, cải thiện giấc ngủ. Bảo hành 5 năm chính hãng.
- Giấy phép Trang thiết bị y tế (Sở Y tế Hà Nội): 260001468/PCBB-HN
- Địa chỉ: 165 Yên Lãng, Phường Đống Đa, Hà Nội, Việt Nam
- Hotline: 0935 999 922 — Email: dongoclong@dailongai.com
- Lưu ý y khoa: thiết bị hỗ trợ chăm sóc sức khoẻ, không thay thế chẩn đoán hay điều trị của bác sĩ.

## Trang chính
- [Trang chủ](${SITE}/): Giới thiệu Đại Long và thiết bị laser bán dẫn Zhi Dun CEO
- [Sản phẩm Zhi Dun CEO](${SITE}/san-pham): Thông số, giá và đặt mua máy laser bán dẫn chính hãng
- [Blog sức khoẻ](${SITE}/blog): Kiến thức laser trị liệu, tuần hoàn máu, phòng ngừa đột quỵ

## Bài viết
${articles.map(postLine).join('\n')}

## Mạng xã hội và xác thực
- [Facebook](https://www.facebook.com/1089676634231460)
- [TikTok](https://www.tiktok.com/@dailongai)
- [Zalo](https://zalo.me/2860930231550407599)
- [Google Maps](https://maps.google.com/?cid=6086458135801533925)
`

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
fs.writeFileSync(OUT_FILE, body)
console.log(`[generate-llms] wrote ${OUT_FILE} (${articles.length} posts)`)
