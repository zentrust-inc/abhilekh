// Help (26 Nov 2026): questions and answers, photo tips. English here; Nepali in i18n.js (test/help.test.mjs checks every
// line has it). Every answer describes what Abhilekh does; none gives medical advice. Change the words here, not in code.
window.HELP = {
  faq: [
    { id: 'what', q: 'What is Abhilekh?', a: [
      'Abhilekh keeps your medical papers safe and lets a doctor see them when you choose.',
      'It shows what each paper says, exactly as printed. It gives no advice: it does not tell you what a result means or what to do.'] },
    { id: "normal", q: "Does Abhilekh tell me whether my result is normal?", a: [
      "No. Abhilekh shows the value, the unit, the range printed on the paper and any flag the lab printed, exactly as printed.",
      "It never says what a result means, never adds a range and never raises an alarm. Ask your doctor what a result means."] },
    { id: "anypaper", q: "Can I add an old paper, or one from any hospital, clinic or lab?", a: [
      "Yes. Any paper you hold can be added: old or new, from any hospital, clinic, lab or pharmacy, printed or handwritten."] },
    { id: 'add', q: 'How do I add a paper?', a: [
      'On Home, tap Photograph a paper. Take one page at a time. The photo is kept exactly as taken.',
      'Two readers then read it. When it says Read · ready to check, open it and check each line against the paper.'] },
    { id: "blurry", q: "What if the paper is crumpled, blurry or badly lit?", a: [
      "Smooth the paper flat and take the photo again in good light. A clear photo is read far better.",
      "Words nobody can read are marked [Uncertain], never guessed. You can type them from the paper when you check it."] },
    { id: "again", q: "What happens if I photograph a page again, or add the back side later?", a: [
      "Each photo is kept as its own paper. A new photo never overwrites an old one.",
      "If you no longer want the earlier photo, delete it yourself from My papers."] },
    { id: "status", q: "What do the words under each paper mean?", a: [
      "Original kept · waiting to be read: the photo is safe and waits for the readers. Being read: the readers are reading it now.",
      "Read · ready to check: open it and check it against the paper. Checked and added to your record: done, and it can be shared.",
      "Could not be read. The original is kept: the photo is safe; nothing was filled in. Waiting: the reading limit for this month is reached: it will be read next month."] },
    { id: 'check', q: 'Why do I check every line?', a: [
      'Two separate readers read each photo. A line is filled in for you only when both read the same thing.',
      'Even then, you look at the paper and confirm it. Nothing reaches a doctor until you add it to your record.'] },
    { id: 'unresolved', q: 'What does "Unresolved. Original document available." mean?', a: [
      'The two readers did not read the same thing, or one of them could not read it.',
      'Type it from the paper, or leave it Unresolved. The doctor can always see the photo of the paper too.'] },
    { id: "notwritten", q: "What do “Not written on the paper” and “Leave it Unresolved” mean?", a: [
      "Not written on the paper: the paper does not say this, for example no duration for a medicine.",
      "Leave it Unresolved: the paper says something, but you cannot read it either. The doctor then sees “Unresolved. Original document available.” and can look at the photo."] },
    { id: "wrong", q: "What if Abhilekh reads something wrong?", a: [
      "You are the one who decides. On the check screen, change any line to what the paper says before you add it to your record.",
      "The photo of the paper never changes, so what the paper really says can always be seen."] },
    { id: "change", q: "Can I change a paper after I add it to my record?", a: [
      "Not yet. If something is wrong, delete the paper from My papers and add the photo again, then check it again."] },
    { id: 'tick', q: 'Why must I tick dates and numbers with a decimal point myself?', a: [
      'A wrong date or a decimal point in the wrong place changes a paper the most.',
      'So these always need your own tick, even when both readers agree.'] },
    { id: 'share', q: 'How do I share with a doctor?', a: [
      'Open Sharing, choose the papers and confirm with your PIN or fingerprint. Show the QR code to the doctor, or send the link.',
      'It works for 15 minutes. You can stop it at any time without a PIN, and you see each time it is opened.'] },
    { id: "stop", q: "How do I stop a share?", a: [
      "Open Sharing and tap Stop sharing on that share. No PIN is needed. The doctor’s link stops working at once."] },
    { id: "doctorsees", q: "What does the doctor see?", a: [
      "Only the papers you chose, for 15 minutes: the date, the hospital or lab, each test with its value, unit, printed range and printed flag, and each medicine as written.",
      "Beside each value the doctor can open the part of the photo it came from, and the whole photo of the paper, under the banner “Patient-provided records. Not institution-verified. May be incomplete.”"] },
    { id: "doctoredit", q: "Can a doctor add or change anything in my record?", a: [
      "No. A doctor can only look, while your share is open. Only you add and check papers."] },
    { id: 'keep', q: 'Can the doctor keep my papers?', a: [
      'The doctor’s page has no download or print button, and every page carries a watermark.',
      'A web page cannot stop a screenshot or a photo of the screen.'] },
    { id: 'who', q: 'Who can see my papers?', a: [
      'You, and a doctor only while a share you made is open.',
      'The people who run Abhilekh’s servers can technically reach the stored data.'] },
    { id: 'where', q: 'Where are my papers kept?', a: [
      'The photos are kept in Google Drive. Your account and what the papers say are kept on Microsoft Azure servers in India, with a copy in Google Drive.',
      'To read a photo, a copy is sent to Anthropic (Claude) and to Google (Cloud Vision). Your papers are not kept in Nepal.'] },
    { id: "source", q: "Where did a value in my record come from?", a: [
      "Every value comes from one of your papers. In My papers, tap See the photo on that paper to see the photo it was read from.",
      "A doctor you share with can open the exact part of the photo each value was read from."] },
    { id: "offline", q: "Can I use Abhilekh without internet?", a: [
      "Abhilekh needs internet to add, read, check and share papers, and the doctor needs internet to open a share.",
      "With a weak connection, take the photos with your phone’s camera first and add them in Abhilekh later, when the connection is good."] },
    { id: "keeppaper", q: "Do I still need to keep the paper?", a: [
      "Keep it if you can. Abhilekh keeps the photo exactly as taken and you can show it at any time, but a hospital or office may still ask for the original paper."] },
    { id: "export", q: "Can I save or print my own record?", a: [
      "Not yet. You can open every paper and its photo in the app at any time."] },
    { id: 'family', q: 'Can I keep papers for my family?', a: [
      'Yes. One account can hold up to 6 people, each with their own papers and shares.',
      'Opening another person’s papers asks for your PIN or fingerprint.'] },
    { id: 'pin', q: 'I forgot my PIN, or I have a new phone.', a: [
      'On the sign-in screen, get a new code by SMS or email, or sign in with Google again, and set a new PIN.',
      'After that, new shares wait 24 hours. You can still stop a share at once.'] },
    { id: "newphone", q: "How do I move to a new phone?", a: [
      "Your papers are kept by Abhilekh, not on the phone. On the new phone, sign in with the same mobile number or email and the code sent to it, or with Google, and all your papers are there.",
      "With a mobile number or email, the old phone is signed out and new shares wait 24 hours. You can still stop a share at once."] },
    { id: 'cost', q: 'What does it cost?', a: ['Abhilekh is free.'] },
    { id: 'delete', q: 'How do I delete a paper or my account?', a: [
      'To delete a paper, open My papers and tap Delete this paper. To delete everything, open the Menu and tap Delete my account. You confirm with your PIN.',
      'It is gone from the app at once, and from every copy within 30 days. This cannot be undone.'] },
  ],
  tips: [
    'One page at a time.',
    'Lay the paper flat on a table.',
    'Fill the screen with the page.',
    'No shine or shadow. Turn the flash off.',
    'Hold still until the photo is sharp.',
  ],
};
