export type VocabularyWord = {
  en: string;
  dari: string;
  pt: string;
  emoji: string;
};

export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Vocabulário da cozinha": "لغات آشپزخانه",
  "Compreensão oral": "درک شنیداری",
  "Apresentação pessoal": "معرفی شخصی",
  "Inglês no cotidiano": "انگلیسی روزمره",
  "Gêneros digitais": "رسانه‌های دیجیتال",
  "Receita": "دستور پخت",
  "Cores e Frutas": "رنگ‌ها و میوه‌ها",
  "Números": "اعداد",
  "Família": "خانواده",
  "Corpo": "بدن",
  "Animais": "حیوانات",
};

export const VOCABULARY_GROUPS: Record<string, VocabularyWord[]> = {
  "Vocabulário da cozinha": [
    { en: "spoon", dari: "قاشق", pt: "colher", emoji: "🥄" },
    { en: "fork", dari: "پنجه", pt: "garfo", emoji: "🍴" },
    { en: "knife", dari: "کارد", pt: "faca", emoji: "🔪" },
    { en: "plate", dari: "بشقاب", pt: "prato", emoji: "🍽️" },
    { en: "cup", dari: "پیاله", pt: "xícara", emoji: "☕" },
  ],
  "Compreensão oral": [
    { en: "listen", dari: "گوش دادن", pt: "ouvir/escutar", emoji: "👂" },
    { en: "speak", dari: "صحبت کردن", pt: "falar", emoji: "🗣️" },
    { en: "repeat", dari: "تکرار کردن", pt: "repetir", emoji: "🔁" },
    { en: "understand", dari: "فهمیدن", pt: "entender", emoji: "💡" },
    { en: "hear", dari: "شنیدن", pt: "ouvir", emoji: "🎧" },
  ],
  "Apresentação pessoal": [
    { en: "name", dari: "نام", pt: "nome", emoji: "📛" },
    { en: "age", dari: "سن", pt: "idade", emoji: "🎂" },
    { en: "country", dari: "کشور", pt: "país", emoji: "🌍" },
    { en: "city", dari: "شهر", pt: "cidade", emoji: "🏙️" },
    { en: "hello", dari: "سلام", pt: "olá", emoji: "👋" },
  ],
  "Inglês no cotidiano": [
    { en: "house", dari: "خانه", pt: "casa", emoji: "🏠" },
    { en: "car", dari: "موتر", pt: "carro", emoji: "🚗" },
    { en: "money", dari: "پول", pt: "dinheiro", emoji: "💵" },
    { en: "phone", dari: "تلیفون", pt: "telefone/celular", emoji: "📱" },
    { en: "key", dari: "کلید", pt: "chave", emoji: "🔑" },
  ],
  "Gêneros digitais": [
    { en: "email", dari: "ایمیل", pt: "e-mail", emoji: "📧" },
    { en: "website", dari: "وب سایت", pt: "site", emoji: "🌐" },
    { en: "password", dari: "رمز عبور", pt: "senha", emoji: "🔐" },
    { en: "video", dari: "ویدیو", pt: "vídeo", emoji: "🎥" },
    { en: "chat", dari: "چت", pt: "bate-papo", emoji: "💬" },
  ],
  "Receita": [
    { en: "water", dari: "آب", pt: "água", emoji: "💧" },
    { en: "bread", dari: "نان", pt: "pão", emoji: "🍞" },
    { en: "milk", dari: "شیر", pt: "leite", emoji: "🥛" },
    { en: "sugar", dari: "بوره", pt: "açúcar", emoji: "🧂" },
    { en: "salt", dari: "نمک", pt: "sal", emoji: "🧂" },
  ],
  "Cores e Frutas": [
    { en: "apple", dari: "سیب", pt: "maçã", emoji: "🍎" },
    { en: "banana / fruit", dari: "کیله", pt: "banana / fruta", emoji: "🍌" },
    { en: "red", dari: "سرخ", pt: "vermelho", emoji: "🔴" },
    { en: "blue", dari: "آبی", pt: "azul", emoji: "🔵" },
    { en: "green", dari: "سبز", pt: "verde", emoji: "🟢" },
  ],
  "Números": [
    { en: "one", dari: "یک", pt: "um", emoji: "1️⃣" },
    { en: "two", dari: "دو", pt: "dois", emoji: "2️⃣" },
    { en: "three", dari: "سه", pt: "três", emoji: "3️⃣" },
    { en: "four", dari: "چهار", pt: "quatro", emoji: "4️⃣" },
    { en: "five", dari: "پنج", pt: "cinco", emoji: "5️⃣" },
  ],
  "Família": [
    { en: "mother", dari: "مادر", pt: "mãe", emoji: "👩" },
    { en: "father", dari: "پدر", pt: "pai", emoji: "👨" },
    { en: "brother", dari: "برادر", pt: "irmão", emoji: "👦" },
    { en: "sister", dari: "خواهر", pt: "irmã", emoji: "👧" },
    { en: "family", dari: "خانواده", pt: "família", emoji: "👪" },
  ],
  "Corpo": [
    { en: "eye", dari: "چشم", pt: "olho", emoji: "👁️" },
    { en: "hand", dari: "دست", pt: "mão", emoji: "✋" },
    { en: "heart", dari: "قلب", pt: "coração", emoji: "❤️" },
    { en: "head", dari: "سر", pt: "cabeça", emoji: "👤" },
    { en: "foot", dari: "پا", pt: "pé", emoji: "🦶" },
  ],
  "Animais": [
    { en: "cat", dari: "گربه", pt: "gato", emoji: "🐱" },
    { en: "bird", dari: "پرنده", pt: "pássaro", emoji: "🐦" },
    { en: "fish", dari: "ماهی", pt: "peixe", emoji: "🐟" },
    { en: "horse", dari: "اسپ", pt: "cavalo", emoji: "🐎" },
    { en: "dog", dari: "سگ", pt: "cachorro", emoji: "🐶" },
  ],
};

export const VOCABULARY = Object.values(VOCABULARY_GROUPS).flat();
