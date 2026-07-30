/* ============================================================
   critters.js — มินิเกม "สัตว์ป่วนหน้าเว็บ"  (KUJU)

   แนวคิด: คล้าย Desktop Destroyer แต่แทนที่จะทุบจอ
   เราปล่อยสัตว์ตัวน้อยๆ ออกมาเดินเล่น วิ่งวน ป่วนหน้าเว็บแทน

   - โมเดลเป็น 3D จริง (Three.js) ประกอบจากทรงพื้นฐาน สไตล์ chibi cel-shaded
   - มุมกล้องเป็นแบบ 2.5D: กล้อง orthographic แมป 1 หน่วย = 1 พิกเซล
     แล้วเอียงตัวสัตว์ลงมา ~23° เพื่อให้ได้มุมมอง 3/4 น่ารักๆ
   - สัตว์เดินสุ่มอิสระ หลบ/ปีนกล่อง UI จริง และตอบสนองเมาส์
   - ให้อาหารได้ (ลากขนมจากชาม) โยนของเล่นให้ไล่ได้ และมันแอบกัดการ์ดเล่นด้วย

   โครงไฟล์:
     1. ค่าคงที่          8. ตัวสร้างโมเดลสัตว์
     2. ตารางสัตว์        9. เอฟเฟกต์ (หัวใจ ดาว กลีบซากุระ)
     3. ข้อความ 2 ภาษา   10. ของบนพื้น (อาหาร / ของเล่น)
     4. ตัวช่วย          11. ตัวสัตว์ + สมองน้อยๆ
     5. ตรวจ WebGL       12. กล่อง UI ที่ต้องหลบ/กัด
     6. ฉาก กล้อง แสง    13. เมาส์
     7. วัสดุ + เรขาคณิต  14. ลูปหลัก  15. แผงควบคุม

   อยากเพิ่มสัตว์ → เพิ่มใน SPECIES (ข้อ 2) ไม่ต้องแตะโค้ดส่วนอื่น
   ============================================================ */

