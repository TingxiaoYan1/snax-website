// backend/controllers/authControllers.js

import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import User from "../models/user.js";
import ErrorHandler from "../utils/errorHandler.js";
import sendToken from "../utils/sendToken.js";
import {
  getResetPasswordTemplate,
  getVerifyCodeTemplate,
} from "../utils/emailTemplates.js";
import sendEmail from "../utils/sendEmail.js";
import crypto from "crypto";
import { delete_file, upload_file } from "../utils/cloudinary.js";

/* =========================================================
 * Auth / Account
 * =======================================================*/

// Register user  =>  POST /api/v1/register
// Creates account, emails a 6-char verification code (no auto-login)
export const registerUser = catchAsyncErrors(async (req, res, next) => {
  const { name, email, password } = req.body;

  let existing = await User.findOne({ email });
  if (existing) {
    return next(new ErrorHandler("User already exists with this email", 400));
  }

  const user = await User.create({
    name,
    email,
    password,
    emailVerified: false,
  });

  // setEmailVerifyCode() should set the hash/expiry and any cooldown fields you maintain
  const code = user.setEmailVerifyCode();
  await user.save();

  const html = getVerifyCodeTemplate(user?.name, code);

  try {
    await sendEmail({
      email: user.email,
      subject: "Your Snack Planet verification code",
      message: html,
    });

    return res.status(201).json({
      success: true,
      message: `Account created. We sent a verification code to ${user.email}.`,
    });
  } catch (err) {
    // rollback code fields on failure to send
    user.emailVerifyCodeHash = undefined;
    user.emailVerifyCodeExpire = undefined;
    await user.save();

    return next(new ErrorHandler(err?.message || "Email could not be sent", 500));
  }
});

// Resend verification code  =>  POST /api/v1/email/code/send   { email }
// NOTE: no max attempts; rely on your cooldown inside setEmailVerifyCode()
export const sendVerificationCode = catchAsyncErrors(async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new ErrorHandler("Email is required", 400));

  const user = await User.findOne({ email }).select(
    "+emailVerifyCodeHash +emailVerifyCodeExpire"
  );
  if (!user) return next(new ErrorHandler("User not found", 404));
  if (user.emailVerified) return next(new ErrorHandler("Email is already verified", 400));

  const code = user.setEmailVerifyCode();
  await user.save();

  const html = getVerifyCodeTemplate(user?.name, code);

  try {
    await sendEmail({
      email: user.email,
      subject: "Your Snack Planet verification code",
      message: html,
    });
    return res
      .status(200)
      .json({ success: true, message: `Verification code sent to ${user.email}.` });
  } catch (err) {
    user.emailVerifyCodeHash = undefined;
    user.emailVerifyCodeExpire = undefined;
    await user.save();
    return next(new ErrorHandler(err?.message || "Email could not be sent", 500));
  }
});

// Verify 6-char code  =>  POST /api/v1/email/code/verify   { email, code }
// No max-attempts check; if the code is wrong, just return 400.
export const verifyEmailCode = catchAsyncErrors(async (req, res, next) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return next(new ErrorHandler("Email and code are required", 400));
  }

  const user = await User.findOne({ email }).select(
    "+emailVerifyCodeHash +emailVerifyCodeExpire +password"
  );
  if (!user) return next(new ErrorHandler("User not found", 404));

  if (user.emailVerified) {
    // Already verified — just log them in
    return sendToken(user, 200, res);
  }

  if (!user.emailVerifyCodeExpire || user.emailVerifyCodeExpire.getTime() < Date.now()) {
    return next(
      new ErrorHandler("Verification code has expired. Please request a new one.", 400)
    );
  }

  // Normalize input to UPPERCASE then hash & compare
  const incoming = String(code).toUpperCase();
  const hashed = crypto.createHash("sha256").update(incoming).digest("hex");

  if (hashed !== user.emailVerifyCodeHash) {
    return next(new ErrorHandler("Invalid verification code.", 400));
  }

  // Success — mark verified and clear code fields
  user.emailVerified = true;
  user.emailVerifyCodeHash = undefined;
  user.emailVerifyCodeExpire = undefined;
  await user.save();

  // Auto-login right away (sets cookie + returns user)
  return sendToken(user, 200, res);
});

