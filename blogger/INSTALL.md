# Floating WhatsApp button for the Blogger blog

## بالعربية

1. افتح Blogger من **متصفح على الكمبيوتر** (تطبيق الجوال لا يعدّل التخطيط)، ثم **التخطيط (Layout)**.
2. في قسم **التذييل (Footer)** اضغط **إضافة أداة (Add a Gadget)** ثم **HTML/JavaScript**.
3. الصق كامل محتوى الملف `whatsapp-button-snippet.html` واحفظ.
4. افتح أي مقال: يظهر زر «واتساب» أسفل الشاشة. اضغطه وتأكد أن واتساب يفتح برسالة جاهزة، دون أن ترسلها.

الخيارات: لتثبيت اللغة أو نقل الزر إلى اليمين، أضف أداة HTML/JavaScript منفصلة **قبلها** تحتوي سطراً واحداً:
`window.JLWA_BUTTON = { lang: 'ar', position: 'right' };` (داخل وسم script).

## English

1. Open Blogger in a **desktop browser** (the phone app cannot edit the layout), then **Layout**.
2. In the **Footer** section choose **Add a Gadget**, then **HTML/JavaScript**.
3. Paste the whole content of `whatsapp-button-snippet.html` and save.
4. Open any post: a "WhatsApp" button appears at the bottom. Tap it and confirm WhatsApp opens with a ready message. Do not send it.

Options: to fix the language or move the button to the right, add a separate HTML/JavaScript gadget **before** it with one line inside a script tag:
`window.JLWA_BUTTON = { lang: 'ar', position: 'right' };`

## Notes

- The button reads the page title and address (without query string) and writes them in the message so the clinic knows which page the visitor came from. Nothing is sent until the visitor taps send in WhatsApp.
- Tested in a desktop Chromium page. **Not yet tested inside Blogger itself.** Back up your layout first (Theme > Backup/Restore).
- Rebuild the snippet after editing `site/assets/wa-button.js`: `node tools/build-snippet.mjs`.
- This button is a clinic brand element. Keep the advertisement footer gadget on the blog as well.
