/**
 * Farmer-friendly multilingual advisory generation (English, Kannada, Hindi,
 * Marathi). Structured model outputs are rendered through templates so the
 * text is predictable and auditable; the same structured payload can be
 * handed to an LLM for free-form conversation later (see docs/ROADMAP).
 */
const LANGS = {
  en: { name: 'English', locale: 'en-IN' },
  kn: { name: 'ಕನ್ನಡ', locale: 'kn-IN' },
  hi: { name: 'हिंदी', locale: 'hi-IN' },
  mr: { name: 'मराठी', locale: 'mr-IN' },
};

const T = {
  en: {
    irrigate_today: 'Irrigate today morning for {hours} hours ({volume} m³ of water).',
    irrigate_tomorrow: 'Irrigate tomorrow morning for {hours} hours ({volume} m³ of water).',
    irrigate_in: 'Next irrigation in {days} days (on {date}) - about {hours} hours ({volume} m³).',
    rain_skip: 'Rain is expected ({rain} mm in 3 days) - do not irrigate now. Next irrigation around {date}.',
    drip_daily: 'Run the drip system for {hours} hours every day ({volume} m³/day).',
    stress: 'Water stress: {level} ({prob}% chance of moderate or severe stress).',
    delay: 'If irrigation is delayed by 5 days, expected yield loss is {loss}% ({tonnes} t of cane).',
    yield: 'Expected cane yield: {yield} t/ha ({total} t for this plot).',
    fert: 'Fertigation this week: {urea} kg urea, {map} kg 12-61-0 and {mop} kg potash ({splits} splits).',
    fert_stop: 'No fertiliser is needed at this crop stage.',
    fungal: 'High humidity: watch for rust, red rot and smut. Inspect leaves and remove infected clumps.',
    borer: 'Hot and dry weather: watch for early shoot borer (dead hearts).',
    disease_low: 'Disease and pest risk is low.',
    stress_levels: ['None', 'Mild', 'Moderate', 'Severe'],
    risk_levels: ['Low', 'Medium', 'High'],
    chat_help: 'Ask me about irrigation, fertiliser, disease, yield or rain for a plot - for example "When should I irrigate MM-MD-0110?"',
    chat_need_farm: 'Please tell me your plot ID (for example MM-MD-0110) so I can give plot-specific advice.',
    chat_unknown_farm: 'I could not find plot {id}. Please check the ID.',
    chat_greeting: 'Namaskara! I am Krishi Mitra, your irrigation assistant.',
    chat_summary: 'Plot {id} ({village}, {taluk}) - crop age {age} days, {stage} stage.',
  },
  kn: {
    irrigate_today: 'ಇಂದು ಬೆಳಿಗ್ಗೆ {hours} ಗಂಟೆ ನೀರು ಹಾಯಿಸಿ ({volume} ಘನ ಮೀಟರ್ ನೀರು).',
    irrigate_tomorrow: 'ನಾಳೆ ಬೆಳಿಗ್ಗೆ {hours} ಗಂಟೆ ನೀರು ಹಾಯಿಸಿ ({volume} ಘನ ಮೀಟರ್ ನೀರು).',
    irrigate_in: 'ಮುಂದಿನ ನೀರಾವರಿ {days} ದಿನಗಳ ನಂತರ ({date}) - ಸುಮಾರು {hours} ಗಂಟೆ ({volume} ಘನ ಮೀಟರ್).',
    rain_skip: 'ಮಳೆ ನಿರೀಕ್ಷಿಸಲಾಗಿದೆ (3 ದಿನಗಳಲ್ಲಿ {rain} ಮಿ.ಮೀ) - ಈಗ ನೀರು ಹಾಯಿಸಬೇಡಿ. ಮುಂದಿನ ನೀರಾವರಿ ಸುಮಾರು {date} ರಂದು.',
    drip_daily: 'ಹನಿ ನೀರಾವರಿಯನ್ನು ಪ್ರತಿದಿನ {hours} ಗಂಟೆ ನಡೆಸಿ ({volume} ಘನ ಮೀಟರ್/ದಿನ).',
    stress: 'ನೀರಿನ ಒತ್ತಡ: {level} (ಮಧ್ಯಮ ಅಥವಾ ತೀವ್ರ ಒತ್ತಡದ ಸಾಧ್ಯತೆ {prob}%).',
    delay: 'ನೀರಾವರಿ 5 ದಿನ ತಡವಾದರೆ ಸುಮಾರು {loss}% ({tonnes} ಟನ್ ಕಬ್ಬು) ಇಳುವರಿ ನಷ್ಟವಾಗಬಹುದು.',
    yield: 'ಅಂದಾಜು ಕಬ್ಬಿನ ಇಳುವರಿ: {yield} ಟನ್/ಹೆಕ್ಟೇರ್ (ಈ ಹೊಲಕ್ಕೆ {total} ಟನ್).',
    fert: 'ಈ ವಾರದ ರಸಾವರಿ: {urea} ಕೆಜಿ ಯೂರಿಯಾ, {map} ಕೆಜಿ 12-61-0 ಮತ್ತು {mop} ಕೆಜಿ ಪೊಟ್ಯಾಷ್ ({splits} ಕಂತುಗಳಲ್ಲಿ).',
    fert_stop: 'ಈ ಬೆಳೆ ಹಂತದಲ್ಲಿ ಗೊಬ್ಬರದ ಅಗತ್ಯವಿಲ್ಲ.',
    fungal: 'ಹೆಚ್ಚಿನ ತೇವಾಂಶ: ತುಕ್ಕು ರೋಗ, ಕೆಂಪು ಕೊಳೆ ಮತ್ತು ಕಾಡಿಗೆ ರೋಗದ ಬಗ್ಗೆ ಎಚ್ಚರವಿರಲಿ. ಎಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ರೋಗಪೀಡಿತ ಕೂಳೆಗಳನ್ನು ತೆಗೆದುಹಾಕಿ.',
    borer: 'ಬಿಸಿ ಮತ್ತು ಒಣ ಹವಾಮಾನ: ಆರಂಭಿಕ ಕಾಂಡ ಕೊರಕದ (ಡೆಡ್ ಹಾರ್ಟ್) ಬಗ್ಗೆ ಎಚ್ಚರವಿರಲಿ.',
    disease_low: 'ರೋಗ ಮತ್ತು ಕೀಟಗಳ ಅಪಾಯ ಕಡಿಮೆ ಇದೆ.',
    stress_levels: ['ಇಲ್ಲ', 'ಸ್ವಲ್ಪ', 'ಮಧ್ಯಮ', 'ತೀವ್ರ'],
    risk_levels: ['ಕಡಿಮೆ', 'ಮಧ್ಯಮ', 'ಹೆಚ್ಚು'],
    chat_help: 'ನೀರಾವರಿ, ಗೊಬ್ಬರ, ರೋಗ, ಇಳುವರಿ ಅಥವಾ ಮಳೆಯ ಬಗ್ಗೆ ಕೇಳಿ - ಉದಾ: "MM-MD-0110 ಗೆ ಯಾವಾಗ ನೀರು ಹಾಯಿಸಬೇಕು?"',
    chat_need_farm: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೊಲದ ಐಡಿ ತಿಳಿಸಿ (ಉದಾ: MM-MD-0110).',
    chat_unknown_farm: '{id} ಹೊಲ ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಐಡಿ ಪರಿಶೀಲಿಸಿ.',
    chat_greeting: 'ನಮಸ್ಕಾರ! ನಾನು ಕೃಷಿ ಮಿತ್ರ, ನಿಮ್ಮ ನೀರಾವರಿ ಸಹಾಯಕ.',
    chat_summary: 'ಹೊಲ {id} ({village}, {taluk}) - ಬೆಳೆಯ ವಯಸ್ಸು {age} ದಿನಗಳು.',
  },
  hi: {
    irrigate_today: 'आज सुबह {hours} घंटे सिंचाई करें ({volume} घन मीटर पानी)।',
    irrigate_tomorrow: 'कल सुबह {hours} घंटे सिंचाई करें ({volume} घन मीटर पानी)।',
    irrigate_in: 'अगली सिंचाई {days} दिन बाद ({date}) करें - लगभग {hours} घंटे ({volume} घन मीटर)।',
    rain_skip: 'बारिश की संभावना है (3 दिनों में {rain} मिमी) - अभी सिंचाई न करें। अगली सिंचाई लगभग {date} को।',
    drip_daily: 'ड्रिप को रोज़ {hours} घंटे चलाएँ ({volume} घन मीटर/दिन)।',
    stress: 'जल तनाव: {level} (मध्यम या गंभीर तनाव की संभावना {prob}%)।',
    delay: 'यदि सिंचाई 5 दिन देर से हुई, तो उपज में लगभग {loss}% ({tonnes} टन गन्ना) की हानि हो सकती है।',
    yield: 'अनुमानित गन्ना उपज: {yield} टन/हेक्टेयर (इस खेत के लिए {total} टन)।',
    fert: 'इस सप्ताह फर्टिगेशन: {urea} किग्रा यूरिया, {map} किग्रा 12-61-0 और {mop} किग्रा पोटाश ({splits} भागों में)।',
    fert_stop: 'इस फसल अवस्था में उर्वरक की आवश्यकता नहीं है।',
    fungal: 'अधिक नमी: रस्ट, लाल सड़न और कंडुआ रोग पर नज़र रखें। पत्तियों की जाँच करें और संक्रमित पौधे हटाएँ।',
    borer: 'गर्म और शुष्क मौसम: प्रारंभिक तना छेदक (डेड हार्ट) पर नज़र रखें।',
    disease_low: 'रोग और कीट का जोखिम कम है।',
    stress_levels: ['नहीं', 'हल्का', 'मध्यम', 'गंभीर'],
    risk_levels: ['कम', 'मध्यम', 'अधिक'],
    chat_help: 'सिंचाई, उर्वरक, रोग, उपज या बारिश के बारे में पूछें - जैसे "MM-MD-0110 में सिंचाई कब करूँ?"',
    chat_need_farm: 'कृपया अपने खेत की आईडी बताएँ (जैसे MM-MD-0110)।',
    chat_unknown_farm: 'खेत {id} नहीं मिला। कृपया आईडी जाँचें।',
    chat_greeting: 'नमस्ते! मैं कृषि मित्र हूँ, आपका सिंचाई सहायक।',
    chat_summary: 'खेत {id} ({village}, {taluk}) - फसल की आयु {age} दिन।',
  },
  mr: {
    irrigate_today: 'आज सकाळी {hours} तास पाणी द्या ({volume} घनमीटर पाणी).',
    irrigate_tomorrow: 'उद्या सकाळी {hours} तास पाणी द्या ({volume} घनमीटर पाणी).',
    irrigate_in: 'पुढील पाणी {days} दिवसांनी ({date}) द्या - सुमारे {hours} तास ({volume} घनमीटर).',
    rain_skip: 'पावसाची शक्यता आहे (3 दिवसांत {rain} मिमी) - आत्ता पाणी देऊ नका. पुढील पाणी सुमारे {date} रोजी.',
    drip_daily: 'ठिबक दररोज {hours} तास चालवा ({volume} घनमीटर/दिवस).',
    stress: 'पाण्याचा ताण: {level} (मध्यम किंवा तीव्र ताणाची शक्यता {prob}%).',
    delay: 'पाणी 5 दिवस उशिरा दिल्यास सुमारे {loss}% ({tonnes} टन ऊस) उत्पादन घटू शकते.',
    yield: 'अपेक्षित ऊस उत्पादन: {yield} टन/हेक्टर (या शेतासाठी {total} टन).',
    fert: 'या आठवड्याचे फर्टिगेशन: {urea} किलो युरिया, {map} किलो 12-61-0 आणि {mop} किलो पोटॅश ({splits} हप्त्यांत).',
    fert_stop: 'या पीक अवस्थेत खताची गरज नाही.',
    fungal: 'जास्त आर्द्रता: तांबेरा, लाल कूज आणि काणी रोगावर लक्ष ठेवा. पाने तपासा आणि रोगग्रस्त बेटे काढून टाका.',
    borer: 'उष्ण व कोरडे हवामान: खोडकिडीवर (डेड हार्ट) लक्ष ठेवा.',
    disease_low: 'रोग व किडीचा धोका कमी आहे.',
    stress_levels: ['नाही', 'सौम्य', 'मध्यम', 'तीव्र'],
    risk_levels: ['कमी', 'मध्यम', 'जास्त'],
    chat_help: 'पाणी, खत, रोग, उत्पादन किंवा पावसाबद्दल विचारा - उदा. "MM-MD-0110 ला पाणी कधी द्यावे?"',
    chat_need_farm: 'कृपया तुमच्या शेताचा आयडी सांगा (उदा. MM-MD-0110).',
    chat_unknown_farm: 'शेत {id} सापडले नाही. कृपया आयडी तपासा.',
    chat_greeting: 'नमस्कार! मी कृषी मित्र, तुमचा सिंचन सहाय्यक.',
    chat_summary: 'शेत {id} ({village}, {taluk}) - पिकाचे वय {age} दिवस.',
  },
};

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}

function lang(code) {
  return T[code] ? code : 'en';
}

function t(code, key, vars = {}) {
  return fill(T[lang(code)][key], vars);
}

function level(code, kind, idx) {
  return T[lang(code)][kind][idx];
}

function formatDate(date, code) {
  return date.toLocaleDateString(LANGS[lang(code)].locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

module.exports = { LANGS, t, level, formatDate, lang };
