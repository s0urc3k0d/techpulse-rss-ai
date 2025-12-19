import nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Create email transporter
 */
export const createEmailTransporter = (config: EmailConfig) => {
  return nodemailer.createTransport(config);
};

/**
 * Send email
 */
export const sendEmail = async (transporter: nodemailer.Transporter, data: EmailData): Promise<void> => {
  try {
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@techpulse.ai';
    await transporter.sendMail({
      from,
      to: data.to,
      subject: data.subject,
      text: data.text,
      html: data.html,
    });
    console.log(`✅ Email envoyé à ${data.to}: ${data.subject}`);
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    throw error;
  }
};

/**
 * Generate HTML email template for daily digest
 */
export const generateDailyDigestEmail = (
  articles: Array<{
    title: string;
    description?: string;
    link: string;
    source: string;
    category: string;
  }>,
  stats: {
    totalArticles: number;
    byCategory: Record<string, number>;
    topSources: Array<{ name: string; count: number }>;
  }
): string => {
  const date = new Date().toLocaleDateString('fr-FR', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Group articles by category
  const articlesByCategory: Record<string, typeof articles> = {};
  articles.forEach(article => {
    if (!articlesByCategory[article.category]) {
      articlesByCategory[article.category] = [];
    }
    articlesByCategory[article.category].push(article);
  });

  const categoryColors: Record<string, string> = {
    'IA & ML': '#3b82f6',
    'Dev & Tools': '#8b5cf6',
    'Cloud & DevOps': '#06b6d4',
    'Security': '#ef4444',
    'Web & Frontend': '#10b981',
    'Mobile': '#f59e0b',
    'Data & Analytics': '#ec4899',
    'Autre': '#64748b'
  };

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TechPulse AI - Digest Quotidien</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a; color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">
                📰 TechPulse AI
              </h1>
              <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 16px;">
                Digest Quotidien - ${date}
              </p>
            </td>
          </tr>

          <!-- Stats Summary -->
          <tr>
            <td style="padding: 30px;">
              <table width="100%" cellpadding="10" cellspacing="0">
                <tr>
                  <td width="33%" style="text-align: center; padding: 15px; background-color: #334155; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: bold; color: #3b82f6;">${stats.totalArticles}</div>
                    <div style="font-size: 14px; color: #94a3b8; margin-top: 5px;">Articles</div>
                  </td>
                  <td width="10"></td>
                  <td width="33%" style="text-align: center; padding: 15px; background-color: #334155; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: bold; color: #8b5cf6;">${Object.keys(stats.byCategory).length}</div>
                    <div style="font-size: 14px; color: #94a3b8; margin-top: 5px;">Catégories</div>
                  </td>
                  <td width="10"></td>
                  <td width="33%" style="text-align: center; padding: 15px; background-color: #334155; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: bold; color: #10b981;">${stats.topSources.length}</div>
                    <div style="font-size: 14px; color: #94a3b8; margin-top: 5px;">Sources</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Articles by Category -->
          ${Object.entries(articlesByCategory).map(([category, catArticles]) => `
          <tr>
            <td style="padding: 0 30px 20px;">
              <h2 style="color: ${categoryColors[category] || '#64748b'}; font-size: 20px; margin: 20px 0 15px; padding-bottom: 10px; border-bottom: 2px solid ${categoryColors[category] || '#64748b'};">
                ${category} (${catArticles.length})
              </h2>
              ${catArticles.slice(0, 5).map(article => `
              <div style="background-color: #334155; border-radius: 8px; padding: 20px; margin-bottom: 15px; border-left: 4px solid ${categoryColors[category] || '#64748b'};">
                <h3 style="margin: 0 0 10px; font-size: 16px; color: #f8fafc;">
                  <a href="${article.link}" style="color: #f8fafc; text-decoration: none;">${article.title}</a>
                </h3>
                ${article.description ? `
                <p style="margin: 0 0 10px; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                  ${article.description.slice(0, 150)}${article.description.length > 150 ? '...' : ''}
                </p>
                ` : ''}
                <div style="font-size: 12px; color: #94a3b8;">
                  📡 ${article.source}
                </div>
                <div style="margin-top: 10px;">
                  <a href="${article.link}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">
                    Lire l'article →
                  </a>
                </div>
              </div>
              `).join('')}
              ${catArticles.length > 5 ? `
              <p style="text-align: center; color: #94a3b8; font-size: 14px; margin-top: 10px;">
                ... et ${catArticles.length - 5} autre(s) article(s)
              </p>
              ` : ''}
            </td>
          </tr>
          `).join('')}

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 30px; text-align: center; border-top: 1px solid #334155;">
              <p style="margin: 0; font-size: 14px; color: #64748b;">
                Généré automatiquement par TechPulse AI
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #475569;">
                Powered by Google Gemini AI
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Generate plain text version of email
 */
export const generateDailyDigestText = (
  articles: Array<{
    title: string;
    description?: string;
    link: string;
    source: string;
    category: string;
  }>,
  stats: {
    totalArticles: number;
  }
): string => {
  const date = new Date().toLocaleDateString('fr-FR', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  let text = `TechPulse AI - Digest Quotidien\n`;
  text += `${date}\n\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `📊 Résumé: ${stats.totalArticles} articles\n\n`;

  // Group by category
  const byCategory: Record<string, typeof articles> = {};
  articles.forEach(a => {
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  });

  Object.entries(byCategory).forEach(([category, items]) => {
    text += `\n${category} (${items.length})\n`;
    text += `${'─'.repeat(50)}\n\n`;
    
    items.slice(0, 5).forEach((article, i) => {
      text += `${i + 1}. ${article.title}\n`;
      if (article.description) {
        text += `   ${article.description.slice(0, 100)}...\n`;
      }
      text += `   📡 ${article.source}\n`;
      text += `   🔗 ${article.link}\n\n`;
    });
  });

  text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Généré automatiquement par TechPulse AI\n`;

  return text;
};
