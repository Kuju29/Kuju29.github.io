/* ============================================================
   data.js — ข้อมูลลิงก์ทั้งหมดของเว็บอยู่ในไฟล์นี้ไฟล์เดียว
   อยากเพิ่ม / ลบ / แก้ลิงก์ ให้แก้ที่นี่ ไม่ต้องไปยุ่งกับไฟล์อื่น

   รูปแบบของแต่ละรายการ:
   {
     icon:  "ชื่อไอคอน",     <- ดูรายชื่อที่ใช้ได้ในไฟล์ js/icons.js
     url:   "ลิงก์",
     title: "ชื่อที่แสดง"     <- ใส่เป็น { en:"...", th:"..." } ก็ได้ถ้าอยากแยกภาษา
     desc:  { en:"คำอธิบายอังกฤษ", th:"คำอธิบายไทย" }
   }

   วิธีเพิ่มรายการใหม่: ก๊อปบล็อก { ... } อันไหนก็ได้ วางต่อท้าย
   แล้วอย่าลืมใส่ , คั่นระหว่างบล็อก
   ============================================================ */

const DATA = {

  /* --- ช่องทางติดตาม / ติดต่อ ------------------------------ */
  social: [
    {
      icon: "youtube",
      url: "https://www.youtube.com/c/KuJu29?sub_confirmation=1",
      title: "YouTube",
      desc: { en: "Subscribe to my channel", th: "กดติดตามช่องของผม" }
    },
    {
      icon: "github",
      url: "https://github.com/Kuju29",
      title: "GitHub",
      desc: { en: "All my code lives here", th: "โค้ดทั้งหมดของผมอยู่ที่นี่" }
    },
    {
      icon: "discord",
      url: "https://discordapp.com/users/218015272370569226",
      title: "Discord",
      desc: { en: "Send me a message", th: "ทักผมได้เลยครับ" }
    }
  ],

  /* --- ผลงาน ----------------------------------------------- */
  works: [
    {
      icon: "puzzle",
      url: "https://chromewebstore.google.com/detail/cjbaepobgmickhgebgagklfcfacbbpem?utm_source=item-share-cb",
      title: { en: "Instant Manga Translator", th: "ส่วนขยายแปลมังงะทันที" },
      desc: {
        en: "A Chrome extension that translates manga right on the page",
        th: "ส่วนขยาย Chrome แปลมังงะบนเว็บให้ทันทีตอนอ่าน"
      }
    },
    {
      icon: "bot",
      url: "https://discord.com/oauth2/authorize?client_id=1396842497627656212",
      title: { en: "Discord Translation Bot", th: "บอทแปลภาษา Discord" },
      desc: {
        en: "Invite it to your server and it translates for you",
        th: "เชิญเข้าเซิร์ฟเวอร์ แล้วมันแปลให้เลย"
      }
    },
    {
      icon: "code",
      url: "https://github.com/Kuju29/myscp-tampermonkey",
      title: { en: "Tampermonkey Userscripts", th: "สคริปต์ Tampermonkey" },
      desc: {
        en: "My userscript collection, including Google Translate + Gemma AI",
        th: "รวมสคริปต์ที่ผมเขียน มี Google Translate + Gemma AI ด้วย"
      }
    },
    {
      icon: "shield",
      url: "https://gist.githubusercontent.com/Kuju29/509fd9ffeebda377df9530026c848d20/raw",
      action: "copy",   // <- ใส่บรรทัดนี้ = กดแล้วคัดลอกลิงก์แทนการเปิดหน้าใหม่
      title: { en: "uBlock Origin Filter List", th: "ลิสต์บล็อกโฆษณา uBlock Origin" },
      desc: {
        en: "Paste this link into uBlock Origin → Filter lists → Import",
        th: "ก๊อปลิงก์นี้ไปใส่ใน uBlock Origin → Filter lists → Import"
      }
    }
  ],

  /* --- ช่องทางบริจาค --------------------------------------- */
  donate: [
    {
      icon: "paypal",
      url: "https://paypal.me/LATTETH",
      title: "PayPal",
      desc: { en: "paypal.me/LATTETH", th: "paypal.me/LATTETH" }
    },
    {
      icon: "github",
      url: "https://github.com/sponsors/Kuju29",
      title: "GitHub Sponsors",
      desc: { en: "Monthly or one-time", th: "รายเดือน หรือครั้งเดียวก็ได้" }
    },
    {
      icon: "coffee",
      url: "https://buymeacoffee.com/6h8ofi6zig",
      title: "Buy Me a Coffee",
      desc: { en: "buymeacoffee.com", th: "buymeacoffee.com" }
    }
  ],

  /* --- QR พร้อมเพย์ ---------------------------------------- */
  promptpay: {
    image: "assets/promptpay-card.png",
    downloadName: "kuju-promptpay.png"
  }
};