(function () {
  "use strict";

  /* ============================================================
     1. ค่าคงที่หลัก
     ============================================================ */
  const TILT = 0.40;                 // มุมเอียงตัวสัตว์ (เรเดียน) ≈ 23°
  const SIN_TILT = Math.sin(TILT);
  const SIZE = 1.35;                 // ตัวคูณขนาดรวมทุกตัว
  const MAX_CRITTERS = 40;           // เพดานจำนวนตัว กัน FPS ตก
  const MAX_PROPS = 14;              // เพดานของที่วางบนพื้น (อาหาร+ของเล่น)
  const AVOID_MIN_WIDTH = 760;       // จอแคบกว่านี้ ปล่อยให้เดินทับการ์ดได้เลย

  /* อารมณ์: mood ลดลง MOOD_DECAY ต่อวินาที
     ลูบหัวครั้งนึงดีใจได้ ≈ MOOD_PET / MOOD_DECAY วินาที (ตอนนี้ ~11 วิ)
     อยากให้ดีใจนานขึ้นอีก → ลด MOOD_DECAY หรือเพิ่ม MOOD_PET */
  const MOOD_DECAY = 0.38;
  const MOOD_PET = 4.2;              // ลูบหัว
  const MOOD_EAT = 3.4;              // กินขนม
  const MOOD_PLAY = 2.4;             // เล่นของเล่น
  const MOOD_NUZZLE = 2.0;           // อ้อนเมาส์
  const FED_TIME = 16;               // อิ่มแล้วขี้เล่นขึ้นกี่วินาที
  const OBSTACLE_SELECTOR = ".section, .topbar, #critter-dock";
  const CHEWABLE_SELECTOR = ".section";   // การ์ดที่ยอมให้แทะเล่นได้
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============================================================
     2. ตารางสัตว์ — หัวใจของเกม
     ---------------------------------------------------------
     ทุกตัวใช้โครงร่างเดียวกัน (ลำตัว หัว หู ตา ขา หาง)
     แล้วปรับสัดส่วน/สี/ของแถม (extras) ให้ต่างกัน

     variants = สีย่อยของสัตว์ชนิดนั้น เกิดมาแล้วสุ่มได้หลายสี
                ระบบจะพยายามเลือกสีที่ยังไม่มีบนจอก่อนเสมอ
     ============================================================ */
  const SPECIES = [
    /* ---------- สัตว์เลี้ยง / สัตว์บ้าน ---------- */
    {
      id: "cat", emoji: "🐱", name: { en: "Cat", th: "แมว" },
      scale: 1.00, gait: "walk",
      color: { main: 0xf0b878, belly: 0xfff1de, inner: 0xffb3c6, nose: 0xff8fa3, dark: 0x8a5a33 },
      body: { w: 15, h: 13, d: 20 }, head: { r: 14, y: 25, z: -8 },
      snout: { r: 6.5, z: -11, y: -3 },
      ears: { type: "triangle", size: 7, spread: 8, tilt: 0.15 },
      eyes: { r: 2.6, spread: 6, y: 2, z: -12 },
      legs: { count: 4, len: 9, r: 2.6, spread: 7, front: 6, back: -7 },
      tail: { type: "long", len: 22, r: 1.8, curl: 0.9 },
      extras: ["whiskers"],
      trait: { speed: 78, curiosity: 0.7, energy: 0.6, naughty: 0.8 },
      variants: [
        { id: "ginger" },
        { id: "grey", color: { main: 0x9aa2ad, belly: 0xe8ecf1, dark: 0x5d646d } },
        { id: "black", color: { main: 0x3b3742, belly: 0x5a545f, dark: 0x201d25 } },
        { id: "white", color: { main: 0xfaf7f2, belly: 0xffffff, dark: 0xd8d2c8 } },
        { id: "siamese", color: { main: 0xe8dccb, belly: 0xfff8ec, dark: 0x5a4436 } },
        { id: "pink", color: { main: 0xf7c2d4, belly: 0xfff0f5, dark: 0xc2778f } }
      ]
    },
    {
      id: "shiba", emoji: "🐕", name: { en: "Shiba", th: "ชิบะ" },
      scale: 1.05, gait: "walk",
      color: { main: 0xdb9b56, belly: 0xfff4e3, inner: 0xffc2ce, nose: 0x3a2b23, dark: 0x8a5a2b },
      body: { w: 16, h: 14, d: 21 }, head: { r: 14.5, y: 26, z: -8 },
      snout: { r: 7, z: -12, y: -3.5 },
      ears: { type: "triangle", size: 7.5, spread: 8.5, tilt: 0.1 },
      eyes: { r: 2.6, spread: 6.2, y: 2, z: -12.5 },
      legs: { count: 4, len: 9.5, r: 3, spread: 7.5, front: 6.5, back: -7 },
      tail: { type: "curl", len: 12, r: 4.2 },
      extras: ["browSpots"],
      trait: { speed: 88, curiosity: 1.0, energy: 0.85, naughty: 0.7 },
      variants: [
        { id: "red" },
        { id: "cream", color: { main: 0xf0dcc0, dark: 0xc0a887 } },
        { id: "black-tan", color: { main: 0x413a3a, belly: 0xe8d5bb, dark: 0x2a2525 } },
        { id: "sesame", color: { main: 0xb5814c, dark: 0x6b4526 } }
      ]
    },
    {
      id: "corgi", emoji: "🐶", name: { en: "Corgi", th: "คอร์กี้" },
      scale: 1.0, gait: "waddle",
      color: { main: 0xe0a25c, belly: 0xfffaf2, inner: 0xffc2ce, nose: 0x3a2b23, dark: 0x9c6a30 },
      body: { w: 16, h: 12, d: 24 }, head: { r: 14, y: 20, z: -9 },
      snout: { r: 6.5, z: -12, y: -3 },
      ears: { type: "triangle", size: 9, spread: 9, tilt: 0.05 },
      eyes: { r: 2.6, spread: 6, y: 2, z: -12 },
      legs: { count: 4, len: 5, r: 3.2, spread: 8, front: 8, back: -8 },
      tail: { type: "puff", len: 6, r: 5 },
      extras: ["bellyPatch"],
      trait: { speed: 74, curiosity: 1.0, energy: 0.9, naughty: 0.85 },
      variants: [
        { id: "red" },
        { id: "sable", color: { main: 0xa87748, dark: 0x6d4a28 } },
        { id: "tri", color: { main: 0x3b3630, belly: 0xfffaf2, dark: 0xb5814c } }
      ]
    },
    {
      id: "rabbit", emoji: "🐰", name: { en: "Rabbit", th: "กระต่าย" },
      scale: 0.95, gait: "hop",
      color: { main: 0xfdfbf7, belly: 0xffffff, inner: 0xffb0c4, nose: 0xff8fa3, dark: 0xd8cfc4 },
      body: { w: 13, h: 13, d: 16 }, head: { r: 12.5, y: 22, z: -7 },
      snout: { r: 5.5, z: -9.5, y: -3 },
      ears: { type: "long", size: 16, spread: 5, tilt: 0.12 },
      eyes: { r: 2.6, spread: 5.6, y: 2, z: -10.5 },
      legs: { count: 4, len: 6, r: 2.8, spread: 6.5, front: 5, back: -6 },
      tail: { type: "puff", len: 4, r: 4.5 },
      extras: ["whiskers"],
      trait: { speed: 96, curiosity: -0.6, energy: 1.0, naughty: 0.5 },
      variants: [
        { id: "white" },
        { id: "brown", color: { main: 0xb08968, belly: 0xf0e2d0, dark: 0x7a5a3d } },
        { id: "grey", color: { main: 0xb8bcc4, belly: 0xeef0f4, dark: 0x7d828b } },
        { id: "black", color: { main: 0x45414c, belly: 0x6b6572, dark: 0x2a2730 } },
        { id: "mint", color: { main: 0xd6f0e2, belly: 0xf2fff8, dark: 0x8fc4aa } }
      ]
    },
    {
      id: "hamster", emoji: "🐹", name: { en: "Hamster", th: "แฮมสเตอร์" },
      scale: 0.8, gait: "scurry",
      color: { main: 0xe8b96b, belly: 0xfff6e4, inner: 0xffb0c4, nose: 0xff8fa3, dark: 0xc2924a },
      body: { w: 14, h: 13, d: 15 }, head: { r: 12, y: 19, z: -6 },
      snout: { r: 5.5, z: -9, y: -3 },
      ears: { type: "round", size: 4.5, spread: 8, tilt: 0.3 },
      eyes: { r: 2.6, spread: 5.4, y: 1.5, z: -10 },
      legs: { count: 4, len: 4, r: 2.4, spread: 6, front: 5, back: -5 },
      tail: { type: "puff", len: 3, r: 2.6 },
      extras: ["cheeks", "whiskers", "bellyPatch"],
      trait: { speed: 110, curiosity: -0.4, energy: 1.0, naughty: 0.9 },
      variants: [
        { id: "golden" },
        { id: "white", color: { main: 0xfaf6ee, dark: 0xd0c8b8 } },
        { id: "grey", color: { main: 0xb0b6bd, dark: 0x7b8189 } }
      ]
    },
    {
      id: "pig", emoji: "🐷", name: { en: "Piglet", th: "หมูน้อย" },
      scale: 0.95, gait: "walk",
      color: { main: 0xf5a8b8, belly: 0xffd3dc, inner: 0xe8778d, nose: 0xe8778d, dark: 0xd97e91 },
      body: { w: 16, h: 13, d: 19 }, head: { r: 13, y: 21, z: -7 },
      snout: { r: 6, z: -11, y: -2, flat: true },
      ears: { type: "flop", size: 7, spread: 8, tilt: 0.5 },
      eyes: { r: 2.4, spread: 5.8, y: 2.5, z: -11 },
      legs: { count: 4, len: 6, r: 2.8, spread: 7, front: 6, back: -6.5 },
      tail: { type: "spring", len: 8, r: 3 },
      extras: ["snoutHoles"],
      trait: { speed: 62, curiosity: 0.6, energy: 0.6, naughty: 0.7 },
      variants: [
        { id: "pink" },
        { id: "spotted", color: { main: 0xe8c4b8, dark: 0x8a6b60 } },
        { id: "black", color: { main: 0x6b626b, belly: 0x8f858f, dark: 0x453f45 } }
      ]
    },

    /* ---------- สัตว์ป่า ---------- */
    {
      id: "redpanda", emoji: "🦊", name: { en: "Red Panda", th: "แพนด้าแดง" },
      scale: 1.0, gait: "walk",
      color: { main: 0xc75b39, belly: 0x3c2822, inner: 0xfff2e4, nose: 0x2b1c16, dark: 0xfff2e4 },
      body: { w: 16, h: 14, d: 20 }, head: { r: 15, y: 24, z: -8 },
      snout: { r: 7, z: -12, y: -3.5 },
      ears: { type: "round", size: 6, spread: 11, tilt: 0.3 },
      eyes: { r: 2.7, spread: 6.4, y: 2, z: -13 },
      legs: { count: 4, len: 7.5, r: 3, spread: 7.5, front: 6, back: -7 },
      tail: { type: "bushy", len: 24, r: 5, curl: 0.35 },
      extras: ["faceMask", "tailRings"],
      trait: { speed: 66, curiosity: 0.5, energy: 0.5, naughty: 0.6 }
    },
    {
      id: "panda", emoji: "🐼", name: { en: "Panda", th: "แพนด้า" },
      scale: 1.1, gait: "walk",
      color: { main: 0xfbfbfb, belly: 0xffffff, inner: 0x2a2a2e, nose: 0x2a2a2e, dark: 0x2a2a2e },
      body: { w: 18, h: 16, d: 20 }, head: { r: 16, y: 26, z: -7 },
      snout: { r: 7.5, z: -13, y: -4 },
      ears: { type: "round", size: 6.5, spread: 12, tilt: 0.25, color: 0x2a2a2e },
      eyes: { r: 2.8, spread: 7, y: 2, z: -14 },
      legs: { count: 4, len: 7, r: 3.6, spread: 8, front: 6.5, back: -7.5, color: 0x2a2a2e },
      tail: { type: "puff", len: 4, r: 3.5 },
      extras: ["eyePatches"],
      trait: { speed: 48, curiosity: 0.2, energy: 0.3, naughty: 0.4 }
    },
    {
      id: "fox", emoji: "🦊", name: { en: "Fox", th: "จิ้งจอก" },
      scale: 1.0, gait: "walk",
      color: { main: 0xe8813c, belly: 0xfff3e2, inner: 0x3a2620, nose: 0x2b1c16, dark: 0x3a2620 },
      body: { w: 14, h: 12, d: 21 }, head: { r: 13.5, y: 24, z: -8 },
      snout: { r: 6, z: -13, y: -4, taper: true },
      ears: { type: "triangle", size: 10, spread: 8, tilt: 0.08 },
      eyes: { r: 2.5, spread: 6, y: 2, z: -12 },
      legs: { count: 4, len: 9.5, r: 2.6, spread: 7, front: 6.5, back: -7.5, color: 0x3a2620 },
      tail: { type: "bushy", len: 26, r: 5.5, curl: 0.5, tipColor: 0xfff3e2 },
      extras: ["whiskers"],
      trait: { speed: 92, curiosity: 0.8, energy: 0.85, naughty: 0.95 },
      variants: [
        { id: "red" },
        { id: "arctic", color: { main: 0xf4f6fa, belly: 0xffffff, dark: 0xbcc4d0 } },
        { id: "fennec", color: { main: 0xecd6ae, belly: 0xfff8ea, dark: 0xb59a72 } }
      ]
    },
    {
      id: "bear", emoji: "🐻", name: { en: "Bear", th: "หมี" },
      scale: 1.12, gait: "walk",
      color: { main: 0xa2703f, belly: 0xd9b382, inner: 0xd9a98a, nose: 0x3a2b23, dark: 0x6f4a26 },
      body: { w: 18, h: 16, d: 21 }, head: { r: 15.5, y: 26, z: -7 },
      snout: { r: 8, z: -12.5, y: -4 },
      ears: { type: "round", size: 6, spread: 11, tilt: 0.25 },
      eyes: { r: 2.6, spread: 6.6, y: 2.5, z: -13.5 },
      legs: { count: 4, len: 7, r: 3.6, spread: 8, front: 6.5, back: -7.5 },
      tail: { type: "puff", len: 4, r: 3 },
      extras: ["bellyPatch"],
      trait: { speed: 54, curiosity: 0.3, energy: 0.4, naughty: 0.6 },
      variants: [
        { id: "brown" },
        { id: "polar", color: { main: 0xf6f8fb, belly: 0xffffff, dark: 0xc4ccd8 } },
        { id: "black", color: { main: 0x4a4249, belly: 0x6d636b, dark: 0x2e292e } }
      ]
    },
    {
      id: "deer", emoji: "🦌", name: { en: "Fawn", th: "กวางน้อย" },
      scale: 1.05, gait: "walk",
      color: { main: 0xc79463, belly: 0xfff2df, inner: 0xffc2ce, nose: 0x3a2b23, dark: 0x8a6236 },
      body: { w: 14, h: 13, d: 20 }, head: { r: 12.5, y: 30, z: -9 },
      snout: { r: 6, z: -11, y: -3.5, taper: true },
      ears: { type: "leaf", size: 8, spread: 10, tilt: 0.7 },
      eyes: { r: 2.6, spread: 5.8, y: 2, z: -11 },
      legs: { count: 4, len: 14, r: 2.1, spread: 6.5, front: 6, back: -7 },
      tail: { type: "puff", len: 4, r: 3.2 },
      extras: ["antlers", "spots", "neck"],
      trait: { speed: 90, curiosity: -0.7, energy: 0.8, naughty: 0.3 }
    },
    {
      id: "capybara", emoji: "🫎", name: { en: "Capybara", th: "คาปิบารา" },
      scale: 1.15, gait: "walk",
      color: { main: 0xa8784c, belly: 0xc9a077, inner: 0x6b482a, nose: 0x3a2b23, dark: 0x7a5433 },
      body: { w: 17, h: 14, d: 24 }, head: { r: 12, y: 21, z: -13, boxy: true },
      snout: { r: 6.5, z: -10, y: -2.5, flat: true },
      ears: { type: "round", size: 4, spread: 8.5, tilt: 0.35 },
      eyes: { r: 2.4, spread: 5.8, y: 3, z: -10.5 },
      legs: { count: 4, len: 6.5, r: 3.2, spread: 7.5, front: 8, back: -8 },
      tail: { type: "none" },
      extras: ["chill"],
      trait: { speed: 38, curiosity: 0.1, energy: 0.15, naughty: 0.1 }
    },
    {
      id: "hedgehog", emoji: "🦔", name: { en: "Hedgehog", th: "เม่นแคระ" },
      scale: 0.85, gait: "scurry",
      color: { main: 0xd8b98e, belly: 0xfff2df, inner: 0xffb0c4, nose: 0x3a2b23, dark: 0x6b5946 },
      body: { w: 15, h: 12, d: 17 }, head: { r: 10, y: 14, z: -13 },
      snout: { r: 5, z: -8, y: -2.5, taper: true },
      ears: { type: "round", size: 3.2, spread: 6, tilt: 0.3 },
      eyes: { r: 2.2, spread: 4.6, y: 1.5, z: -8 },
      legs: { count: 4, len: 4, r: 2.2, spread: 6.5, front: 5, back: -5.5 },
      tail: { type: "none" },
      extras: ["spikes", "whiskers"],
      trait: { speed: 70, curiosity: -0.5, energy: 0.7, naughty: 0.4 },
      variants: [
        { id: "tan" },
        { id: "salt", color: { main: 0xe4e0d8, dark: 0x8a857c } },
        { id: "cinnamon", color: { main: 0xd39a6a, dark: 0x7a5030 } }
      ]
    },
    {
      id: "squirrel", emoji: "🐿️", name: { en: "Squirrel", th: "กระรอก" },
      scale: 0.9, gait: "scurry",
      color: { main: 0xb5825a, belly: 0xfff0dd, inner: 0xffb0c4, nose: 0x3a2b23, dark: 0x7d5636 },
      body: { w: 12, h: 13, d: 15 }, head: { r: 11, y: 21, z: -6 },
      snout: { r: 5, z: -8.5, y: -3, taper: true },
      ears: { type: "leaf", size: 5.5, spread: 6.5, tilt: 0.2 },
      eyes: { r: 2.5, spread: 5.2, y: 2, z: -9.5 },
      legs: { count: 4, len: 5, r: 2.2, spread: 6, front: 5, back: -5.5 },
      tail: { type: "plume", len: 24, r: 6 },
      extras: ["whiskers", "bellyPatch"],
      trait: { speed: 108, curiosity: 0.4, energy: 1.0, naughty: 1.0 },
      variants: [
        { id: "red" },
        { id: "grey", color: { main: 0xa5aab2, belly: 0xf0f2f6, dark: 0x6f757e } },
        { id: "black", color: { main: 0x4a444c, belly: 0x6e6670, dark: 0x2c282e } }
      ]
    },
    {
      id: "raccoon", emoji: "🦝", name: { en: "Raccoon", th: "แรคคูน" },
      scale: 1.0, gait: "walk",
      color: { main: 0x9aa0a8, belly: 0xe2e6ec, inner: 0x3a3640, nose: 0x2b272e, dark: 0x3a3640 },
      body: { w: 15, h: 13, d: 20 }, head: { r: 13, y: 22, z: -9 },
      snout: { r: 6, z: -11, y: -3, taper: true },
      ears: { type: "round", size: 5, spread: 9.5, tilt: 0.3 },
      eyes: { r: 2.6, spread: 6, y: 2, z: -11.5 },
      legs: { count: 4, len: 7, r: 2.8, spread: 7, front: 6, back: -6.5, color: 0x3a3640 },
      tail: { type: "bushy", len: 20, r: 4.6, curl: 0.4 },
      extras: ["eyePatches", "tailRings", "whiskers"],
      trait: { speed: 84, curiosity: 1.0, energy: 0.9, naughty: 1.0 }
    },
    {
      id: "koala", emoji: "🐨", name: { en: "Koala", th: "โคอาล่า" },
      scale: 1.0, gait: "slow",
      color: { main: 0xa8aeb8, belly: 0xeceff4, inner: 0xf0c0cc, nose: 0x3a3640, dark: 0x767c86 },
      body: { w: 16, h: 15, d: 18 }, head: { r: 14, y: 25, z: -6 },
      snout: null,
      ears: { type: "fluff", size: 8, spread: 13, tilt: 0.2 },
      eyes: { r: 2.5, spread: 6.4, y: 2, z: -12 },
      legs: { count: 4, len: 6, r: 3.2, spread: 7.5, front: 6, back: -6.5 },
      tail: { type: "none" },
      extras: ["bigNose", "bellyPatch"],
      trait: { speed: 34, curiosity: 0.2, energy: 0.15, naughty: 0.2 }
    },
    {
      id: "sloth", emoji: "🦥", name: { en: "Sloth", th: "สลอธ" },
      scale: 1.0, gait: "slow",
      color: { main: 0xa39177, belly: 0xd8cbb2, inner: 0xc4a58a, nose: 0x3a3026, dark: 0x6b5c47 },
      body: { w: 14, h: 14, d: 17 }, head: { r: 12.5, y: 23, z: -6 },
      snout: { r: 6, z: -10, y: -3, flat: true },
      ears: { type: "none" },
      eyes: { r: 2.4, spread: 5.6, y: 1, z: -11 },
      legs: { count: 4, len: 8, r: 2.4, spread: 7, front: 6, back: -6.5 },
      tail: { type: "none" },
      extras: ["longArms", "slothMask", "smile"],
      trait: { speed: 24, curiosity: 0.3, energy: 0.05, naughty: 0.15 }
    },
    {
      id: "tiger", emoji: "🐯", name: { en: "Tiger Cub", th: "ลูกเสือ" },
      scale: 1.05, gait: "walk",
      color: { main: 0xeca14a, belly: 0xfff3e0, inner: 0xffb3c6, nose: 0xd9738a, dark: 0x33291f },
      body: { w: 16, h: 13, d: 21 }, head: { r: 14.5, y: 25, z: -8 },
      snout: { r: 7, z: -12, y: -3 },
      ears: { type: "round", size: 5.5, spread: 10, tilt: 0.25 },
      eyes: { r: 2.7, spread: 6.4, y: 2, z: -13 },
      legs: { count: 4, len: 8.5, r: 3, spread: 7.5, front: 6.5, back: -7.5 },
      tail: { type: "long", len: 24, r: 2.2, curl: 0.7 },
      extras: ["whiskers", "bodyStripes"],
      trait: { speed: 86, curiosity: 0.8, energy: 0.85, naughty: 1.0 },
      variants: [
        { id: "orange" },
        { id: "white", color: { main: 0xf6f7fa, belly: 0xffffff, dark: 0x39353f } }
      ]
    },

    /* ---------- สัตว์น้ำ ---------- */
    {
      id: "penguin", emoji: "🐧", name: { en: "Penguin", th: "เพนกวิน" },
      scale: 0.95, gait: "waddle",
      color: { main: 0x2f3a52, belly: 0xfdfdfd, inner: 0xf6a93b, nose: 0xf6a93b, dark: 0x1f2738 },
      body: { w: 14, h: 19, d: 14 }, head: { r: 12.5, y: 30, z: -3 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 2.6, spread: 5.4, y: 1.5, z: -10.5 },
      legs: { count: 2, len: 4, r: 2.6, spread: 5, front: 2, back: 2, color: 0xf6a93b },
      tail: { type: "none" },
      extras: ["beak", "flippers", "bellyPatch"],
      trait: { speed: 58, curiosity: 0.5, energy: 0.5, naughty: 0.5 }
    },
    {
      id: "seal", emoji: "🦭", name: { en: "Seal Pup", th: "ลูกแมวน้ำ" },
      scale: 1.0, gait: "wriggle",
      color: { main: 0xdfe4ea, belly: 0xfbfdff, inner: 0xf0b0c0, nose: 0x2e2a33, dark: 0xa8b0bb },
      body: { w: 14, h: 12, d: 24 }, head: { r: 12, y: 15, z: -14 },
      snout: { r: 6.5, z: -9, y: -2.5, flat: true },
      ears: { type: "none" },
      eyes: { r: 3, spread: 5.4, y: 2, z: -9 },
      legs: { count: 0, len: 0, r: 0, spread: 0, front: 0, back: 0 },
      tail: { type: "flipperTail", len: 10, r: 6 },
      extras: ["sideFlippers", "whiskers"],
      trait: { speed: 46, curiosity: 0.7, energy: 0.35, naughty: 0.5 },
      variants: [
        { id: "white" },
        { id: "grey", color: { main: 0xa9b3bf, belly: 0xdfe6ee, dark: 0x757f8c } }
      ]
    },
    {
      id: "otter", emoji: "🦦", name: { en: "Otter", th: "นาก" },
      scale: 0.95, gait: "scurry",
      color: { main: 0x8a6a4c, belly: 0xd8bfa0, inner: 0xf0b0c0, nose: 0x2e2a26, dark: 0x5c452e },
      body: { w: 13, h: 12, d: 23 }, head: { r: 11.5, y: 18, z: -13 },
      snout: { r: 6, z: -9, y: -2.5, flat: true },
      ears: { type: "round", size: 3, spread: 7, tilt: 0.3 },
      eyes: { r: 2.4, spread: 5.2, y: 2, z: -9 },
      legs: { count: 4, len: 4.5, r: 2.4, spread: 6.5, front: 7, back: -7 },
      tail: { type: "cone", len: 16, r: 3.5 },
      extras: ["whiskers", "bellyPatch"],
      trait: { speed: 92, curiosity: 1.0, energy: 0.95, naughty: 0.9 }
    },
    {
      id: "whale", emoji: "🐳", name: { en: "Baby Whale", th: "วาฬน้อย" },
      scale: 1.0, gait: "float",
      color: { main: 0x6f9fd8, belly: 0xdcecfa, inner: 0x4a7cb0, nose: 0x2e3a4a, dark: 0x4a7cb0 },
      body: { w: 16, h: 14, d: 26 }, head: { r: 12, y: 14, z: -14 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 2.4, spread: 8, y: 1, z: -8 },
      legs: { count: 0, len: 0, r: 0, spread: 0, front: 0, back: 0 },
      tail: { type: "flipperTail", len: 12, r: 8 },
      extras: ["sideFlippers", "dorsalFin", "blowhole", "smile"],
      float: 10,
      trait: { speed: 44, curiosity: 0.6, energy: 0.3, naughty: 0.3 }
    },
    {
      id: "crab", emoji: "🦀", name: { en: "Crab", th: "ปูน้อย" },
      scale: 0.9, gait: "scuttle",
      color: { main: 0xe8604a, belly: 0xffc9b0, inner: 0xffe0d0, nose: 0x8a2f22, dark: 0xb8402e },
      body: { w: 18, h: 9, d: 14 }, head: { r: 0, y: 0, z: 0, none: true },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 2.6, spread: 6, y: 26, z: -4, stalk: true },
      face: { y: 13, z: -12 },     // ตำแหน่งปากยิ้ม (สัตว์ที่ไม่มีหัวแยก)
      legs: { count: 4, len: 6, r: 1.8, spread: 9, front: 5, back: -5 },
      tail: { type: "none" },
      extras: ["claws", "smile"],
      trait: { speed: 74, curiosity: 0.3, energy: 0.7, naughty: 0.8 },
      variants: [
        { id: "red" },
        { id: "blue", color: { main: 0x5a8fd8, belly: 0xb8d4f0, dark: 0x3a5f9a } },
        { id: "purple", color: { main: 0xa87ad0, belly: 0xdcc4f0, dark: 0x6f4a94 } }
      ]
    },
    {
      id: "octopus", emoji: "🐙", name: { en: "Octopus", th: "ปลาหมึกน้อย" },
      scale: 0.95, gait: "float",
      color: { main: 0xdf7fb0, belly: 0xffd4e6, inner: 0xffe8f2, nose: 0x8a3a5f, dark: 0xa85080 },
      body: { w: 13, h: 13, d: 13 }, head: { r: 14, y: 15, z: 0 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 3.2, spread: 6.4, y: 1, z: -11 },
      // legs.count = 0 (ไม่วาดขา) แต่ len ยังใช้ยกลำตัวให้หนวดห้อยถึงพื้นพอดี
      legs: { count: 0, len: 9, r: 0, spread: 0, front: 0, back: 0 },
      tail: { type: "none" },
      extras: ["tentacles", "smile"],
      float: 4,
      trait: { speed: 56, curiosity: 0.9, energy: 0.5, naughty: 0.8 },
      variants: [
        { id: "pink" },
        { id: "violet", color: { main: 0x9f7ad8, belly: 0xd8c4f4, dark: 0x6f4aa8 } },
        { id: "coral", color: { main: 0xf08a68, belly: 0xffd0bc, dark: 0xb85a3a } }
      ]
    },
    {
      id: "axolotl", emoji: "🦎", name: { en: "Axolotl", th: "อาโซโลเทิล" },
      scale: 0.95, gait: "crawl",
      color: { main: 0xf7b8cf, belly: 0xffe3ee, inner: 0xe8618f, nose: 0xe8618f, dark: 0xe8618f },
      body: { w: 12, h: 9, d: 20 }, head: { r: 11, y: 11, z: -12 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 2.2, spread: 6, y: 2, z: -9 },
      legs: { count: 4, len: 4, r: 2.2, spread: 7, front: 5, back: -6 },
      tail: { type: "fin", len: 18, r: 6 },
      extras: ["gills", "smile"],
      trait: { speed: 44, curiosity: 0.6, energy: 0.35, naughty: 0.4 },
      variants: [
        { id: "pink" },
        { id: "gold", color: { main: 0xf4d97a, belly: 0xfff2c4, inner: 0xd8a63a, dark: 0xd8a63a } },
        { id: "melanoid", color: { main: 0x5f5a6b, belly: 0x827c90, inner: 0x3f3a4a, dark: 0x3f3a4a } }
      ]
    },
    {
      id: "turtle", emoji: "🐢", name: { en: "Turtle", th: "เต่า" },
      scale: 0.95, gait: "crawl",
      color: { main: 0x8fd18a, belly: 0xdcf3d3, inner: 0xffb0c4, nose: 0x3f6b3a, dark: 0x9c7a3f },
      body: { w: 15, h: 8, d: 17 }, head: { r: 10, y: 12, z: -15 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 2.3, spread: 4.8, y: 2, z: -8.4 },
      legs: { count: 4, len: 4.5, r: 3, spread: 8.5, front: 6, back: -6.5 },
      tail: { type: "cone", len: 6, r: 2.5 },
      extras: ["shell", "smile"],
      trait: { speed: 30, curiosity: 0.3, energy: 0.2, naughty: 0.3 }
    },
    {
      id: "frog", emoji: "🐸", name: { en: "Frog", th: "กบ" },
      scale: 0.9, gait: "hop",
      color: { main: 0x7cc65a, belly: 0xe9f7cf, inner: 0xffb0c4, nose: 0x4e8a36, dark: 0x4e8a36 },
      body: { w: 16, h: 11, d: 16 }, head: { r: 12, y: 13, z: -5 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 4, spread: 7, y: 9, z: -4, bulge: true },
      legs: { count: 4, len: 5, r: 2.8, spread: 8, front: 6, back: -6 },
      tail: { type: "none" },
      extras: ["smile", "bellyPatch"],
      trait: { speed: 84, curiosity: 0.4, energy: 1.0, naughty: 0.6 },
      variants: [
        { id: "green" },
        { id: "blue", color: { main: 0x5aa8d8, belly: 0xcfe9f7, dark: 0x36698a } },
        { id: "gold", color: { main: 0xe8c65a, belly: 0xfaf0cf, dark: 0xa88a36 } }
      ]
    },

    /* ---------- สัตว์ฟาร์ม / นก ---------- */
    {
      id: "duck", emoji: "🦆", name: { en: "Duckling", th: "ลูกเป็ด" },
      scale: 0.85, gait: "waddle",
      color: { main: 0xf7d24b, belly: 0xfff0b0, inner: 0xf08a2c, nose: 0xf08a2c, dark: 0xd9a91f },
      body: { w: 14, h: 13, d: 15 }, head: { r: 11.5, y: 20, z: -5 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 2.4, spread: 5.2, y: 1.5, z: -9.5 },
      legs: { count: 2, len: 4.5, r: 2.2, spread: 5, front: 1, back: 1, color: 0xf08a2c },
      tail: { type: "flat", len: 7, r: 4 },
      extras: ["beak", "flippers"],
      trait: { speed: 70, curiosity: 0.9, energy: 0.8, naughty: 0.6 }
    },
    {
      id: "chicken", emoji: "🐔", name: { en: "Chicken", th: "ไก่" },
      scale: 0.9, gait: "waddle",
      color: { main: 0xfbf6ee, belly: 0xffffff, inner: 0xe8503c, nose: 0xf0a83c, dark: 0xd8cfc0 },
      body: { w: 14, h: 15, d: 16 }, head: { r: 10.5, y: 24, z: -4 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 2.2, spread: 5, y: 1.5, z: -8.5 },
      legs: { count: 2, len: 6, r: 1.8, spread: 5, front: 1, back: 1, color: 0xf0a83c },
      tail: { type: "feathers", len: 12, r: 5 },
      extras: ["beak", "comb", "wattle", "flippers"],
      trait: { speed: 78, curiosity: 0.6, energy: 0.85, naughty: 0.8 },
      variants: [
        { id: "white" },
        { id: "brown", color: { main: 0xc98a4e, belly: 0xe8c294, dark: 0x8a5a2e } },
        { id: "black", color: { main: 0x4a444f, belly: 0x6b6470, dark: 0x2c282f } }
      ]
    },
    {
      id: "cow", emoji: "🐮", name: { en: "Calf", th: "ลูกวัว" },
      scale: 1.08, gait: "walk",
      color: { main: 0xfaf7f2, belly: 0xffffff, inner: 0xf0b0c0, nose: 0xf0b0c0, dark: 0x3b3740 },
      body: { w: 17, h: 14, d: 22 }, head: { r: 13, y: 24, z: -9 },
      snout: { r: 7, z: -11, y: -3, flat: true, color: 0xf7c4cf },
      ears: { type: "flop", size: 6.5, spread: 11, tilt: 1.2 },
      eyes: { r: 2.6, spread: 6, y: 2.5, z: -11.5 },
      legs: { count: 4, len: 9, r: 2.8, spread: 7.5, front: 6.5, back: -7.5 },
      tail: { type: "tuft", len: 16, r: 1.4 },
      extras: ["hornsPair", "cowSpots"],
      trait: { speed: 52, curiosity: 0.4, energy: 0.35, naughty: 0.4 },
      variants: [
        { id: "holstein" },
        { id: "brown", color: { main: 0xb5825a, belly: 0xe0c4a4, dark: 0x6f4a2e } },
        { id: "pink", color: { main: 0xf7d8e2, belly: 0xfff0f5, dark: 0xc98aa0 } }
      ]
    },
    {
      id: "horse", emoji: "🐴", name: { en: "Pony", th: "ม้าน้อย" },
      scale: 1.08, gait: "walk",
      color: { main: 0xb5814c, belly: 0xdcc0a0, inner: 0xf0b0c0, nose: 0x3a2b23, dark: 0x6b4a2a },
      body: { w: 14, h: 14, d: 22 }, head: { r: 12, y: 31, z: -11 },
      snout: { r: 6, z: -12, y: -4, taper: true },
      ears: { type: "leaf", size: 6.5, spread: 7, tilt: 0.35 },
      eyes: { r: 2.5, spread: 5.8, y: 2, z: -11 },
      legs: { count: 4, len: 14, r: 2.4, spread: 6.5, front: 6.5, back: -7.5 },
      tail: { type: "mane", len: 18, r: 4 },
      extras: ["mane", "neck"],
      trait: { speed: 96, curiosity: 0.6, energy: 0.9, naughty: 0.5 },
      variants: [
        { id: "bay" },
        { id: "white", color: { main: 0xfaf8f4, belly: 0xffffff, dark: 0xd0c8bc } },
        { id: "black", color: { main: 0x453f4a, belly: 0x6a6270, dark: 0x2a262e } },
        { id: "palomino", color: { main: 0xe8c47a, belly: 0xfff0cc, dark: 0xb08a3c } }
      ]
    },
    {
      id: "sheep", emoji: "🐑", name: { en: "Sheep", th: "แกะ" },
      scale: 1.0, gait: "walk",
      color: { main: 0xfdfaf3, belly: 0xffffff, inner: 0xffb0c4, nose: 0x4a4a52, dark: 0x4a4a52 },
      body: { w: 17, h: 15, d: 19 }, head: { r: 11, y: 24, z: -9, color: 0x4a4a52 },
      snout: { r: 5.5, z: -9, y: -2.5, color: 0x5c5c66 },
      ears: { type: "flop", size: 6, spread: 9, tilt: 1.1, color: 0x4a4a52 },
      eyes: { r: 2.2, spread: 5, y: 1.5, z: -9 },
      legs: { count: 4, len: 8, r: 2.4, spread: 7, front: 6, back: -6.5, color: 0x4a4a52 },
      tail: { type: "puff", len: 4, r: 4 },
      extras: ["wool"],
      trait: { speed: 56, curiosity: -0.5, energy: 0.4, naughty: 0.3 },
      variants: [
        { id: "cream" },
        { id: "pink", color: { main: 0xffe4ee } },
        { id: "grey", color: { main: 0xd8dade } }
      ]
    },
    {
      id: "owl", emoji: "🦉", name: { en: "Owl", th: "นกฮูก" },
      scale: 0.9, gait: "hop",
      color: { main: 0xa8875f, belly: 0xf0dcbe, inner: 0xf0a83c, nose: 0xf0a83c, dark: 0x6b543a },
      body: { w: 14, h: 16, d: 14 }, head: { r: 13.5, y: 27, z: -2 },
      snout: null,
      ears: { type: "tuft", size: 6, spread: 8, tilt: 0.2 },
      eyes: { r: 4.2, spread: 6.4, y: 2, z: -11, ring: 0xfff4dc },
      legs: { count: 2, len: 4, r: 2.2, spread: 5, front: 1, back: 1, color: 0xf0a83c },
      tail: { type: "feathers", len: 10, r: 4.5 },
      extras: ["beakSmall", "flippers", "bellyPatch"],
      trait: { speed: 64, curiosity: 0.5, energy: 0.4, naughty: 0.4 },
      variants: [
        { id: "brown" },
        { id: "snowy", color: { main: 0xf6f4ee, belly: 0xffffff, dark: 0xc4bdb0 } },
        { id: "grey", color: { main: 0x9298a2, belly: 0xdde1e8, dark: 0x646a74 } }
      ]
    },
    {
      id: "parrot", emoji: "🦜", name: { en: "Parrot", th: "นกแก้ว" },
      scale: 0.88, gait: "hop",
      color: { main: 0x4fbf6a, belly: 0xf2e85a, inner: 0xe8503c, nose: 0x3a3026, dark: 0x2f8a4a },
      body: { w: 12, h: 15, d: 13 }, head: { r: 10.5, y: 25, z: -3 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 2.4, spread: 5, y: 2, z: -8.5 },
      legs: { count: 2, len: 4, r: 1.8, spread: 4.5, front: 1, back: 1, color: 0x9a9aa2 },
      tail: { type: "feathers", len: 18, r: 3.5 },
      extras: ["beakSmall", "crest", "flippers"],
      trait: { speed: 88, curiosity: 1.0, energy: 0.95, naughty: 0.95 },
      variants: [
        { id: "green" },
        { id: "macaw", color: { main: 0x3a7fd8, belly: 0xf2c23a, dark: 0x2a5aa0 } },
        { id: "rose", color: { main: 0xf7a8c4, belly: 0xfff0f5, dark: 0xc4708c } }
      ]
    },

    /* ---------- แฟนตาซี / แมลง ---------- */
    {
      id: "unicorn", emoji: "🦄", name: { en: "Unicorn", th: "ยูนิคอร์น" },
      scale: 1.05, gait: "walk",
      color: { main: 0xfdfbff, belly: 0xffffff, inner: 0xffc2e0, nose: 0xf0a6c8, dark: 0xc9a6ff },
      body: { w: 14, h: 13, d: 21 }, head: { r: 12.5, y: 30, z: -10 },
      snout: { r: 6, z: -11, y: -3.5, taper: true },
      ears: { type: "leaf", size: 7, spread: 8, tilt: 0.5 },
      eyes: { r: 2.6, spread: 5.8, y: 2, z: -11 },
      legs: { count: 4, len: 13, r: 2.4, spread: 6.5, front: 6, back: -7 },
      tail: { type: "mane", len: 18, r: 4 },
      extras: ["horn", "rainbowMane", "sparkle", "neck"],
      trait: { speed: 82, curiosity: 0.7, energy: 0.7, naughty: 0.5 },
      variants: [
        { id: "white" },
        { id: "lavender", color: { main: 0xe6dcff, dark: 0xa88ae8 } },
        { id: "mint", color: { main: 0xdcf7ec, dark: 0x8ad8bc } }
      ]
    },
    {
      id: "dino", emoji: "🦕", name: { en: "Baby Dino", th: "ไดโนน้อย" },
      scale: 1.0, gait: "walk",
      color: { main: 0x7fd4c1, belly: 0xdff7f0, inner: 0xffc2ce, nose: 0x3f8a78, dark: 0xf7c05a },
      body: { w: 15, h: 14, d: 20 }, head: { r: 12.5, y: 25, z: -9 },
      snout: { r: 6.5, z: -11, y: -3, flat: true },
      ears: { type: "none" },
      eyes: { r: 2.8, spread: 6, y: 3, z: -11 },
      legs: { count: 4, len: 8, r: 3.2, spread: 7.5, front: 6, back: -7 },
      tail: { type: "cone", len: 20, r: 5 },
      extras: ["plates", "smile"],
      trait: { speed: 68, curiosity: 0.8, energy: 0.75, naughty: 0.9 },
      variants: [
        { id: "mint" },
        { id: "peach", color: { main: 0xf7b58a, belly: 0xffe4d0, dark: 0xd88a5a } },
        { id: "sky", color: { main: 0x8ac4f0, belly: 0xd8ecfb, dark: 0x5a94c4 } }
      ]
    },
    {
      id: "dragon", emoji: "🐉", name: { en: "Baby Dragon", th: "มังกรน้อย" },
      scale: 1.0, gait: "walk",
      color: { main: 0x9a7fd8, belly: 0xe4d8f7, inner: 0xffc2ce, nose: 0x5a3f94, dark: 0xf7c05a },
      body: { w: 15, h: 13, d: 20 }, head: { r: 13, y: 26, z: -9 },
      snout: { r: 6.5, z: -11.5, y: -3, taper: true },
      ears: { type: "leaf", size: 6, spread: 8, tilt: 0.6 },
      eyes: { r: 2.8, spread: 6, y: 2.5, z: -11.5 },
      legs: { count: 4, len: 8, r: 3, spread: 7.5, front: 6, back: -7 },
      tail: { type: "cone", len: 22, r: 4.5 },
      extras: ["smallWings", "hornsPair", "plates", "smile"],
      wingScale: 1.1,
      trait: { speed: 84, curiosity: 0.9, energy: 0.9, naughty: 1.0 },
      variants: [
        { id: "violet" },
        { id: "ember", color: { main: 0xe8664a, belly: 0xffd0bc, dark: 0xf7c05a } },
        { id: "jade", color: { main: 0x5ac48a, belly: 0xd0f4e0, dark: 0xf7c05a } }
      ]
    },
    {
      id: "phoenix", emoji: "🔥", name: { en: "Phoenix Chick", th: "ลูกฟีนิกซ์" },
      scale: 0.92, gait: "hop",
      color: { main: 0xf28a3c, belly: 0xffd76e, inner: 0xe8503c, nose: 0xe8503c, dark: 0xe8503c },
      body: { w: 13, h: 15, d: 14 }, head: { r: 11, y: 25, z: -3 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 2.5, spread: 5.2, y: 2, z: -9 },
      legs: { count: 2, len: 4.5, r: 1.8, spread: 4.5, front: 1, back: 1, color: 0xf0a83c },
      tail: { type: "feathers", len: 20, r: 5 },
      extras: ["beakSmall", "crest", "bigWings", "sparkle"],
      wingScale: 1.15,
      float: 4,
      trait: { speed: 94, curiosity: 0.8, energy: 1.0, naughty: 0.7 }
    },
    {
      id: "slime", emoji: "🫧", name: { en: "Slime", th: "สไลม์" },
      scale: 1.0, gait: "bounce",
      color: { main: 0x6fd8c4, belly: 0xc8f7ec, inner: 0xffffff, nose: 0x3a9a86, dark: 0x3a9a86 },
      body: { w: 17, h: 13, d: 17 }, head: { r: 0, y: 0, z: 0, none: true },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 3, spread: 6, y: 14, z: -12 },
      face: { y: 8, z: -14 },
      legs: { count: 0, len: 0, r: 0, spread: 0, front: 0, back: 0 },
      tail: { type: "none" },
      extras: ["jelly", "smileLow"],
      trait: { speed: 62, curiosity: 0.8, energy: 0.9, naughty: 0.7 },
      variants: [
        { id: "aqua" },
        { id: "berry", color: { main: 0xd87ac4, belly: 0xf7c8ec, dark: 0x9a3a86 } },
        { id: "lemon", color: { main: 0xe8d86f, belly: 0xf9f2c8, dark: 0xa89a3a } },
        { id: "grape", color: { main: 0x8f7ad8, belly: 0xd4c8f7, dark: 0x5a3a9a } }
      ]
    },
    {
      id: "bee", emoji: "🐝", name: { en: "Bee", th: "ผึ้ง" },
      scale: 0.78, gait: "flutter",
      color: { main: 0xf2c23a, belly: 0xfff0b8, inner: 0x3a3026, nose: 0x3a3026, dark: 0x3a3026 },
      body: { w: 12, h: 11, d: 15 }, head: { r: 10, y: 14, z: -11 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 2.6, spread: 4.8, y: 1.5, z: -8 },
      legs: { count: 0, len: 0, r: 0, spread: 0, front: 0, back: 0 },
      tail: { type: "none" },
      extras: ["smallWings", "antennae", "bodyStripes", "smile"],
      wingScale: 1.25,
      float: 26,
      trait: { speed: 104, curiosity: 0.9, energy: 1.0, naughty: 0.8 }
    },
    {
      id: "butterfly", emoji: "🦋", name: { en: "Butterfly", th: "ผีเสื้อ" },
      scale: 0.8, gait: "flutter",
      color: { main: 0x7f9fe8, belly: 0xd8e4fb, inner: 0xf2a8c8, nose: 0x3a3046, dark: 0xf2a8c8 },
      body: { w: 6, h: 7, d: 16 }, head: { r: 7.5, y: 10, z: -10 },
      snout: null,
      ears: { type: "none" },
      eyes: { r: 2.2, spread: 3.6, y: 1, z: -6 },
      legs: { count: 0, len: 0, r: 0, spread: 0, front: 0, back: 0 },
      tail: { type: "none" },
      extras: ["bigWings", "antennae", "sparkle"],
      wingScale: 1.75, wingTilt: -0.62,
      float: 30,
      trait: { speed: 88, curiosity: 0.7, energy: 0.9, naughty: 0.3 },
      variants: [
        { id: "blue" },
        { id: "monarch", color: { main: 0xf08a3c, dark: 0x3a3046 } },
        { id: "rose", color: { main: 0xf28ab4, dark: 0xc4507a } },
        { id: "mint", color: { main: 0x7fd8b8, dark: 0x3a9a7a } }
      ]
    }
  ];

  const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

  /* ============================================================
     3. ข้อความในแผงควบคุม (2 ภาษา)
     ============================================================ */
  const UI_TEXT = {
    en: {
      open: "Critters", title: "Let something loose",
      hint: "Tap a critter to send it wandering. Drag treats and toys out of the bowl and basket below. Hold and drag anything to move it — drop it back on this panel to put it away.",
      clear: "Clear all", pause: "Pause", resume: "Resume", random: "Surprise me",
      bowlTip: "Drag out a treat (tap to just drop one)",
      toyTip: "Drag out a toy (tap to just drop one)",
      count: "on screen",
      full: "That's a full house — clear a few first",
      cleared: "All critters went home",
      noWebGL: "Your browser can't run the critter game (WebGL is off or unavailable)",
      noLib: "Couldn't load the 3D library — check your connection and reload"
    },
    th: {
      open: "ปล่อยสัตว์", title: "เลือกตัวป่วน",
      hint: "กดเลือกสัตว์เพื่อปล่อยออกมาเดินเล่น ลากขนมกับของเล่นออกจากชามและตะกร้าด้านล่างได้ และจับลากทุกอย่างเพื่อย้ายที่ — ลากมาปล่อยที่แผงนี้คือเก็บออก",
      clear: "เก็บให้หมด", pause: "หยุด", resume: "เล่นต่อ", random: "สุ่มเลย",
      bowlTip: "ลากขนมออกไปวาง (แตะเฉยๆ ก็วางให้)",
      toyTip: "ลากของเล่นออกไปวาง (แตะเฉยๆ ก็วางให้)",
      count: "ตัวบนจอ",
      full: "เต็มแล้วครับ เก็บออกบ้างก่อนนะ",
      cleared: "สัตว์กลับบ้านหมดแล้ว",
      noWebGL: "เบราว์เซอร์นี้เล่นเกมสัตว์ไม่ได้ (WebGL ถูกปิดหรือไม่รองรับ)",
      noLib: "โหลดไลบรารี 3D ไม่สำเร็จ — เช็คเน็ตแล้วลองโหลดหน้าใหม่อีกครั้ง"
    }
  };

  let lang = document.documentElement.lang === "th" ? "th" : "en";
  const T = () => UI_TEXT[lang] || UI_TEXT.en;
  const pickName = (s) => s.name[lang] || s.name.en;

  /* ============================================================
     4. ตัวช่วยเล็กๆ
     ============================================================ */
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /** หมุนมุมเข้าหาเป้าหมายแบบสั้นที่สุด (กันหมุนวนรอบโลก) */
  function angleLerp(from, to, t) {
    let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return from + d * t;
  }

  /** สลับลำดับอาเรย์ (Fisher–Yates) — ใช้สุ่มแบบไม่ซ้ำ */
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) { console.warn("[critters]", msg); return; }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ============================================================
     5. ตรวจว่าเล่นได้ไหม — ถ้าไม่ได้ต้องบอกตรงๆ ไม่เงียบหาย
     ============================================================ */
  function webglSupported() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext &&
        (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) {
      return false;
    }
  }

  if (typeof window.THREE === "undefined") {
    console.error("[critters] ไม่พบ THREE — สคริปต์ three.js โหลดไม่สำเร็จ");
    buildDock({ disabled: T().noLib });
    return;
  }
  if (!webglSupported()) {
    console.error("[critters] เบราว์เซอร์นี้ไม่รองรับ WebGL");
    buildDock({ disabled: T().noWebGL });
    return;
  }

  /* ============================================================
     6. ฉาก / กล้อง / แสง
     ---------------------------------------------------------
     กล้อง orthographic แมปแบบ 1 หน่วย = 1 พิกเซล
     world x =  screen x
     world y = -screen y      (จอนับ y ลง แต่ 3D นับ y ขึ้น)
     ============================================================ */
  const canvas = document.createElement("canvas");
  canvas.id = "critter-canvas";
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -4000, 4000);
  camera.position.set(0, 0, 2000);

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const keyLight = new THREE.DirectionalLight(0xfff4e8, 0.85);
  keyLight.position.set(-0.5, 1, 0.9);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xffb7d8, 0.35);   // แสงสะท้อนสีซากุระ
  rimLight.position.set(0.8, 0.3, -0.7);
  scene.add(rimLight);

  let W = 0, H = 0;
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    camera.left = 0; camera.right = W;
    camera.top = 0; camera.bottom = -H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H, false);
  }
  resize();
  window.addEventListener("resize", resize);

  /* ============================================================
     7. วัสดุ cel-shaded + คลังเรขาคณิต (ใช้ซ้ำเพื่อประหยัดหน่วยความจำ)
     ============================================================ */
  const toonRamp = (() => {
    const data = new Uint8Array([110, 110, 110, 255, 196, 196, 196, 255, 255, 255, 255, 255]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  })();

  const matCache = new Map();
  /** วัสดุแบบการ์ตูน (cel-shaded)
      opts.flat = ผิวเหลี่ยม low-poly — MeshToonMaterial ของ r128 ไม่รองรับ
      flatShading จึงใช้ MeshPhongMaterial ที่ปิดความมันแทน */
  function mat(color, opts) {
    const o = opts || {};
    const k = color + "|" + (o.opacity != null ? o.opacity : 1) + "|" + (o.flat ? 1 : 0);
    let m = matCache.get(k);
    if (!m) {
      const common = {
        color: color,
        transparent: o.opacity != null && o.opacity < 1,
        opacity: o.opacity != null ? o.opacity : 1
      };
      m = o.flat
        ? new THREE.MeshPhongMaterial(Object.assign({ flatShading: true, shininess: 0, specular: 0x000000 }, common))
        : new THREE.MeshToonMaterial(Object.assign({ gradientMap: toonRamp }, common));
      matCache.set(k, m);
    }
    return m;
  }
  const flatMat = (color, opacity) =>
    new THREE.MeshBasicMaterial({
      color: color, transparent: opacity != null, opacity: opacity != null ? opacity : 1,
      side: THREE.DoubleSide, depthWrite: false
    });

  const geoCache = new Map();
  function geo(key, make) {
    let g = geoCache.get(key);
    if (!g) { g = make(); geoCache.set(key, g); }
    return g;
  }
  const BALL = geo("ball", () => new THREE.SphereGeometry(1, 14, 10));
  const CONE = geo("cone", () => new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0));
  const CYL = geo("cyl", () => new THREE.CylinderGeometry(1, 1, 1, 10));
  const DISC = geo("disc", () => new THREE.CircleGeometry(1, 20));
  const BOX = geo("box", () => new THREE.BoxGeometry(1, 1, 1));

  /** ทรงรี — ลูกบอลที่ยืดได้ 3 แกน */
  function ellipsoid(rx, ry, rz, color, opts) {
    const m = new THREE.Mesh(BALL, mat(color, opts));
    m.scale.set(rx, ry, rz);
    return m;
  }
  /** แคปซูล — three r128 ไม่มี CapsuleGeometry เลยประกอบเอง */
  function capsule(r, len, color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(CYL, mat(color));
    body.scale.set(r, len, r);
    g.add(body);
    const top = new THREE.Mesh(BALL, mat(color));
    top.scale.setScalar(r); top.position.y = len / 2; g.add(top);
    const bot = top.clone(); bot.position.y = -len / 2; g.add(bot);
    return g;
  }

  /* ============================================================
     8. ตัวสร้างโมเดลสัตว์
     ---------------------------------------------------------
     โครงลำดับชั้น:
       root (ตำแหน่งบนจอ)
        └ tilt (เอียง 3/4)
           ├ shadow (เงาแบนบนพื้น)
           └ bob (ใช้เด้ง/กระโดด/ลอย)
              └ yaw (หันหน้า)
                 └ ชิ้นส่วนตัวสัตว์ (เท้าอยู่ที่ y = 0)
     ============================================================ */
  function buildModel(spec, variant) {
    // variant ทับสีบางตัวได้ ที่เหลือใช้สีหลักของสายพันธุ์
    const c = (variant && variant.color) ? Object.assign({}, spec.color, variant.color) : spec.color;
    const root = new THREE.Group();

    const tilt = new THREE.Group();
    tilt.rotation.x = TILT;
    root.add(tilt);

    // --- เงา ---
    const shadow = new THREE.Mesh(DISC, flatMat(0x1a1020, 0.24));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.4;
    shadow.scale.set(spec.body.w * 1.15, 1, spec.body.d * 1.15);
    tilt.add(shadow);

    const bob = new THREE.Group();
    tilt.add(bob);
    const yaw = new THREE.Group();
    bob.add(yaw);

    const parts = {
      root: root, tilt: tilt, bob: bob, yaw: yaw, shadow: shadow,
      legs: [], ears: [], eyes: [], wings: [], tentacles: [], extras: {}
    };

    const legLen = spec.legs.len;
    const bodyY = legLen + spec.body.h * 0.75;
    parts.bodyY = bodyY;

    /* ---------- ลำตัว ---------- */
    const bodyGroup = new THREE.Group();
    yaw.add(bodyGroup);
    parts.bodyGroup = bodyGroup;

    const jelly = spec.extras.indexOf("jelly") >= 0;
    const body = ellipsoid(spec.body.w, spec.body.h, spec.body.d, c.main,
      jelly ? { opacity: 0.82 } : undefined);
    body.position.y = bodyY;
    bodyGroup.add(body);
    parts.body = body;

    if (jelly) {   // สไลม์ — มีแกนสว่างข้างในให้ดูวุ้นๆ
      const core = ellipsoid(spec.body.w * 0.45, spec.body.h * 0.45, spec.body.d * 0.45, c.belly, { opacity: 0.9 });
      core.position.y = bodyY - spec.body.h * 0.15;
      bodyGroup.add(core);
    }

    if (spec.extras.indexOf("bellyPatch") >= 0) {
      const belly = ellipsoid(spec.body.w * 0.72, spec.body.h * 0.72, spec.body.d * 0.55, c.belly);
      belly.position.set(0, bodyY - spec.body.h * 0.18, -spec.body.d * 0.45);
      bodyGroup.add(belly);
    }

    // ขนแกะ — ลูกบอลหลายลูกกองบนตัว
    if (spec.extras.indexOf("wool") >= 0) {
      [[0, 0.55, 0.45], [0, 0.6, -0.4], [0.6, 0.35, 0], [-0.6, 0.35, 0],
       [0.42, 0.6, 0.42], [-0.42, 0.6, 0.42], [0.42, 0.55, -0.42], [-0.42, 0.55, -0.42], [0, 0.8, 0]]
        .forEach((p) => {
          const s = ellipsoid(spec.body.w * 0.5, spec.body.w * 0.5, spec.body.w * 0.5, c.main);
          s.position.set(spec.body.w * p[0], bodyY + spec.body.h * p[1], spec.body.d * p[2]);
          bodyGroup.add(s);
        });
    }

    // หนามเม่น — เรียงเป็น 3 วงคลุมแผ่นหลัง
    if (spec.extras.indexOf("spikes") >= 0) {
      const rings = [
        { n: 11, rad: 0.92, y: 0.35, len: 11 },
        { n: 8, rad: 0.60, y: 0.80, len: 10 },
        { n: 4, rad: 0.26, y: 1.05, len: 8 }
      ];
      rings.forEach((rg) => {
        for (let i = 0; i < rg.n; i++) {
          const a = (i / rg.n) * Math.PI * 2 + rg.rad;
          const p = new THREE.Mesh(CONE, mat(c.dark, { flat: true }));
          p.scale.set(2.5, rg.len, 2.5);
          p.position.set(Math.cos(a) * spec.body.w * rg.rad,
            bodyY + spec.body.h * rg.y,
            Math.sin(a) * spec.body.d * rg.rad + spec.body.d * 0.22);
          // เอนหนามออกจากกลางลำตัว
          p.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
          bodyGroup.add(p);
        }
      });
    }

    // กระดองเต่า
    if (spec.extras.indexOf("shell") >= 0) {
      const shell = ellipsoid(spec.body.w * 1.18, spec.body.h * 1.55, spec.body.d * 1.08, c.dark, { flat: true });
      shell.position.y = bodyY + spec.body.h * 0.15;
      bodyGroup.add(shell);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        const p = ellipsoid(3.4, 1.4, 3.4, 0xc79a55);
        p.position.set(Math.cos(a) * spec.body.w * 0.66,
          bodyY + spec.body.h * 1.42, Math.sin(a) * spec.body.d * 0.6);
        bodyGroup.add(p);
      }
      const mid = ellipsoid(4, 1.5, 4, 0xd9ae66);
      mid.position.y = bodyY + spec.body.h * 1.62;
      bodyGroup.add(mid);
    }

    // แผงหลัง (ไดโน / มังกร)
    if (spec.extras.indexOf("plates") >= 0) {
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(CONE, mat(c.dark, { flat: true }));
        p.scale.set(3.2, 6 - i * 0.9, 1.4);
        p.position.set(0, bodyY + spec.body.h * 0.85, spec.body.d * (0.45 - i * 0.35));
        bodyGroup.add(p);
      }
    }

    // ลายทาง (เสือ / ผึ้ง)
    if (spec.extras.indexOf("bodyStripes") >= 0) {
      for (let i = 0; i < 3; i++) {
        const s = ellipsoid(spec.body.w * 1.02, spec.body.h * 0.9, 1.9, c.dark);
        s.position.set(0, bodyY + spec.body.h * 0.08, spec.body.d * (0.5 - i * 0.35));
        bodyGroup.add(s);
      }
    }

    // ลายวัว
    if (spec.extras.indexOf("cowSpots") >= 0) {
      [[0.7, 0.4, 0.2], [-0.6, 0.3, -0.35], [0.2, 0.75, -0.5], [-0.3, 0.6, 0.5]].forEach((p) => {
        const s = ellipsoid(4.2, 3.4, 3.2, c.dark);
        s.position.set(spec.body.w * p[0], bodyY + spec.body.h * p[1], spec.body.d * p[2]);
        bodyGroup.add(s);
      });
    }

    // จุดขาวลูกกวาง
    if (spec.extras.indexOf("spots") >= 0) {
      for (let i = 0; i < 6; i++) {
        const s = ellipsoid(1.6, 1.6, 1, c.belly);
        s.position.set(rand(-1, 1) * spec.body.w * 0.8,
          bodyY + rand(0.1, 0.8) * spec.body.h, rand(-0.6, 0.7) * spec.body.d);
        bodyGroup.add(s);
      }
    }

    // ครีบหลัง (วาฬ)
    if (spec.extras.indexOf("dorsalFin") >= 0) {
      const f = new THREE.Mesh(CONE, mat(c.dark, { flat: true }));
      f.scale.set(2, 9, 5);
      f.position.set(0, bodyY + spec.body.h * 0.9, spec.body.d * 0.1);
      f.rotation.x = 0.35;
      bodyGroup.add(f);
    }
    if (spec.extras.indexOf("blowhole") >= 0) {
      const b = ellipsoid(1.6, 0.8, 1.6, c.dark);
      b.position.set(0, bodyY + spec.body.h * 1.0, -spec.body.d * 0.35);
      bodyGroup.add(b);
    }

    // ครีบข้างลำตัว (แมวน้ำ / วาฬ)
    if (spec.extras.indexOf("sideFlippers") >= 0) {
      [-1, 1].forEach((side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * spec.body.w * 0.85, bodyY - spec.body.h * 0.25, -spec.body.d * 0.15);
        yaw.add(pivot);
        const f = ellipsoid(6, 1.6, 3.4, c.main);
        f.position.set(side * 4, 0, 0);
        f.rotation.z = side * -0.25;
        pivot.add(f);
        parts.wings.push(pivot);
      });
    }

    // หนวดปลาหมึก
    if (spec.extras.indexOf("tentacles") >= 0) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const pivot = new THREE.Group();
        pivot.position.set(Math.cos(a) * spec.body.w * 0.62, bodyY - spec.body.h * 0.55,
          Math.sin(a) * spec.body.d * 0.62);
        yaw.add(pivot);
        let prev = pivot;
        for (let k = 0; k < 3; k++) {
          const seg = new THREE.Group();
          seg.position.y = -4;
          prev.add(seg);
          const m = ellipsoid(2.6 - k * 0.6, 2.6, 2.6 - k * 0.6, c.main);
          m.position.y = -1;
          seg.add(m);
          prev = seg;
        }
        parts.tentacles.push(pivot);
      }
    }

    /* ---------- หัว ---------- */
    const headPivot = new THREE.Group();
    headPivot.position.set(0, bodyY + spec.head.y - spec.body.h * 0.4, spec.head.z);
    yaw.add(headPivot);
    parts.head = headPivot;

    if (!spec.head.none) {
      const headColor = spec.head.color != null ? spec.head.color : c.main;
      const head = spec.head.boxy
        ? (() => {
            const m = new THREE.Mesh(BOX, mat(headColor));
            m.scale.set(spec.head.r * 1.3, spec.head.r * 1.25, spec.head.r * 1.6);
            return m;
          })()
        : ellipsoid(spec.head.r, spec.head.r * 0.95, spec.head.r * 0.98, headColor);
      headPivot.add(head);
    }

    // ปาก / จมูก
    if (spec.snout) {
      const sc = spec.snout.color != null ? spec.snout.color : (spec.snout.taper ? c.main : c.belly);
      const s = spec.snout.taper
        ? ellipsoid(spec.snout.r * 0.7, spec.snout.r * 0.7, spec.snout.r * 1.5, sc)
        : ellipsoid(spec.snout.r, spec.snout.r * (spec.snout.flat ? 0.8 : 0.85),
            spec.snout.r * (spec.snout.flat ? 0.55 : 0.9), sc);
      s.position.set(0, spec.snout.y, spec.snout.z);
      headPivot.add(s);

      const nose = ellipsoid(2.2, 1.7, 1.6, c.nose);
      nose.position.set(0, spec.snout.y + spec.snout.r * 0.3, spec.snout.z - spec.snout.r * 0.75);
      headPivot.add(nose);

      if (spec.extras.indexOf("snoutHoles") >= 0) {
        [-1.8, 1.8].forEach((x) => {
          const h = ellipsoid(0.8, 1.1, 0.5, 0xb85a72);
          h.position.set(x, spec.snout.y, spec.snout.z - spec.snout.r * 0.58);
          headPivot.add(h);
        });
      }
    }

    // จมูกใหญ่โคอาล่า
    if (spec.extras.indexOf("bigNose") >= 0) {
      const n = ellipsoid(4.2, 5, 3.4, c.nose);
      n.position.set(0, -2, -spec.head.r * 0.82);
      headPivot.add(n);
    }
    // หน้ากากสลอธ
    if (spec.extras.indexOf("slothMask") >= 0) {
      const m = ellipsoid(spec.head.r * 0.82, spec.head.r * 0.5, spec.head.r * 0.4, c.belly);
      m.position.set(0, 1, -spec.head.r * 0.68);
      headPivot.add(m);
    }

    // จะงอยปาก
    if (spec.extras.indexOf("beak") >= 0) {
      const b = new THREE.Mesh(CONE, mat(c.inner));
      b.scale.set(4, 6.5, 3);
      b.rotation.x = -Math.PI / 2;
      b.position.set(0, -1.5, -spec.head.r * 0.75);
      headPivot.add(b);
    }
    if (spec.extras.indexOf("beakSmall") >= 0) {
      const b = new THREE.Mesh(CONE, mat(0xf0a83c));
      b.scale.set(2.6, 4.5, 2.6);
      b.rotation.x = -Math.PI / 2 + 0.5;
      b.position.set(0, -2, -spec.head.r * 0.85);
      headPivot.add(b);
    }
    // หงอน + เหนียงไก่
    if (spec.extras.indexOf("comb") >= 0) {
      for (let i = 0; i < 3; i++) {
        const p = ellipsoid(1.6, 2.8 - Math.abs(i - 1) * 0.6, 1.6, 0xe8503c);
        p.position.set(0, spec.head.r * 0.92, -3 + i * 3);
        headPivot.add(p);
      }
    }
    if (spec.extras.indexOf("wattle") >= 0) {
      const w = ellipsoid(1.6, 2.6, 1.2, 0xe8503c);
      w.position.set(0, -5.5, -spec.head.r * 0.68);
      headPivot.add(w);
    }
    // หงอนขนนก (นกแก้ว / ฟีนิกซ์)
    if (spec.extras.indexOf("crest") >= 0) {
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(CONE, mat(i === 1 ? c.inner : c.belly, { flat: true }));
        p.scale.set(1.8, 8 - Math.abs(i - 1) * 2.5, 1.8);
        p.position.set((i - 1) * 3, spec.head.r * 0.7, -1);
        p.rotation.z = (i - 1) * -0.3;
        p.rotation.x = -0.3;
        headPivot.add(p);
      }
    }
    // หนวดแมลง
    if (spec.extras.indexOf("antennae") >= 0) {
      [-1, 1].forEach((side) => {
        const st = new THREE.Mesh(CYL, mat(c.dark));
        st.scale.set(0.45, 8, 0.45);
        st.position.set(side * 2.6, spec.head.r * 0.7 + 3, -1);
        st.rotation.z = side * 0.4;
        headPivot.add(st);
        const tip = ellipsoid(1.5, 1.5, 1.5, c.dark);
        tip.position.set(side * 5.4, spec.head.r * 0.7 + 7, -1);
        headPivot.add(tip);
      });
    }

    /* ---------- ตา ---------- */
    const eyeSpec = spec.eyes;
    [-1, 1].forEach((side) => {
      const g = new THREE.Group();
      g.position.set(side * eyeSpec.spread, eyeSpec.y, eyeSpec.z);
      // ปู/สไลม์ไม่มีหัวแยก — ตาไปติดกับลำตัวแทน
      (spec.head.none ? bodyGroup : headPivot).add(g);

      if (eyeSpec.stalk) {
        const st = new THREE.Mesh(CYL, mat(c.main));
        st.scale.set(1.4, 8, 1.4);
        st.position.y = -4;
        g.add(st);
      }
      if (eyeSpec.ring != null) {           // วงขนรอบตานกฮูก
        const r = ellipsoid(eyeSpec.r * 1.5, eyeSpec.r * 1.5, 1.2, eyeSpec.ring);
        r.position.z = -eyeSpec.r * 0.2;
        g.add(r);
      }

      if (eyeSpec.bulge || eyeSpec.stalk) {
        const white = ellipsoid(eyeSpec.r * 1.3, eyeSpec.r * 1.3, eyeSpec.r * 1.3, 0xfdfdfd);
        g.add(white);
        const pupil = ellipsoid(eyeSpec.r * 0.6, eyeSpec.r * 0.75, eyeSpec.r * 0.6, 0x1b1b20);
        pupil.position.z = -eyeSpec.r * 0.95;
        g.add(pupil);
      } else {
        const e = ellipsoid(eyeSpec.r, eyeSpec.r * 1.15, eyeSpec.r * 0.7, 0x241f26);
        g.add(e);
        const shine = ellipsoid(eyeSpec.r * 0.34, eyeSpec.r * 0.34, eyeSpec.r * 0.34, 0xffffff);
        shine.position.set(side * -0.6, eyeSpec.r * 0.45, -eyeSpec.r * 0.55);
        g.add(shine);
      }
      parts.eyes.push(g);
    });

    const faceHost = spec.head.none ? bodyGroup : headPivot;

    // แก้มชมพู
    if (spec.extras.indexOf("cheeks") >= 0 || spec.extras.indexOf("sparkle") >= 0) {
      [-1, 1].forEach((side) => {
        const b = ellipsoid(3, 2, 1.2, 0xff9db8, { opacity: 0.75 });
        b.position.set(side * (eyeSpec.spread + 3.5), eyeSpec.y - 3.5, eyeSpec.z + 1.5);
        faceHost.add(b);
      });
    }

    if (spec.extras.indexOf("faceMask") >= 0) {
      const m = ellipsoid(spec.head.r * 0.85, spec.head.r * 0.5, spec.head.r * 0.5, c.dark);
      m.position.set(0, eyeSpec.y - 1, eyeSpec.z + 3);
      headPivot.add(m);
      [-1, 1].forEach((side) => {
        const p = ellipsoid(3.4, 3, 2, 0x7a3b26);
        p.position.set(side * eyeSpec.spread, eyeSpec.y, eyeSpec.z + 0.8);
        headPivot.add(p);
      });
    }
    if (spec.extras.indexOf("eyePatches") >= 0) {
      [-1, 1].forEach((side) => {
        const p = ellipsoid(4.4, 5, 2.4, c.dark);
        p.position.set(side * eyeSpec.spread, eyeSpec.y - 0.5, eyeSpec.z + 1.2);
        p.rotation.z = side * 0.35;
        headPivot.add(p);
      });
    }
    if (spec.extras.indexOf("browSpots") >= 0) {
      [-1, 1].forEach((side) => {
        const p = ellipsoid(1.8, 1.4, 1, c.belly);
        p.position.set(side * eyeSpec.spread, eyeSpec.y + 4.5, eyeSpec.z + 0.5);
        headPivot.add(p);
      });
    }

    // ยิ้ม — ตัวที่ไม่มีหัวแยก (ปู/สไลม์) ระบุตำแหน่งปากไว้ที่ spec.face
    if (spec.extras.indexOf("smile") >= 0 || spec.extras.indexOf("smileLow") >= 0) {
      const low = spec.extras.indexOf("smileLow") >= 0;
      const mouthY = spec.face ? spec.face.y : eyeSpec.y - (low ? 7 : 6);
      const mouthZ = spec.face ? spec.face.z : -spec.head.r * 0.9;
      [-1, 0, 1].forEach((i) => {
        const d = ellipsoid(0.9, 0.7, 0.5, 0x3a2b33);
        d.position.set(i * 3, mouthY + Math.abs(i) * 0.6, mouthZ);
        faceHost.add(d);
      });
    }

    // หนวด
    if (spec.extras.indexOf("whiskers") >= 0) {
      [-1, 1].forEach((side) => {
        for (let i = 0; i < 2; i++) {
          const w = new THREE.Mesh(CYL, mat(0xfff6ee));
          w.scale.set(0.2, 7, 0.2);
          w.rotation.z = side * (Math.PI / 2 - 0.22 + i * 0.34);
          w.position.set(side * 8.5, eyeSpec.y - 4 + i * 2.2, eyeSpec.z - 2);
          headPivot.add(w);
        }
      });
    }

    // เขา
    if (spec.extras.indexOf("horn") >= 0) {
      const h = new THREE.Mesh(CONE, mat(0xffd76e, { flat: true }));
      h.scale.set(2.4, 13, 2.4);
      h.position.set(0, spec.head.r * 0.75, -spec.head.r * 0.35);
      h.rotation.x = -0.35;
      headPivot.add(h);
    }
    if (spec.extras.indexOf("hornsPair") >= 0) {
      [-1, 1].forEach((side) => {
        const h = new THREE.Mesh(CONE, mat(c.dark, { flat: true }));
        h.scale.set(2, 7, 2);
        h.position.set(side * 5.5, spec.head.r * 0.7, -1);
        h.rotation.z = side * 0.55;
        headPivot.add(h);
      });
    }
    if (spec.extras.indexOf("antlers") >= 0) {
      [-1, 1].forEach((side) => {
        const stem = new THREE.Mesh(CYL, mat(0x9c7040));
        stem.scale.set(0.9, 10, 0.9);
        stem.position.set(side * 5, spec.head.r * 0.85 + 4, -1);
        stem.rotation.z = side * 0.3;
        headPivot.add(stem);
        const tip = new THREE.Mesh(CYL, mat(0x9c7040));
        tip.scale.set(0.8, 6, 0.8);
        tip.position.set(side * 8.5, spec.head.r * 0.85 + 10, -1);
        tip.rotation.z = side * 0.9;
        headPivot.add(tip);
      });
    }
    // แผงคอ — ยูนิคอร์นใช้สีรุ้งพาสเทล ม้าธรรมดาใช้สีเข้มของตัวเอง
    const RAINBOW = [0xffb3d1, 0xffd9a0, 0xfff3a0, 0xb8f0c8, 0xa8d8ff, 0xd0b3ff];
    const rainbowMane = spec.extras.indexOf("rainbowMane") >= 0;
    const maneColors = rainbowMane ? RAINBOW : [c.dark, c.dark, c.dark, c.dark, c.dark, c.dark];
    if (spec.extras.indexOf("mane") >= 0 || rainbowMane) {
      for (let i = 0; i < 6; i++) {
        const s = ellipsoid(3, 3.4, 2.6, maneColors[i % maneColors.length]);
        s.position.set(0, spec.head.r * 0.5 - i * 2.6, spec.head.r * 0.55 + i * 2.2);
        headPivot.add(s);
      }
    }
    // คอ — เชื่อมลำตัวกับหัวสำหรับสัตว์คอยาว ไม่งั้นหัวดูลอยแยกจากตัว
    if (spec.extras.indexOf("neck") >= 0) {
      const hx = 0, hy = bodyY + spec.head.y - spec.body.h * 0.4, hz = spec.head.z;
      const sy = bodyY + spec.body.h * 0.45, sz = -spec.body.d * 0.5;
      const dy = hy - sy, dz = hz - sz;
      const len = Math.sqrt(dy * dy + dz * dz);
      const neck = new THREE.Mesh(CYL, mat(c.main));
      neck.scale.set(spec.head.r * 0.38, len * 1.06, spec.head.r * 0.38);
      neck.position.set(hx, (hy + sy) / 2, (hz + sz) / 2);
      neck.rotation.x = -Math.atan2(dz, dy);
      yaw.add(neck);
    }
    if (spec.extras.indexOf("gills") >= 0) {
      [-1, 1].forEach((side) => {
        for (let i = 0; i < 3; i++) {
          const g2 = new THREE.Group();
          g2.position.set(side * spec.head.r * 0.75, 2 + i * 3.5, spec.head.r * 0.2);
          g2.rotation.z = side * (0.5 - i * 0.35);
          headPivot.add(g2);
          const stem = new THREE.Mesh(CYL, mat(c.inner));
          stem.scale.set(0.8, 8, 0.8);
          stem.position.y = 4; stem.rotation.z = side * -1.1;
          g2.add(stem);
          const puff = ellipsoid(2.4, 2.4, 2.4, c.inner);
          puff.position.set(side * 7, 5, 0);
          g2.add(puff);
        }
      });
    }

    /* ---------- หู ---------- */
    const earColor = spec.ears.color != null ? spec.ears.color
      : (spec.head.color != null ? spec.head.color : c.main);
    if (spec.ears.type !== "none" && !spec.head.none) {
      [-1, 1].forEach((side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * spec.ears.spread, spec.head.r * 0.62, -1);
        pivot.rotation.z = side * -spec.ears.tilt;
        headPivot.add(pivot);

        const S = spec.ears.size;
        if (spec.ears.type === "triangle") {
          const e = new THREE.Mesh(CONE, mat(earColor, { flat: true }));
          e.scale.set(S * 0.62, S, S * 0.4);
          pivot.add(e);
          const inner = new THREE.Mesh(CONE, mat(c.inner, { flat: true }));
          inner.scale.set(S * 0.36, S * 0.66, S * 0.3);
          inner.position.set(0, 1, -S * 0.18);
          pivot.add(inner);
        } else if (spec.ears.type === "round") {
          pivot.add(ellipsoid(S, S, S * 0.5, earColor));
          const inner = ellipsoid(S * 0.55, S * 0.55, S * 0.4, c.inner);
          inner.position.z = -S * 0.3;
          pivot.add(inner);
        } else if (spec.ears.type === "fluff") {       // โคอาล่า — หูฟูเป็นพวง
          pivot.add(ellipsoid(S, S, S * 0.6, earColor));
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const f = ellipsoid(S * 0.45, S * 0.45, S * 0.35, c.belly);
            f.position.set(Math.cos(a) * S * 0.7, Math.sin(a) * S * 0.7, -S * 0.25);
            pivot.add(f);
          }
        } else if (spec.ears.type === "tuft") {        // นกฮูก — พู่ขนบนหัว
          const e = new THREE.Mesh(CONE, mat(earColor, { flat: true }));
          e.scale.set(S * 0.5, S, S * 0.4);
          e.rotation.z = side * -0.3;
          pivot.add(e);
        } else if (spec.ears.type === "long") {
          const e = capsule(S * 0.26, S * 0.75, earColor);
          e.position.y = S * 0.5;
          pivot.add(e);
          const inner = capsule(S * 0.14, S * 0.6, c.inner);
          inner.position.set(0, S * 0.5, -S * 0.14);
          pivot.add(inner);
        } else if (spec.ears.type === "flop") {
          const e = ellipsoid(S * 0.5, S, S * 0.35, earColor);
          e.position.y = -S * 0.5;
          pivot.add(e);
          pivot.rotation.z = side * -spec.ears.tilt - side * 0.3;
        } else if (spec.ears.type === "leaf") {
          const e = ellipsoid(S * 0.42, S * 0.85, S * 0.28, earColor);
          e.position.y = S * 0.6;
          pivot.add(e);
          const inner = ellipsoid(S * 0.24, S * 0.55, S * 0.2, c.inner);
          inner.position.set(0, S * 0.6, -S * 0.16);
          pivot.add(inner);
        }
        parts.ears.push(pivot);
      });
    }

    /* ---------- ขา ---------- */
    const legColor = spec.legs.color != null ? spec.legs.color : c.main;
    if (spec.legs.count > 0) {
      const rows = spec.legs.count === 2 ? [spec.legs.front] : [spec.legs.front, spec.legs.back];
      const longArms = spec.extras.indexOf("longArms") >= 0;
      rows.forEach((zPos, rowIndex) => {
        [-1, 1].forEach((side) => {
          const pivot = new THREE.Group();
          const isArm = longArms && rowIndex === 0;
          const thisLen = isArm ? legLen * 1.6 : legLen;
          // แขนยาว (สลอธ) ต้องเหวี่ยงไปข้างหน้า ไม่ห้อยตรงลงพื้น
          // ไม่งั้นปลายแขนจะจมลงไปใต้พื้น: 1.6·len·cos(0.9) ≈ len พอดี
          const base = isArm ? -0.9 : 0;
          pivot.position.set(side * spec.legs.spread, legLen, -zPos);
          pivot.rotation.x = base;
          yaw.add(pivot);

          const leg = new THREE.Mesh(CYL, mat(legColor));
          leg.scale.set(spec.legs.r, thisLen, spec.legs.r);
          leg.position.y = -thisLen / 2;
          pivot.add(leg);

          const foot = ellipsoid(spec.legs.r * 1.15, spec.legs.r * 0.9, spec.legs.r * 1.5, legColor);
          foot.position.set(0, -thisLen, -spec.legs.r * 0.5);
          pivot.add(foot);

          // ขาทแยงมุมขยับพร้อมกัน (เดินแบบสัตว์สี่ขาจริง)
          parts.legs.push({
            pivot: pivot,
            base: base,
            phase: (rowIndex + (side > 0 ? 1 : 0)) % 2 === 0 ? 0 : Math.PI
          });
        });
      });
    }

    // ก้ามปู
    if (spec.extras.indexOf("claws") >= 0) {
      [-1, 1].forEach((side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * spec.body.w * 0.95, bodyY - 1, -spec.body.d * 0.5);
        yaw.add(pivot);
        const arm = new THREE.Mesh(CYL, mat(c.main));
        arm.scale.set(1.8, 7, 1.8);
        arm.rotation.z = side * -0.9;
        arm.position.set(side * 3, -1, 0);
        pivot.add(arm);
        const claw = ellipsoid(4.2, 4.6, 3, c.main);
        claw.position.set(side * 7.5, 2, -1);
        pivot.add(claw);
        const nip = ellipsoid(2.6, 1.4, 2.2, c.belly);
        nip.position.set(side * 10, 3.4, -2);
        pivot.add(nip);
        parts.wings.push(pivot);      // ใช้ระบบขยับปีก (โบกก้ามได้)
      });
    }

    // ครีบ / ปีกเล็กแนบตัว (เพนกวิน เป็ด ไก่ นก)
    if (spec.extras.indexOf("flippers") >= 0) {
      [-1, 1].forEach((side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * spec.body.w * 0.95, bodyY + 2, 0);
        yaw.add(pivot);
        const f = ellipsoid(1.6, 7, 4, c.main);
        f.position.y = -5;
        pivot.add(f);
        parts.wings.push(pivot);
      });
    }

    // ปีกกระพือ — ขนาดปรับได้ที่ spec.wingScale
    const WS = spec.wingScale || 1;
    if (spec.extras.indexOf("smallWings") >= 0) {
      [-1, 1].forEach((side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * spec.body.w * 0.7, bodyY + spec.body.h * 0.55, spec.body.d * 0.1);
        yaw.add(pivot);
        const wgeo = ellipsoid(10 * WS, 1.2, 6.5 * WS, 0xffffff, { opacity: 0.55 });
        wgeo.position.set(side * 9 * WS, 1, 0);
        wgeo.rotation.z = side * -0.2;
        pivot.add(wgeo);
        parts.wings.push(pivot);
      });
      parts.fastWings = true;
    }
    if (spec.extras.indexOf("bigWings") >= 0) {
      [-1, 1].forEach((side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * spec.body.w * 0.5, bodyY + spec.body.h * 0.45, 0);
        pivot.rotation.x = spec.wingTilt || 0;
        yaw.add(pivot);
        const upper = ellipsoid(12 * WS, 1, 10 * WS, c.main, { opacity: 0.94 });
        upper.position.set(side * 11 * WS, 3, -6 * WS);
        upper.rotation.z = side * -0.15;
        pivot.add(upper);
        const lower = ellipsoid(9 * WS, 1, 7 * WS, c.dark, { opacity: 0.94 });
        lower.position.set(side * 9 * WS, -2, 7 * WS);
        lower.rotation.z = side * -0.1;
        pivot.add(lower);
        // จุดลายบนปีก
        const dot = ellipsoid(2.6 * WS, 1.2, 2.6 * WS, c.belly);
        dot.position.set(side * 12 * WS, 4, -7 * WS);
        pivot.add(dot);
        parts.wings.push(pivot);
      });
      if (spec.extras.indexOf("antennae") >= 0) parts.fastWings = true;
    }

    /* ---------- หาง ---------- */
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, bodyY + spec.body.h * 0.25, spec.body.d * 0.85);
    yaw.add(tailPivot);
    parts.tail = tailPivot;

    const t = spec.tail;
    if (t.type === "long") {
      let prev = tailPivot;
      for (let i = 0; i < 4; i++) {
        const seg = new THREE.Group();
        seg.position.set(0, i === 0 ? 2 : 0, t.len / 4);
        seg.rotation.x = -(t.curl || 0.4) * 0.5;
        prev.add(seg);
        const m = ellipsoid(t.r * (1 - i * 0.12), t.r * (1 - i * 0.12), t.len / 7, c.main);
        m.position.z = t.len / 8;
        seg.add(m);
        prev = seg;
      }
    } else if (t.type === "bushy" || t.type === "plume") {
      const curl = t.type === "plume" ? 1.15 : (t.curl || 0.4);
      const m = ellipsoid(t.r, t.r, t.len * 0.55, c.main);
      m.position.z = t.len * 0.45;
      m.rotation.x = -curl;
      tailPivot.add(m);
      if (t.tipColor != null) {
        const tip = ellipsoid(t.r * 0.8, t.r * 0.8, t.len * 0.2, t.tipColor);
        tip.position.set(0, Math.sin(curl) * t.len * 0.5, t.len * 0.82);
        tailPivot.add(tip);
      }
      if (spec.extras.indexOf("tailRings") >= 0) {
        for (let i = 0; i < 3; i++) {
          const r2 = ellipsoid(t.r * 0.92, t.r * 0.92, 1.6, c.dark);
          r2.position.set(0, Math.sin(curl) * (6 + i * 6), 5 + i * 6.5);
          tailPivot.add(r2);
        }
      }
    } else if (t.type === "puff") {
      const m = ellipsoid(t.r, t.r, t.r, c.belly);
      m.position.z = t.len * 0.5;
      tailPivot.add(m);
    } else if (t.type === "tuft") {
      const st = new THREE.Mesh(CYL, mat(c.main));
      st.scale.set(t.r, t.len, t.r);
      st.rotation.x = -1.1;
      st.position.z = t.len * 0.35;
      tailPivot.add(st);
      const tip = ellipsoid(3, 3.4, 3, c.dark);
      tip.position.set(0, -t.len * 0.42, t.len * 0.72);
      tailPivot.add(tip);
    } else if (t.type === "curl") {
      const ring = new THREE.Mesh(
        geo("torus-curl", () => new THREE.TorusGeometry(1, 0.42, 8, 16, Math.PI * 1.6)), mat(c.main));
      ring.scale.setScalar(t.r);
      ring.position.set(0, t.r * 1.2, t.len * 0.2);
      ring.rotation.set(0.3, Math.PI / 2, 0);
      tailPivot.add(ring);
    } else if (t.type === "spring") {
      const ring = new THREE.Mesh(
        geo("torus-spring", () => new THREE.TorusGeometry(1, 0.3, 6, 14, Math.PI * 1.7)), mat(c.main));
      ring.scale.setScalar(t.r);
      ring.position.set(0, t.r, t.len * 0.3);
      ring.rotation.set(0, Math.PI / 2, 0.4);
      tailPivot.add(ring);
    } else if (t.type === "cone") {
      const m = new THREE.Mesh(CONE, mat(c.main));
      m.scale.set(t.r, t.len, t.r);
      m.rotation.x = Math.PI / 2 - 0.35;
      tailPivot.add(m);
    } else if (t.type === "flat") {
      const m = ellipsoid(t.r, t.r * 0.45, t.len * 0.5, c.main);
      m.position.set(0, 1, t.len * 0.4);
      m.rotation.x = -0.4;
      tailPivot.add(m);
    } else if (t.type === "fin") {
      const m = ellipsoid(1.4, t.r, t.len * 0.5, c.main);
      m.position.z = t.len * 0.4;
      tailPivot.add(m);
    } else if (t.type === "flipperTail") {
      [-1, 1].forEach((side) => {
        const f = ellipsoid(t.r * 0.9, 1.5, t.r * 0.55, c.main);
        f.position.set(side * t.r * 0.75, -2, t.len * 0.65);
        f.rotation.z = side * 0.25;
        tailPivot.add(f);
      });
    } else if (t.type === "feathers") {
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(CONE, mat(i === 1 ? c.main : c.dark, { flat: true }));
        f.scale.set(2.2, t.len - Math.abs(i - 1) * 4, 1.4);
        f.position.set((i - 1) * 3.5, 1, t.len * 0.2);
        f.rotation.x = Math.PI / 2 - 0.55;
        f.rotation.z = (i - 1) * 0.28;
        tailPivot.add(f);
      }
    } else if (t.type === "mane") {
      for (let i = 0; i < 4; i++) {
        const s = ellipsoid(2.6, 3, 3.4, maneColors[i % maneColors.length]);
        s.position.set(0, 2 - i * 2.2, 3 + i * 3);
        tailPivot.add(s);
      }
    }

    root.scale.setScalar(spec.scale * SIZE);
    const topY = spec.head.none ? bodyY + spec.body.h * 1.6 : bodyY + spec.head.y + spec.head.r;
    parts.height = topY * spec.scale * SIZE;
    parts.float = (spec.float || 0);

    return parts;
  }

  /* ============================================================
     9. เอฟเฟกต์เล็กๆ (หัวใจ ดาว กลีบซากุระ เศษการ์ด)
     ============================================================ */
  function spriteTexture(draw) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    draw(cv.getContext("2d"));
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  const TEX_HEART = spriteTexture((x) => {
    x.fillStyle = "#ff6f96";
    x.beginPath(); x.moveTo(32, 54);
    x.bezierCurveTo(2, 34, 8, 8, 32, 22);
    x.bezierCurveTo(56, 8, 62, 34, 32, 54);
    x.fill();
  });
  const TEX_STAR = spriteTexture((x) => {
    x.fillStyle = "#ffe066"; x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 28 : 12;
      x[i ? "lineTo" : "moveTo"](32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    x.closePath(); x.fill();
  });
  const TEX_PETAL = spriteTexture((x) => {
    const g = x.createRadialGradient(32, 26, 2, 32, 32, 28);
    g.addColorStop(0, "#ffe6f2"); g.addColorStop(1, "#ff9dc6");
    x.fillStyle = g;
    x.beginPath(); x.ellipse(32, 32, 14, 22, 0, 0, Math.PI * 2); x.fill();
  });
  const TEX_PAW = spriteTexture((x) => {
    x.fillStyle = "rgba(120,80,110,.85)";
    x.beginPath(); x.ellipse(32, 40, 13, 10, 0, 0, Math.PI * 2); x.fill();
    [[18, 22, 5], [28, 17, 5.5], [39, 17, 5.5], [48, 23, 5]].forEach((p) => {
      x.beginPath(); x.ellipse(p[0], p[1], p[2], p[2] * 1.15, 0, 0, Math.PI * 2); x.fill();
    });
  });
  const TEX_CHIP = spriteTexture((x) => {   // เศษที่กระเด็นตอนกัดการ์ด
    x.fillStyle = "rgba(255,255,255,.85)";
    x.beginPath(); x.moveTo(32, 8); x.lineTo(54, 30); x.lineTo(36, 56); x.lineTo(12, 36);
    x.closePath(); x.fill();
  });
  const TEX_ZZZ = spriteTexture((x) => {
    x.fillStyle = "#cfd8ff";
    x.font = "bold 46px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("z", 32, 34);
  });
  const TEX_DUST = spriteTexture((x) => {      // ฝุ่นตลบ (ตอนทะเลาะ / ตกลงพื้น)
    x.fillStyle = "rgba(226,214,236,.9)";
    [[22, 34, 13], [40, 30, 15], [32, 44, 11], [46, 42, 9], [16, 44, 8]].forEach((p) => {
      x.beginPath(); x.arc(p[0], p[1], p[2], 0, Math.PI * 2); x.fill();
    });
  });
  const TEX_ANGRY = spriteTexture((x) => {     // ดาวหมุนหัว / ประกายโมโห
    x.strokeStyle = "#ff8a6a"; x.lineWidth = 7; x.lineCap = "round";
    x.beginPath(); x.moveTo(14, 14); x.lineTo(50, 50); x.stroke();
    x.beginPath(); x.moveTo(50, 14); x.lineTo(14, 50); x.stroke();
  });

  const puffs = [];
  function spawnPuff(x, y, tex, count, opts) {
    const o = opts || {};
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, depthTest: false
      }));
      const size = o.size || 18;
      s.scale.set(size, size, 1);
      s.position.set(x + rand(-8, 8), -y, 900);
      scene.add(s);
      puffs.push({
        sprite: s, life: 0, max: o.max || 0.9,
        vx: o.vx != null ? o.vx : rand(-24, 24),
        vy: o.vy != null ? o.vy : rand(46, 82),
        spin: rand(-3, 3), size: size
      });
    }
  }

  const petals = [];
  (function makePetals() {
    const n = REDUCED_MOTION ? 0 : 34;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: TEX_PETAL, transparent: true, opacity: rand(0.35, 0.8), depthWrite: false
      }));
      const size = rand(8, 17);
      s.scale.set(size, size, 1);
      s.position.set(rand(0, W), -rand(-H, H), rand(-500, -100));
      scene.add(s);
      petals.push({ sprite: s, vy: rand(22, 55), sway: rand(0.4, 1.5), phase: rand(0, 6.28), drift: rand(-18, 18) });
    }
  })();

  /* ============================================================
     10. ของบนพื้น — อาหาร และ ของเล่น
     ============================================================ */
  const props = [];

  /* --- อาหาร 10 อย่าง -------------------------------------
     แต่ละอย่างประกอบทรงเองให้ดูออกว่าเป็นอะไร ไม่ใช่แค่เปลี่ยนสี
     ฟังก์ชัน build รับกลุ่มมา แล้วแปะชิ้นส่วนใส่ (y = 0 คือพื้น)
     --------------------------------------------------------- */
  const TREATS = [
    {
      id: "meat", emoji: "🍖", shadow: 10,
      build: (g) => {
        const m = ellipsoid(7, 5.5, 6, 0xc4603c);
        m.position.y = 6; g.add(m);
        const bone = new THREE.Mesh(CYL, mat(0xfff2e0));
        bone.scale.set(1.7, 12, 1.7);
        bone.rotation.z = 0.9; bone.position.set(7, 8, 0); g.add(bone);
        [[10.5, 11.5], [3.5, 4.5]].forEach((p) => {
          const k = ellipsoid(2.6, 2.6, 2.6, 0xfff8ee);
          k.position.set(p[0], p[1], 0); g.add(k);
        });
      }
    },
    {
      id: "apple", emoji: "🍎", shadow: 8,
      build: (g) => {
        const a = ellipsoid(7, 7, 7, 0xd94436);
        a.position.y = 7; g.add(a);
        const dent = ellipsoid(2.4, 1.4, 2.4, 0xa8302a);
        dent.position.y = 13.4; g.add(dent);
        const stem = new THREE.Mesh(CYL, mat(0x6b4a2a));
        stem.scale.set(0.8, 5, 0.8); stem.position.y = 16; g.add(stem);
        const leaf = ellipsoid(3.4, 0.9, 1.9, 0x5fb64f);
        leaf.position.set(3, 16.5, 0); leaf.rotation.z = -0.4; g.add(leaf);
      }
    },
    {
      id: "cookie", emoji: "🍪", shadow: 9,
      build: (g) => {
        const c = new THREE.Mesh(CYL, mat(0xc9975a));
        c.scale.set(8, 3, 8); c.position.y = 1.8; g.add(c);
        [[3, 2], [-3.4, 1.5], [0.5, -3], [4, -3.5], [-2, -1]].forEach((p) => {
          const chip = ellipsoid(1.5, 1.2, 1.5, 0x4a2f1e);
          chip.position.set(p[0], 3.4, p[1]); g.add(chip);
        });
      }
    },
    {
      id: "carrot", emoji: "🥕", shadow: 7,
      build: (g) => {
        const c = new THREE.Mesh(CONE, mat(0xef8330));
        c.scale.set(4, 15, 4); c.position.y = 1; c.rotation.x = 0.15; g.add(c);
        [-1, 0, 1].forEach((i) => {
          const leaf = new THREE.Mesh(CONE, mat(0x54ab46));
          leaf.scale.set(1.6, 7, 1.6);
          leaf.position.set(i * 2.2, 15, 0);
          leaf.rotation.z = i * -0.35; g.add(leaf);
        });
      }
    },
    {
      id: "fish", emoji: "🐟", shadow: 10,
      build: (g) => {
        // หันข้างให้กล้อง ไม่งั้นมองจากหน้าจะเห็นแต่หางเป็นใบไม้
        const side = new THREE.Group();
        side.rotation.y = 1.25;
        g.add(side);
        const b = ellipsoid(5, 5, 9, 0x8fc0e0);
        b.position.y = 5.5; side.add(b);
        const tail = new THREE.Mesh(CONE, mat(0x5f96bd, { flat: true }));
        tail.scale.set(5.5, 7, 1.2);
        tail.rotation.x = -Math.PI / 2; tail.position.set(0, 6, 9); side.add(tail);
        const fin = ellipsoid(1, 3.4, 3, 0x5f96bd);
        fin.position.set(0, 9.5, 1); side.add(fin);
        const eye = ellipsoid(1.2, 1.2, 0.9, 0x24202a);
        eye.position.set(2.6, 7, -6.5); side.add(eye);
        const eye2 = eye.clone(); eye2.position.x = -2.6; side.add(eye2);
      }
    },
    {
      id: "cheese", emoji: "🧀", shadow: 9,
      build: (g) => {
        const w = new THREE.Mesh(CONE, mat(0xf0c246, { flat: true }));
        w.scale.set(9, 9, 9); w.rotation.x = -Math.PI / 2; w.position.y = 4.5; g.add(w);
        [[2, 4, 3], [-2, 6, 1], [0.5, 3, -2]].forEach((p) => {
          const h = ellipsoid(1.5, 1.5, 1.5, 0xd8a52e);
          h.position.set(p[0], p[1], p[2]); g.add(h);
        });
      }
    },
    {
      id: "donut", emoji: "🍩", shadow: 10,
      build: (g) => {
        const d = new THREE.Mesh(geo("torus-donut",
          () => new THREE.TorusGeometry(1, 0.42, 10, 18)), mat(0xd4a05e));
        d.scale.setScalar(7.5); d.rotation.x = -Math.PI / 2; d.position.y = 3.2; g.add(d);
        const ice = new THREE.Mesh(geo("torus-donut",
          () => new THREE.TorusGeometry(1, 0.42, 10, 18)), mat(0xf28ab4));
        ice.scale.setScalar(7.7); ice.rotation.x = -Math.PI / 2; ice.position.y = 4.6; g.add(ice);
        [0, 1, 2, 3, 4].forEach((i) => {
          const a = (i / 5) * Math.PI * 2;
          const s = ellipsoid(1.4, 0.5, 0.6, 0xfff2a8);
          s.position.set(Math.cos(a) * 7.5, 6.4, Math.sin(a) * 7.5);
          s.rotation.y = -a; g.add(s);
        });
      }
    },
    {
      id: "cupcake", emoji: "🧁", shadow: 8,
      build: (g) => {
        const cup = new THREE.Mesh(CYL, mat(0xe0a0c0));
        cup.scale.set(6, 7, 6); cup.position.y = 3.5; g.add(cup);
        const f1 = ellipsoid(6.4, 4, 6.4, 0xfff0f6);
        f1.position.y = 8.5; g.add(f1);
        const f2 = ellipsoid(4.4, 3.4, 4.4, 0xfff0f6);
        f2.position.y = 12; g.add(f2);
        const cherry = ellipsoid(2.2, 2.2, 2.2, 0xd93a4a);
        cherry.position.y = 15.5; g.add(cherry);
      }
    },
    {
      id: "honey", emoji: "🍯", shadow: 9,
      build: (g) => {
        const pot = ellipsoid(7, 6.5, 7, 0xd8b088);
        pot.position.y = 6.5; g.add(pot);
        const lip = new THREE.Mesh(CYL, mat(0xc09468));
        lip.scale.set(5, 2, 5); lip.position.y = 13; g.add(lip);
        const drip = ellipsoid(4.4, 2.4, 4.4, 0xf2b830);
        drip.position.y = 14; g.add(drip);
        const dab = ellipsoid(1.6, 2.6, 1.6, 0xf2b830);
        dab.position.set(4.6, 11, 0); g.add(dab);
      }
    },
    {
      id: "seeds", emoji: "🌰", shadow: 9,
      build: (g) => {
        [[0, 0, 0], [4, 0, 2], [-3.6, 0, 2.6], [1.5, 0, -4], [-1.5, 3.4, -0.5]].forEach((p) => {
          const s = ellipsoid(2.6, 2.6, 3.2, 0x9c6b3f);
          s.position.set(p[0], 2.8 + p[1], p[2]);
          s.rotation.y = p[0]; g.add(s);
          const tip = ellipsoid(1.4, 1.4, 1.4, 0xd8b88e);
          tip.position.set(p[0], 2.8 + p[1], p[2] - 2.8); g.add(tip);
        });
      }
    }
  ];

  /* --- ของเล่น 6 อย่าง ------------------------------------- */
  const TOYS = [
    {
      id: "ball", emoji: "⚽", shadow: 11, roll: true,
      build: (spin) => {
        spin.add(ellipsoid(10, 10, 10, 0xff9dc6));
        [0, 1, 2].forEach((i) => {
          const stripe = ellipsoid(10.3, 1.5, 10.3, 0xfff0f6);
          stripe.rotation.z = i * 0.7; spin.add(stripe);
        });
      }
    },
    {
      id: "yarn", emoji: "🧶", shadow: 11, roll: true,
      build: (spin) => {
        spin.add(ellipsoid(10, 10, 10, 0xb48ce0));
        for (let i = 0; i < 5; i++) {
          const w = new THREE.Mesh(geo("torus-yarn",
            () => new THREE.TorusGeometry(1, 0.075, 6, 20)), mat(0x8f66c4));
          w.scale.setScalar(10.2);
          w.rotation.set(i * 0.7, i * 1.1, i * 0.5);
          spin.add(w);
        }
        const tailEnd = ellipsoid(1.4, 1.4, 4, 0x8f66c4);
        tailEnd.position.set(9, -4, 4); spin.add(tailEnd);
      }
    },
    {
      id: "bone", emoji: "🦴", shadow: 12, roll: false,
      build: (spin) => {
        const shaft = new THREE.Mesh(CYL, mat(0xfff2e0));
        shaft.scale.set(2.4, 17, 2.4);
        shaft.rotation.z = Math.PI / 2; spin.add(shaft);
        [-8.5, 8.5].forEach((x) => {
          [-2.8, 2.8].forEach((z) => {
            const k = ellipsoid(3.2, 3.2, 3.2, 0xfff8ee);
            k.position.set(x, 0, z); spin.add(k);
          });
        });
      }
    },
    {
      id: "feather", emoji: "🪶", shadow: 9, roll: false,
      build: (spin) => {
        const stick = new THREE.Mesh(CYL, mat(0xb08a5a));
        stick.scale.set(1.1, 16, 1.1);
        stick.rotation.z = 0.7; spin.add(stick);
        const quill = ellipsoid(2.2, 7.5, 1.2, 0x7fc4e8);
        quill.position.set(6, 8, 0); quill.rotation.z = 0.5; spin.add(quill);
        const quill2 = ellipsoid(1.8, 6, 1, 0xf2a8c8);
        quill2.position.set(8.5, 11.5, 0); quill2.rotation.z = 0.9; spin.add(quill2);
      }
    },
    {
      id: "block", emoji: "🧊", shadow: 11, roll: false,
      build: (spin) => {
        const b = new THREE.Mesh(BOX, mat(0x7fc4d8, { flat: true }));
        b.scale.set(15, 15, 15); spin.add(b);
        [[0, 0, 7.7], [7.7, 0, 0]].forEach((p, i) => {
          const face = ellipsoid(4, 4, 0.6, i ? 0xfff0a8 : 0xf2a8c8);
          face.position.set(p[0], p[1], p[2]);
          if (i) face.rotation.y = Math.PI / 2;
          spin.add(face);
        });
      }
    },
    {
      id: "bell", emoji: "🔔", shadow: 10, roll: true,
      build: (spin) => {
        spin.add(ellipsoid(9, 9, 9, 0xf2c23a));
        const band = ellipsoid(9.3, 1.4, 9.3, 0xc99a1e);
        spin.add(band);
        const slit = ellipsoid(1.2, 4.5, 9.4, 0x8a6b12);
        spin.add(slit);
        const ring = new THREE.Mesh(geo("torus-bell",
          () => new THREE.TorusGeometry(1, 0.28, 6, 14)), mat(0xc99a1e));
        ring.scale.setScalar(3.4); ring.position.y = 10; spin.add(ring);
      }
    }
  ];

  const TREAT_BY_ID = new Map(TREATS.map((t) => [t.id, t]));
  const TOY_BY_ID = new Map(TOYS.map((t) => [t.id, t]));

  /** ประกอบร่างของบนพื้น: กลุ่มนอก → เอียง 3/4 → เงา + ตัวของ */
  function buildPropMesh(kind, def) {
    const g = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.rotation.x = TILT;
    g.add(tilt);

    const sh = new THREE.Mesh(DISC, flatMat(0x1a1020, 0.22));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.3;
    sh.scale.set(def.shadow, 1, def.shadow);
    tilt.add(sh);

    const hop = new THREE.Group();          // ใช้ตกลงพื้น / ยกขึ้นตอนถูกลาก
    tilt.add(hop);

    if (kind === "food") {
      def.build(hop);
    } else {
      const spin = new THREE.Group();
      spin.position.y = def.shadow;
      hop.add(spin);
      def.build(spin);
      g.userData.spin = spin;
    }
    g.userData.hop = hop;
    g.userData.shadow = sh;
    return g;
  }

  /** ดันจุดให้พ้นการ์ด UI — ของที่วางในการ์ดจะไม่มีใครเดินไปถึง */
  function nudgeOutOfCards(x, y) {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (!insideRect(o, x, y, PAD)) continue;
      const dl = x - (o.l - PAD), dr = (o.r + PAD) - x;
      const dt = y - (o.t - PAD), db = (o.b + PAD) - y;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) x = o.l - PAD - 2;
      else if (m === dr) x = o.r + PAD + 2;
      else if (m === dt) y = o.t - PAD - 2;
      else y = o.b + PAD + 2;
    }
    return { x: clamp(x, 30, Math.max(40, W - 30)), y: clamp(y, 70, Math.max(80, H - 20)) };
  }

  function addProp(kind, x, y, defId) {
    if (props.length >= MAX_PROPS) {
      // เต็มแล้วก็เก็บอันเก่าสุดออก ดีกว่าปล่อยให้เฟรมตก
      removeProp(props[0]);
    }
    const table = kind === "food" ? TREATS : TOYS;
    const byId = kind === "food" ? TREAT_BY_ID : TOY_BY_ID;
    let def;
    if (defId != null) {
      def = byId.get(defId);
      if (!def) {          // ขอชนิดที่ไม่มีจริง บอกไปตรงๆ ไม่แอบสุ่มให้
        console.error("[critters] ไม่รู้จัก " + kind + " ชนิด:", defId);
        return null;
      }
    } else {
      def = pickOne(table);
    }

    const spot = nudgeOutOfCards(x, y);
    const mesh = buildPropMesh(kind, def);
    scene.add(mesh);
    const p = {
      kind: kind, mesh: mesh, def: def,
      x: spot.x, y: spot.y, vx: 0, vy: 0,
      bites: kind === "food" ? 3 : 0, born: 0, drop: 26,
      spin: 0, held: false
    };
    props.push(p);
    spawnPuff(spot.x, spot.y, TEX_STAR, 3, { size: 11 });
    return p;
  }

  function removeProp(p) {
    scene.remove(p.mesh);
    const i = props.indexOf(p);
    if (i >= 0) props.splice(i, 1);
  }

  function updateProps(dt) {
    for (let i = props.length - 1; i >= 0; i--) {
      const p = props[i];
      p.born += dt;

      // ถูกจับลากอยู่ = ลอยตามนิ้ว ไม่มีฟิสิกส์
      if (p.held) {
        p.vx = 0; p.vy = 0;
        p.mesh.userData.hop.position.y = 26;
        p.mesh.userData.shadow.material.opacity = 0.1;
        p.mesh.position.set(p.x, -p.y, 1200);      // วางไว้หน้าสุด
        continue;
      }
      p.mesh.userData.shadow.material.opacity = 0.22;

      if (p.kind === "toy") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const f = Math.pow(0.28, dt);      // แรงเสียดทาน
        p.vx *= f; p.vy *= f;
        // เด้งขอบจอ
        if (p.x < 26 && p.vx < 0) { p.x = 26; p.vx = -p.vx * 0.6; }
        if (p.x > W - 26 && p.vx > 0) { p.x = W - 26; p.vx = -p.vx * 0.6; }
        if (p.y < 74 && p.vy < 0) { p.y = 74; p.vy = -p.vy * 0.6; }
        if (p.y > H - 24 && p.vy > 0) { p.y = H - 24; p.vy = -p.vy * 0.6; }
        // เด้งออกจากการ์ด
        for (let j = 0; j < obstacles.length; j++) {
          const o = obstacles[j];
          if (!insideRect(o, p.x, p.y, PAD)) continue;
          const dl = p.x - (o.l - PAD), dr = (o.r + PAD) - p.x;
          const dt2 = p.y - (o.t - PAD), db = (o.b + PAD) - p.y;
          const m = Math.min(dl, dr, dt2, db);
          if (m === dl) { p.x = o.l - PAD; p.vx = -Math.abs(p.vx) * 0.6; }
          else if (m === dr) { p.x = o.r + PAD; p.vx = Math.abs(p.vx) * 0.6; }
          else if (m === dt2) { p.y = o.t - PAD; p.vy = -Math.abs(p.vy) * 0.6; }
          else { p.y = o.b + PAD; p.vy = Math.abs(p.vy) * 0.6; }
        }
        const spin = p.mesh.userData.spin;
        if (spin) {
          if (p.def.roll) {                       // ลูกกลมๆ กลิ้งไปตามทาง
            spin.rotation.x -= (p.vy * dt) / 10;
            spin.rotation.z -= (p.vx * dt) / 10;
          } else {                                // ของเหลี่ยม/ยาว หมุนควงแบนๆ
            p.spin += Math.hypot(p.vx, p.vy) * dt * 0.055;
            spin.rotation.y = p.spin;
          }
        }
      }

      // ตกลงพื้นตอนเพิ่งวาง
      if (p.drop > 0) {
        p.drop = Math.max(0, p.drop - dt * 130);
        p.mesh.userData.hop.position.y = p.drop;
      }

      p.mesh.position.set(p.x, -p.y, p.y * 0.25 + 1);

      if (p.kind === "food" && p.bites <= 0) { removeProp(p); }
    }
  }

  /* ============================================================
     11. ตัวสัตว์ + สมองน้อยๆ
     ============================================================ */
  const critters = [];

  /** เลือกสีย่อยที่ยังไม่มีบนจอ (ถ้าเลี่ยงได้) */
  function pickVariant(spec) {
    if (!spec.variants || !spec.variants.length) return null;
    const used = {};
    critters.forEach((c) => {
      if (c.spec.id === spec.id && c.variant) used[c.variant.id] = true;
    });
    const free = spec.variants.filter((v) => !used[v.id]);
    return pickOne(free.length ? free : spec.variants);
  }

  function spawn(speciesId, atX, atY) {
    const spec = SPECIES_BY_ID.get(speciesId);
    if (!spec) {                                  // ไม่แอบสุ่มตัวอื่นให้ — บอกว่าผิดไปเลย
      console.error("[critters] ไม่รู้จักสัตว์ id:", speciesId);
      return null;
    }
    if (critters.length >= MAX_CRITTERS) {
      toast(T().full);
      return null;
    }

    const variant = pickVariant(spec);
    const parts = buildModel(spec, variant);
    scene.add(parts.root);

    const spot = freePoint();
    const x = atX != null ? atX : (spot ? spot.x : rand(40, Math.max(60, W - 40)));
    const y = atY != null ? atY : (spot ? spot.y : rand(H * 0.5, Math.max(H * 0.5 + 10, H - 60)));

    const c = {
      spec: spec, variant: variant, parts: parts,
      x: x, y: y, vx: 0, vy: 0,
      heading: rand(-Math.PI, Math.PI),
      speed: spec.trait.speed * rand(0.85, 1.15),
      state: "wander", timer: rand(0.5, 2),
      tx: x, ty: y,
      walkPhase: rand(0, 6.28),
      hop: 0, hopV: 0,
      blink: rand(1.5, 5),
      mood: 0, startle: 0, pawTimer: 0, born: 0,
      target: null,          // ของที่กำลังมุ่งไป (อาหาร/ของเล่น)
      chewCard: null,        // การ์ดที่กำลังแทะ
      biteTimer: 0,
      fed: 0,                // เพิ่งกินอิ่ม → ขี้เล่นขึ้นชั่วคราว
      wingPhase: rand(0, 6.28),
      path: null, pathGoal: null,      // เส้นทางเดินอ้อมการ์ดที่คิดไว้
      pathStamp: -1, pathTimer: 0,
      held: false,                     // กำลังถูกจับลากอยู่
      foe: null, foeCool: 0,           // คู่ทะเลาะ + ช่วงพักหลังเลิกทะเลาะ
      stuckTimer: 0, lastX: x, lastY: y,
      ignoreProp: null, ignoreUntil: 0  // ของที่เพิ่งเดินไปไม่ถึง พักไว้ก่อน
    };
    critters.push(c);

    spawnPuff(x, y - parts.height * 0.4, TEX_STAR, 5, { size: 14 });
    updateCount();
    return c;
  }

  function despawn(c) {
    scene.remove(c.parts.root);
    c.parts.root.traverse((o) => {
      if (o.isSprite && o.material) o.material.dispose();
    });
    const i = critters.indexOf(c);
    if (i >= 0) critters.splice(i, 1);
    updateCount();
  }

  function clearAll() {
    while (critters.length) {
      const c = critters[critters.length - 1];
      spawnPuff(c.x, c.y - c.parts.height * 0.4, TEX_STAR, 4, { size: 12 });
      despawn(c);
    }
    while (props.length) removeProp(props[0]);
    toast(T().cleared);
  }

  /** ปล่อยหลายตัวแบบไม่ซ้ำชนิดกัน */
  function spawnAssorted(n) {
    const bag = shuffled(SPECIES);
    let made = 0;
    for (let i = 0; i < bag.length && made < n; i++) {
      if (spawn(bag[i].id)) made++;
    }
    return made;
  }

  /* ============================================================
     12. กล่อง UI — ต้องหลบ และแอบกัดเล่นได้
     ============================================================ */
  let obstacles = [];
  let chewables = [];
  let navNodes = [];     // จุดต่อของกราฟเส้นทาง (มุมการ์ด)
  let navEdges = [];
  let navStamp = 0;      // เปลี่ยนเลขเมื่อผังการ์ดเปลี่ยน → ทุกตัวคิดทางใหม่
  let obstacleTimer = 0;
  let avoidOn = window.innerWidth >= AVOID_MIN_WIDTH;

  const PAD = 14;
  const MAX_PUSH = 12;      // ดันออกได้สูงสุดกี่พิกเซลต่อเฟรม (เร็วกว่าที่สัตว์วิ่งได้มาก)

  function insideRect(o, x, y, pad) {
    return x > o.l - pad && x < o.r + pad && y > o.t - pad && y < o.b + pad;
  }

  function refreshObstacles() {
    avoidOn = window.innerWidth >= AVOID_MIN_WIDTH;
    obstacles = [];
    chewables = [];
    if (!avoidOn) return;      // จอแคบ: ปล่อยเดินทับการ์ดไปเลย ไม่งั้นไม่เหลือที่
    document.querySelectorAll(OBSTACLE_SELECTOR).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      if (r.bottom < -80 || r.top > H + 80) return;
      const box = { l: r.left, r: r.right, t: r.top, b: r.bottom, el: el };
      obstacles.push(box);
      if (el.matches && el.matches(CHEWABLE_SELECTOR)) chewables.push(box);
    });
    buildNavGraph();
  }

  function avoid(c, ax) {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (!insideRect(o, c.x, c.y, PAD)) continue;
      const dl = c.x - (o.l - PAD), dr = (o.r + PAD) - c.x;
      const dt = c.y - (o.t - PAD), db = (o.b + PAD) - c.y;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) { ax.x -= 300; c.x -= Math.min(MAX_PUSH, dl); c.vx = Math.min(c.vx, 0); }
      else if (m === dr) { ax.x += 300; c.x += Math.min(MAX_PUSH, dr); c.vx = Math.max(c.vx, 0); }
      else if (m === dt) { ax.y -= 300; c.y -= Math.min(MAX_PUSH, dt); c.vy = Math.min(c.vy, 0); }
      else { ax.y += 300; c.y += Math.min(MAX_PUSH, db); c.vy = Math.max(c.vy, 0); }
    }
  }

  function freePoint() {
    for (let i = 0; i < 16; i++) {
      const x = rand(40, Math.max(60, W - 40));
      const y = rand(80, Math.max(100, H - 40));
      let clear = true;
      for (let j = 0; j < obstacles.length; j++) {
        if (insideRect(obstacles[j], x, y, PAD + 8)) { clear = false; break; }
      }
      if (clear) return { x: x, y: y };
    }
    return null;
  }

  /* --- เดินอ้อมกล่อง UI ------------------------------------
     แรงผลัก (avoid) อย่างเดียวไม่พอ: ถ้าของกินอยู่อีกฝั่งของการ์ด
     สัตว์จะเดินตรงเข้าชนขอบการ์ดแล้วติดอยู่ที่นั่น เพราะแรงเดินเข้าหา
     เป้ากับแรงผลักออกหักกลบกันพอดี

     ทางแก้: ก่อนจะเดิน เช็คว่าเส้นตรงจากตัวไปเป้าตัดการ์ดใบไหนไหม
     ถ้าตัด ให้เดินไปที่ "มุมการ์ด" ที่อ้อมสั้นที่สุดก่อน แล้วค่อยไปต่อ
     คิดใหม่ทุกเฟรม จึงแก้ตัวเองได้เรื่อยๆ เวลาการ์ดเลื่อน
     --------------------------------------------------------- */

  /** เส้นตรงจาก (x0,y0) ถึง (x1,y1) ตัดผ่านกล่องไหม (Liang–Barsky) */
  function segHitsRect(x0, y0, x1, y1, o, pad) {
    const l = o.l - pad, r = o.r + pad, tp = o.t - pad, bt = o.b + pad;
    const dx = x1 - x0, dy = y1 - y0;
    let t0 = 0, t1 = 1;
    const edges = [[-dx, x0 - l], [dx, r - x0], [-dy, y0 - tp], [dy, bt - y0]];
    for (let i = 0; i < 4; i++) {
      const p = edges[i][0], q = edges[i][1];
      if (p === 0) {
        if (q < 0) return false;          // ขนานกับขอบและอยู่นอกกล่อง
      } else {
        const k = q / p;
        if (p < 0) { if (k > t1) return false; if (k > t0) t0 = k; }
        else { if (k < t0) return false; if (k < t1) t1 = k; }
      }
    }
    return true;
  }

  const DETOUR_GAP = PAD + 12;

  /** เดินตรงจาก (x0,y0) ถึง (x1,y1) ได้ไหม (ไม่ตัดการ์ดใบไหนเลย) */
  function visible(x0, y0, x1, y1) {
    for (let i = 0; i < obstacles.length; i++) {
      if (segHitsRect(x0, y0, x1, y1, obstacles[i], PAD)) return false;
    }
    return true;
  }

  /* --- กราฟเส้นทาง (visibility graph) ---------------------
     จุดต่อ = มุมของการ์ดทุกใบ (ถอยออกมา DETOUR_GAP)
     เชื่อมจุดที่เดินตรงหากันได้ แล้วหาเส้นทางสั้นสุดด้วย Dijkstra

     ทำไมต้องใช้กราฟ ไม่ใช่ "เลือกมุมที่ใกล้เป้าที่สุด" แบบง่ายๆ:
     การเลือกทีละมุมมันมองแค่ก้าวเดียว เลยเดินเข้าซอกตันได้
     เช่นลงไปมุมล่างซ้ายของการ์ด แล้วพบว่าใต้การ์ดแคบเกินจะเดินต่อ
     --------------------------------------------------------- */
  function buildNavGraph() {
    navNodes = [];
    const g = DETOUR_GAP;
    for (let k = 0; k < obstacles.length; k++) {
      const o = obstacles[k];
      const cand = [
        [o.l - g, o.t - g], [o.r + g, o.t - g],
        [o.l - g, o.b + g], [o.r + g, o.b + g]
      ];
      for (let i = 0; i < cand.length; i++) {
        const x = clamp(cand[i][0], 26, Math.max(30, W - 26));
        const y = clamp(cand[i][1], 72, Math.max(80, H - 22));
        let bad = false;
        for (let j = 0; j < obstacles.length; j++) {
          if (insideRect(obstacles[j], x, y, PAD)) { bad = true; break; }
        }
        if (!bad) navNodes.push({ x: x, y: y });
      }
    }
    navEdges = navNodes.map(() => []);
    for (let i = 0; i < navNodes.length; i++) {
      for (let j = i + 1; j < navNodes.length; j++) {
        const a = navNodes[i], b = navNodes[j];
        if (!visible(a.x, a.y, b.x, b.y)) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        navEdges[i].push({ j: j, cost: d });
        navEdges[j].push({ j: i, cost: d });
      }
    }
    navStamp++;
  }

  /** คืนอาเรย์จุดพัก (ไม่รวมจุดเริ่ม/จุดจบ)
      []   = เดินตรงไปได้เลย
      null = ไปไม่ถึงจริงๆ (ผู้เรียกต้องเลิกล้มแผน ไม่ใช่ยืนดันกำแพง) */
  function findPath(sx, sy, tx, ty) {
    if (visible(sx, sy, tx, ty)) return [];
    const N = navNodes.length;
    if (!N) return null;

    const startVis = [], goalVis = [];
    for (let i = 0; i < N; i++) {
      if (visible(sx, sy, navNodes[i].x, navNodes[i].y)) startVis.push(i);
      if (visible(tx, ty, navNodes[i].x, navNodes[i].y)) goalVis.push(i);
    }
    if (!startVis.length || !goalVis.length) return null;

    const dist = new Array(N).fill(Infinity);
    const prev = new Array(N).fill(-1);
    const done = new Array(N).fill(false);
    for (let i = 0; i < startVis.length; i++) {
      const n = navNodes[startVis[i]];
      dist[startVis[i]] = Math.hypot(n.x - sx, n.y - sy);
    }
    for (;;) {
      let u = -1, bd = Infinity;
      for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
      if (u < 0) break;
      done[u] = true;
      const es = navEdges[u];
      for (let e = 0; e < es.length; e++) {
        const nd = dist[u] + es[e].cost;
        if (nd < dist[es[e].j]) { dist[es[e].j] = nd; prev[es[e].j] = u; }
      }
    }

    let end = -1, bestTotal = Infinity;
    for (let i = 0; i < goalVis.length; i++) {
      const k = goalVis[i], n = navNodes[k];
      const total = dist[k] + Math.hypot(tx - n.x, ty - n.y);
      if (total < bestTotal) { bestTotal = total; end = k; }
    }
    if (end < 0 || !isFinite(dist[end])) return null;

    const path = [];
    for (let i = end; i >= 0; i = prev[i]) path.unshift({ x: navNodes[i].x, y: navNodes[i].y });
    return path;
  }

  /** เลือกจุดที่ควรเดินไปตอนนี้ (null = มุ่งตรงไปที่เป้าได้เลย) */
  function steerTo(c, tx, ty, dt) {
    c.pathTimer -= dt;
    const stale = !c.pathGoal || c.pathStamp !== navStamp || c.pathTimer <= 0 ||
      Math.hypot(c.pathGoal.x - tx, c.pathGoal.y - ty) > 90;
    if (stale) {
      c.path = findPath(c.x, c.y, tx, ty);
      c.pathGoal = { x: tx, y: ty };
      c.pathStamp = navStamp;
      c.pathTimer = 0.4;
    }
    if (!c.path || !c.path.length) return null;
    while (c.path.length && Math.hypot(c.path[0].x - c.x, c.path[0].y - c.y) < 22) c.path.shift();
    return c.path.length ? c.path[0] : null;
  }

  function pickTarget(c) {
    const p = freePoint();
    if (p) { c.tx = p.x; c.ty = p.y; return true; }
    c.tx = Math.random() < 0.5 ? rand(20, 60) : rand(Math.max(60, W - 60), Math.max(70, W - 20));
    c.ty = rand(80, Math.max(100, H - 40));
    return false;
  }

  /** เลือกจุดริมการ์ดใบที่ใกล้ที่สุด สำหรับไปยืนแทะ
      จุดหมายต้องอยู่พ้นเขตผลัก (PAD) พอสมควร ไม่งั้นแรงผลักจะสู้กับ
      แรงเดินเข้าหาเป้า แล้วเดินไปไม่ถึงจุดหมายเลย */
  const CHEW_GAP = PAD + 10;
  function pickChewSpot(c) {
    if (!chewables.length) return false;
    let o = chewables[0], bestD = Infinity;
    for (let i = 0; i < chewables.length; i++) {
      const b = chewables[i];
      const cx = (b.l + b.r) / 2, cy = (b.t + b.b) / 2;
      const d = Math.hypot(cx - c.x, cy - c.y);
      if (d < bestD) { bestD = d; o = b; }
    }
    const side = randInt(0, 3);
    if (side === 0) { c.tx = rand(o.l + 20, o.r - 20); c.ty = o.t - CHEW_GAP; }
    else if (side === 1) { c.tx = rand(o.l + 20, o.r - 20); c.ty = o.b + CHEW_GAP; }
    else if (side === 2) { c.tx = o.l - CHEW_GAP; c.ty = rand(o.t + 20, o.b - 20); }
    else { c.tx = o.r + CHEW_GAP; c.ty = rand(o.t + 20, o.b - 20); }
    c.ty = clamp(c.ty, 80, Math.max(90, H - 30));
    c.tx = clamp(c.tx, 30, Math.max(40, W - 30));
    c.chewCard = o;
    return true;
  }

  /** ทำให้การ์ดสั่นตอนโดนแทะ */
  function shakeCard(box, x, y) {
    if (!box || !box.el) return;
    box.el.classList.add("critter-chewed");
    setTimeout(() => box.el.classList.remove("critter-chewed"), 340);
    spawnPuff(x, y, TEX_CHIP, 3, { size: 9, max: 0.6 });
  }

  /* ============================================================
     13. เมาส์
     ============================================================ */
  const mouse = { x: -9999, y: -9999, px: -9999, py: -9999, speed: 0, inside: false };

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
  }, { passive: true });
  window.addEventListener("mouseleave", () => { mouse.inside = false; mouse.x = mouse.y = -9999; });
  window.addEventListener("touchmove", (e) => {
    if (!e.touches[0]) return;
    mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; mouse.inside = true;
  }, { passive: true });

  function critterAt(px, py) {
    for (let i = critters.length - 1; i >= 0; i--) {
      const c = critters[i];
      const cy = c.y - c.parts.height * 0.5;
      const r = Math.max(20, c.parts.height * 0.5);
      const dx = px - c.x, dy = py - cy;
      if (dx * dx + dy * dy < r * r) return c;
    }
    return null;
  }

  function propAt(px, py) {
    for (let i = props.length - 1; i >= 0; i--) {
      const p = props[i];
      const r = p.def.shadow + 8;
      const dx = px - p.x, dy = py - (p.y - r * 0.5);
      if (dx * dx + dy * dy < r * r) return p;
    }
    return null;
  }

  /** หาสิ่งที่อยู่ใต้เมาส์ (ของบนพื้นมาก่อน เพราะชิ้นเล็กกว่า จับยากกว่า) */
  function grabAt(px, py) {
    const p = propAt(px, py);
    if (p) return { kind: "prop", prop: p };
    const c = critterAt(px, py);
    if (c) return { kind: "critter", critter: c };
    return null;
  }

  /* --- ระบบลาก ---------------------------------------------
     จับได้ทั้งสัตว์ อาหาร และของเล่น
     - แตะเฉยๆ (ไม่ขยับ) = ลูบหัวสัตว์ / เขี่ยของเล่น
     - กดค้างแล้วลาก = ย้ายตำแหน่ง
     - ลากมาปล่อยที่แผงควบคุม = เก็บออกไป
     --------------------------------------------------------- */
  const drag = { active: false, moved: false, target: null, sx: 0, sy: 0 };
  let overDock = false;

  function dockHit(px, py) {
    if (!dockEl) return false;
    const r = dockEl.getBoundingClientRect();
    return px >= r.left - 12 && px <= r.right + 12 && py >= r.top - 12 && py <= r.bottom + 12;
  }

  // canvas ปกติไม่รับคลิก (จะได้กดลิงก์ข้างใต้ได้)
  // แต่ถ้าเมาส์อยู่บนตัวสัตว์/ของ ค่อยเปิดรับคลิกชั่วคราว
  function updatePointerCapture() {
    const want = (drag.active || (mouse.inside && grabAt(mouse.x, mouse.y))) ? "auto" : "none";
    if (canvas.style.pointerEvents !== want) canvas.style.pointerEvents = want;
    canvas.style.cursor = drag.active ? "grabbing" : (want === "auto" ? "grab" : "");
  }

  function beginDrag(e) {
    const hit = grabAt(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    drag.active = true;
    drag.moved = false;
    drag.target = hit;
    drag.sx = e.clientX; drag.sy = e.clientY;
    if (hit.kind === "prop") hit.prop.held = true;
    else {
      hit.critter.held = true;
      hit.critter.vx = 0; hit.critter.vy = 0;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* บางเบราว์เซอร์ไม่มี ก็ไม่เป็นไร */ }
  }

  function moveDrag(e) {
    if (!drag.active) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    const t = drag.target;
    if (t.kind === "prop") { t.prop.x = e.clientX; t.prop.y = e.clientY; }
    else { t.critter.x = e.clientX; t.critter.y = e.clientY; }

    const on = dockHit(e.clientX, e.clientY);
    if (on !== overDock) {
      overDock = on;
      if (dockEl) dockEl.classList.toggle("is-bin", on);
    }
  }

  function endDrag(e) {
    if (!drag.active) return;
    const t = drag.target;
    const px = e ? e.clientX : mouse.x, py = e ? e.clientY : mouse.y;
    drag.active = false;
    drag.target = null;
    if (dockEl) dockEl.classList.remove("is-bin");
    const wasOverDock = overDock;
    overDock = false;

    if (t.kind === "prop") {
      const p = t.prop;
      p.held = false;
      if (drag.moved && wasOverDock) {          // ลากมาทิ้ง = เก็บออก
        spawnPuff(p.x, p.y, TEX_STAR, 4, { size: 12 });
        removeProp(p);
        return;
      }
      const spot = nudgeOutOfCards(p.x, p.y);
      p.x = spot.x; p.y = spot.y;
      p.drop = 22;
      if (!drag.moved && p.kind === "toy") {    // แตะเฉยๆ = เขี่ยเล่น
        p.vx = rand(-220, 220); p.vy = rand(-220, 220);
      }
      spawnPuff(p.x, p.y, TEX_STAR, 2, { size: 9 });
      return;
    }

    const c = t.critter;
    c.held = false;
    if (drag.moved && wasOverDock) {            // ลากสัตว์มาทิ้ง = เก็บกลับบ้าน
      spawnPuff(c.x, c.y - c.parts.height * 0.4, TEX_STAR, 5, { size: 13 });
      despawn(c);
      return;
    }
    const spot = nudgeOutOfCards(c.x, c.y);
    c.x = spot.x; c.y = spot.y;
    c.path = null; c.pathGoal = null;           // ย้ายที่แล้วต้องคิดทางใหม่
    if (drag.moved) {
      // ปล่อยลงพื้น: ตกใจเล็กน้อยแล้วสะบัดตัว
      c.hopV = 120;
      c.startle = 0.8;
      c.state = "idle"; c.timer = rand(0.6, 1.2);
      spawnPuff(c.x, c.y, TEX_DUST, 3, { size: 15, max: 0.6, vy: 10 });
    } else {
      // แตะเฉยๆ = ลูบหัว
      c.mood = MOOD_PET;
      c.hopV = 190;
      c.state = "happy";
      c.timer = 1.4;
      spawnPuff(c.x, c.y - c.parts.height * 0.75, TEX_HEART, 4, { size: 16 });
    }
    void px; void py;
  }

  canvas.addEventListener("pointerdown", beginDrag);
  canvas.addEventListener("pointermove", moveDrag, { passive: true });
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", () => endDrag(null));

  /* ============================================================
     14. ลูปหลัก
     ============================================================ */
  let running = true;
  let last = performance.now();
  let rafId = null;

  // อ่านผังการ์ด + สร้างกราฟเส้นทางรอบแรก ก่อนเริ่มวาด
  // (ต้องเรียกที่นี่ ไม่ใช่ตรงจุดที่นิยามฟังก์ชัน เพราะระบบเส้นทาง
  //  ถูกประกาศด้วย const/let ที่อยู่ถัดลงไป — เรียกก่อนจะยังเข้าไม่ถึง)
  refreshObstacles();

  function step(now) {
    rafId = requestAnimationFrame(step);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;          // กันกระตุกตอนสลับแท็บกลับมา
    if (!running) { renderer.render(scene, camera); return; }

    const mdx = mouse.x - mouse.px, mdy = mouse.y - mouse.py;
    mouse.speed = Math.sqrt(mdx * mdx + mdy * mdy) / dt;
    mouse.px = mouse.x; mouse.py = mouse.y;

    obstacleTimer -= dt;
    if (obstacleTimer <= 0) { refreshObstacles(); obstacleTimer = 0.4; }

    updateProps(dt);
    for (let i = 0; i < critters.length; i++) updateCritter(critters[i], dt);
    updatePetals(dt);
    updatePuffs(dt);
    updatePointerCapture();

    renderer.render(scene, camera);
  }

  /** หาของที่ใกล้ที่สุดในรัศมี */
  function nearestProp(c, kind, radius) {
    let best = null, bestD = radius * radius;
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (p.kind !== kind) continue;
      const dx = p.x - c.x, dy = p.y - c.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  /** หาคู่ทะเลาะ — ชอบเกิดตอนแย่งของกินชิ้นเดียวกัน */
  function findRival(c, dt, naughty) {
    for (let i = 0; i < critters.length; i++) {
      const o = critters[i];
      if (o === c || o.held || o.foe || o.foeCool > 0) continue;
      if (o.state === "squabble" || o.state === "happy" || o.state === "sleep") continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (d > 66) continue;
      const sameFood = c.state === "eat" && o.state === "eat" && c.target && c.target === o.target;
      const mean = (naughty + (o.spec.trait.naughty != null ? o.spec.trait.naughty : 0.5)) * 0.5;
      const chance = (sameFood ? 3.2 : 0.28) * mean;
      if (Math.random() < chance * dt) return o;
    }
    return null;
  }

  function startSquabble(a, b) {
    const dur = rand(1.3, 2.4);
    [[a, b], [b, a]].forEach((pair) => {
      const x = pair[0];
      x.foe = pair[1];
      x.state = "squabble";
      x.timer = dur;
      x.target = null;
      x.path = null; x.pathGoal = null;
    });
    spawnPuff((a.x + b.x) / 2, (a.y + b.y) / 2, TEX_ANGRY, 2, { size: 16, max: 0.7 });
  }

  /** เลิกทะเลาะ — ผลักออกจากกันแล้วแยกย้าย */
  function endSquabble(c) {
    const o = c.foe;
    c.foe = null;
    c.foeCool = 6;
    if (o) {
      o.foe = null;
      o.foeCool = 6;
      const dx = o.x - c.x, dy = o.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      c.vx = -dx / d * 150; c.vy = -dy / d * 150;
      o.vx = dx / d * 150; o.vy = dy / d * 150;
      if (o.state === "squabble") {
        o.state = "wander"; o.timer = rand(1.6, 3); o.startle = 0.7;
        pickTarget(o);
      }
      spawnPuff((c.x + o.x) / 2, (c.y + o.y) / 2, TEX_STAR, 4, { size: 12 });
    }
    c.startle = 0.7;
  }

  function updateCritter(c, dt) {
    const p = c.parts;
    const tr = c.spec.trait;
    const naughty = tr.naughty != null ? tr.naughty : 0.5;
    c.born += dt;

    /* ---------- ถูกจับห้อยอยู่ ----------
       ไม่ต้องคิดอะไร แค่ห้อยขยับขาเปะปะให้ดูน่ารัก */
    if (c.held) {
      c.mood = Math.max(0, c.mood - dt * MOOD_DECAY);
      if (c.foe) endSquabble(c);
      p.root.position.set(c.x, -c.y, 1300);
      p.bob.position.y = 30 + Math.sin(c.born * 8) * 3;
      p.bob.rotation.z = Math.sin(c.born * 6.5) * 0.14;
      p.bob.rotation.x = 0;
      p.shadow.material.opacity = 0.07;
      for (let i = 0; i < p.legs.length; i++) {
        const L = p.legs[i];
        L.pivot.rotation.x = L.base + Math.sin(c.born * 11 + L.phase) * 0.55;
      }
      for (let i = 0; i < p.ears.length; i++) p.ears[i].rotation.x = Math.sin(c.born * 9 + i) * 0.2;
      p.tail.rotation.y = Math.sin(c.born * 10) * 0.4;
      p.head.rotation.x = -0.15;
      for (let i = 0; i < p.eyes.length; i++) p.eyes[i].scale.y = 1;
      return;
    }
    c.foeCool = Math.max(0, c.foeCool - dt);
    c.timer -= dt;
    c.mood = Math.max(0, c.mood - dt * MOOD_DECAY);
    c.fed = Math.max(0, c.fed - dt);
    c.startle = Math.max(0, c.startle - dt * 1.6);

    const bodyY = c.y - p.height * 0.5;
    const dmx = mouse.x - c.x, dmy = mouse.y - bodyY;
    const mdist = Math.sqrt(dmx * dmx + dmy * dmy);

    if (mouse.inside && mdist < 110 && mouse.speed > 1400 && c.startle <= 0) {
      c.startle = 1;
      c.hopV = 130;
      spawnPuff(c.x, c.y - p.height, TEX_STAR, 2, { size: 11 });
    }

    /* ---------- เลือกสถานะ ---------- */
    const busy = c.state === "happy" || c.state === "eat" || c.state === "chew" || c.state === "nuzzle";

    if (c.ignoreProp && c.born > c.ignoreUntil) c.ignoreProp = null;

    // อาหารมาก่อนเสมอ — ใครก็ยอมทิ้งทุกอย่างเพื่อของกิน
    // รัศมีกว้างเกือบเต็มจอ เพื่อให้ "วางขนมแล้วทุกตัววิ่งมาแย่งกัน"
    if (c.state !== "eat") {
      const food = nearestProp(c, "food", 1100);
      if (food && food !== c.ignoreProp) { c.state = "eat"; c.target = food; c.timer = 14; }
    }
    // ของเล่น — เห็นได้ไกล ไม่งั้นเดินหลงไปแล้วไม่กลับมาเล่นอีกเลย
    if (!busy && c.state !== "play") {
      const toy = nearestProp(c, "toy", 850);
      if (toy && toy !== c.ignoreProp && Math.random() < (0.5 + naughty) * dt * 1.8) {
        c.state = "play"; c.target = toy; c.timer = rand(5, 10);
      }
    }
    if (!busy) {
      if (mouse.inside && mdist < 300 && tr.curiosity > 0.2 && c.state !== "chase") {
        if (Math.random() < tr.curiosity * dt * 2.2) { c.state = "chase"; c.timer = rand(2, 5); }
      } else if (mouse.inside && mdist < 190 && tr.curiosity < -0.2) {
        c.state = "flee"; c.timer = rand(0.8, 1.6);
      }
    }
    // เดินไปถึงเมาส์แล้ว → อ้อน
    if (c.state === "chase" && mouse.inside && mdist < 62) {
      c.state = "nuzzle"; c.timer = rand(1.6, 3.2);
    }

    // ทะเลาะกัน
    if (c.state === "squabble") {
      // คู่กรณีหายไปกลางทาง (ถูกเก็บ / ถูกจับ) ก็เลิกเอง
      if (!c.foe || c.foe.held || critters.indexOf(c.foe) < 0) {
        c.foe = null; c.foeCool = 4;
        c.state = "wander"; c.timer = rand(1.2, 2.4); pickTarget(c);
      }
    } else if (!busy && c.foeCool <= 0 && !c.foe) {
      const rival = findRival(c, dt, naughty);
      if (rival) startSquabble(c, rival);
    }

    if (c.timer <= 0) {
      if (c.state === "squabble") endSquabble(c);
      if (c.state === "eat" || c.state === "play") { c.target = null; }
      c.chewCard = null;
      const r = Math.random();
      if (c.state === "idle" || c.state === "sleep" || c.state === "groom") {
        c.state = "wander"; c.timer = rand(1.5, 4.5); pickTarget(c);
      } else if (r < 0.14 * naughty && chewables.length && avoidOn) {
        // แอบไปแทะการ์ด — ให้เวลาพอเดินไปถึงจริง ไม่ใช่เดินครึ่งทางแล้วเลิก
        if (pickChewSpot(c)) {
          const far = Math.hypot(c.tx - c.x, c.ty - c.y);
          c.state = "goChew";
          c.timer = Math.min(16, 2.5 + far / (c.speed * 0.7));
        } else { c.state = "wander"; c.timer = 3; pickTarget(c); }
      } else if (r < 0.20 + naughty * 0.12 && (c.fed > 0 || tr.energy > 0.7)) {
        c.state = "zoomies"; c.timer = rand(1.4, 2.6);
      } else if (r < 0.34 * (1.2 - tr.energy)) {
        c.state = "sleep"; c.timer = rand(2.5, 6);
      } else if (r < 0.46) {
        c.state = "groom"; c.timer = rand(1.2, 2.6);
      } else if (r < 0.56) {
        c.state = "idle"; c.timer = rand(0.8, 2.4);
      } else {
        c.state = "wander"; c.timer = rand(1.8, 5); pickTarget(c);
      }
    }

    /* ---------- ทิศที่อยากไป ---------- */
    let wantX = 0, wantY = 0, gas = 0;
    // goal = จุดหมายจริง (จะถูกส่งเข้าระบบเดินอ้อมการ์ดทีหลัง)
    let goalX = 0, goalY = 0, hasGoal = false;

    if (c.state === "wander" || c.state === "goChew") {
      goalX = c.tx; goalY = c.ty; hasGoal = true;
      gas = 1;
      const dist = Math.hypot(c.tx - c.x, c.ty - c.y);
      if (c.state === "goChew") {
        if (dist < 40) { c.state = "chew"; c.timer = rand(1.8, 3.6); c.biteTimer = 0; }
      } else if (dist < 26) pickTarget(c);
    } else if (c.state === "eat" && c.target) {
      if (props.indexOf(c.target) < 0) { c.target = null; c.state = "wander"; pickTarget(c); }
      else {
        goalX = c.target.x; goalY = c.target.y; hasGoal = true;
        const d = Math.hypot(goalX - c.x, goalY - c.y);
        gas = d > 26 ? 1.4 : 0;
        if (d <= 30) {
          c.biteTimer -= dt;
          if (c.biteTimer <= 0) {
            c.biteTimer = 0.45;
            c.target.bites -= 1;
            c.mood = Math.max(c.mood, MOOD_EAT);
            c.fed = FED_TIME;
            c.hopV = Math.max(c.hopV, 60);
            spawnPuff(c.target.x, c.target.y - 10, TEX_HEART, 2, { size: 13 });
          }
        }
      }
    } else if (c.state === "play" && c.target) {
      if (props.indexOf(c.target) < 0) { c.target = null; c.state = "wander"; pickTarget(c); }
      else {
        goalX = c.target.x; goalY = c.target.y; hasGoal = true;
        const bx = goalX - c.x, by = goalY - c.y;
        const d = Math.hypot(bx, by) || 1;
        gas = 1.35;
        if (d < 30) {          // เตะบอล
          c.target.vx += (bx / d) * 260;
          c.target.vy += (by / d) * 260;
          c.mood = Math.max(c.mood, MOOD_PLAY);
          if (Math.random() < 0.4) spawnPuff(c.x, c.y - p.height * 0.8, TEX_HEART, 1, { size: 12 });
        }
      }
    } else if (c.state === "chew") {
      gas = 0;
      c.biteTimer -= dt;
      if (c.biteTimer <= 0) {
        c.biteTimer = 0.42;
        shakeCard(c.chewCard, c.x, c.y - p.height * 0.4);
        c.hopV = Math.max(c.hopV, 40);
      }
    } else if (c.state === "chase") {
      goalX = mouse.x; goalY = mouse.y + p.height * 0.4; hasGoal = true;
      gas = mdist > 55 ? 1.25 : 0;
      if (!mouse.inside) { c.state = "wander"; pickTarget(c); }
    } else if (c.state === "nuzzle") {
      goalX = mouse.x; goalY = mouse.y + p.height * 0.35; hasGoal = true;
      gas = mdist > 34 ? 0.7 : 0;
      if (!mouse.inside) { c.state = "wander"; pickTarget(c); }
      if (Math.random() < dt * 3.2) spawnPuff(c.x, c.y - p.height * 0.85, TEX_HEART, 1, { size: 13 });
      c.mood = Math.max(c.mood, MOOD_NUZZLE);
    } else if (c.state === "squabble") {
      gas = 0;
      // ฝุ่นตลบระหว่างสองตัว + ประกายโมโหเป็นระยะ
      if (c.foe && c.x <= c.foe.x) {     // ให้ตัวซ้ายเป็นคนพ่นเอฟเฟกต์ กันซ้อนกันสองเท่า
        const mx = (c.x + c.foe.x) / 2, my = (c.y + c.foe.y) / 2;
        if (Math.random() < dt * 16) {
          spawnPuff(mx, my - 8, TEX_DUST, 1, { size: rand(16, 26), max: 0.5, vy: rand(20, 50) });
        }
        if (Math.random() < dt * 3) {
          spawnPuff(mx, my - p.height * 0.7, TEX_ANGRY, 1, { size: 13, max: 0.6 });
        }
      }
    } else if (c.state === "flee") {
      wantX = -dmx; wantY = -dmy;
      gas = 1.55;
    } else if (c.state === "zoomies") {
      const a = c.born * 7;
      wantX = Math.cos(a) * 100; wantY = Math.sin(a) * 100;
      gas = 1.7;
    } else {
      gas = 0;                               // idle / sleep / groom / happy
    }

    // ถ้ามีจุดหมายชัดเจน ให้เดินอ้อมการ์ดที่ขวางอยู่ก่อน
    if (hasGoal) {
      const wp = steerTo(c, goalX, goalY, dt);
      wantX = (wp ? wp.x : goalX) - c.x;
      wantY = (wp ? wp.y : goalY) - c.y;
    } else {
      c.path = null; c.pathGoal = null;
    }

    const wl = Math.hypot(wantX, wantY) || 1;
    const accel = { x: (wantX / wl) * c.speed * gas, y: (wantY / wl) * c.speed * gas };

    avoid(c, accel);

    const edge = 34;
    if (c.x < edge) accel.x += (edge - c.x) * 6;
    if (c.x > W - edge) accel.x -= (c.x - (W - edge)) * 6;
    if (c.y < 70) accel.y += (70 - c.y) * 6;
    if (c.y > H - edge) accel.y -= (c.y - (H - edge)) * 6;

    const responsiveness = (c.state === "flee" || c.state === "zoomies") ? 7 : 3.4;
    c.vx += (accel.x - c.vx) * Math.min(1, responsiveness * dt);
    c.vy += (accel.y - c.vy) * Math.min(1, responsiveness * dt);
    if (gas === 0) { c.vx *= Math.pow(0.02, dt); c.vy *= Math.pow(0.02, dt); }

    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.x = clamp(c.x, 12, Math.max(20, W - 12));
    c.y = clamp(c.y, 60, Math.max(70, H - 12));

    /* ---------- กันติดค้าง ----------
       ตาข่ายกันเหนียวชั้นสุดท้าย: ถ้าอยาก "เดิน" แต่แทบไม่ขยับเลย 1.6 วิ
       ถือว่าไปต่อไม่ได้จริง ให้เลิกสนใจเป้าเดิมแล้วเปลี่ยนไปที่อื่น
       (เคสที่เจอ: ของกินอยู่ในซอกที่เดินอ้อมไม่ได้จริงๆ) */
    c.stuckTimer += dt;
    if (c.stuckTimer >= 1.6) {
      if (gas > 0 && Math.hypot(c.x - c.lastX, c.y - c.lastY) < 12) {
        if (c.target) { c.ignoreProp = c.target; c.ignoreUntil = c.born + 8; }
        c.target = null;
        c.chewCard = null;
        c.state = "wander";
        c.timer = rand(1.5, 3);
        c.vx = 0; c.vy = 0;
        pickTarget(c);
      }
      c.stuckTimer = 0; c.lastX = c.x; c.lastY = c.y;
    }

    const sp = Math.hypot(c.vx, c.vy);

    /* ---------- หันหน้า ---------- */
    // จอ y นับลง แต่โลก y นับขึ้น + ตัวเอียง TILT อยู่ ⇒ ต้องหารด้วย sin(TILT)
    let faceX = c.vx, faceY = c.vy;
    if (sp < 6) {
      // ยืนอยู่กับที่: หันไปทางสิ่งที่สนใจ (ของกิน / เมาส์ / การ์ดที่กำลังแทะ)
      if (c.state === "squabble" && c.foe) { faceX = c.foe.x - c.x; faceY = c.foe.y - c.y; }
      else if (c.state === "eat" && c.target) { faceX = c.target.x - c.x; faceY = c.target.y - c.y; }
      else if (c.state === "chew" && c.chewCard) {
        faceX = (c.chewCard.l + c.chewCard.r) / 2 - c.x;
        faceY = (c.chewCard.t + c.chewCard.b) / 2 - c.y;
      } else if ((c.state === "nuzzle" || c.state === "chase") && mouse.inside) { faceX = dmx; faceY = dmy; }
      else { faceX = 0; faceY = 0; }
    }
    if (Math.hypot(faceX, faceY) > 3) {
      let target = Math.atan2(-faceX, -faceY / SIN_TILT);
      if (c.spec.gait === "scuttle") target += Math.PI / 2;    // ปูเดินข้าง
      c.heading = angleLerp(c.heading, target, Math.min(1, dt * 7));
    }
    p.yaw.rotation.y = c.heading;

    p.root.position.set(c.x, -c.y, c.y * 0.25);

    /* ---------- แอนิเมชัน ---------- */
    const gait = c.spec.gait;
    const stride = sp / (c.speed || 1);
    c.walkPhase += dt * (4 + stride * 9);
    c.wingPhase += dt * (p.fastWings ? 34 : 12);

    if (gait === "hop" && stride > 0.15 && c.hop <= 0.01 && c.hopV <= 0) c.hopV = 150 + stride * 90;
    if (gait === "bounce" && c.hop <= 0.01 && c.hopV <= 0) c.hopV = 90 + stride * 120;
    c.hopV -= 620 * dt;
    c.hop += c.hopV * dt;
    if (c.hop <= 0) { c.hop = 0; c.hopV = 0; }

    let bobY = c.hop + p.float;
    let roll = 0, pitch = 0, squash = 1;

    if (gait === "waddle") {
      roll = Math.sin(c.walkPhase * 0.9) * 0.16 * (0.35 + stride);
      bobY += Math.abs(Math.sin(c.walkPhase * 0.9)) * 2 * stride;
    } else if (gait === "crawl" || gait === "wriggle") {
      bobY += Math.sin(c.walkPhase * 0.7) * 1.2 * stride;
      roll = Math.sin(c.walkPhase * 0.8) * 0.1 * stride;
    } else if (gait === "scurry") {
      bobY += Math.abs(Math.sin(c.walkPhase * 1.6)) * 3 * stride;
    } else if (gait === "walk" || gait === "slow") {
      bobY += Math.abs(Math.sin(c.walkPhase)) * 2.2 * stride;
      pitch = Math.sin(c.walkPhase * 2) * 0.02 * stride;
    } else if (gait === "scuttle") {
      bobY += Math.abs(Math.sin(c.walkPhase * 1.4)) * 2 * stride;
    } else if (gait === "float") {
      bobY += Math.sin(c.born * 1.8) * 4;
      roll = Math.sin(c.born * 1.2) * 0.07;
    } else if (gait === "flutter") {
      bobY += Math.sin(c.born * 5.5) * 5;
    } else if (gait === "bounce") {
      squash = 1 + Math.max(-0.18, Math.min(0.22, -c.hopV / 900));
    }

    if (c.mood > 0) bobY += Math.abs(Math.sin(c.born * 16)) * 5 * Math.min(1, c.mood);
    if (c.startle > 0) roll += Math.sin(c.born * 40) * 0.12 * c.startle;
    if (c.state === "squabble") {          // สั่นตึงๆ เหมือนตะลุมบอน
      roll += Math.sin(c.born * 34) * 0.22;
      pitch += Math.sin(c.born * 27) * 0.14;
      bobY += Math.abs(Math.sin(c.born * 21)) * 5;
    }

    p.bob.position.y = bobY;
    p.bob.rotation.z = roll;
    p.bob.rotation.x = pitch;
    if (p.bodyGroup) {
      p.bodyGroup.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    }

    // ขา
    const legAmp = (gait === "hop" || gait === "bounce")
      ? (c.hop > 1 ? 0.5 : 0.15)
      : 0.15 + stride * (gait === "slow" ? 0.5 : 0.85);
    for (let i = 0; i < p.legs.length; i++) {
      const L = p.legs[i];
      L.pivot.rotation.x = L.base + Math.sin(c.walkPhase + L.phase) * legAmp;
    }

    // ปีก / ครีบ / ก้าม
    const flap = gait === "flutter" ? Math.sin(c.wingPhase) * 0.9
      : (Math.sin(c.wingPhase * 0.4) * 0.12 + stride * 0.2 + c.mood * 0.25);
    for (let i = 0; i < p.wings.length; i++) {
      p.wings[i].rotation.z = (i % 2 ? 1 : -1) * flap;
    }
    // หนวดปลาหมึก
    for (let i = 0; i < p.tentacles.length; i++) {
      p.tentacles[i].rotation.x = Math.sin(c.born * 3 + i) * 0.25;
      p.tentacles[i].rotation.z = Math.cos(c.born * 2.6 + i) * 0.2;
    }

    // หัว
    const sleeping = c.state === "sleep";
    const grooming = c.state === "groom";
    const eating = c.state === "eat" && c.target && Math.hypot(c.target.x - c.x, c.target.y - c.y) <= 30;
    const chewing = c.state === "chew";
    let headX = Math.sin(c.born * 1.3) * 0.05;
    if (sleeping) headX = 0.42;
    else if (grooming) headX = 0.62 + Math.sin(c.born * 7) * 0.12;
    else if (eating || chewing) headX = 0.5 + Math.sin(c.born * 14) * 0.18;
    else if (c.mood > 0) headX = -0.28;
    p.head.rotation.x += (headX - p.head.rotation.x) * Math.min(1, dt * 6);
    const headZ = c.state === "idle" ? Math.sin(c.born * 1.1) * 0.12
      : (c.state === "nuzzle" ? Math.sin(c.born * 9) * 0.22 : 0);
    p.head.rotation.z += (headZ - p.head.rotation.z) * Math.min(1, dt * 5);

    // หู
    const earWiggle = Math.sin(c.born * 3.2) * 0.06 + (c.startle > 0 ? Math.sin(c.born * 28) * 0.25 * c.startle : 0);
    for (let i = 0; i < p.ears.length; i++) {
      p.ears[i].rotation.x = earWiggle * (i % 2 ? 1 : -1) + (sleeping ? 0.25 : 0);
    }

    // หาง
    const wag = 0.25 + stride * 0.5 + c.mood * 0.9;
    p.tail.rotation.y = Math.sin(c.born * (5 + stride * 6 + c.mood * 8)) * wag * 0.5;
    p.tail.rotation.x = sleeping ? 0.3 : Math.sin(c.born * 2) * 0.08;

    // ตา
    c.blink -= dt;
    let eyeScale = 1;
    if (sleeping || grooming) eyeScale = 0.12;
    else if (c.blink < 0.12) eyeScale = Math.max(0.12, Math.abs(c.blink) / 0.12);
    if (c.blink < -0.06) c.blink = rand(2, 6);
    for (let i = 0; i < p.eyes.length; i++) p.eyes[i].scale.y = eyeScale;

    // เงา
    const shrink = clamp(1 - (c.hop + p.float) / 90, 0.45, 1);
    p.shadow.scale.x = c.spec.body.w * 1.15 * shrink;
    p.shadow.scale.z = c.spec.body.d * 1.15 * shrink;
    p.shadow.material.opacity = 0.24 * shrink;

    // รอยเท้า
    c.pawTimer -= dt;
    if (!REDUCED_MOTION && stride > 0.55 && p.legs.length > 0 && c.pawTimer <= 0) {
      c.pawTimer = 0.16;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: TEX_PAW, transparent: true, opacity: 0.5, depthWrite: false
      }));
      s.scale.set(10, 10, 1);
      s.position.set(c.x + rand(-4, 4), -c.y + 2, c.y * 0.25 - 1);
      scene.add(s);
      puffs.push({ sprite: s, life: 0, max: 1.1, vx: 0, vy: 0, spin: 0, size: 10, fadeOnly: true });
    }

    // zZZ ตอนหลับ
    if (sleeping && Math.random() < dt * 1.2) {
      spawnPuff(c.x + 8, c.y - p.height * 0.9, TEX_ZZZ, 1, { size: 14, max: 1.6, vx: 14, vy: 40 });
    }
    if (c.mood > MOOD_PET * 0.4 && Math.random() < dt * 5) {
      spawnPuff(c.x, c.y - p.height * 0.9, TEX_HEART, 1, { size: 12 });
    }
  }

  function updatePetals(dt) {
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      p.phase += dt * p.sway;
      p.sprite.position.y -= p.vy * dt;
      p.sprite.position.x += (Math.sin(p.phase) * 26 + p.drift) * dt;
      p.sprite.material.rotation += dt * p.sway * 0.8;
      if (p.sprite.position.y < -H - 30) {
        p.sprite.position.y = 30;
        p.sprite.position.x = rand(-40, W + 40);
      }
      if (p.sprite.position.x > W + 50) p.sprite.position.x = -40;
      if (p.sprite.position.x < -50) p.sprite.position.x = W + 40;
    }
  }

  function updatePuffs(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const f = puffs[i];
      f.life += dt;
      const k = f.life / f.max;
      if (k >= 1) {
        scene.remove(f.sprite);
        f.sprite.material.dispose();
        puffs.splice(i, 1);
        continue;
      }
      if (!f.fadeOnly) {
        f.sprite.position.x += f.vx * dt;
        f.sprite.position.y += f.vy * dt;
        f.sprite.material.rotation += f.spin * dt;
        const s = f.size * (1 + k * 0.4);
        f.sprite.scale.set(s, s, 1);
      }
      f.sprite.material.opacity = (1 - k) * (f.fadeOnly ? 0.5 : 1);
    }
  }

  rafId = requestAnimationFrame(step);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    } else if (!rafId) {
      last = performance.now();
      rafId = requestAnimationFrame(step);
    }
  });

  /* ============================================================
     15. แผงควบคุม
     ============================================================ */
  let dockEl, gridEl, countEl, pauseBtn;

  function buildDock(opts) {
    const o = opts || {};
    const dock = document.createElement("div");
    dock.id = "critter-dock";
    dock.className = "critter-dock";

    const row = document.createElement("div");
    row.className = "critter-row";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "critter-fab";
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<span class="paw" aria-hidden="true">🐾</span><span class="critter-fab-label"></span>';

    const bowl = document.createElement("button");
    bowl.type = "button";
    bowl.className = "critter-bowl js-bowl";
    bowl.innerHTML = '<span aria-hidden="true">🥣</span>';

    const toybox = document.createElement("button");
    toybox.type = "button";
    toybox.className = "critter-bowl critter-toybox js-toybox";
    toybox.innerHTML = '<span aria-hidden="true">🧶</span>';

    const panel = document.createElement("div");
    panel.className = "critter-panel";
    panel.hidden = true;

    if (o.disabled) {
      // เล่นไม่ได้ ก็บอกไปตรงๆ ไม่ต้องแกล้งทำเป็นมีปุ่มให้กด
      panel.innerHTML = '<p class="critter-error"></p>';
      panel.querySelector(".critter-error").textContent = o.disabled;
      toggle.classList.add("is-disabled");
      bowl.hidden = true;
      toybox.hidden = true;
    } else {
      panel.innerHTML =
        '<div class="critter-head">' +
          '<strong class="critter-title"></strong>' +
          '<button type="button" class="critter-x" aria-label="close">✕</button>' +
        "</div>" +
        '<p class="critter-hint"></p>' +
        '<div class="critter-grid" role="group"></div>' +
        '<div class="critter-bar">' +
          '<button type="button" class="critter-btn js-random"></button>' +
          '<button type="button" class="critter-btn js-pause"></button>' +
          '<button type="button" class="critter-btn danger js-clear"></button>' +
          '<span class="critter-count"></span>' +
        "</div>";
    }

    row.appendChild(toggle);
    row.appendChild(bowl);
    row.appendChild(toybox);
    dock.appendChild(panel);
    dock.appendChild(row);
    document.body.appendChild(dock);

    dockEl = dock;
    const open = () => {
      panel.hidden = false;
      dock.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      panel.hidden = true;
      dock.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    };
    toggle.addEventListener("click", () => (panel.hidden ? open() : close()));

    if (o.disabled) { applyDockText(); return; }

    gridEl = panel.querySelector(".critter-grid");
    countEl = panel.querySelector(".critter-count");
    pauseBtn = panel.querySelector(".js-pause");

    SPECIES.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "critter-pick";
      b.dataset.id = s.id;
      b.innerHTML = '<span class="e">' + s.emoji + '</span><span class="n"></span>';
      b.addEventListener("click", () => {
        if (spawn(s.id)) {
          b.classList.add("pop");
          setTimeout(() => b.classList.remove("pop"), 260);
        }
      });
      gridEl.appendChild(b);
    });

    panel.querySelector(".critter-x").addEventListener("click", close);
    panel.querySelector(".js-clear").addEventListener("click", clearAll);
    panel.querySelector(".js-random").addEventListener("click", () => spawnAssorted(randInt(2, 4)));
    pauseBtn.addEventListener("click", () => {
      running = !running;
      applyDockText();
    });

    setupSpawnDrag(bowl, "food");
    setupSpawnDrag(toybox, "toy");
    applyDockText();
    updateCount();
  }

  /* --- ลากของออกจากชาม / กล่องของเล่น ----------------------
     กดค้างแล้วลากออกมาวางตรงไหนก็ได้
     แตะเฉยๆ (ไม่ลาก) = วางให้เองในที่ว่าง
     --------------------------------------------------------- */
  function setupSpawnDrag(btn, kind) {
    const table = kind === "food" ? TREATS : TOYS;
    const bowl = btn;
    let ghost = null, dragging = false, startX = 0, startY = 0, pending = null;

    function makeGhost(x, y, emoji) {
      ghost = document.createElement("div");
      ghost.className = "critter-treat-ghost";
      ghost.textContent = emoji;
      document.body.appendChild(ghost);
      moveGhost(x, y);
    }
    function moveGhost(x, y) {
      if (ghost) { ghost.style.left = x + "px"; ghost.style.top = y + "px"; }
    }
    function killGhost() {
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
    }

    bowl.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      pending = pickOne(table);          // สุ่มชนิดตอนเริ่มลาก ให้ตรงกับที่โชว์
      makeGhost(e.clientX, e.clientY, pending.emoji);
      bowl.classList.add("is-dragging");
    });

    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      moveGhost(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      bowl.classList.remove("is-dragging");
      killGhost();
      const moved = Math.hypot(e.clientX - startX, e.clientY - startY);
      const id = pending ? pending.id : null;
      pending = null;
      let made;
      if (moved < 8) {
        const spot = freePoint() || { x: W / 2, y: H * 0.75 };
        made = addProp(kind, spot.x, spot.y, id);    // แตะเฉยๆ = วางให้เอง
      } else {
        made = addProp(kind, e.clientX, e.clientY, id);
      }
      // ของเล่นที่แตะเฉยๆ ให้กลิ้งออกไปเลย ดูมีชีวิตกว่าวางนิ่ง
      if (made && kind === "toy" && moved < 8) {
        made.vx = rand(-190, 190); made.vy = rand(-190, 190);
      }
    });

    window.addEventListener("pointercancel", () => {
      if (!dragging) return;
      dragging = false;
      bowl.classList.remove("is-dragging");
      pending = null;
      killGhost();
    });
  }

  function applyDockText() {
    if (!dockEl) return;
    const t = T();
    const set = (sel, txt) => { const el = dockEl.querySelector(sel); if (el) el.textContent = txt; };
    set(".critter-fab-label", t.open);
    set(".critter-title", t.title);
    set(".critter-hint", t.hint);
    set(".js-clear", t.clear);
    set(".js-random", t.random);
    set(".js-pause", running ? t.pause : t.resume);
    const bowl = dockEl.querySelector(".js-bowl");
    if (bowl) { bowl.title = t.bowlTip; bowl.setAttribute("aria-label", t.bowlTip); }
    const toybox = dockEl.querySelector(".js-toybox");
    if (toybox) { toybox.title = t.toyTip; toybox.setAttribute("aria-label", t.toyTip); }
    if (gridEl) {
      gridEl.querySelectorAll(".critter-pick").forEach((b) => {
        const s = SPECIES_BY_ID.get(b.dataset.id);
        if (s) {
          b.querySelector(".n").textContent = pickName(s);
          b.title = pickName(s);
        }
      });
    }
    updateCount();
  }

  function updateCount() {
    if (!countEl) return;
    countEl.textContent = critters.length + "/" + MAX_CRITTERS + " " + T().count;
  }

  buildDock({});

  window.addEventListener("kuju:lang", (e) => {
    if (e.detail && e.detail.lang) lang = e.detail.lang;
    applyDockText();
  });

  /* ============================================================
     16. เปิดหน้ามาให้มีเพื่อนต้อนรับ — สุ่มชนิดไม่ซ้ำกันทุกครั้ง
     ============================================================ */
  if (!REDUCED_MOTION) {
    setTimeout(() => spawnAssorted(randInt(2, 3)), 700);
  }

  // เปิดทางให้เล่นจาก console ได้ด้วย (สนุกดี)
  window.KUJU_CRITTERS = {
    spawn: spawn,
    clear: clearAll,
    assorted: spawnAssorted,
    feed: (x, y, id) => addProp("food", x != null ? x : W / 2, y != null ? y : H * 0.75, id),
    toy: (x, y, id) => addProp("toy", x != null ? x : W / 2, y != null ? y : H * 0.7, id),
    species: SPECIES.map((s) => s.id),
    treats: TREATS.map((t) => t.id),
    toys: TOYS.map((t) => t.id),
    // ช่องเล็กๆ ให้ชุดทดสอบและ console ส่องสถานะภายในได้
    _debugSpecies: () => critters.map((c) => c.spec.id),
    _debugVariants: () => critters.map((c) => c.spec.id + "/" + (c.variant ? c.variant.id : "-")),
    _debugProps: () => props.slice(),
    _debugStates: () => critters.map((c) => c.state),
    _debugPairs: () => critters.map((c) => ({ state: c.state, hasFoe: !!c.foe }))
  };
})();
