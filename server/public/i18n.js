// English / नेपाली for the patient app.
// Every visible English line is looked up here by its exact text; a line with no entry stays in English.
// Papers (titles, values, units, printed ranges, flags) are never translated: they are shown the way they are printed.
(function(){
const NE={
// Sign-in
"Can't reach Abhilekh right now. You are still signed in.":"अहिले अभिलेखमा पुग्न सकिएन। तपाईं अझै साइन इन हुनुहुन्छ।",
"Try again":"पुनः प्रयास गर्नुहोस्",
"Sign in to Abhilekh":"अभिलेखमा साइन इन गर्नुहोस्",
"Continue with Google, or your mobile number gets one SMS code the first time, or your email address gets one code by mail. A PIN protects sharing; with a mobile number or email you also use it to sign in on that device.":"Google बाट जारी राख्नुहोस्, वा पहिलो पटक तपाईंको मोबाइल नम्बरमा एउटा SMS कोड आउँछ, वा इमेल ठेगानामा एउटा कोड आउँछ। पिनले साझेदारीको सुरक्षा गर्छ; मोबाइल नम्बर वा इमेलबाट साइन इन गर्दा त्यही डिभाइसमा पिन पनि प्रयोग हुन्छ।",
"Welcome back":"पुनः स्वागत छ",
"Sign in with fingerprint or face":"डिभाइसको औँठाछाप वा अनुहारबाट साइन इन गर्नुहोस्",
"or":"वा",
"Your PIN (6 digits)":"तपाईंको पिन (6 अंक)",
"PIN (6 digits)":"पिन (6 अंक)",
"Sign in":"साइन इन",
"Not you, or a new device? Use another account":"तपाईं होइन, वा नयाँ डिभाइस? अर्को खाता प्रयोग गर्नुहोस्",
"Continue with Google":"Google बाट जारी राख्नुहोस्",
"or use a mobile number or email":"वा मोबाइल नम्बर वा इमेल प्रयोग गर्नुहोस्",
"Mobile number (Nepal) or email":"मोबाइल नम्बर (नेपाल) वा इमेल",
"98XXXXXXXX or name@example.com":"98XXXXXXXX वा name@example.com",
"Forgot your PIN on a Google account? Sign in with Google again":"Google खातामा पिन बिर्सनुभयो? फेरि Google बाट साइन इन गर्नुहोस्",
"New here, new device or forgot PIN? Get a code (SMS for a number, mail for an email)":"नयाँ हुनुहुन्छ, नयाँ डिभाइस हो वा पिन बिर्सनुभयो? कोड मगाउनुहोस् (मोबाइलमा SMS वा इमेलमा)",
"Code from the SMS or email":"SMS वा इमेलबाट आएको कोड",
"Continue":"जारी राख्नुहोस्",
"New 6-digit PIN":"नयाँ 6 अंकको पिन",
"The same PIN again":"उही पिन फेरि लेख्नुहोस्",
"Save PIN":"पिन सुरक्षित गर्नुहोस्",
"Welcome. Choose a 6-digit PIN. Google signs you in on any device; the PIN protects sharing.":"स्वागत छ। 6 अंकको पिन रोज्नुहोस्। Google ले तपाईंलाई जुनसुकै डिभाइसमा साइन इन गराउँछ; पिनले साझेदारीको सुरक्षा गर्छ।",
"Welcome. Choose a 6-digit PIN. You will use it on this device instead of a code.":"स्वागत छ। 6 अंकको पिन रोज्नुहोस्। कोडको सट्टा यो डिभाइसमा तपाईंले यही प्रयोग गर्नुहुन्छ।",
"Set a new PIN. Other devices are signed out, and new shares wait 24 hours. You can still stop shares at once.":"नयाँ पिन राख्नुहोस्। अन्य डिभाइसबाट साइन आउट हुनेछ, र नयाँ साझेदारी गर्न 24 घण्टा कुर्नुपर्नेछ। पहिलेबाट सक्रिय साझेदारी भने तपाईंले जुनसुकै बेला रोक्न सक्नुहुन्छ।",
"Type your number or email first.":"पहिले आफ्नो नम्बर वा इमेल टाइप गर्नुहोस्।",
"Enter your PIN.":"आफ्नो पिन हाल्नुहोस्।",
"Enter your 6-digit PIN.":"आफ्नो 6 अंकको पिन हाल्नुहोस्।",
"Enter a valid email address.":"मान्य इमेल ठेगाना हाल्नुहोस्।",
"Enter a Nepal mobile number (10 digits starting with 98, 97 or 96) or an email address.":"नेपालको मोबाइल नम्बर (98, 97 वा 96 बाट सुरु हुने 10 अंक) वा इमेल ठेगाना हाल्नुहोस्।",
"Not turned on yet. Sign in with your PIN, then turn it on from the home screen.":"अहिलेसम्म सक्रिय गरिएको छैन। आफ्नो पिनले साइन इन गर्नुहोस्, अनि मुख्य पृष्ठबाट सक्रिय गर्नुहोस्।",
"Cancelled. Nothing was changed.":"रद्द गरियो। केही पनि परिवर्तन भएन।",
"Cancelled. Type your PIN instead.":"रद्द गरियो। बरु आफ्नो पिन टाइप गर्नुहोस्।",
"Cancelled. Use your PIN or a code.":"रद्द गरियो। आफ्नो पिन वा कोड प्रयोग गर्नुहोस्।",
"Google sign-in did not work. Try again in a few minutes.":"Google साइन इन चलेन। केही मिनेटपछि पुनः प्रयास गर्नुहोस्।",
"Google sign-in did not work. Try again.":"Google साइन इन चलेन। पुनः प्रयास गर्नुहोस्।",
"Google sign-in was cancelled.":"Google साइन इन रद्द गरियो।",
"No Abhilekh account uses this Google account yet. Choose Continue with Google to create one.":"यो Google खाता प्रयोग गर्ने कुनै अभिलेख खाता अहिलेसम्म छैन। एउटा बनाउन “Google बाट जारी राख्नुहोस्” रोज्नुहोस्।",
"That sign-in took too long or came from another browser. Try again.":"त्यो साइन इन धेरै ढिलो भयो वा अर्को ब्राउजरबाट आयो। पुनः प्रयास गर्नुहोस्।",
"This Google account has no verified email, so it cannot be used.":"यो Google खातामा प्रमाणित इमेल छैन, त्यसैले यो प्रयोग गर्न मिल्दैन।",
"Something went wrong.":"केही गडबड भयो।",
// PIN entry
"PIN entry":"पिन राख्नुहोस्",
"PIN, six digits":"पिन, छ अंक",
"Show digits":"अंक देखाउनुहोस्",
"Hide digits":"अंक लुकाउनुहोस्",
"Your PIN":"तपाईंको पिन",
"Choose a 6-digit PIN":"6 अंकको पिन रोज्नुहोस्",
"Type the same PIN again":"उही पिन फेरि टाइप गर्नुहोस्",
"Your PIN, to turn it on":"सक्रिय गर्न आफ्नो पिन राख्नुहोस्",
"Your PIN, to confirm":"पुष्टि गर्न तपाईंको पिन",
"Your current PIN":"तपाईंको हालको पिन",
"Choose a new 6-digit PIN":"नयाँ 6 अंकको पिन रोज्नुहोस्",
"Type the new PIN again":"नयाँ पिन फेरि टाइप गर्नुहोस्",
"The two PINs are not the same. Start again.":"दुई पिन मिलेनन्। फेरि सुरु गर्नुहोस्।",
"The two PINs are not the same.":"दुई पिन मिलेनन्।",
"The two new PINs are not the same.":"दुई नयाँ पिन मिलेनन्।",
"The two new PINs are not the same. Type the new PIN again.":"दुई नयाँ पिन मिलेनन्। नयाँ पिन फेरि टाइप गर्नुहोस्।",
"PIN changed. Your other devices stay signed in.":"पिन बदलियो। तपाईंका अन्य डिभाइसहरू साइन इन नै रहन्छन्।",
// Home
"Hello":"नमस्ते",
"Add a name for this record":"यो अभिलेखलाई नाम दिनुहोस्",
"Change name":"नाम बदल्नुहोस्",
"A name for this record (only you and the doctors you share with see it)":"यो अभिलेखको नाम (तपाईं र तपाईंले साझा गर्ने डाक्टरले मात्र देख्छन्)",
"e.g. Papers of Aama":"जस्तै: आमाका कागजातहरू",
"Save":"सुरक्षित गर्नुहोस्",
"Cancel":"रद्द गर्नुहोस्",
"Next time, one touch":"अर्को पटक, एकै पटक छुएर",
"Sign in and share with your fingerprint or face instead of typing a PIN. Your device does the check; Abhilekh never sees it.":"पिन टाइप गर्नुको सट्टा औँठाछाप वा अनुहारले साइन इन र साझा गर्नुहोस्। तपाईंको डिभाइसले औँठाछाप वा अनुहार पहिचान गर्छ। अभिलेखले तपाईंको बायोमेट्रिक विवरण प्राप्त गर्दैन।",
"Turn on fingerprint or face":"औँठाछाप वा अनुहार सक्रिय गर्नुहोस्",
"Photograph a paper":"कागजको फोटो खिच्नुहोस्",
"Coming in the next step":"यो सुविधा अर्को चरणमा उपलब्ध हुनेछ",
"Show a doctor":"डाक्टरलाई देखाउनुहोस्",
"Choose papers, set the time":"कागजात छान्नुहोस् र समय तोक्नुहोस्",
"Add a paper first":"पहिले कागजात थप्नुहोस्",
"How it will work":"यो कसरी काम गर्छ",
"Check that Abhilekh read it right":"अभिलेखले कागजात ठीकसँग पढ्यो कि जाँच्नुहोस्",
"Show a doctor with a code, for as long as you choose":"तपाईंले छानेको समयसम्म कोडबाट डाक्टरलाई देखाउनुहोस्",
"Try it with a SAMPLE paper":"नमूना (SAMPLE) कागजातबाट प्रयास गर्नुहोस्",
"SAMPLE papers are invented. They go into your record only, so you can see how Abhilekh works.":"नमूना कागजातहरू काल्पनिक हुन्। ती तपाईंको अभिलेखमा मात्र जान्छन्, ताकि अभिलेख कसरी काम गर्छ तपाईंले हेर्न सक्नुहुन्छ।",
"Tap to see them":"हेर्न थिच्नुहोस्",
"Nothing is being shared":"केही पनि साझा गरिएको छैन",
"Tap to see who looked":"कसले हेर्यो हेर्न थिच्नुहोस्",
"Only you can see your papers":"तपाईंले मात्र आफ्ना कागजात देख्न सक्नुहुन्छ",
// Papers
"My papers":"मेरा कागजात",
"Each paper is shown the way it is printed. Dates keep the calendar printed on the paper; nothing is converted.":"प्रत्येक कागजातमा छापिएको विवरण जस्ताको तस्तै देखाइन्छ। मिति कागजातमा छापिएको पात्रोमै रहन्छ; केही पनि रूपान्तरण गरिँदैन।",
"No papers yet. Photograph a paper from Home.":"अहिलेसम्म कुनै कागजात छैन। मुख्य पृष्ठबाट कागजको फोटो खिच्नुहोस्।",
"See what it says":"के लेखिएको छ हेर्नुहोस्",
"Hide what it says":"के लेखिएको छ लुकाउनुहोस्",
// Sharing
"Share with a doctor":"डाक्टरसँग साझा गर्नुहोस्",
"You choose what a doctor can see and for how long. You can stop a share at any time, and you see every time it is opened.":"डाक्टरले के र कति समयसम्म हेर्न सक्छन् भन्ने तपाईंले रोज्नुहुन्छ। तपाईं जुनसुकै बेला साझेदारी रोक्न सक्नुहुन्छ, र कसैले खोलेको प्रत्येक पटक तपाईंले देख्न सक्नुहुन्छ।",
"New share":"नयाँ साझेदारी",
"Add a paper first. There is nothing to share yet.":"पहिले कागजात थप्नुहोस्। साझा गर्न अहिले केही छैन।",
"Who is it for? (only for your own list, optional)":"कसका लागि? (तपाईंको आफ्नै सूचीका लागि मात्र, ऐच्छिक)",
"e.g. Dr. Namuna, Example Clinic":"जस्तै: डा. नमूना, उदाहरण क्लिनिक",
"How long can they see it?":"उनीहरूले कति समयसम्म हेर्न सक्छन्?",
"15 minutes":"15 मिनेट",
"1 minute (test only)":"1 मिनेट (परीक्षणका लागि मात्र)",
"A share lasts 15 minutes.":"साझेदारी 15 मिनेटसम्म मात्र रहन्छ।",
"Use my PIN instead":"मेरो पिन प्रयोग गर्नुहोस्",
"Create share link":"साझेदारी लिङ्क बनाउनुहोस्",
"Create share link (fingerprint or face)":"साझेदारी लिङ्क बनाउनुहोस् (औँठाछाप वा अनुहार)",
"Choose at least one report to share.":"साझा गर्न कम्तीमा एउटा कागजात छान्नुहोस्।",
"Your shares":"तपाईंका साझेदारीहरू",
"Active":"सक्रिय",
"Stopped by you":"तपाईंले रोक्नुभएको",
"Time ran out":"म्याद सकियो",
"Doctor (no name given)":"डाक्टर (नाम दिइएको छैन)",
"Send by WhatsApp":"WhatsApp बाट पठाउनुहोस्",
"Open the link":"लिङ्क खोल्नुहोस्",
"Stop sharing":"साझेदारी रोक्नुहोस्",
"Yes, stop now":"हो, अहिले रोक्नुहोस्",
"Who looked, and when:":"कसले र कहिले हेर्नुभयो:",
"You stopped this share.":"तपाईंले यो साझेदारी रोक्नुभयो।",
"Opened on a doctor's phone.":"डाक्टरको फोनमा खोलियो।",
"Someone tried to open it, but it was stopped. Nothing was shown.":"कसैले खोल्न खोज्यो, तर यो रोकिएको थियो। केही देखाइएन।",
"Someone tried to open it, but it was out of time. Nothing was shown.":"कसैले खोल्न खोज्यो, तर समय सकिएको थियो। केही देखाइएन।",
"The doctor sees only what the paper says: value, unit, printed range and any flag the lab printed. Abhilekh gives no advice.":"डाक्टरले कागजातमा भएको विवरण मात्र देख्नुहुन्छ: मान, एकाइ, छापिएको दायरा र ल्याबले छापेको कुनै चिन्ह। अभिलेखले कुनै सल्लाह दिँदैन।",
"No such share.":"त्यस्तो साझेदारी छैन।",
// Menu
"Menu":"मेनु",
"Account":"खाता",
"Language":"भाषा",
"Close":"बन्द गर्नुहोस्",
"Fingerprint or face":"औँठाछाप वा अनुहार",
"Change PIN":"पिन बदल्नुहोस्",
"Sign out":"साइन आउट",
"‹ Back":"‹ पछाडि जानुहोस्",
"Fingerprint or face sign-in":"औँठाछाप वा अनुहारबाट साइन इन",
"Turn on for this device":"यो डिभाइसमा सक्रिय गर्नुहोस्",
"Add this device":"यो डिभाइस थप्नुहोस्",
"Turn off everywhere":"सबै ठाउँमा बन्द गर्नुहोस्",
"Off. Turn it on to sign in with one touch instead of typing a PIN. Your device does the check; Abhilekh never sees a fingerprint or a face.":"बन्द छ। पिन टाइप गर्नुको सट्टा एकै पटक छुएर साइन इन गर्न यसलाई सक्रिय गर्नुहोस्। तपाईंको डिभाइसले औँठाछाप वा अनुहार पहिचान गर्छ। अभिलेखले तपाईंको बायोमेट्रिक विवरण प्राप्त गर्दैन।",
"Current PIN":"हालको पिन",
"New PIN (6 digits)":"नयाँ पिन (6 अंक)",
"The new PIN again":"नयाँ पिन फेरि",
// Bottom tabs
"Home":"मुख्य",
"Sharing":"साझा",
// Titles
"Abhilekh: your medical papers":"अभिलेख: तपाईंका स्वास्थ्य कागजात",
// Messages from the server
"Not signed in.":"साइन इन गरिएको छैन।",
"Sign in first.":"पहिले साइन इन गर्नुहोस्।",
"The PIN must be 6 digits.":"पिन 6 अंकको हुनुपर्छ।",
"Choose a PIN that is not one digit repeated.":"एउटै अंक मात्र दोहोरिएको पिन नरोज्नुहोस्।",
"Choose a PIN that is not a run like 123456.":"123456 जस्तो क्रमैसँग आएको पिन नरोज्नुहोस्।",
"Choose a PIN that is not one half repeated.":"पिनको पहिलो तीन अंक नै अन्तिम तीन अंकमा दोहोरिने पिन नरोज्नुहोस्।",
"Choose a PIN different from the current one.":"हालको पिनभन्दा फरक पिन रोज्नुहोस्।",
"A code was just sent. Wait a minute before asking again.":"कोड भर्खरै पठाइएको छ। फेरि माग्नुअघि एक मिनेट पर्खनुहोस्।",
"Busy. Try again in a few minutes.":"व्यस्त छ। केही मिनेटपछि पुनः प्रयास गर्नुहोस्।",
"Too many tries. Wait a few minutes.":"धेरै प्रयास भयो। केही मिनेट पर्खनुहोस्।",
"Too many tries.":"धेरै प्रयास भयो।",
"Too many wrong codes. Ask for a new one.":"धेरै गलत कोड भयो। नयाँ कोड माग्नुहोस्।",
"This code has ended. Ask for a new one.":"यो कोडको समय सकियो। नयाँ कोड माग्नुहोस्।",
"This step has timed out. Ask for a new code.":"यो चरणको समय सकियो। नयाँ कोड माग्नुहोस्।",
"This step has timed out. Sign in with Google again.":"यो चरणको समय सकियो। फेरि Google बाट साइन इन गर्नुहोस्।",
"This step has timed out. Try again.":"यो चरणको समय सकियो। पुनः प्रयास गर्नुहोस्।",
"The SMS could not be sent. Try again in a few minutes.":"SMS पठाउन सकिएन। केही मिनेटपछि पुनः प्रयास गर्नुहोस्।",
"The email could not be sent. Try again in a few minutes.":"इमेल पठाउन सकिएन। केही मिनेटपछि पुनः प्रयास गर्नुहोस्।",
"Codes by SMS are not switched on yet, so new sign-ups and new phones cannot be added. Try again later.":"SMS कोड अहिलेसम्म सक्रिय गरिएको छैन, त्यसैले नयाँ दर्ता र नयाँ फोन थप्न मिल्दैन। पछि पुनः प्रयास गर्नुहोस्।",
"Sign-up is paused for today. Try again tomorrow.":"आजका लागि नयाँ दर्ता रोकिएको छ। भोलि पुनः प्रयास गर्नुहोस्।",
"Too many codes from this connection. Try again later.":"यो जडानबाट धेरै कोड माग्न खोजियो। पछि पुनः प्रयास गर्नुहोस्।",
"This device is already set up.":"यो डिभाइस पहिले नै सेट गरिएको छ।",
"This device could not be set up for fingerprint or face sign-in.":"यो डिभाइसमा औँठाछाप वा अनुहारबाट साइन इन सेट गर्न सकिएन।",
"Fingerprint or face did not work. Type your PIN instead.":"औँठाछाप वा अनुहारले काम गरेन। बरु आफ्नो पिन टाइप गर्नुहोस्।",
"Fingerprint or face sign-in did not work. Use your PIN or a code.":"औँठाछाप वा अनुहारबाट साइन इन चलेन। आफ्नो पिन वा कोड प्रयोग गर्नुहोस्।",
"Fingerprint or face sign-in is not switched on.":"औँठाछाप वा अनुहारबाट साइन इन सक्रिय गरिएको छैन।",
"No fingerprint or face sign-in is set up. Use your PIN.":"औँठाछाप वा अनुहारबाट साइन इन सेट गरिएको छैन। आफ्नो पिन प्रयोग गर्नुहोस्।",
"Google sign-in is not switched on yet.":"Google साइन इन अहिलेसम्म सक्रिय गरिएको छैन।",
"This link is not valid.":"यो लिङ्क मान्य छैन।",
"Bad request.":"अनुरोध मिलेन।",
"Send JSON.":"JSON पठाउनुहोस्।",
// Family and photos (build plan M1, 25 Nov 2026). Written by Claude: needs a native speaker's review.
"Family":"परिवार",
"Add a family member":"परिवारको सदस्य थप्नुहोस्",
"Switch person":"अर्को व्यक्ति रोज्नुहोस्",
"Whose papers?":"कसका कागजात?",
"One account can keep the papers of your family, each person separately. Opening another person's papers asks for your PIN.":"एउटै खातामा परिवारका सबैको कागजात छुट्टाछुट्टै राख्न सकिन्छ। अर्को व्यक्तिको कागजात खोल्दा तपाईंको पिन सोधिन्छ।",
"Open with fingerprint or face":"औँठाछाप वा अनुहारबाट खोल्नुहोस्",
"Your PIN, to open these papers":"यी कागजात खोल्न तपाईंको पिन",
"Open":"खोल्नुहोस्",
"Add":"थप्नुहोस्",
"e.g. Aama":"जस्तै: आमा",
"open now":"अहिले खुला",
"(no name yet)":"(नाम राखिएको छैन)",
"Photograph a paper":"कागजको फोटो खिच्नुहोस्",
"Kept exactly as taken":"जस्ताको तस्तै राखिन्छ",
"Coming soon":"छिट्टै आउँदैछ",
"Add a paper":"कागज थप्नुहोस्",
"The photo is kept exactly as taken: never straightened, cropped or changed. Abhilekh does not read it yet; reading comes next.":"फोटो जस्ताको तस्तै राखिन्छ: सिधा पारिँदैन, काटिँदैन, बदलिँदैन। अभिलेखले यसलाई अहिले पढ्दैन; पढ्ने काम अर्को चरणमा आउँछ।",
"For a good photo:":"राम्रो फोटोका लागि:",
"one page at a time, flat on a dark table, the page filling the screen, no shine from a light or window.":"एकपटकमा एउटा पाना, गाढा रङको टेबलमा समतल राखेर, पानाले पूरै स्क्रिन ढाक्ने गरी, बत्ती वा झ्यालको चमक नपर्ने गरी।",
"Take a photo":"फोटो खिच्नुहोस्",
"Choose from the phone (several at once)":"फोनबाट रोज्नुहोस् (एकैपटक धेरै)",
"No good internet? Photograph all the papers with the phone's camera now, then choose them here together when the connection is good.":"इन्टरनेट राम्रो छैन? अहिले फोनको क्यामेराले सबै कागजको फोटो खिच्नुहोस्, अनि इन्टरनेट राम्रो भएपछि यहाँ सबै एकैपटक रोज्नुहोस्।",
"Keeping the original…":"मूल फोटो राख्दै…",
"This photo is already kept.":"यो फोटो पहिले नै राखिएको छ।",
"Original kept. It will be read in the next step.":"मूल फोटो राखियो। यसलाई अर्को चरणमा पढिनेछ।",
"Photo":"फोटो",
"Original kept · waiting to be read":"मूल फोटो राखिएको छ · पढ्न बाँकी",
"Being read…":"पढ्दै…",
"Waiting: the reading limit for this month is reached":"पर्खँदै: यो महिनाको पढ्ने सीमा पुगेको छ",
"Could not be read. The original is kept.":"पढ्न सकिएन। मूल फोटो राखिएको छ।",
"Read · ready to check":"पढियो · जाँच गर्न तयार",
"Only one reader answered, so nothing is marked as agreed.":"एउटा मात्र पाठकले जवाफ दियो, त्यसैले कुनै कुरा सहमत भनेर चिनो लगाइएको छैन।",
"See what the readers found":"पाठकहरूले के भेटे हेर्नुहोस्",
"Hide what the readers found":"पाठकहरूले भेटेको लुकाउनुहोस्",
"Date on the paper":"कागजमा लेखिएको मिति",
"Clinic, hospital or lab":"क्लिनिक, अस्पताल वा ल्याब",
"Doctor":"डाक्टर",
"Check this against the paper.":"यसलाई कागजसँग दाँजेर हेर्नुहोस्।",
"Only one reader saw this line.":"यो पङ्क्ति एउटा पाठकले मात्र देख्यो।",
"Not found on the DDA list: shown as written.":"DDA सूचीमा भेटिएन: लेखिएजस्तै देखाइएको।",
"Unresolved. Original document available.":"अनिर्णीत। मूल कागज उपलब्ध छ।",
"Check and add to my record":"जाँचेर मेरो अभिलेखमा थप्नुहोस्",
"Checked and added to your record":"जाँचेर तपाईंको अभिलेखमा थपियो",
"Checked by you":"तपाईंले जाँचेको",
"Back to my papers":"मेरा कागजातमा फर्कनुहोस्",
"This share is not live.":"यो साझेदारी अहिले खुला छैन।",
"Check against the paper":"कागजसँग दाँजेर जाँच्नुहोस्",
"Look at the paper and at each line below. Nothing reaches a doctor until you add it to your record.":"कागज र तलका हरेक पङ्क्ति हेर्नुहोस्। तपाईंले अभिलेखमा नथपेसम्म केही पनि डाक्टरकहाँ पुग्दैन।",
"Tap the photo to see it larger.":"ठूलो हेर्न फोटो थिच्नुहोस्।",
"Type it exactly as printed":"छापिएजस्तै लेख्नुहोस्",
"Both readers read this date the same. Check it against the paper.":"दुवै पाठकले यो मिति उस्तै पढे। कागजसँग दाँजेर हेर्नुहोस्।",
"The readers did not agree on the date. Type it yourself, exactly as printed (any calendar).":"पाठकहरू मितिमा सहमत भएनन्। कागजमा छापिएजस्तै आफैँ लेख्नुहोस् (जुनसुकै पात्रो)।",
"Medicine":"औषधि",
"Form":"किसिम",
"Tablet":"ट्याब्लेट","Capsule":"क्याप्सुल","Injection":"सुई","Syrup":"सिरप","Suspension":"सस्पेन्सन","Ointment":"मलहम","Drops":"थोपा","Sachet":"स्याचेट",
"Generic (DDA register)":"जेनेरिक नाम (DDA दर्ता सूची)",
"How often":"कति पटक",
"How long":"कति दिनसम्म",
"How long (as written)":"कति दिनसम्म (लेखिएजस्तै)",
"Choose from the paper":"कागजबाट छान्नुहोस्",
"Other (type it as written)":"अन्य (लेखिएजस्तै टाइप गर्नुहोस्)",
"Not written on the paper":"कागजमा लेखिएको छैन",
"As written on the paper":"कागजमा लेखिएजस्तै",
"How often, as written":"कति पटक, लेखिएजस्तै",
"The readers did not agree. Choose it from the paper, or leave it Unresolved.":"पाठकहरू सहमत भएनन्। कागजबाट छान्नुहोस्, वा अनिर्णीत नै छोड्नुहोस्।",
"Check the date against the paper.":"मिति कागजसँग दाँजेर हेर्नुहोस्।",
"Both readers read this the same.":"दुवै पाठकले यो एउटै पढे।",
"Has a decimal point: check it against the paper yourself.":"दशमलव छ: कागजसँग आफैँ दाँजेर हेर्नुहोस्।",
"The readers did not agree. Type it from the paper, or leave it Unresolved.":"पाठकहरू सहमत भएनन्। कागजबाट हेरेर लेख्नुहोस्, वा अनिर्णीत छोड्नुहोस्।",
"Matches the paper":"कागजसँग मिल्छ",
"Leave it Unresolved":"अनिर्णीत छोड्नुहोस्",
"Results":"नतिजा",
"Medicines":"औषधि",
"Test":"जाँच",
"Value":"मान",
"Unit":"एकाइ",
"Printed range":"छापिएको दायरा",
"Flag printed by the lab":"ल्याबले छापेको चिन्ह",
"Medicine, as written":"औषधि, लेखिएजस्तै",
"Dose":"मात्रा",
"Duration":"अवधि",
"This line is not on the paper":"यो पङ्क्ति कागजमा छैन",
"Put this line back":"यो पङ्क्ति फर्काउनुहोस्",
"Not found on the DDA list: kept as written.":"DDA सूचीमा भेटिएन: लेखिएजस्तै राखिएको।",
"Not found on the DDA register: kept as written.":"DDA दर्ता सूचीमा भेटिएन: लेखिएजस्तै राखिएको।",
"Not found on the DDA register: shown as written.":"DDA दर्ता सूचीमा भेटिएन: लेखिएजस्तै देखाइएको।",
"The readers did not agree, but this copy is on the DDA register exactly. Check it against the paper.":"पाठकहरू सहमत भएनन्, तर यो प्रतिलिपि DDA दर्ता सूचीमा हुबहु छ। कागजसँग दाँजेर हेर्नुहोस्।",
"Add to my record":"मेरो अभिलेखमा थप्नुहोस्",
"Abhilekh keeps what the paper says. It gives no advice.":"अभिलेखले कागजमा जे छ त्यही राख्छ। कुनै सल्लाह दिँदैन।",
"This paper is not ready to check yet.":"यो कागज अझै जाँच गर्न तयार छैन।",
"Type the date exactly as it is printed on the paper.":"मिति कागजमा छापिएजस्तै लेख्नुहोस्।",
"Add a checked paper first":"पहिले पुष्टि गरिएको कागज थप्नुहोस्",
"Type a name for this person.":"यो व्यक्तिको नाम लेख्नुहोस्।",
"One account can hold up to 6 people.":"एउटा खातामा बढीमा 6 जना राख्न सकिन्छ।",
"No such person.":"यस्तो व्यक्ति भेटिएन।",
"Adding photos is not switched on yet.":"फोटो थप्ने सुविधा अहिले खुला गरिएको छैन।",
"Send a photo (JPEG, PNG, WebP or HEIC).":"फोटो पठाउनुहोस् (JPEG, PNG, WebP वा HEIC)।",
"This photo is larger than 15 MB.":"यो फोटो 15 MB भन्दा ठूलो छ।",
"This photo is empty.":"यो फोटो खाली छ।",
"The photo could not be kept just now. Nothing was added. Try again in a minute.":"अहिले फोटो राख्न सकिएन। केही थपिएन। एक मिनेटपछि फेरि प्रयास गर्नुहोस्।",
"No such paper.":"यस्तो कागज भेटिएन।",
"The original could not be fetched just now.":"अहिले मूल फोटो ल्याउन सकिएन।",
"This original does not match what was kept.":"यो मूल फोटो राखिएकोसँग मिलेन।"
};
const ASK={"get a code by SMS":"SMS बाट कोड लिनुहोस्","get a code by email":"इमेलबाट कोड लिनुहोस्","sign in with Google again":"फेरि Google बाट साइन इन गर्नुहोस्"};
const KIND=(k)=>k==='number'?'नम्बर':'ठेगाना';
const PAT=[
[/^Papers of (.+)$/,m=>m[1]+' का कागजातहरू'],
[/^Added (.+)$/,m=>m[1]+' मा थपिएको'],
[/^(\d+) agreed by both readers · (\d+) for you to check · (\d+) unresolved$/,m=>'दुवै पाठक सहमत: '+m[1]+' · तपाईंले जाँच्नुपर्ने: '+m[2]+' · अनिर्णीत: '+m[3]],
[/^(\d+) ready to check$/,m=>m[1]+' जाँच गर्न तयार'],
[/^On the DDA register: (.+)$/,m=>'DDA दर्ता सूचीमा: '+m[1].replace(' · registration lapsed',' · दर्ता अवधि सकिएको').replace(/^several products share this name/,'यो नाममा धेरै उत्पादन छन्')],
[/^(\d+) lines? still to check\. They are marked in yellow\.$/,m=>'जाँच्न बाँकी '+m[1]+' पङ्क्ति पहेँलोमा देखाइएको छ।'],
[/^Check (.+) against the paper\.$/,m=>m[1]+' कागजसँग दाँजेर हेर्नुहोस्।'],
[/^Type (.+) from the paper, or leave it Unresolved\.$/,m=>m[1]+' कागजबाट लेख्नुहोस्, वा अनिर्णीत छोड्नुहोस्।'],
[/^The readers did not agree on this line\. Unresolved\. Original document available\.$/,m=>'यो पङ्क्तिमा पाठकहरू सहमत भएनन्। अनिर्णीत। मूल कागज उपलब्ध छ।'],
[/^Keeping the originals: (\d+) of (\d+)$/,m=>'मूल फोटो राख्दै: '+m[2]+' मध्ये '+m[1]],
[/^(\d+) kept(?: · (\d+) already kept)?(?: · (\d+) not kept)?\.$/,m=>m[1]+' राखियो'+(m[2]?' · '+m[2]+' पहिले नै राखिएको':'')+(m[3]?' · '+m[3]+' राख्न सकिएन':'')+'।'],
[/^(\d+) already kept(?: · (\d+) not kept)?\.$/,m=>m[1]+' पहिले नै राखिएको'+(m[2]?' · '+m[2]+' राख्न सकिएन':'')+'।'],
[/^(\d+) KB$/,m=>m[1]+' KB'],
[/^Signed in: (.+)$/,m=>'साइन इन गरिएको: '+m[1]],
[/^(\d+) papers?$/,m=>m[1]+' कागजात'],
[/^(\d+) active shares?$/,m=>m[1]+' साझेदारी सक्रिय छ'],
[/^Printed range: (.*?)(?: · flag printed on the paper: (.*))?$/,m=>'छापिएको दायरा: '+m[1]+(m[2]?' · कागजातमा छापिएको चिन्ह: '+m[2]:'')],
[/^(until|ended) (.+)$/,m=>m[2]+(m[1]==='until'?' सम्म':' मा समाप्त भयो')],
[/^(\d+) of 6 digits$/,m=>'6 मध्ये '+m[1]+' अंक'],
[/^You created this share(?: for (.+))?\.$/,m=>m[1]?'तपाईंले '+m[1]+' का लागि यो साझेदारी बनाउनुभयो।':'तपाईंले यो साझेदारी बनाउनुभयो।'],
[/^Test mode, nothing sent\. Code: (.+)$/,m=>'परीक्षण मोड, केही पठाइएन। कोड: '+m[1]],
[/^On for this device(?: and (\d+) more)?\. One touch signs you in, and a touch confirms creating a share; your PIN still works\.$/,m=>'यो डिभाइसमा सक्रिय छ'+(m[1]?' र थप '+m[1]+' मा':'')+'। एउटै छोइमा साइन इन हुन्छ, र साझेदारी बनाउँदा पनि एउटै छोइले पुष्टि गर्छ; तपाईंको पिन अझै काम गर्छ।'],
[/^On for (\d+) devices?, not yet for this one\. Add it to sign in with one touch here too\.$/,m=>m[1]+' डिभाइसमा सक्रिय छ, यसमा अझै छैन। यहाँ पनि एउटै छोइमा साइन इन गर्न यसलाई थप्नुहोस्।'],
[/^Your PIN was reset with a new code, so new shares are paused until (.+?)\. You can still stop shares\.$/,m=>'तपाईंको पिन नयाँ कोडले रिसेट गरिएकाले '+m[1]+' सम्म नयाँ साझेदारी रोकिएको छ। तपाईं अझै साझेदारी रोक्न सक्नुहुन्छ।'],
[/^New shares are paused until (.+?), 24 hours after your PIN was reset with a new code\. You can still stop shares\.$/,m=>m[1]+' सम्म नयाँ साझेदारी रोकिएको छ, नयाँ कोडले पिन रिसेट गरेको 24 घण्टासम्म। तपाईं अझै साझेदारी रोक्न सक्नुहुन्छ।'],
[/^Wrong PIN\. (\d+) tries left before a 15-minute wait\.$/,m=>'पिन मिलेन। 15 मिनेट कुर्नुपर्नुअघि '+m[1]+' पटक प्रयास बाँकी छ।'],
[/^That code is not right\. (\d+) tries left\.$/,m=>'त्यो कोड मिलेन। '+m[1]+' पटक प्रयास बाँकी छ।'],
[/^Too many wrong PINs\. (Get a code by SMS|Get a code by email|Sign in with Google again) to set a new PIN\.$/,m=>'धेरै गलत पिन भयो। नयाँ पिन राख्न '+ASK[m[1].toLowerCase()]+'।'],
[/^Too many wrong PINs\. Wait 15 minutes, or (.+)\.$/,m=>'धेरै गलत पिन भयो। 15 मिनेट पर्खनुहोस्, वा '+(ASK[m[1]]||m[1])+'।'],
[/^Too many wrong PINs\. Try again after (.+), or (.+)\.$/,m=>'धेरै गलत पिन भयो। '+m[1]+' पछि पुनः प्रयास गर्नुहोस्, वा '+(ASK[m[2]]||m[2])+'।'],
[/^This device is new for this (number|address)\. Get a code by (SMS|email) to continue\.$/,m=>'यो डिभाइस यो '+KIND(m[1])+'का लागि नयाँ हो। जारी राख्न '+(m[2]==='SMS'?'SMS':'इमेल')+'बाट कोड लिनुहोस्।'],
[/^This account already has (\d+) fingerprint or face sign-ins\. Remove them first\.$/,m=>'यो खातामा पहिले नै '+m[1]+' औँठाछाप वा अनुहार साइन इन छन्। पहिले तिनलाई हटाउनुहोस्।'],
[/^Too many codes for this (number|address)\. Try again later\.$/,m=>'यो '+KIND(m[1])+'का लागि धेरै कोड माग्न खोजियो। पछि पुनः प्रयास गर्नुहोस्।']
];
let lang='en';
try{lang=localStorage.getItem('abhLang')||((navigator.language||'').toLowerCase().startsWith('ne')?'ne':'en')}catch(e){}
function tr(s){
  if(lang!=='ne')return s;
  const k=String(s).replace(/\s+/g,' ').trim();if(!k)return s;
  let r=NE[k];
  if(r===undefined)for(const[re,f]of PAT){const m=re.exec(k);if(m){r=f(m);break}}
  if(r===undefined&&k.includes(' · ')){const ps=k.split(' · ');const out=ps.map(p=>{const q=NE[p];if(q!==undefined)return q;for(const[re,f]of PAT){const m=re.exec(p);if(m)return f(m)}return p});if(out.some((p,i)=>p!==ps[i]))r=out.join(' · ')}
  if(r===undefined)return s;
  return s.match(/^\s*/)[0]+r+s.match(/\s*$/)[0];
}
const TXT=new WeakMap(),ATT=new WeakMap(),AT=['placeholder','aria-label','title'];
function doText(n){
  const rec=TXT.get(n);const en=rec&&n.nodeValue===rec.ne?rec.en:n.nodeValue;
  if(lang==='ne'){const ne=tr(en);if(ne!==en){TXT.set(n,{en,ne});if(n.nodeValue!==ne)n.nodeValue=ne}else TXT.delete(n)}
  else if(rec&&n.nodeValue===rec.ne){n.nodeValue=rec.en;TXT.delete(n)}
}
function doAttr(e,a){
  if(!e.hasAttribute(a))return;
  let m=ATT.get(e);if(!m){m={};ATT.set(e,m)}
  const cur=e.getAttribute(a),rec=m[a];const en=rec&&cur===rec.ne?rec.en:cur;
  if(lang==='ne'){const ne=tr(en);if(ne!==en){m[a]={en,ne};if(cur!==ne)e.setAttribute(a,ne)}else delete m[a]}
  else if(rec&&cur===rec.ne){e.setAttribute(a,rec.en);delete m[a]}
}
function walk(root){
  if(root.nodeType===3){if(!/^(SCRIPT|STYLE)$/.test(root.parentNode&&root.parentNode.nodeName||''))doText(root);return}
  if(root.nodeType!==1||/^(SCRIPT|STYLE)$/.test(root.nodeName))return;
  AT.forEach(a=>doAttr(root,a));
  for(const c of root.childNodes)walk(c);
}
let TITLE0=document.title;
function setTitle(){const t=document.title;document.title=lang==='ne'?tr(TITLE0):TITLE0;void t}
const mo=new MutationObserver(list=>{
  for(const m of list){
    if(m.type==='childList')m.addedNodes.forEach(walk);
    else if(m.type==='characterData')doText(m.target);
    else if(m.type==='attributes')doAttr(m.target,m.attributeName);
  }
});
function paintSwitch(){
  document.documentElement.lang=lang==='ne'?'ne':'en';
  document.querySelectorAll('[data-lang]').forEach(b=>{const on=b.getAttribute('data-lang')===lang;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
}
function setLang(l){
  lang=l;try{localStorage.setItem('abhLang',l)}catch(e){}
  paintSwitch();walk(document.body);setTitle();
  window.dispatchEvent(new Event('langchange'));
}
window.i18n={lang:()=>lang,tr,set:setLang};
function start(){
  document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>setLang(b.getAttribute('data-lang'))));
  paintSwitch();walk(document.body);setTitle();
  mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:AT});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
