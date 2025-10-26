import express from 'express';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { client } from '../dbConfig.js';

const router = express.Router();
const myDB = client.db('Batch-5');
const Users = myDB.collection('Users');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'farazhayat448@gmail.com', 
    pass: 'ugxp mjus wsry xzjy',
  },
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(user) {
  return jwt.sign(
    { email: user.email, firstName: user.firstName },
    process.env.SECRET_KEY || 'secret',
    { expiresIn: '1h' }
  );
}

/* =========================
   Register
   ========================= */
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, phone, email, password } = req.body;

    if (!firstName || !lastName || !phone || !email || !password) {
      return res.send('Please fill out complete form');
    }

    const lowerEmail = email.toLowerCase();
    const emailFormat = /^[a-zA-Z0-9_.+]+(?<!^[0-9]*)@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    const passwordValidation =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;
    const phoneVerification = /^(?:\+92|0)3[0-9]{9}$/;

    if (
      !(
        lowerEmail.match(emailFormat) &&
        password.match(passwordValidation) &&
        phone.match(phoneVerification)
      )
    ) {
      return res.send('Invalid email, password or phone number');
    }

    const existing = await Users.findOne({ email: lowerEmail });
    if (existing) {
      return res.send('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpiresAt = Date.now() + 5 * 60 * 1000;

    await Users.insertOne({
      firstName,
      lastName,
      email: lowerEmail,
      password: hashedPassword,
      phone,
      otp,
      otpExpiresAt,
      isVerified: false,
    });

    try {
      await transporter.sendMail({
        from: 'farazhayat448@gmail.com',
        to: lowerEmail,
        subject: 'Registration OTP Verification',
        text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
      });
      return res.send({
        message: 'OTP sent to your email. Please verify within 5 minutes.',
      });
    } catch (mailErr) {
      return res.send({
        message: 'Error sending OTP email',
        error: mailErr?.message || mailErr,
      });
    }
  } catch (err) {
    return res.send({
      message: 'Something Went Wrong',
      error: err?.message || err,
    });
  }
});

/* =========================
   Verify OTP
   ========================= */
// router.post('/verify-otp', async (req, res) => {
//   try {
//     const { email, otp } = req.body;
//     const lowerEmail = email?.toLowerCase();

//     const user = await Users.findOne({ email: lowerEmail });
//     if (!user) return res.send('User not found');

//     if (user.isVerified) return res.send('User already verified. Please login.');

//     if (!user.otpExpiresAt || Date.now() > user.otpExpiresAt) {
//       const newOtp = generateOtp();
//       const newExpiry = Date.now() + 5 * 60 * 1000;

//       await Users.updateOne(
//         { email: lowerEmail },
//         { $set: { otp: newOtp, otpExpiresAt: newExpiry } }
//       );

//       try {
//         await transporter.sendMail({
//           from: 'farazhayat448@gmail.com',
//           to: lowerEmail,
//           subject: 'OTP Expired – New OTP',
//           text: `Your new OTP is ${newOtp}. It will expire in 5 minutes.`,
//         });
//         return res.send({
//           message: 'OTP expired. A new OTP has been emailed. Please verify again.',
//         });
//       } catch (mailErr) {
//         return res.send({
//           message: 'Error sending new OTP email',
//           error: mailErr?.message || mailErr,
//         });
//       }
//     }

//     if (user.otp === otp) {
//       await Users.updateOne(
//         { email: lowerEmail },
//         { $set: { isVerified: true }, $unset: { otp: '', otpExpiresAt: '' } }
//       );

//       const token = signToken(user);
//       return res.send({
//         status: 1,
//         message: 'OTP verified. Login successful!',
//         token,
//         data: { ...user, password: undefined },
//       });
//     } else {
//       return res.send('Invalid OTP');
//     }
//   } catch (err) {
//     return res.send({
//       message: 'Something Went Wrong',
//       error: err?.message || err,
//     });
//   }
// });

/* =========================
   Login
   ========================= */
   router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
  
      if (!email || !password)
        return res.status(400).json({ status: 0, message: "Email and password are required" });
  
      const lowerEmail = email.toLowerCase();
      const user = await Users.findOne({ email: lowerEmail });
  
      if (!user)
        return res.status(404).json({ status: 0, message: "Email not registered!" });
  
      const match = await bcrypt.compare(password, user.password);
      if (!match)
        return res.status(401).json({ status: 0, message: "Invalid email or password" });
  
      // If OTP verification is required
      if (!user.isVerified) {
        return res.status(403).json({ status: 0, message: "Please verify your email first" });
      }
  
      const token = signToken(user);
  
      return res.status(200).json({
        status: 1,
        message: "Login Successful",
        token,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (err) {
      console.error("Login Error:", err);
      return res.status(500).json({
        status: 0,
        message: "Something went wrong",
        error: err.message,
      });
    }
  });
  
  

router.post('/forgot-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const lowerEmail = email?.toLowerCase();

    const user = await Users.findOne({ email: lowerEmail });
    if (!user) return res.send({ status: 0, message: 'User not found' });

   
    if (!otp && !newPassword) {
      const generatedOtp = generateOtp();
      const expiry = Date.now() + 5 * 60 * 1000;

      await Users.updateOne(
        { email: lowerEmail },
        { $set: { resetOtp: generatedOtp, resetOtpExpiry: expiry } }
      );

      await transporter.sendMail({
        from: 'farazhayat448@gmail.com',
        to: lowerEmail,
        subject: 'Password Reset OTP',
        text: `Your OTP is ${generatedOtp}. It will expire in 5 minutes.`,
      });

      return res.send({ status: 1, message: 'OTP sent to your email' });
    }

    if (otp && newPassword) {
      if (
        user.resetOtp === otp &&
        user.resetOtpExpiry &&
        Date.now() < user.resetOtpExpiry
      ) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await Users.updateOne(
          { email: lowerEmail },
          { $set: { password: hashedPassword }, $unset: { resetOtp: '', resetOtpExpiry: '' } }
        );

        return res.send({ status: 1, message: 'Password reset successfully' });
      } else {
        return res.send({ status: 0, message: 'Invalid or expired OTP' });
      }
    }

    return res.send({ status: 0, message: 'Invalid request' });
  } catch (error) {
    return res.send({
      status: 0,
      message: 'Something Went Wrong',
      error: error?.message || error,
    });
  }
});

/* =========================
   LogOut
   ========================= */

router.post('/logout', (req, res) => {
  try {
    res.status(200).send({
      status: 1,
      message: 'Logout successful'
    });
  } catch (error) {
    res.status(500).send({
      status: 0,
      message: 'Error while logging out',
      error: error.message
    });
  }
});


export default router;
