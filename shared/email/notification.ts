import { transport } from "./mailer";
import { config } from "../config/config";

export async function sendBudgetAlert(opts: {
  email: string;
  name: string;
  category: string;
  spent: number;
  limit: number;
  percentage: number;
}) {
  const isOver = opts.spent >= opts.limit;
  const subject = isOver
    ? `⚠️ Budget exceeded: ${opts.category}`
    : `⚠️ Budget alert: ${opts.category} at ${opts.percentage}%`;

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
      <h2 style="color:#16a34a">CampusWallet Budget Alert</h2>
      <p>Hi ${opts.name},</p>
      <p>${
        isOver
          ? `You've <strong>exceeded</strong> your <strong>${opts.category}</strong> budget.`
          : `You've used <strong>${opts.percentage}%</strong> of your <strong>${opts.category}</strong> budget.`
      }</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px;border:1px solid #e5e7eb">Category</td><td style="padding:8px;border:1px solid #e5e7eb"><strong>${opts.category}</strong></td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb">Spent</td><td style="padding:8px;border:1px solid #e5e7eb">₦${opts.spent.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb">Limit</td><td style="padding:8px;border:1px solid #e5e7eb">₦${opts.limit.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb">Usage</td><td style="padding:8px;border:1px solid #e5e7eb;color:${isOver ? "#dc2626" : "#d97706"}">${opts.percentage}%</td></tr>
      </table>
      <p style="color:#6b7280;font-size:14px">Log in to CampusWallet to review your spending.</p>
    </div>
  `;

  await transport.sendMail({
    from: `"CampusWallet" <${config.EMAIL_NAME}>`,
    to: opts.email,
    subject,
    html,
  });
}

export async function sendWelcomeEmail(opts: { email: string; name: string }) {
  await transport.sendMail({
    from: `"CampusWallet" <${config.EMAIL_NAME}>`,
    to: opts.email,
    subject: "Welcome to CampusWallet 🎉",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
        <h2 style="color:#16a34a">Welcome, ${opts.name}!</h2>
        <p>Your CampusWallet account is ready. Start tracking your expenses and setting budgets to stay on top of your finances.</p>
        <p style="color:#6b7280;font-size:14px">— The CampusWallet Team</p>
      </div>
    `,
  });
}
