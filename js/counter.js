/* ============================================================
   counter.js — ตัวนับผู้เข้าชมเว็บ (GoatCounter)

   ทำ 2 อย่าง:
   1. โหลดสคริปต์เก็บสถิติของ GoatCounter (ไม่ใช้ cookie ไม่เก็บข้อมูลส่วนตัว
      จึงไม่ต้องมีแถบขออนุญาต cookie)
   2. ดึงยอดรวมทั้งเว็บมาโชว์ที่ท้ายหน้า

   ตั้งค่ารหัสเว็บที่ js/data.js → DATA.analytics.goatcounter.code
   ============================================================ */

(function () {
  "use strict";

  const cfg = (window.DATA && DATA.analytics && DATA.analytics.goatcounter) || null;
  const code = cfg && typeof cfg.code === "string" ? cfg.code.trim() : "";

  // ยังไม่ได้ตั้งรหัส = ปิดสนิท ไม่ยิงขอข้อมูลไปที่ไหน
  // (สำคัญสำหรับคนที่ fork เว็บนี้ไปใช้ต่อ จะได้ไม่ส่งสถิติเข้าบัญชีคนอื่น)
  if (!code) {
    console.info("[KUJU] ตัวนับผู้เข้าชมปิดอยู่ — ใส่รหัส GoatCounter ที่ js/data.js เพื่อเปิดใช้");
    return;
  }
  if (!/^[a-z0-9-]+$/i.test(code)) {
    console.error('[KUJU] รหัส GoatCounter "' + code + '" ผิดรูปแบบ ' +
      "ต้องเป็นชื่อ subdomain เท่านั้น เช่น kuju29 (ไม่ใช่ URL เต็ม)");
    return;
  }

  const BASE = "https://" + code + ".goatcounter.com";

  /* --- 1. โหลดสคริปต์เก็บสถิติ ----------------------------- */
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter", BASE + "/count");
  s.addEventListener("error", () => {
    // ไม่ขึ้นเงียบๆ — บอกไว้ใน console ให้เจ้าของเว็บรู้ว่าสถิติไม่ถูกเก็บ
    console.error("[KUJU] โหลด count.js ของ GoatCounter ไม่สำเร็จ — สถิติรอบนี้ไม่ถูกบันทึก");
  });
  document.head.appendChild(s);

  /* --- 2. ดึงยอดรวมมาโชว์ ---------------------------------- */
  if (cfg.showCounter === false) return;

  const box = document.getElementById("visit-count");
  if (!box) {
    console.error("[KUJU] ไม่พบ #visit-count ใน index.html — ตัวเลขผู้เข้าชมจะไม่แสดง");
    return;
  }

  const label = { en: "visitors so far", th: "คนแวะมาแล้ว" };
  let lang = document.documentElement.lang === "th" ? "th" : "en";
  let total = null;

  function paint() {
    if (total === null) return;
    box.textContent = total + " " + (label[lang] || label.en);
  }

  window.addEventListener("kuju:lang", (e) => {
    if (e.detail && e.detail.lang) lang = e.detail.lang;
    paint();
  });

  // path พิเศษ "TOTAL" = ยอดรวมทั้งเว็บ (ไม่ใช่เฉพาะหน้านี้)
  fetch(BASE + "/counter/TOTAL.json", { mode: "cors" })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
      if (typeof data.count !== "string" && typeof data.count !== "number") {
        throw new Error("ไม่มีฟิลด์ count ในคำตอบ");
      }
      total = String(data.count);
      box.hidden = false;
      paint();
    })
    .catch((err) => {
      // ไม่โชว์เลข 0 หรือเลขมั่วๆ ให้คนอ่านเข้าใจผิด — ซ่อนไปเลย
      // แล้วบอกสาเหตุจริงไว้ใน console ให้เจ้าของเว็บตามแก้ได้
      box.hidden = true;
      console.error("[KUJU] ดึงยอดผู้เข้าชมไม่สำเร็จ:", err.message,
        "\nเช็ค 2 อย่าง: (1) รหัสเว็บใน data.js ถูกไหม " +
        '(2) เปิด "Allow adding visitor counts on your website" ใน Settings ของ GoatCounter แล้วหรือยัง');
    });
})();
