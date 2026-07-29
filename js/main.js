/* ============================================================
   main.js — ตัวรันเว็บ
   ปกติไม่ต้องแก้ไฟล์นี้
   อยากเพิ่มลิงก์ → แก้ js/data.js
   อยากแก้คำพูด  → แก้ js/i18n.js
   อยากแก้สี/หน้าตา → แก้ css/style.css
   ============================================================ */

(function () {
  "use strict";

  /* --- ตัวช่วยเล็กๆ --------------------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const ARROW =
    '<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8"/></svg>';
  const COPY =
    '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/>' +
    '<path d="M5 15V5a2 2 0 012-2h8"/></svg>';

  /** รับค่าที่อาจเป็น string ธรรมดา หรือ {en,th} แล้วคืนค่าตามภาษาปัจจุบัน */
  function pick(value, lang) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return value[lang] || value.en || "";
  }

  /* --- สถานะ --------------------------------------------- */
  let lang = localStorage.getItem("kuju_lang");
  if (!lang) {
    lang = (navigator.language || "en").toLowerCase().startsWith("th") ? "th" : "en";
  }
  let theme =
    localStorage.getItem("kuju_theme") ||
    (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

  /* --- สร้าง 1 รายการลิงก์ -------------------------------- */
  function buildItem(entry) {
    const isCopy = entry.action === "copy";
    const a = document.createElement("a");
    a.className = "item";
    a.href = entry.url;
    if (isCopy) {
      // กดแล้วคัดลอกลิงก์ ไม่เปิดหน้าใหม่ (แต่คลิกขวา > copy link ยังใช้ได้)
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        copyToClipboard(entry.url);
      });
    } else {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }

    const color = ICON_COLORS[entry.icon] || ICON_COLORS.link;
    const path = ICONS[entry.icon] || ICONS.link;

    a.innerHTML =
      '<span class="icon" style="background:' + color.bg + ';color:' + color.fg + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + "</svg>" +
      "</span>" +
      '<span class="text">' +
        "<b></b><span></span>" +
      "</span>" +
      '<span class="go">' + (isCopy ? COPY : ARROW) + "</span>";

    // ใส่ข้อความผ่าน textContent เพื่อกันปัญหาอักขระพิเศษ
    a.querySelector(".text b").textContent = pick(entry.title, lang);
    a.querySelector(".text span").textContent = pick(entry.desc, lang);
    return a;
  }

  /** คัดลอกข้อความลงคลิปบอร์ด */
  function copyToClipboard(text) {
    if (!navigator.clipboard) {
      // เบราว์เซอร์เก่า หรือเปิดผ่าน http ธรรมดา — บอกผู้ใช้ตรงๆ ว่าคัดลอกอัตโนมัติไม่ได้
      window.prompt(I18N[lang].copyManual, text);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => toast(I18N[lang].copied),
      () => window.prompt(I18N[lang].copyManual, text)
    );
  }

  function fillList(container, entries) {
    if (!container) return;
    container.textContent = "";
    entries.forEach((e) => container.appendChild(buildItem(e)));
  }

  /* --- วาดหน้าเว็บใหม่ทั้งหมดตามภาษาปัจจุบัน -------------- */
  function render() {
    const t = I18N[lang];

    document.documentElement.lang = lang;
    document.title = t.pagetitle;

    // ข้อความที่ติด data-t ไว้ใน index.html
    document.querySelectorAll("[data-t]").forEach((el) => {
      const key = el.dataset.t;
      if (t[key]) el.textContent = t[key];
    });

    fillList($("#list-social"), DATA.social);
    fillList($("#list-works"), DATA.works);
    fillList($("#list-donate"), DATA.donate);

    $("#qr-img").src = DATA.promptpay.image;
    $("#langLabel").textContent = t.otherLang;
    updateThemeLabel();

    localStorage.setItem("kuju_lang", lang);

    // บอกส่วนอื่นๆ ของเว็บ (เช่น มินิเกมใน critters.js) ว่าภาษาเปลี่ยนแล้ว
    window.dispatchEvent(new CustomEvent("kuju:lang", { detail: { lang: lang } }));
  }

  /* --- ธีมมืด / สว่าง ------------------------------------- */
  function updateThemeLabel() {
    const t = I18N[lang];
    $("#themeIcon").textContent = theme === "dark" ? "🌙" : "☀️";
    $("#themeLabel").textContent = theme === "dark" ? t.themeDark : t.themeLight;
  }

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#0b0d10" : "#f6f7f9";
    updateThemeLabel();
    localStorage.setItem("kuju_theme", theme);
  }

  /* --- แจ้งเตือนเล็กๆ ------------------------------------- */
  let toastTimer = null;
  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  /* --- ปุ่มต่างๆ ------------------------------------------ */
  $("#langBtn").addEventListener("click", () => {
    lang = lang === "en" ? "th" : "en";
    render();
  });

  $("#themeBtn").addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme();
  });

  /* --- ปุ่มบันทึกรูป QR -----------------------------------
     หมายเหตุ: การใส่แค่ attribute download="" ไม่พอ เพราะบางเบราว์เซอร์
     จะ "เปิดรูป" แทนที่จะเซฟ วิธีที่ได้ผลจริงคือโหลดไฟล์มาเป็น blob ก่อน
     แล้วค่อยสั่งดาวน์โหลดจาก blob นั้น
     ------------------------------------------------------- */
  async function saveQrImage() {
    const url = DATA.promptpay.image;
    let blobUrl = null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();

      blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = DATA.promptpay.downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast(I18N[lang].qrSaved);
    } catch (err) {
      // ไม่แอบเปิดรูปแทนแล้วทำเหมือนสำเร็จ — บอกผู้ใช้ตรงๆ ว่าเซฟไม่ได้
      // เคสที่เจอบ่อย: เปิดไฟล์แบบ file:// ตอนทดสอบในเครื่อง เบราว์เซอร์บล็อก fetch
      console.error("[KUJU] บันทึก QR ไม่สำเร็จ:", err);
      toast(I18N[lang].qrSaveFailed);
    } finally {
      if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }
  }

  $("#qr-save").addEventListener("click", saveQrImage);

  /* --- เริ่มทำงาน ---------------------------------------- */
  $("#year").textContent = new Date().getFullYear();
  applyTheme();
  render();
})();
