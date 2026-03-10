const nodemailer = require("nodemailer");

const sendEmail = async ({ email, subject, text, html }) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: `"DogMart" <${process.env.EMAIL_USER}>`,
            to: email,
            subject,
            text,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info.messageId);
        return true;
    } catch (error) {
        console.error("Email error:", error);
        return false;
    }
};

module.exports = sendEmail;
