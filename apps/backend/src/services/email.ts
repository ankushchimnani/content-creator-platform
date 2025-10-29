import nodemailer from 'nodemailer';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify connection configuration
export async function verifyEmailConnection() {
  try {
    await transporter.verify();
    console.log('✅ Email service is ready to send messages');
    return true;
  } catch (error) {
    console.error('❌ Email service configuration error:', error);
    return false;
  }
}

// Send account credentials email to new user
export async function sendCredentialsEmail(
  userEmail: string,
  userName: string,
  temporaryPassword: string,
  role: string,
  courseNames?: string[],
  admins?: Array<{ name: string; contact?: string }>
) {
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const currentYear = new Date().getFullYear();

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: userEmail,
    subject: '🎉 Welcome to Masai - Your Guard Rail Account Credentials',
    html: `
      <!DOCTYPE html>
      <html lang="en" style="margin: 0; padding: 0;">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Welcome to Masai</title>
          <style>
            body {
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #f9fafb;
              margin: 0;
              padding: 0;
              color: #333333;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: #ffffff;
              border-radius: 10px;
              box-shadow: 0 3px 12px rgba(0, 0, 0, 0.05);
              overflow: hidden;
            }
            .header {
              background-color: #d32f2f;
              padding: 20px 30px;
              text-align: center;
            }
            .header img {
              max-height: 50px;
            }
            .content {
              padding: 30px;
              line-height: 1.6;
            }
            .content h2 {
              color: #111827;
              margin-top: 0;
            }
            .content p {
              color: #4b5563;
            }
            .credentials {
              background-color: #f3f4f6;
              border-radius: 8px;
              padding: 16px;
              margin: 20px 0;
            }
            .credentials p {
              margin: 6px 0;
              font-size: 15px;
            }
            .credentials strong {
              color: #111827;
            }
            .cta {
              text-align: center;
              margin-top: 30px;
            }
            .cta a {
              display: inline-block;
              background-color: #d32f2f;
              color: #ffffff;
              padding: 12px 28px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: 600;
              transition: background-color 0.2s ease-in-out;
            }
            .cta a:hover {
              background-color: #b71c1c;
            }
            .footer {
              text-align: center;
              font-size: 13px;
              color: #6b7280;
              padding: 20px 30px;
              background-color: #f9fafb;
            }
            .footer a {
              color: #d32f2f;
              text-decoration: none;
            }
            @media (max-width: 600px) {
              .content {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <img
                src="https://coding-platform.s3.amazonaws.com/dev/lms/tickets/062040d1-ef70-4f34-ab38-4e3427741588/RFxjdxLROruCpJZH.png"
                alt="Masai Logo"
                style="max-height: 45px; height: 45px; width: auto; display: block; margin: 0 auto;"
              />
            </div>

            <!-- Main Content -->
            <div class="content">
              <h2>Welcome to <strong>Masai</strong> 🎉</h2>
              <p>Hi <strong>${userName}</strong>,</p>
              <p>
                Welcome to <strong>Guard Rail</strong> — your dedicated platform for learning and progress tracking at <strong>Masai</strong>.
                We're thrilled to have you on board! Below are your access details and assigned course information.
              </p>

              <div class="credentials">
                <p><strong>Login Email:</strong> ${userEmail}</p>
                <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
                ${courseNames && courseNames.length > 0 ? `
                  <p><strong>Assigned Course${courseNames.length > 1 ? 's' : ''}:</strong></p>
                  <ul style="margin: 4px 0; padding-left: 20px;">
                    ${courseNames.map(course => `
                      <li style="margin: 2px 0;">
                        ${course}
                      </li>
                    `).join('')}
                  </ul>
                ` : ''}
                ${admins && admins.length > 0 ? `
                  <p><strong>Assigned Admin${admins.length > 1 ? 's' : ''}:</strong></p>
                  <ul style="margin: 4px 0; padding-left: 20px;">
                    ${admins.map(admin => `
                      <li style="margin: 2px 0;">
                        ${admin.name}${admin.contact ? ` - ${admin.contact}` : ''}
                      </li>
                    `).join('')}
                  </ul>
                ` : ''}
              </div>

              <p>
                You can log in to your <strong>Guard Rail</strong> account using the credentials above.
                For your security, please update your password after your first login.
              </p>

              <div class="cta">
                <a href="${loginUrl}" target="_blank">Login</a>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <p>
                ${admins && admins.length > 0 && admins[0].contact ? `Need help? Contact your admin <strong>${admins[0].name}</strong> at <a href="tel:${admins[0].contact}">${admins[0].contact}</a> or email us at` : 'Need help? Email us at'}
                <a href="mailto:support@masaischool.com">support@masaischool.com</a>.
              </p>
              <p>© ${currentYear} Masai School. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Welcome to Masai - Guard Rail Platform!

Hi ${userName},

Welcome to Guard Rail — your dedicated platform for learning and progress tracking at Masai.
We're thrilled to have you on board! Below are your access details and assigned course information.

Login Credentials:
Email: ${userEmail}
Temporary Password: ${temporaryPassword}
${courseNames && courseNames.length > 0 ? `\nAssigned Course${courseNames.length > 1 ? 's' : ''}:\n${courseNames.map(course => `  - ${course}`).join('\n')}` : ''}
${admins && admins.length > 0 ? `\nAssigned Admin${admins.length > 1 ? 's' : ''}:\n${admins.map(admin => `  - ${admin.name}${admin.contact ? ` (${admin.contact})` : ''}`).join('\n')}` : ''}

You can log in to your Guard Rail account using the credentials above.
For your security, please update your password after your first login.

Login URL: ${loginUrl}

${admins && admins.length > 0 && admins[0].contact ? `Need help? Contact your admin ${admins[0].name} at ${admins[0].contact} or email us at support@masaischool.com` : 'Need help? Email us at support@masaischool.com'}

© ${currentYear} Masai School. All rights reserved.
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
}

// Generic send email function
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
}

// Send task assignment email to creator
export async function sendTaskAssignmentEmail(
  creatorEmail: string,
  creatorName: string,
  taskDetails: {
    topic: string;
    contentType: string;
    course: string;
    section: string;
    dueDate?: string;
    assignedByName: string;
  }
) {
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const currentYear = new Date().getFullYear();

  // Format content type
  const contentTypeFormatted = taskDetails.contentType.replace('_', ' ');

  // Format section
  const sectionFormatted = taskDetails.section.replace('_', '-');

  // Format due date
  const dueDateFormatted = taskDetails.dueDate
    ? new Date(taskDetails.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Not specified';

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: creatorEmail,
    subject: `New Task Assigned: ${taskDetails.topic}`,
    html: `
      <!DOCTYPE html>
      <html lang="en" style="margin: 0; padding: 0;">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>New Task Assignment</title>
          <style>
            body {
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #f9fafb;
              margin: 0;
              padding: 0;
              color: #333333;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: #ffffff;
              border-radius: 10px;
              box-shadow: 0 3px 12px rgba(0, 0, 0, 0.05);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);
              padding: 25px 30px;
              text-align: center;
            }
            .header h1 {
              color: #ffffff;
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 30px;
              line-height: 1.6;
            }
            .content h2 {
              color: #111827;
              margin-top: 0;
              font-size: 20px;
            }
            .content p {
              color: #4b5563;
              margin: 12px 0;
            }
            .task-details {
              background-color: #f3f4f6;
              border-left: 4px solid #9333ea;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .task-details .detail-row {
              margin: 10px 0;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
              font-size: 14px;
            }
            .task-details .detail-row:last-child {
              border-bottom: none;
            }
            .task-details .label {
              color: #6b7280;
              font-weight: 500;
              font-size: 14px;
              margin-right: 8px;
            }
            .task-details .value {
              color: #111827;
              font-weight: 600;
              font-size: 14px;
            }
            .footer {
              text-align: center;
              font-size: 13px;
              color: #6b7280;
              padding: 20px 30px;
              background-color: #f9fafb;
            }
            .footer a {
              color: #9333ea;
              text-decoration: none;
            }
            @media (max-width: 600px) {
              .content {
                padding: 20px;
              }
              .task-details .detail-row {
                flex-direction: column;
              }
              .task-details .value {
                text-align: left;
                margin-top: 4px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <h1>New Task Assigned</h1>
            </div>

            <!-- Main Content -->
            <div class="content">
              <h2>Hello ${creatorName}!</h2>
              <p>
                You have been assigned a new task by <strong>${taskDetails.assignedByName}</strong>.
                Please review the details below and start working on it at your earliest convenience.
              </p>

              <div class="task-details">
                <div class="detail-row">
                  <span class="label">Topic :</span>
                  <span class="value">${taskDetails.topic}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Content Type :</span>
                  <span class="value">${contentTypeFormatted}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Course :</span>
                  <span class="value">${taskDetails.course}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Section :</span>
                  <span class="value">${sectionFormatted}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Due Date :</span>
                  <span class="value">${dueDateFormatted}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Assigned By :</span>
                  <span class="value">${taskDetails.assignedByName}</span>
                </div>
              </div>

              <p>
                Log in to the Guard Rail platform to view the complete task details, guidelines,
                and start working on your content.
              </p>
            </div>

            <!-- Footer -->
            <div class="footer">
              <p>
                Need help? Email us at
                <a href="mailto:support@masaischool.com">support@masaischool.com</a>.
              </p>
              <p>© ${currentYear} Masai School. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
New Task Assigned!

Hello ${creatorName},

You have been assigned a new task by ${taskDetails.assignedByName}.
Please review the details below and start working on it at your earliest convenience.

Task Details:
- Topic: ${taskDetails.topic}
- Content Type: ${contentTypeFormatted}
- Course: ${taskDetails.course}
- Section: ${sectionFormatted}
- Due Date: ${dueDateFormatted}
- Assigned By: ${taskDetails.assignedByName}

Log in to the Guard Rail platform to view the complete task details, guidelines,
and start working on your content.

Login URL: ${loginUrl}

Need help? Email us at support@masaischool.com

© ${currentYear} Masai School. All rights reserved.
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Task assignment email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending task assignment email:', error);
    throw error;
  }
}

