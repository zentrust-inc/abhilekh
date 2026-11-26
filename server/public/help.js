// Help (26 Nov 2026): questions and answers, photo tips. English here; Nepali in i18n.js (test/help.test.mjs checks every
// line has it). Every answer describes what Abhilekh does; none gives medical advice. Change the words here, not in code.
window.HELP = {
  faq: [
    { id: 'what', q: 'What is Abhilekh?', a: [
      'Abhilekh keeps your medical papers safe and lets a doctor see them when you choose.',
      'It shows what each paper says, exactly as printed. It gives no advice: it does not tell you what a result means or what to do.'] },
    { id: 'add', q: 'How do I add a paper?', a: [
      'On Home, tap Photograph a paper. Take one page at a time. The photo is kept exactly as taken.',
      'Two readers then read it. When it says Read · ready to check, open it and check each line against the paper.'] },
    { id: 'check', q: 'Why do I check every line?', a: [
      'Two separate readers read each photo. A line is filled in for you only when both read the same thing.',
      'Even then, you look at the paper and confirm it. Nothing reaches a doctor until you add it to your record.'] },
    { id: 'unresolved', q: 'What does "Unresolved. Original document available." mean?', a: [
      'The two readers did not read the same thing, or one of them could not read it.',
      'Type it from the paper, or leave it Unresolved. The doctor can always see the photo of the paper too.'] },
    { id: 'tick', q: 'Why must I tick dates and numbers with a decimal point myself?', a: [
      'A wrong date or a decimal point in the wrong place changes a paper the most.',
      'So these always need your own tick, even when both readers agree.'] },
    { id: 'share', q: 'How do I share with a doctor?', a: [
      'Open Sharing, choose the papers and confirm with your PIN or fingerprint. Show the QR code to the doctor, or send the link.',
      'It works for 15 minutes. You can stop it at any time without a PIN, and you see each time it is opened.'] },
    { id: 'keep', q: 'Can the doctor keep my papers?', a: [
      'The doctor’s page has no download or print button, and every page carries a watermark.',
      'A web page cannot stop a screenshot or a photo of the screen.'] },
    { id: 'who', q: 'Who can see my papers?', a: [
      'You, and a doctor only while a share you made is open.',
      'The people who run Abhilekh’s servers can technically reach the stored data.'] },
    { id: 'where', q: 'Where are my papers kept?', a: [
      'The photos are kept in Google Drive. Your account and what the papers say are kept on Microsoft Azure servers in India, with a copy in Google Drive.',
      'To read a photo, a copy is sent to Anthropic (Claude) and to Google (Cloud Vision). Your papers are not kept in Nepal.'] },
    { id: 'family', q: 'Can I keep papers for my family?', a: [
      'Yes. One account can hold up to 6 people, each with their own papers and shares.',
      'Opening another person’s papers asks for your PIN or fingerprint.'] },
    { id: 'pin', q: 'I forgot my PIN, or I have a new phone.', a: [
      'On the sign-in screen, get a new code by SMS or email, or sign in with Google again, and set a new PIN.',
      'After that, new shares wait 24 hours. You can still stop a share at once.'] },
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
