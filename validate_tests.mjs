import fs from 'fs';

function validate() {
  console.log("Testlar tekshirilmoqda...");
  const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));

  manifest.forEach(item => {
    const data = JSON.parse(fs.readFileSync(`./${item.file}`, 'utf8'));
    data.forEach((q, idx) => {
      if (!q.q || typeof q.q !== 'string') {
        throw new Error(`Xato: ${item.file} -> ${idx}-savolda matn yo'q`);
      }
      if (!Array.isArray(q.o) || q.o.length < 2 || q.o.length > 6) {
        throw new Error(`Xato: ${item.file} -> ${idx}-savolda variantlar noto'g'ri (2-6 bo'lishi kerak)`);
      }
      if (typeof q.a !== 'number' || q.a < 0 || q.a >= q.o.length) {
        throw new Error(`Xato: ${item.file} -> ${idx}-savolda to'g'ri javob indeksi diapazondan tashqarida`);
      }
      if (q.lex) {
        if (q.lex.doc && !/^-?\d+$/.test(q.lex.doc)) {
          throw new Error(`Xato: ${item.file} -> ${idx}-savol doc faqat raqam bo'lishi kerak`);
        }
        if (q.lex.anchor && !/^-?\d+$/.test(q.lex.anchor)) {
          throw new Error(`Xato: ${item.file} -> ${idx}-savol anchor faqat raqam bo'lishi kerak`);
        }
      }
    });
  });
  console.log("Barcha testlar muvaffaqiyatli tekshirildi!");
}

validate();
