import { Resend } from 'resend';

export async function sendReportEmail(params: {
  uri: string;
  reason: string | null;
  movement?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;

  if (!apiKey || !to) {
    console.warn('[report] Email skipped: RESEND_API_KEY or ADMIN_EMAIL missing');
    return;
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM ?? 'Sport App <onboarding@resend.dev>';

  await resend.emails.send({
    from,
    to,
    subject: `Signalement · ${params.movement ?? 'performance'}`,
    text: [
      'Nouveau signalement sur une performance.',
      '',
      `Movement: ${params.movement ?? '—'}`,
      `URI: ${params.uri}`,
      `Raison: ${params.reason ?? '—'}`,
    ].join('\n'),
  });
}