// Login  =>  POST /api/v1/login
// If not verified, return a structured 403 so the frontend can redirect to /verify-email
export const loginUser = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler("Please enter email & password", 400));
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) return next(new ErrorHandler("Invalid email or password", 401));

  const isPasswordMatched = await user.comparePassword(password);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  if (!user.emailVerified) {
    // << Key change: return a JSON the client can detect and redirect on
    return res.status(403).json({
      success: false,
      error: "EMAIL_UNVERIFIED",
      message: "Please verify your email before logging in.",
      email: user.email,
    });
  }

  sendToken(user, 200, res);
});

// Logout user  =>  GET /api/v1/logout
export const logout = catchAsyncErrors(async (_req, res) => {
  res.cookie("token", null, { expires: new Date(Date.now()), httpOnly: true });
  res.status(200).json({ message: "Logged Out" });
});

// Forgot password  =>  POST /api/v1/password/forgot
export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return next(new ErrorHandler("User not found with this email", 404));

  const resetToken = user.getResetPasswordToken();
  await user.save();

  const resetUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;
  const html = getResetPasswordTemplate(user?.name, resetUrl);

  try {
    await sendEmail({
      email: user.email,
      subject: "Snack Planet Password Recovery",
      message: html,
    });

    res.status(200).json({ success: true, message: `Email sent to: ${user.email}` });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    return next(new ErrorHandler(error?.message || "Email could not be sent", 500));
  }
});

// Reset password  =>  PUT /api/v1/password/reset/:token
export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new ErrorHandler("Password reset token is invalid or has expired", 400)
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHandler("Password does not match", 400));
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendToken(user, 200, res);
});

/* =========================================================
 * Profile
 * =======================================================*/

export const getUserProfile = catchAsyncErrors(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.status(200).json({ user });
});

export const updatePassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("+password");

  const isMatched = await user.comparePassword(req.body.oldPassword);
  if (!isMatched) return next(new ErrorHandler("Old password is incorrect", 400));

  user.password = req.body.password;
  await user.save();

  sendToken(user, 200, res);
});

export const updateProfile = catchAsyncErrors(async (req, res) => {
  const newUserData = { name: req.body.name, email: req.body.email };

  const user = await User.findByIdAndUpdate(req.user._id, newUserData, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, user });
});

export const uploadAvatar = catchAsyncErrors(async (req, res, next) => {
  const avatarResponse = await upload_file(req.body.avatar, "Snack Planet/avatars");

  if (req?.user?.avatar?.url) {
    await delete_file(req?.user?.avatar?.public_id);
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: avatarResponse },
    { new: true, runValidators: true }
  );

  res.status(200).json({ success: true, user });
});

/* =========================================================
 * Admin
 * =======================================================*/

export const allUsers = catchAsyncErrors(async (_req, res) => {
  const users = await User.find();
  res.status(200).json({ success: true, users });
});

export const getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new ErrorHandler(`User not found with id: ${req.params.id}`, 404));
  res.status(200).json({ success: true, user });
});

export const updateUser = catchAsyncErrors(async (req, res, next) => {
  const newUserData = { name: req.body.name, email: req.body.email, role: req.body.role };
  const user = await User.findByIdAndUpdate(req.params.id, newUserData, {
    new: true,
    runValidators: true,
  });
  if (!user) return next(new ErrorHandler(`User not found with id: ${req.params.id}`, 404));
  res.status(200).json({ success: true });
});

export const deleteUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new ErrorHandler(`User not found with id: ${req.params.id}`, 404));
  if (user?.avatar?.public_id) await delete_file(user?.avatar?.public_id);
  await user.deleteOne();
  res.status(200).json({ success: true });
});
