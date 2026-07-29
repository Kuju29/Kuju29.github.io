/* ============================================================
   critters.js — มินิเกม "สัตว์ป่วนหน้าเว็บ"  (KUJU)

   แนวคิด: คล้าย Desktop Destroyer แต่แทนที่จะทุบจอ
   เราปล่อยสัตว์ตัวน้อยๆ ออกมาเดินเล่น วิ่งวน ป่วนหน้าเว็บแทน

   - โมเดลเป็น 3D จริง (Three.js) ประกอบจากทรงพื้นฐาน สไตล์ chibi cel-shaded
   - มุมกล้องเป็นแบบ 2.5D: กล้อง orthographic แมป 1 หน่วย = 1 พิกเซล
     แล้วเอียงตัวสัตว์ลงมา ~23° เพื่อให้ได้มุมมอง 3/4 น่ารักๆ
   - สัตว์เดินสุ่มอิสระ หลบ/ปีนกล่อง UI จริงบนหน้าเว็บ และตอบสนองเมาส์

   อยากเพิ่มสัตว์ → เพิ่มใน SPECIES ข้างล่าง (ไม่ต้องแตะโค้ดส่วนอื่น)
   ============================================================ */

(function () {
  "use strict";

  /* ============================================================
     0. ค่าคงที่หลัก
     ============================================================ */
  const TILT = 0.40;                 // มุมเอียงตัวสัตว์ (เรเดียน) ≈ 23°
  const SIZE = 1.35;                 // ตัวคูณขนาดรวมทุกตัว (อยากตัวใหญ่/เล็กลง แก้ตรงนี้)
  const SIN_TILT = Math.sin(TILT);
  const MAX_CRITTERS = 40;           // เพดานจำนวนตัว กัน FPS ตก
  const AVOID_MIN_WIDTH = 760;       // จอแคบกว่านี้ ปล่อยให้เดินทับการ์ดได้เลย
                                     // (ไม่งั้นบนมือถือแทบไม่เหลือที่ให้เดิน)
  const OBSTACLE_SELECTOR = ".section, .topbar, #critter-dock";
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============================================================
     1. ตารางสัตว์ — หัวใจของเกม
     ---------------------------------------------------------
     ทุกตัวใช้โครงร่างเดียวกัน (ลำตัว หัว หู ตา ขา หาง)
     แล้วปรับสัดส่วน/สี/ของแถม (extras) ให้ต่างกัน
     ============================================================ */
  const SPECIES = [
    {
      id: "cat", emoji: "🐱", name: { en: "Cat", th: "แมว" },
      scale: 1.00, gait: "walk",
      color: { main: 0xf0b878, belly: 0xfff1de, inner: 0xffb3c6, nose: 0xff8fa8, dark: 0x8a5a33 },
      body: { w: 15, h: 13, d: 20 }, head: { r: 14, y: 25, z: -8 },
      snout: { r: 6.5, z: -11, y: -3 },
      ears: { type: "triangle", size: 7, spread: 8, tilt: 0.15 },
      eyes: { r: 2.6, spread: 6, y: 2, z: -12 },
      legs: { count: 4, len: 9, r: 2.6, spread: 7, front: 6, back: -7 },
      tail: { type: "long", len: 22, r: 1.8, curl: 0.9 },
      extras: ["whiskers", "stripes"],
      trait: { speed: 78, curiosity: 0.7, energy: 0.6 }
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
      trait: { speed: 88, curiosity: 1.0, energy: 0.85 }
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
      trait: { speed: 74, curiosity: 1.0, energy: 0.9 }
    },
    {
      id: "rabbit", emoji: "🐰", name: { en: "Rabbit", th: "กระต่าย" },
      scale: 0.95, gait: "hop",
      color: { main: 0xfdfbf7, belly: 0xffffff, inner: 0xffb0c4, nose: 0xff8fa8, dark: 0xd8cfc4 },
      body: { w: 13, h: 13, d: 16 }, head: { r: 12.5, y: 22, z: -7 },
      snout: { r: 5.5, z: -9.5, y: -3 },
      ears: { type: "long", size: 16, spread: 5, tilt: 0.12 },
      eyes: { r: 2.6, spread: 5.6, y: 2, z: -10.5 },
      legs: { count: 4, len: 6, r: 2.8, spread: 6.5, front: 5, back: -6 },
      tail: { type: "puff", len: 4, r: 4.5 },
      extras: ["whiskers"],
      trait: { speed: 96, curiosity: -0.6, energy: 1.0 }
    },
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
      trait: { speed: 66, curiosity: 0.5, energy: 0.5 }
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
      trait: { speed: 48, curiosity: 0.2, energy: 0.3 }
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
      trait: { speed: 92, curiosity: 0.8, energy: 0.85 }
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
      trait: { speed: 54, curiosity: 0.3, energy: 0.4 }
    },
    {
      id: "hamster", emoji: "🐹", name: { en: "Hamster", th: "แฮมสเตอร์" },
      scale: 0.8, gait: "scurry",
      color: { main: 0xe8b96b, belly: 0xfff6e4, inner: 0xffb0c4, nose: 0xff8fa8, dark: 0xc2924a },
      body: { w: 14, h: 13, d: 15 }, head: { r: 12, y: 19, z: -6 },
      snout: { r: 5.5, z: -9, y: -3 },
      ears: { type: "round", size: 4.5, spread: 8, tilt: 0.3 },
      eyes: { r: 2.6, spread: 5.4, y: 1.5, z: -10 },
      legs: { count: 4, len: 4, r: 2.4, spread: 6, front: 5, back: -5 },
      tail: { type: "puff", len: 3, r: 2.6 },
      extras: ["cheeks", "whiskers", "bellyPatch"],
      trait: { speed: 110, curiosity: -0.4, energy: 1.0 }
    },
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
      trait: { speed: 58, curiosity: 0.5, energy: 0.5 }
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
      trait: { speed: 84, curiosity: 0.4, energy: 1.0 }
    },
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
      trait: { speed: 70, curiosity: 0.9, energy: 0.8 }
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
      trait: { speed: 62, curiosity: 0.6, energy: 0.6 }
    },
    {
      id: "sheep", emoji: "🐑", name: { en: "Sheep", th: "แกะ" },
      scale: 1.0, gait: "walk",
      color: { main: 0xfdfaf3, belly: 0xffffff, inner: 0xffb0c4, nose: 0x4a4a52, dark: 0x4a4a52 },
      body: { w: 17, h: 15, d: 19 }, head: { r: 11, y: 24, z: -9, color: 0x4a4a52 },
      snout: { r: 5.5, z: -9, y: -2.5, color: 0x5c5c66 },
      ears: { type: "flop", size: 6, spread: 9, tilt: 1.1, color: 0x4a4a52 },
      eyes: { r: 2.2, spread: 5, y: 1.5, z: -9, color: 0xffffff, pupil: 0x1b1b20 },
      legs: { count: 4, len: 8, r: 2.4, spread: 7, front: 6, back: -6.5, color: 0x4a4a52 },
      tail: { type: "puff", len: 4, r: 4 },
      extras: ["wool"],
      trait: { speed: 56, curiosity: -0.5, energy: 0.4 }
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
      extras: ["antlers", "spots"],
      trait: { speed: 90, curiosity: -0.7, energy: 0.8 }
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
      trait: { speed: 30, curiosity: 0.3, energy: 0.2 }
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
      trait: { speed: 44, curiosity: 0.6, energy: 0.35 }
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
      trait: { speed: 38, curiosity: 0.1, energy: 0.15 }
    },
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
      extras: ["horn", "mane", "sparkle"],
      trait: { speed: 82, curiosity: 0.7, energy: 0.7 }
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
      trait: { speed: 68, curiosity: 0.8, energy: 0.75 }
    }
  ];

  const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

  /* ============================================================
     2. ข้อความในแผงควบคุม (2 ภาษา)
     ============================================================ */
  const UI_TEXT = {
    en: {
      open: "Critters", title: "Let something loose",
      hint: "Tap a critter to send it wandering. They dodge the cards and chase your cursor.",
      clear: "Clear all", pause: "Pause", resume: "Resume", random: "Surprise me",
      count: "on screen", close: "Close",
      full: "That's a full house — clear a few first",
      cleared: "All critters went home",
      noWebGL: "Your browser can't run the critter game (WebGL is off or unavailable)",
      noLib: "Couldn't load the 3D library — check your connection and reload"
    },
    th: {
      open: "ปล่อยสัตว์", title: "เลือกตัวป่วน",
      hint: "กดเลือกสัตว์เพื่อปล่อยออกมาเดินเล่น เขาจะหลบการ์ดและวิ่งตามเมาส์ของคุณ",
      clear: "เก็บให้หมด", pause: "หยุด", resume: "เล่นต่อ", random: "สุ่มเลย",
      count: "ตัวบนจอ", close: "ปิด",
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
     3. ตัวช่วยเล็กๆ
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

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) { console.warn("[critters]", msg); return; }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ============================================================
     4. ตรวจว่าเล่นได้ไหม — ถ้าไม่ได้ต้องบอกตรงๆ ไม่เงียบหาย
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
     5. ฉาก / กล้อง / แสง
     ---------------------------------------------------------
     กล้อง orthographic แมปแบบ 1 หน่วย = 1 พิกเซลบนจอ
     world x =  screen x
     world y = -screen y      (จอนับ y ลง แต่ 3D นับ y ขึ้น)
     ============================================================ */
  const canvas = document.createElement("canvas");
  canvas.id = "critter-canvas";
  document.body.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -4000, 4000);
  camera.position.set(0, 0, 2000);

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const key = new THREE.DirectionalLight(0xfff4e8, 0.85);
  key.position.set(-0.5, 1, 0.9);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb7d8, 0.35);   // แสงสะท้อนสีซากุระ
  rim.position.set(0.8, 0.3, -0.7);
  scene.add(rim);

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
     6. วัสดุ cel-shaded + คลังเรขาคณิต (ใช้ซ้ำเพื่อประหยัดหน่วยความจำ)
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
      opts.flat = อยากได้ผิวเหลี่ยมๆ low-poly — MeshToonMaterial ของ r128
      ไม่รองรับ flatShading จึงใช้ MeshPhongMaterial ที่ปิดความมันแทน
      (ให้เฉดใกล้เคียงกัน แต่เห็นเหลี่ยมชัด) */
  function mat(color, opts) {
    const o = opts || {};
    const k = color + "|" + (o.opacity || 1) + "|" + (o.flat ? 1 : 0);
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
     7. ตัวสร้างโมเดลสัตว์
     ---------------------------------------------------------
     โครงลำดับชั้น:
       root (ตำแหน่งบนจอ)
        └ tilt (เอียง 3/4)
           ├ shadow (เงาแบนบนพื้น)
           └ bob (ใช้เด้ง/กระโดด)
              └ yaw (หันหน้า)
                 └ ชิ้นส่วนตัวสัตว์ (เท้าอยู่ที่ y = 0)
     ============================================================ */
  function buildModel(spec) {
    const c = spec.color;
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

    const parts = { root, tilt, bob, yaw, shadow, legs: [], ears: [], eyes: [], extras: {} };

    const legLen = spec.legs.len;
    const bodyY = legLen + spec.body.h * 0.75;

    // --- ลำตัว ---
    const body = ellipsoid(spec.body.w, spec.body.h, spec.body.d, c.main);
    body.position.y = bodyY;
    yaw.add(body);
    parts.body = body;

    // ท้องสีอ่อน
    if (spec.extras.indexOf("bellyPatch") >= 0) {
      const belly = ellipsoid(spec.body.w * 0.72, spec.body.h * 0.72, spec.body.d * 0.55, c.belly);
      belly.position.set(0, bodyY - spec.body.h * 0.18, -spec.body.d * 0.45);
      yaw.add(belly);
    }

    // ขนแกะ — ลูกบอลหลายลูกกองบนตัว
    if (spec.extras.indexOf("wool") >= 0) {
      const puffs = [
        [0, 0.55, 0.45], [0, 0.6, -0.4], [0.6, 0.35, 0], [-0.6, 0.35, 0],
        [0.42, 0.6, 0.42], [-0.42, 0.6, 0.42], [0.42, 0.55, -0.42], [-0.42, 0.55, -0.42], [0, 0.8, 0]
      ];
      puffs.forEach((p) => {
        const s = ellipsoid(spec.body.w * 0.5, spec.body.w * 0.5, spec.body.w * 0.5, c.main);
        s.position.set(spec.body.w * p[0], bodyY + spec.body.h * p[1], spec.body.d * p[2]);
        yaw.add(s);
      });
    }

    // กระดอง
    if (spec.extras.indexOf("shell") >= 0) {
      const shell = ellipsoid(spec.body.w * 1.18, spec.body.h * 1.55, spec.body.d * 1.08, c.dark, { flat: true });
      shell.position.y = bodyY + spec.body.h * 0.15;
      yaw.add(shell);
      // ลายหกเหลี่ยมบนกระดอง
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        const p = ellipsoid(3.4, 1.4, 3.4, 0xc79a55);
        p.position.set(Math.cos(a) * spec.body.w * 0.66,
          bodyY + spec.body.h * 1.42, Math.sin(a) * spec.body.d * 0.6);
        yaw.add(p);
      }
      const mid = ellipsoid(4, 1.5, 4, 0xd9ae66);
      mid.position.y = bodyY + spec.body.h * 1.62;
      yaw.add(mid);
    }

    // แผงหลังไดโน
    if (spec.extras.indexOf("plates") >= 0) {
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(CONE, mat(c.dark, { flat: true }));
        p.scale.set(3.2, 6 - i * 0.9, 1.4);
        p.position.set(0, bodyY + spec.body.h * 0.85, spec.body.d * (0.45 - i * 0.35));
        yaw.add(p);
      }
    }

    // --- หัว ---
    const headPivot = new THREE.Group();
    headPivot.position.set(0, bodyY + spec.head.y - spec.body.h * 0.4, spec.head.z);
    yaw.add(headPivot);
    parts.head = headPivot;

    const headColor = spec.head.color != null ? spec.head.color : c.main;
    const head = spec.head.boxy
      ? (() => { const m = new THREE.Mesh(BOX, mat(headColor)); m.scale.set(spec.head.r * 1.3, spec.head.r * 1.25, spec.head.r * 1.6); return m; })()
      : ellipsoid(spec.head.r, spec.head.r * 0.95, spec.head.r * 0.98, headColor);
    headPivot.add(head);

    // ปาก / จมูก
    if (spec.snout) {
      const sc = spec.snout.color != null ? spec.snout.color : (spec.snout.taper ? c.main : c.belly);
      const s = spec.snout.taper
        ? ellipsoid(spec.snout.r * 0.7, spec.snout.r * 0.7, spec.snout.r * 1.5, sc)
        : ellipsoid(spec.snout.r, spec.snout.r * (spec.snout.flat ? 0.8 : 0.85), spec.snout.r * (spec.snout.flat ? 0.55 : 0.9), sc);
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

    // จะงอยปาก
    if (spec.extras.indexOf("beak") >= 0) {
      const b = new THREE.Mesh(CONE, mat(c.inner));
      b.scale.set(4, 6.5, 3);
      b.rotation.x = -Math.PI / 2;
      b.position.set(0, -1.5, -spec.head.r * 0.75);
      headPivot.add(b);
    }

    // --- ตา ---
    const eyeSpec = spec.eyes;
    [-1, 1].forEach((side) => {
      const g = new THREE.Group();
      g.position.set(side * eyeSpec.spread, eyeSpec.y, eyeSpec.z);
      headPivot.add(g);

      if (eyeSpec.bulge) {                     // ตากบ — โปนขึ้นบนหัว
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

    // แก้มชมพู
    if (spec.extras.indexOf("cheeks") >= 0 || spec.extras.indexOf("sparkle") >= 0) {
      [-1, 1].forEach((side) => {
        const b = ellipsoid(3, 2, 1.2, 0xff9db8, { opacity: 0.75 });
        b.position.set(side * (eyeSpec.spread + 3.5), eyeSpec.y - 3.5, eyeSpec.z + 1.5);
        headPivot.add(b);
      });
    }

    // หน้ากาก (แพนด้าแดง) / วงตาแพนด้า
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
        const p = ellipsoid(4.4, 5, 2.4, 0x2a2a2e);
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

    // ยิ้ม (เส้นโค้งง่ายๆ ด้วยลูกบอลเล็ก 3 ลูก)
    if (spec.extras.indexOf("smile") >= 0) {
      [-1, 0, 1].forEach((i) => {
        const d = ellipsoid(0.9, 0.7, 0.5, 0x3a2b33);
        d.position.set(i * 3, eyeSpec.y - 6 - Math.abs(i) * -0.6, -spec.head.r * 0.9);
        headPivot.add(d);
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

    // เขายูนิคอร์น
    if (spec.extras.indexOf("horn") >= 0) {
      const h = new THREE.Mesh(CONE, mat(0xffd76e, { flat: true }));
      h.scale.set(2.4, 13, 2.4);
      h.position.set(0, spec.head.r * 0.75, -spec.head.r * 0.35);
      h.rotation.x = -0.35;
      headPivot.add(h);
    }
    // เขากวาง
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
    // แผงคอยูนิคอร์น (ไล่สีรุ้งพาสเทล)
    if (spec.extras.indexOf("mane") >= 0) {
      const maneColors = [0xffb3d1, 0xffd9a0, 0xfff3a0, 0xb8f0c8, 0xa8d8ff, 0xd0b3ff];
      for (let i = 0; i < 6; i++) {
        const s = ellipsoid(3, 3.4, 2.6, maneColors[i % maneColors.length]);
        s.position.set(0, spec.head.r * 0.5 - i * 2.6, spec.head.r * 0.55 + i * 2.2);
        headPivot.add(s);
      }
    }
    // เหงือกอาโซโลเทิล
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

    // --- หู ---
    const earColor = spec.ears.color != null ? spec.ears.color : (spec.head.color != null ? spec.head.color : c.main);
    if (spec.ears.type !== "none") {
      [-1, 1].forEach((side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * spec.ears.spread, spec.head.r * 0.62, spec.head.z >= 0 ? 0 : -1);
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
          const e = ellipsoid(S, S, S * 0.5, earColor);
          pivot.add(e);
          const inner = ellipsoid(S * 0.55, S * 0.55, S * 0.4, c.inner);
          inner.position.z = -S * 0.3;
          pivot.add(inner);
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

    // --- ขา ---
    const legColor = spec.legs.color != null ? spec.legs.color : c.main;
    if (spec.legs.count > 0) {
      const rows = spec.legs.count === 2 ? [spec.legs.front] : [spec.legs.front, spec.legs.back];
      rows.forEach((zPos, rowIndex) => {
        [-1, 1].forEach((side) => {
          const pivot = new THREE.Group();
          pivot.position.set(side * spec.legs.spread, legLen, -zPos);
          yaw.add(pivot);

          const leg = new THREE.Mesh(CYL, mat(legColor));
          leg.scale.set(spec.legs.r, legLen, spec.legs.r);
          leg.position.y = -legLen / 2;
          pivot.add(leg);

          const foot = ellipsoid(spec.legs.r * 1.15, spec.legs.r * 0.9, spec.legs.r * 1.5, legColor);
          foot.position.set(0, -legLen, -spec.legs.r * 0.5);
          pivot.add(foot);

          // เฟสการก้าว: ขาทแยงมุมขยับพร้อมกัน (เดินแบบสัตว์สี่ขาจริง)
          parts.legs.push({ pivot: pivot, phase: (rowIndex + (side > 0 ? 1 : 0)) % 2 === 0 ? 0 : Math.PI });
        });
      });
    }

    // ครีบ / ปีก
    if (spec.extras.indexOf("flippers") >= 0) {
      [-1, 1].forEach((side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * spec.body.w * 0.95, bodyY + 2, 0);
        yaw.add(pivot);
        const f = ellipsoid(1.6, 7, 4, spec.id === "duck" ? c.main : c.main);
        f.position.y = -5;
        pivot.add(f);
        parts.ears.push(pivot);      // ใช้ระบบขยับหูเดียวกัน (กระพือได้)
      });
    }

    // จุดขาวบนตัวลูกกวาง
    if (spec.extras.indexOf("spots") >= 0) {
      for (let i = 0; i < 6; i++) {
        const s = ellipsoid(1.6, 1.6, 1, c.belly);
        s.position.set(rand(-1, 1) * spec.body.w * 0.8,
          bodyY + rand(0.1, 0.8) * spec.body.h,
          rand(-0.6, 0.7) * spec.body.d);
        s.position.multiplyScalar(1);
        yaw.add(s);
      }
    }

    // --- หาง ---
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
    } else if (t.type === "bushy") {
      const m = ellipsoid(t.r, t.r, t.len * 0.55, c.main);
      m.position.z = t.len * 0.45;
      m.rotation.x = -(t.curl || 0.4);
      tailPivot.add(m);
      if (t.tipColor != null) {
        const tip = ellipsoid(t.r * 0.8, t.r * 0.8, t.len * 0.2, t.tipColor);
        tip.position.set(0, Math.sin(t.curl || 0.4) * t.len * 0.5, t.len * 0.82);
        tailPivot.add(tip);
      }
      if (spec.extras.indexOf("tailRings") >= 0) {
        for (let i = 0; i < 3; i++) {
          const r2 = ellipsoid(t.r * 0.92, t.r * 0.92, 1.6, 0x4a2b1e);
          r2.position.set(0, Math.sin(t.curl || 0.4) * (6 + i * 6), 5 + i * 6.5);
          tailPivot.add(r2);
        }
      }
    } else if (t.type === "puff") {
      const m = ellipsoid(t.r, t.r, t.r, c.belly);
      m.position.z = t.len * 0.5;
      tailPivot.add(m);
    } else if (t.type === "curl") {
      const ring = new THREE.Mesh(
        geo("torus-curl", () => new THREE.TorusGeometry(1, 0.42, 8, 16, Math.PI * 1.6)),
        mat(c.main)
      );
      ring.scale.setScalar(t.r);
      ring.position.set(0, t.r * 1.2, t.len * 0.2);
      ring.rotation.set(0.3, Math.PI / 2, 0);
      tailPivot.add(ring);
    } else if (t.type === "spring") {
      const ring = new THREE.Mesh(
        geo("torus-spring", () => new THREE.TorusGeometry(1, 0.3, 6, 14, Math.PI * 1.7)),
        mat(c.main)
      );
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
    } else if (t.type === "mane") {
      const maneColors = [0xffb3d1, 0xffd9a0, 0xb8f0c8, 0xa8d8ff];
      for (let i = 0; i < 4; i++) {
        const s = ellipsoid(2.6, 3, 3.4, maneColors[i]);
        s.position.set(0, 2 - i * 2.2, 3 + i * 3);
        tailPivot.add(s);
      }
    }

    // ขนาดรวม
    root.scale.setScalar(spec.scale * SIZE);
    parts.height = (bodyY + spec.head.y + spec.head.r) * spec.scale * SIZE;

    return parts;
  }

  /* ============================================================
     8. เอฟเฟกต์เล็กๆ (หัวใจ ดาว กลีบซากุระ)
     ============================================================ */
  function spriteTexture(draw) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const ctx = cv.getContext("2d");
    draw(ctx);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  const TEX_HEART = spriteTexture((x) => {
    x.fillStyle = "#ff6f96";
    x.beginPath();
    x.moveTo(32, 54);
    x.bezierCurveTo(2, 34, 8, 8, 32, 22);
    x.bezierCurveTo(56, 8, 62, 34, 32, 54);
    x.fill();
  });
  const TEX_STAR = spriteTexture((x) => {
    x.fillStyle = "#ffe066";
    x.beginPath();
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
    x.beginPath();
    x.ellipse(32, 32, 14, 22, 0, 0, Math.PI * 2);
    x.fill();
  });
  const TEX_PAW = spriteTexture((x) => {
    x.fillStyle = "rgba(120,80,110,.85)";
    x.beginPath(); x.ellipse(32, 40, 13, 10, 0, 0, Math.PI * 2); x.fill();
    [[18, 22, 5], [28, 17, 5.5], [39, 17, 5.5], [48, 23, 5]].forEach((p) => {
      x.beginPath(); x.ellipse(p[0], p[1], p[2], p[2] * 1.15, 0, 0, Math.PI * 2); x.fill();
    });
  });

  const puffs = [];       // เอฟเฟกต์ชั่วคราว
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
        vx: rand(-24, 24), vy: rand(46, 82), spin: rand(-3, 3), size: size
      });
    }
  }

  // กลีบซากุระร่วง — ผูกกับธีมพื้นหลัง
  const petals = [];
  function makePetals() {
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
  }
  makePetals();

  /* ============================================================
     9. ตัวสัตว์ 1 ตัว — สถานะและสมองน้อยๆ
     ============================================================ */
  const critters = [];

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

    const parts = buildModel(spec);
    scene.add(parts.root);

    // เกิดในที่ว่าง ไม่โผล่กลางการ์ด
    const spot = freePoint();
    const x = atX != null ? atX : (spot ? spot.x : rand(40, Math.max(60, W - 40)));
    const y = atY != null ? atY : (spot ? spot.y : rand(H * 0.5, Math.max(H * 0.5 + 10, H - 60)));

    const c = {
      spec: spec, parts: parts,
      x: x, y: y, vx: 0, vy: 0,
      heading: rand(-Math.PI, Math.PI),
      speed: spec.trait.speed * rand(0.85, 1.15),
      state: "wander", timer: rand(0.5, 2),
      tx: x, ty: y,
      walkPhase: rand(0, 6.28),
      hop: 0, hopV: 0,
      blink: rand(1.5, 5),
      mood: 0,                 // >0 = ดีใจ (เพิ่งโดนกด)
      startle: 0,
      pawTimer: 0,
      born: 0
    };
    critters.push(c);

    // เอฟเฟกต์ตอนเกิด
    spawnPuff(x, y - parts.height * 0.4, TEX_STAR, 5, { size: 14 });
    updateCount();
    return c;
  }

  function despawn(c) {
    scene.remove(c.parts.root);
    c.parts.root.traverse((o) => {
      // geometry/material ใช้ร่วมกันทั้งฉาก (แคชไว้) จึงไม่ dispose ที่นี่
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
    toast(T().cleared);
    updateCount();
  }

  /* ============================================================
     10. กล่อง UI — สัตว์ต้องหลบ/ปีนของจริงบนหน้าเว็บ
     ============================================================ */
  let obstacles = [];
  let obstacleTimer = 0;
  let avoidOn = window.innerWidth >= AVOID_MIN_WIDTH;

  function refreshObstacles() {
    avoidOn = window.innerWidth >= AVOID_MIN_WIDTH;
    obstacles = [];
    if (!avoidOn) return;      // จอแคบ: ปล่อยเดินทับการ์ดไปเลย ไม่งั้นไม่เหลือที่
    document.querySelectorAll(OBSTACLE_SELECTOR).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      if (r.bottom < -80 || r.top > H + 80) return;
      obstacles.push({ l: r.left, r: r.right, t: r.top, b: r.bottom });
    });
  }
  refreshObstacles();

  const PAD = 14;                 // เว้นระยะจากขอบการ์ด
  const MAX_PUSH = 12;            // ดันออกได้สูงสุดกี่พิกเซลต่อเฟรม
                                  // (เร็วกว่าความเร็ววิ่งสูงสุดของสัตว์มาก
                                  //  จึงมั่นใจได้ว่าไม่มีตัวไหนวิ่งทะลุเข้าไปค้างได้)

  function insideRect(o, x, y, pad) {
    return x > o.l - pad && x < o.r + pad && y > o.t - pad && y < o.b + pad;
  }

  /** แรงผลักออกจากกล่อง UI + ดันออกจริงถ้าเผลอเข้าไปแล้ว */
  function avoid(c, ax) {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (!insideRect(o, c.x, c.y, PAD)) continue;
      // ออกทางด้านที่ใกล้ที่สุด
      const dl = c.x - (o.l - PAD), dr = (o.r + PAD) - c.x;
      const dt = c.y - (o.t - PAD), db = (o.b + PAD) - c.y;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) { ax.x -= 300; c.x -= Math.min(MAX_PUSH, dl); c.vx = Math.min(c.vx, 0); }
      else if (m === dr) { ax.x += 300; c.x += Math.min(MAX_PUSH, dr); c.vx = Math.max(c.vx, 0); }
      else if (m === dt) { ax.y -= 300; c.y -= Math.min(MAX_PUSH, dt); c.vy = Math.min(c.vy, 0); }
      else { ax.y += 300; c.y += Math.min(MAX_PUSH, db); c.vy = Math.max(c.vy, 0); }
    }
  }

  /** สุ่มจุดบนจอที่ไม่ทับกล่อง UI
      หาไม่เจอจริงๆ (จอเต็มไปด้วยการ์ด) จะคืน null — ผู้เรียกตัดสินใจเอง */
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

  function pickTarget(c) {
    const p = freePoint();
    if (p) { c.tx = p.x; c.ty = p.y; return true; }
    // ไม่เหลือที่ว่างเลย — เดินเลาะขอบจอแทน
    c.tx = Math.random() < 0.5 ? rand(20, 60) : rand(Math.max(60, W - 60), Math.max(70, W - 20));
    c.ty = rand(80, Math.max(100, H - 40));
    return false;
  }

  /* ============================================================
     11. เมาส์
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

  /** หาว่าเมาส์อยู่บนตัวไหน (ทดสอบในพิกัดจอ ไม่ต้อง raycast ให้เปลือง) */
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

  // canvas ปกติไม่รับคลิก (จะได้กดลิงก์ข้างใต้ได้)
  // แต่ถ้าเมาส์อยู่บนตัวสัตว์พอดี ค่อยเปิดรับคลิกชั่วคราว
  function updatePointerCapture() {
    const over = mouse.inside ? critterAt(mouse.x, mouse.y) : null;
    const want = over ? "auto" : "none";
    if (canvas.style.pointerEvents !== want) canvas.style.pointerEvents = want;
    canvas.style.cursor = over ? "pointer" : "";
  }

  canvas.addEventListener("pointerdown", (e) => {
    const c = critterAt(e.clientX, e.clientY);
    if (!c) return;
    e.preventDefault();
    c.mood = 1.6;
    c.hopV = 190;
    c.state = "happy";
    c.timer = 1.2;
    spawnPuff(c.x, c.y - c.parts.height * 0.75, TEX_HEART, 4, { size: 16 });
  });

  /* ============================================================
     12. ลูปหลัก
     ============================================================ */
  let running = true;
  let last = performance.now();
  let rafId = null;

  function step(now) {
    rafId = requestAnimationFrame(step);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;          // กันกระตุกตอนสลับแท็บกลับมา
    if (!running) { renderer.render(scene, camera); return; }

    // ความเร็วเมาส์ (ใช้ตกใจ)
    const mdx = mouse.x - mouse.px, mdy = mouse.y - mouse.py;
    mouse.speed = Math.sqrt(mdx * mdx + mdy * mdy) / dt;
    mouse.px = mouse.x; mouse.py = mouse.y;

    obstacleTimer -= dt;
    if (obstacleTimer <= 0) { refreshObstacles(); obstacleTimer = 0.4; }

    for (let i = 0; i < critters.length; i++) updateCritter(critters[i], dt);
    updatePetals(dt);
    updatePuffs(dt);
    updatePointerCapture();

    renderer.render(scene, camera);
  }

  function updateCritter(c, dt) {
    const p = c.parts;
    const tr = c.spec.trait;
    c.born += dt;
    c.timer -= dt;
    c.mood = Math.max(0, c.mood - dt);
    c.startle = Math.max(0, c.startle - dt * 1.6);

    // --- ระยะห่างจากเมาส์ ---
    const bodyY = c.y - p.height * 0.5;
    const dmx = mouse.x - c.x, dmy = mouse.y - bodyY;
    const mdist = Math.sqrt(dmx * dmx + dmy * dmy);

    // เมาส์สะบัดเร็วผ่านใกล้ๆ = ตกใจ
    if (mouse.inside && mdist < 110 && mouse.speed > 1400 && c.startle <= 0) {
      c.startle = 1;
      c.hopV = 130;
      spawnPuff(c.x, c.y - p.height, TEX_STAR, 2, { size: 11 });
    }

    // --- เลือกสถานะ ---
    if (c.state !== "happy") {
      if (mouse.inside && mdist < 300 && tr.curiosity > 0.2 && c.state !== "chase") {
        if (Math.random() < tr.curiosity * dt * 2.2) { c.state = "chase"; c.timer = rand(2, 5); }
      } else if (mouse.inside && mdist < 190 && tr.curiosity < -0.2) {
        c.state = "flee"; c.timer = rand(0.8, 1.6);
      }
    }
    if (c.timer <= 0) {
      const r = Math.random();
      if (c.state === "idle" || c.state === "sleep") {
        c.state = "wander"; c.timer = rand(1.5, 4.5); pickTarget(c);
      } else if (r < 0.22 * (1.2 - tr.energy)) {
        c.state = "sleep"; c.timer = rand(2.5, 6);
      } else if (r < 0.45) {
        c.state = "idle"; c.timer = rand(0.8, 2.4);
      } else {
        c.state = "wander"; c.timer = rand(1.8, 5); pickTarget(c);
      }
    }

    // --- คำนวณทิศที่อยากไป ---
    let wantX = 0, wantY = 0, gas = 0;
    if (c.state === "wander") {
      wantX = c.tx - c.x; wantY = c.ty - c.y;
      gas = 1;
      if (Math.sqrt(wantX * wantX + wantY * wantY) < 26) pickTarget(c);
    } else if (c.state === "chase") {
      wantX = dmx; wantY = dmy + p.height * 0.4;
      gas = mdist > 55 ? 1.25 : 0;          // ถึงแล้วหยุดหอบ ไม่ทับเมาส์
      if (!mouse.inside) { c.state = "wander"; pickTarget(c); }
    } else if (c.state === "flee") {
      wantX = -dmx; wantY = -dmy;
      gas = 1.55;
    } else if (c.state === "happy") {
      gas = 0;
    } else {
      gas = 0;                               // idle / sleep
    }

    const wl = Math.hypot(wantX, wantY) || 1;
    const accel = { x: (wantX / wl) * c.speed * gas, y: (wantY / wl) * c.speed * gas };

    // หลบกล่อง UI
    avoid(c, accel);

    // กันหลุดขอบจอ
    const edge = 34;
    if (c.x < edge) accel.x += (edge - c.x) * 6;
    if (c.x > W - edge) accel.x -= (c.x - (W - edge)) * 6;
    if (c.y < 70) accel.y += (70 - c.y) * 6;
    if (c.y > H - edge) accel.y -= (c.y - (H - edge)) * 6;

    // --- ความเร็ว / ตำแหน่ง ---
    const responsiveness = c.state === "flee" ? 7 : 3.4;
    c.vx += (accel.x - c.vx) * Math.min(1, responsiveness * dt);
    c.vy += (accel.y - c.vy) * Math.min(1, responsiveness * dt);
    if (gas === 0) { c.vx *= Math.pow(0.02, dt); c.vy *= Math.pow(0.02, dt); }

    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.x = clamp(c.x, 12, Math.max(20, W - 12));
    c.y = clamp(c.y, 60, Math.max(70, H - 12));

    const sp = Math.hypot(c.vx, c.vy);

    // --- หันหน้า ---
    // จอ y นับลง แต่โลก y นับขึ้น + ตัวเอียง TILT อยู่ ⇒ ต้องหารด้วย sin(TILT)
    if (sp > 6) {
      const target = Math.atan2(-c.vx, -c.vy / SIN_TILT);
      c.heading = angleLerp(c.heading, target, Math.min(1, dt * 7));
    }
    p.yaw.rotation.y = c.heading;

    // --- วางตำแหน่งบนจอ + ลำดับหน้า-หลัง ---
    p.root.position.set(c.x, -c.y, c.y * 0.25);

    // --- แอนิเมชันเดิน ---
    const gait = c.spec.gait;
    const stride = sp / (c.speed || 1);
    c.walkPhase += dt * (4 + stride * 9);

    // กระโดด (กระต่าย/กบ) และเด้งตอนดีใจ
    if (gait === "hop" && stride > 0.15 && c.hop <= 0.01 && c.hopV <= 0) c.hopV = 150 + stride * 90;
    c.hopV -= 620 * dt;
    c.hop += c.hopV * dt;
    if (c.hop <= 0) { c.hop = 0; c.hopV = 0; }

    let bobY = c.hop;
    let roll = 0, pitch = 0;

    if (gait === "waddle") {
      roll = Math.sin(c.walkPhase * 0.9) * 0.16 * (0.35 + stride);
      bobY += Math.abs(Math.sin(c.walkPhase * 0.9)) * 2 * stride;
    } else if (gait === "crawl") {
      bobY += Math.sin(c.walkPhase * 0.7) * 1.2 * stride;
    } else if (gait === "scurry") {
      bobY += Math.abs(Math.sin(c.walkPhase * 1.6)) * 3 * stride;
    } else if (gait === "walk") {
      bobY += Math.abs(Math.sin(c.walkPhase)) * 2.2 * stride;
      pitch = Math.sin(c.walkPhase * 2) * 0.02 * stride;
    }

    if (c.mood > 0) bobY += Math.abs(Math.sin(c.born * 16)) * 5 * c.mood;
    if (c.startle > 0) roll += Math.sin(c.born * 40) * 0.12 * c.startle;

    p.bob.position.y = bobY;
    p.bob.rotation.z = roll;
    p.bob.rotation.x = pitch;

    // ขา
    const legAmp = gait === "hop"
      ? (c.hop > 1 ? 0.5 : 0.15)
      : 0.15 + stride * 0.85;
    for (let i = 0; i < p.legs.length; i++) {
      const L = p.legs[i];
      L.pivot.rotation.x = Math.sin(c.walkPhase + L.phase) * legAmp;
    }

    // หัว: เอียงตามเลี้ยว + ก้มตอนนอน + เงยตอนดีใจ
    const sleeping = c.state === "sleep";
    const headTargetX = sleeping ? 0.42 : (c.mood > 0 ? -0.28 : Math.sin(c.born * 1.3) * 0.05);
    p.head.rotation.x += (headTargetX - p.head.rotation.x) * Math.min(1, dt * 5);
    p.head.rotation.z += ((c.state === "idle" ? Math.sin(c.born * 1.1) * 0.12 : 0) - p.head.rotation.z) * Math.min(1, dt * 4);

    // หู: กระดิกเป็นระยะ
    const earWiggle = Math.sin(c.born * 3.2) * 0.06 + (c.startle > 0 ? Math.sin(c.born * 28) * 0.25 * c.startle : 0);
    for (let i = 0; i < p.ears.length; i++) {
      p.ears[i].rotation.x = earWiggle * (i % 2 ? 1 : -1) + (sleeping ? 0.25 : 0);
    }

    // หาง: แกว่งเร็วขึ้นเมื่อดีใจ/วิ่ง
    const wag = (0.25 + stride * 0.5 + c.mood * 0.9);
    p.tail.rotation.y = Math.sin(c.born * (5 + stride * 6 + c.mood * 8)) * wag * 0.5;
    p.tail.rotation.x = sleeping ? 0.3 : Math.sin(c.born * 2) * 0.08;

    // กะพริบตา / หลับตา
    c.blink -= dt;
    let eyeScale = 1;
    if (sleeping) eyeScale = 0.12;
    else if (c.blink < 0.12) eyeScale = Math.max(0.12, Math.abs(c.blink) / 0.12);
    if (c.blink < -0.06) c.blink = rand(2, 6);
    for (let i = 0; i < p.eyes.length; i++) p.eyes[i].scale.y = eyeScale;

    // เงา: หดเมื่อกระโดดสูง
    const shrink = clamp(1 - c.hop / 90, 0.45, 1);
    p.shadow.scale.x = c.spec.body.w * 1.15 * shrink;
    p.shadow.scale.z = c.spec.body.d * 1.15 * shrink;
    p.shadow.material.opacity = 0.24 * shrink;

    // รอยเท้าเล็กๆ ตอนวิ่ง
    c.pawTimer -= dt;
    if (!REDUCED_MOTION && stride > 0.55 && c.pawTimer <= 0) {
      c.pawTimer = 0.16;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: TEX_PAW, transparent: true, opacity: 0.5, depthWrite: false
      }));
      s.scale.set(10, 10, 1);
      s.position.set(c.x + rand(-4, 4), -c.y + 2, c.y * 0.25 - 1);
      scene.add(s);
      puffs.push({ sprite: s, life: 0, max: 1.1, vx: 0, vy: 0, spin: 0, size: 10, fadeOnly: true });
    }

    // เสียงหัวใจลอยเวลาดีใจ
    if (c.mood > 1.2 && Math.random() < dt * 6) {
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

  // หยุดวาดตอนสลับแท็บออกไป — ประหยัดแบต
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    } else if (!rafId) {
      last = performance.now();
      rafId = requestAnimationFrame(step);
    }
  });

  /* ============================================================
     13. แผงควบคุม
     ============================================================ */
  let dockEl, gridEl, countEl, pauseBtn;

  function buildDock(opts) {
    const o = opts || {};
    const dock = document.createElement("div");
    dock.id = "critter-dock";
    dock.className = "critter-dock";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "critter-fab";
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<span class="paw" aria-hidden="true">🐾</span><span class="critter-fab-label"></span>';

    const panel = document.createElement("div");
    panel.className = "critter-panel";
    panel.hidden = true;

    if (o.disabled) {
      // เล่นไม่ได้ ก็บอกไปตรงๆ ไม่ต้องแกล้งทำเป็นมีปุ่มให้กด
      panel.innerHTML = '<p class="critter-error"></p>';
      panel.querySelector(".critter-error").textContent = o.disabled;
      toggle.classList.add("is-disabled");
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

    dock.appendChild(panel);
    dock.appendChild(toggle);
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
        const c = spawn(s.id);
        if (c) {
          b.classList.add("pop");
          setTimeout(() => b.classList.remove("pop"), 260);
          updateCount();
        }
      });
      gridEl.appendChild(b);
    });

    panel.querySelector(".critter-x").addEventListener("click", close);
    panel.querySelector(".js-clear").addEventListener("click", clearAll);
    panel.querySelector(".js-random").addEventListener("click", () => {
      const n = randInt(2, 4);
      for (let i = 0; i < n; i++) spawn(pickOne(SPECIES).id);
      updateCount();
    });
    pauseBtn.addEventListener("click", () => {
      running = !running;
      applyDockText();
    });

    applyDockText();
    updateCount();
  }

  function applyDockText() {
    if (!dockEl) return;
    const t = T();
    const q = (sel) => dockEl.querySelector(sel);
    const set = (sel, txt) => { const el = q(sel); if (el) el.textContent = txt; };
    set(".critter-fab-label", t.open);
    set(".critter-title", t.title);
    set(".critter-hint", t.hint);
    set(".js-clear", t.clear);
    set(".js-random", t.random);
    set(".js-pause", running ? t.pause : t.resume);
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

  /* ============================================================
     14. เชื่อมกับระบบสลับภาษาของเว็บ
     ============================================================ */
  window.addEventListener("kuju:lang", (e) => {
    if (e.detail && e.detail.lang) lang = e.detail.lang;
    applyDockText();
  });

  /* ============================================================
     15. เปิดหน้ามาให้มีเพื่อนต้อนรับ 2 ตัว
     ============================================================ */
  if (!REDUCED_MOTION) {
    setTimeout(() => {
      spawn("cat", W * 0.16, H * 0.72);
      spawn("shiba", W * 0.84, H * 0.66);
      updateCount();
    }, 700);
  }

  // เปิดทางให้เล่นจาก console ได้ด้วย (สนุกดี)
  window.KUJU_CRITTERS = { spawn: spawn, clear: clearAll, species: SPECIES.map((s) => s.id) };
})();
