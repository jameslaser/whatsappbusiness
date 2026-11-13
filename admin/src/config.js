// Public values only. The publishable key is designed for browsers: every table is locked by Row Level Security,
// so only a signed-in admin can read or write anything. Never put a secret or service_role key in this file.
export const SUPABASE_URL = 'https://xpkrtagvfwocnuecwukt.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_1z08BxPCq1V5bnH35_DJKw_wBVuFXaq';

export const CLINIC = {
  brand: 'James Laser Hair Removal for Men',
  whatsapp: '966557401562',
  tz: 'Asia/Riyadh',
  site: 'https://jameslaser.github.io/whatsappbusiness/'
};

// Added to every promotional (offer) message. Arabic first, same wording as the website footer.
export const LEGAL_FOOTER = {
  ar: 'إعلان · James Laser Hair Removal for Men, Harmony Derma، شارع خالد بن الوليد، الحمراء، الرياض.\n' +
      'واتساب: +966 55 740 1562 · من السبت إلى الخميس، 1:00 ظهراً – 10:00 مساءً.\n' +
      'النتائج تختلف ولا تُضمن. من المضاعفات المحتملة: احمرار وتورم مؤقتان، وتغيّر في لون الجلد، وفي حالات نادرة حروق أو بثور أو ندبات. عدم الالتزام بتعليمات ما بعد الجلسة والمتابعة قد يزيد الخطر.',
  en: 'Advertisement · James Laser Hair Removal for Men, Harmony Derma, Khalid Bin Walid St, Al Hamra, Riyadh.\n' +
      'WhatsApp: +966 55 740 1562 · Saturday to Thursday, 1:00 PM – 10:00 PM.\n' +
      'Results vary and are not guaranteed. Possible complications: temporary redness and swelling, skin color changes and, rarely, burns, blisters or scars. Skipping aftercare and follow-up can raise the risk.',
  stop: 'لإيقاف الرسائل الترويجية اكتب: إيقاف\nTo stop promotional messages reply: STOP'
};

export const IDLE_SIGN_OUT_MINUTES = 30;
