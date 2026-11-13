// Builds blogger/whatsapp-button-snippet.html: the floating button script inlined,
// ready to paste into a Blogger "HTML/JavaScript" gadget. Run: node tools/build-snippet.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(join(root, 'site/assets/wa-button.js'), 'utf8').trim();

if (/<\/?script|<!--/i.test(js)) throw new Error('wa-button.js must not contain script tags or HTML comment markers');

const out = `<!-- James Laser Hair Removal for Men: floating WhatsApp button.
     Paste into Blogger > Layout > Add a Gadget > HTML/JavaScript (put it in the Footer so it loads on every page).
     Optional settings: see the comment at the top of the script below. -->
<script>
//<![CDATA[
${js}
//]]>
</script>
`;

writeFileSync(join(root, 'blogger/whatsapp-button-snippet.html'), out);
console.log('wrote blogger/whatsapp-button-snippet.html (' + out.length + ' bytes)');
