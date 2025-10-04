import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter your name"],
        maxLength: [50, "Your name cannot exceed 50 characters"],
    },

    email: {
        type: String,
        required: [true, "Please enter your email"],
        unique: true,
    },

    password: {
        type: String,
        required: [true, "Please enter your password"],
        minLength: [6, "Your password must be longer than 6 characters"],
        select: false,
    },

    avatar: {
        public_id: String,
        url: String,
    },

    role: {
        type: String,
        default: "user",
    },

    searchHistory: {
        type: [
            {
                term: { type: String, required: true, trim: true },
                at: { type: Date, default: Date.now }
            }
            
        ],
        default: []
    },

    emailVerified: { type: Boolean, default: false },
    emailVerifyCodeHash: { type: String, select: false },
    emailVerifyCodeExpire: { type: Date, select: false },
    emailVerifyAttempts: { type: Number, default: 0, select: false },

    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {timestamps: true}
);

// Encrypting password before saving the user
userSchema.pre("save", async function (next){
    if(!this.isModified("password")) {
        next();
    }

    this.password = await bcrypt.hash(this.password, 10);
});

// Return JWT Token
userSchema.methods.getJwtToken = function() {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn : process.env.JWT_EXPIRES_TIME,
    });
};

// Compare user password
userSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Generate password reset token
userSchema.methods.getResetPasswordToken = function () {

    //Generate token
    const resetToken = crypto.randomBytes(20).toString("hex");

    //Hash and set to resetPasswordToken field
    this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    //set token expire time
    this.resetPasswordExpire = Date.now() +30*60*1000;

    return resetToken;
};

userSchema.methods.addSearchKeyword = function (rawTerm, limit = 40) {
  const term = String(rawTerm || '').trim();
  if (!term) return this;

  // remove existing occurrences (de-dupe)
  this.searchHistory = this.searchHistory.filter((k) => k.term.toLowerCase() !== term.toLowerCase());

  // put new term at the "front" (most recent)
  this.searchHistory.unshift({ term, at: new Date() });

  // enforce max length like a queue
  if (this.searchHistory.length > limit) {
    this.searchHistory = this.searchHistory.slice(0, limit);
  }
  return this;
};

userSchema.index({ _id: 1, "searchHistory.term": 1 });

userSchema.virtual("coupons", {
  ref: "Coupon",
  localField: "_id",
  foreignField: "assignedTo",
  justOne: false,
});

userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

function makeCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

if (!userSchema.methods.setEmailVerifyCode) {
  userSchema.methods.setEmailVerifyCode = function () {
    const code = makeCode(6);
    this.emailVerifyCodeHash = crypto.createHash("sha256").update(code).digest("hex");
    const minutes = Number(process.env.VERIFY_EMAIL_EXPIRE_MIN || 30);
    this.emailVerifyCodeExpire = Date.now() + minutes * 60 * 1000;
    this.emailVerifyAttempts = 0;
    return code;
  };
}


export default mongoose.model("User", userSchema);