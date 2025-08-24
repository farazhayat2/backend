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
    user: 'farazhayat448@@gmail.com',
    pass: 'ugxp mjus wsry xzjy',
  },
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(user) {

  return jwt.sign(
    { email: user.email, firstName: user.firstName },
    'secret',
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
    const passwordValidation = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;
    const phoneVerification = /^(?:\+92|0)3[0-9]{9}$/;

    if (
      !(lowerEmail.match(emailFormat) &&
        password.match(passwordValidation) &&
        phone.match(phoneVerification))
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

    // Send OTP email
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
      return res.send({ message: 'Error sending OTP email', error: mailErr?.message || mailErr });
    }
  } catch (err) {
    return res.send({ message: 'Something Went Wrong', error: err?.message || err });
  }
});

/* =========================
   Verify OTP
   ========================= */
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const lowerEmail = email?.toLowerCase();

    const user = await Users.findOne({ email: lowerEmail });
    if (!user) return res.send('User not found');

    if (user.isVerified) return res.send('User already verified. Please login.');

    // Handle missing expiry or expired
    if (!user.otpExpiresAt || Date.now() > user.otpExpiresAt) {
      const newOtp = generateOtp();
      const newExpiry = Date.now() + 5 * 60 * 1000;

      await Users.updateOne(
        { email: lowerEmail },
        { $set: { otp: newOtp, otpExpiresAt: newExpiry } }
      );

      try {
        await transporter.sendMail({
          from: 'farazhayat448@gmail.com',
          to: lowerEmail,
          subject: 'OTP Expired – New OTP',
          text: `Your new OTP is ${newOtp}. It will expire in 5 minutes.`,
        });
        return res.send({
          message: 'OTP expired. A new OTP has been emailed. Please verify again.',
        });
      } catch (mailErr) {
        return res.send({ message: 'Error sending new OTP email', error: mailErr?.message || mailErr });
      }
    }

    if (user.otp === otp) {
      await Users.updateOne(
        { email: lowerEmail },
        { $set: { isVerified: true }, $unset: { otp: '', otpExpiresAt: '' } }
      );

      const token = signToken(user);
      return res.send({
        status: 1,
        message: 'OTP verified. Login successful!',
        token,
        data: { ...user, password: undefined }, // avoid sending hash
      });
    } else {
      return res.send('Invalid OTP');
    }
  } catch (err) {
    return res.send({ message: 'Something Went Wrong', error: err?.message || err });
  }
});

/* =========================
   Login (sends OTP if not verified)
   ========================= */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const lowerEmail = email?.toLowerCase();

    if (!lowerEmail || !password) {
      return res.send({ status: 0, message: 'Email or Password is required' });
    }

    const user = await Users.findOne({ email: lowerEmail });
    if (!user) {
      return res.send({ status: 0, message: 'Email not registered!' });
    }

    const matchPassword = await bcrypt.compare(password, user.password);
    if (!matchPassword) {
      return res.send({ status: 0, message: 'Invalid Email or Password' });
    }

    const Token = await jwt.sign({
      email,
      firstName : user.firstName,
    },process.env.SECRET_KEY, { expiresIn: '1h' })

    res.cookie("token", token,{
      httpOnly: true,
      secure : true
    })

    if (!user.isVerified) {
      const newOtp = generateOtp();
      const newExpiry = Date.now() + 5 * 60 * 1000;

      await Users.updateOne(
        { email: lowerEmail },
        { $set: { otp: newOtp, otpExpiresAt: newExpiry } }
      );

      try {
        await transporter.sendMail({
          from: 'farazhayat448@gmail.com',
          to: lowerEmail,
          subject: 'Login OTP Verification',
          text: `Your OTP for login is ${newOtp}. It will expire in 5 minutes.`,
        });
        return res.send({
          status: 0,
          message: 'Please verify OTP sent to your email before login.',
        });
      } catch (mailErr) {
        return res.send({ status: 0, message: 'Error sending OTP email', error: mailErr?.message || mailErr });
      }
    }

    

    // Verified → issue token
    const token = signToken(user);
    return res.send({ status: 1, message: 'Login Successful', token, data: { ...user, password: undefined } });
  } catch (error) {
    return res.send({ status: 0, message: 'Something Went Wrong', error: error?.message || error });
  }
});

export default router;
