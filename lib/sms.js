// SMS sender stub. Swap the body of `sendSms` with a real provider call
// (e.g., Twilio) when one is available. Until then, every "sent" message
// is printed to the server console with full details so you can complete
// the verification flow during development.

function sendSms(to, body) {
  const ts = new Date().toISOString();
  const banner = '═'.repeat(60);
  console.log('\n' + banner);
  console.log('  📱 [SMS] (개발 모드 — 콘솔에만 출력됩니다)');
  console.log('  수신자 : ' + to);
  console.log('  시각   : ' + ts);
  console.log('  내용   : ' + body);
  console.log(banner + '\n');
  return { ok: true, to, body, sentAt: ts };
}

module.exports = { sendSms };