// Send content submission notification to admin
export async function sendContentSubmissionEmail(
  adminEmail: string,
  adminName: string,
  submissionDetails: {
    creatorName: string;
    contentTitle: string;
    contentType: string;
    category?: string;
    wordCount: number;
    submittedAt: string;
  }
) {
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const currentYear = new Date().getFullYear();

  // Format content type
  const contentTypeFormatted = submissionDetails.contentType.replace('_', ' ');

  // Format submission date
  const submittedAtFormatted = new Date(submissionDetails.submittedAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: adminEmail,
    subject: `New Content Submitted for Review: ${submissionDetails.contentTitle}`,
    html: `
      <!DOCTYPE html>
      <html lang="en" style="margin: 0; padding: 0;">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>New Content Submission</title>
          <style>
            body {
              font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #f9fafb;
              margin: 0;
              padding: 0;
              color: #333333;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: #ffffff;
              border-radius: 10px;
              box-shadow: 0 3px 12px rgba(0, 0, 0, 0.05);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
              padding: 25px 30px;
              text-align: center;
            }
            .header h1 {
              color: #ffffff;
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 30px;
              line-height: 1.6;
            }
            .content h2 {
              color: #111827;
              margin-top: 0;
              font-size: 20px;
            }
            .content p {
              color: #4b5563;
              margin: 12px 0;
            }
            .submission-details {
              background-color: #eff6ff;
              border-left: 4px solid #2563eb;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .submission-details .detail-row {
              margin: 10px 0;
              padding: 8px 0;
              border-bottom: 1px solid #dbeafe;
              font-size: 14px;
            }
            .submission-details .detail-row:last-child {
              border-bottom: none;
            }
            .submission-details .label {
              color: #6b7280;
              font-weight: 500;
              font-size: 14px;
              margin-right: 8px;
            }
            .submission-details .value {
              color: #111827;
              font-weight: 600;
              font-size: 14px;
            }
            .cta {
              text-align: center;
              margin-top: 30px;
            }
            .cta a {
              display: inline-block;
              background-color: #2563eb;
              color: #ffffff;
              padding: 12px 28px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: 600;
              transition: background-color 0.2s ease-in-out;
            }
            .cta a:hover {
              background-color: #1d4ed8;
            }
            .footer {
              text-align: center;
              font-size: 13px;
              color: #6b7280;
              padding: 20px 30px;
              background-color: #f9fafb;
            }
            .footer a {
              color: #2563eb;
              text-decoration: none;
            }
            @media (max-width: 600px) {
              .content {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <h1>🔔 New Content Submitted</h1>
            </div>

            <!-- Main Content -->
            <div class="content">
              <h2>Hello ${adminName}!</h2>
              <p>
                <strong>${submissionDetails.creatorName}</strong> has submitted new content for your review.
                Please review it at your earliest convenience.
              </p>

              <div class="submission-details">
                <div class="detail-row">
                  <span class="label">Content Title :</span>
                  <span class="value">${submissionDetails.contentTitle}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Content Type :</span>
                  <span class="value">${contentTypeFormatted}</span>
                </div>
                ${submissionDetails.category ? `
                <div class="detail-row">
                  <span class="label">Category :</span>
                  <span class="value">${submissionDetails.category}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="label">Word Count :</span>
                  <span class="value">${submissionDetails.wordCount} words</span>
                </div>
                <div class="detail-row">
                  <span class="label">Submitted By :</span>
                  <span class="value">${submissionDetails.creatorName}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Submitted At :</span>
                  <span class="value">${submittedAtFormatted}</span>
                </div>
              </div>

              <p>
                Log in to the Guard Rail platform to review the content and provide feedback.
              </p>

              <div class="cta">
                <a href="${loginUrl}" target="_blank">Review Content</a>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <p>
                Need help? Email us at
                <a href="mailto:support@masaischool.com">support@masaischool.com</a>.
              </p>
              <p>© ${currentYear} Masai School. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
New Content Submitted for Review!

Hello ${adminName},

${submissionDetails.creatorName} has submitted new content for your review.
Please review it at your earliest convenience.

Content Details:
- Title: ${submissionDetails.contentTitle}
- Content Type: ${contentTypeFormatted}
${submissionDetails.category ? `- Category: ${submissionDetails.category}` : ''}
- Word Count: ${submissionDetails.wordCount} words
- Submitted By: ${submissionDetails.creatorName}
- Submitted At: ${submittedAtFormatted}

Log in to the Guard Rail platform to review the content and provide feedback.

Login URL: ${loginUrl}

Need help? Email us at support@masaischool.com

© ${currentYear} Masai School. All rights reserved.
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Content submission email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending content submission email:', error);
    throw error;
  }
}

// Send password reset email (for future use)
export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  resetToken: string
) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: userEmail,
    subject: '🔐 Password Reset Request - GuardRail Platform',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9fafb;
              border-radius: 10px;
              padding: 30px;
              border: 1px solid #e5e7eb;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              margin-bottom: 30px;
            }
            .content {
              background: white;
              padding: 25px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 14px 30px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
              margin: 20px 0;
            }
            .warning {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset</h1>
            </div>

            <div class="content">
              <p>Hi <strong>${userName}</strong>,</p>

              <p>We received a request to reset your password for your GuardRail Platform account.</p>

              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>

              <div class="warning">
                <strong>⚠️ Note:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
              </div>

              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    throw error;
  }
}
