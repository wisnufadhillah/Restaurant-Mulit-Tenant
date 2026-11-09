# PRD — Agno Playground

## Objective
Membangun lingkungan pengujian independen untuk mengembangkan dan mengevaluasi Agno sebelum diintegrasikan dengan AI Architecture RestaurantAI.

## Requirements

1. Playground memiliki antarmuka chat tersendiri dan berjalan tanpa ketergantungan pada NestJS atau chatbot production.
2. Menampilkan proses internal Agno, termasuk agent execution, tool calling, arguments, tool results, dan final response.
3. Memiliki execution trace untuk setiap interaksi.
4. Mendukung mock tools dan mock data untuk pengujian tanpa menyentuh production.
5. Memiliki scenario testing untuk menguji ketepatan perilaku agent.
6. Menyediakan evaluasi hasil PASS, FAIL, dan REVIEW.
7. Menyimpan riwayat pengujian agar hasil antar-model dan konfigurasi dapat dibandingkan.

## Constraints

- Jangan mengubah atau mengganggu `AI-PoweredRestaurant/lib/ai`.
- Jangan mengubah chatbot production maupun NestJS.
- Manfaatkan struktur Agno V2 yang sudah tersedia.
- Gunakan Agno sebagai agent runtime.
- Gunakan Python untuk pengembangan AI architecture baru.
- Hindari implementasi business logic ganda.
- Gunakan mock environment selama tahap pengujian awal.

## Development Scope

Kerjakan bertahap:

1. Independent Playground.
2. Agent & Tool Inspector.
3. Execution Trace.
4. Scenario Testing & Evaluation.
5. Persiapan integrasi dengan AI Architecture lama.

## Definition of Done

Agno dapat diuji secara mandiri, seluruh proses eksekusinya dapat diamati, dan hasilnya dapat dievaluasi tanpa melibatkan chatbot production.

**Catatan:** Fokus pada pembangunan Agno Playground terlebih dahulu. Jangan memulai migrasi keseluruhan AI Architecture sebelum playground siap digunakan.