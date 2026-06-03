import { sendMail } from "../services/mailer.js";

export async function sendContactMail(req, res) {
  try {
    const { firstName, lastName, email, company, subject, message } = req.body;

    if (!firstName || !lastName || !email || !subject || !message) {
      return res.status(400).json({ message: "All required fields must be filled." });
    }

    const html = `
      <h2>New Contact Message</h2>
      <p><strong>Name:</strong> ${firstName} ${lastName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Company:</strong> ${company || "N/A"}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `;

    await sendMail({
      to: process.env.ADMIN_EMAIL,
      subject: `Contact Form: ${subject}`,
      html
    });

    res.json({ message: "Message sent successfully." });

  } catch (err) {
    console.error("Contact email error:", err);
    res.status(500).json({ message: "Failed to send message." });
  }
}