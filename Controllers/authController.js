const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const User = require("../Models/UserModel");
const Tutor = require("../Models/TutorModel");
const Admin = require("../Models/AdminModel");
require("dotenv").config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
//Generate Unique ID
const generateUniqueUserID = async (prefix = "edusphereUser") => {
  const randomNumber = Math.floor(100000 + Math.random() * 900000);
  const userId = `${prefix}${randomNumber}`;
  const exists = await User.findOne({ user_id: userId });
  return exists ? generateUniqueUserID(prefix) : userId;
};


//User Google Auth
const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({ message: "Email not verified" });
    }

    let user = await User.findOne({ email });

    if (user) {
      if (!user.status) {
        return res.status(403).json({
          message: "Your account has been blocked. Please contact support.",
          code: "ACCOUNT_BLOCKED",
        });
      }

      if (!user.googleId) {
        const newGoogleId = await generateUniqueUserID();
        user.googleId = newGoogleId;
        user.profileImage = picture;
        user.is_verified = true;
      }

      user.lastActive = new Date();
      user.lastLogin = new Date();
      await user.save();
    } else {
      const newGoogleId = await generateUniqueUserID();
      user = new User({
        full_name: name,
        email,
        user_id: newGoogleId,
        googleId: newGoogleId,
        profileImage: picture,
        is_verified: true,
        lastActive: new Date(),
        lastLogin: new Date(),
        status: true,
      });

      await user.save();
    }

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        profileImage: user.profileImage,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Google authentication error:", error);
    res.status(500).json({ message: "Google authentication failed" });
  }
};


//Tutor Google Auth
const tutorGoogleAuth = async (req, res) => {
  try {
    const { token, subject } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({ message: "Email not verified" });
    }
    let tutor = await Tutor.findOne({ email });

    if (tutor) {
      if (!tutor.status) {
        return res.status(403).json({
          message: "Your account has been blocked. Please contact support.",
          code: "ACCOUNT_BLOCKED",
        });
      }
      if (!tutor.googleId) {
        tutor.googleId = googleId;
        tutor.profile_image = picture;
        tutor.is_verified = true;
        if (subject && !tutor.subject) {
          tutor.subject = subject;
        }
      }
      tutor.lastActive = new Date();
      tutor.lastLogin = new Date();
      await tutor.save();
    } else {
      tutor = new Tutor({
        full_name: name,
        email,
        googleId,
        profile_image: picture,
        is_verified: true,
        subject: subject || null,
        lastActive: new Date(),
        lastLogin: new Date(),
        status: true,
      });

      await tutor.save();
    }
    const authToken = jwt.sign(
      {
        id: tutor._id,
        role: "tutor",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(200).json({
      token: authToken,
      tutor: {
        id: tutor._id,
        full_name: tutor.full_name,
        email: tutor.email,
        profile_image: tutor.profile_image,
        subject: tutor.subject,
      },
    });
  } catch (error) {
    console.error("Tutor Google authentication error:", error);
    res.status(500).json({ message: "Google authentication failed" });
  }
};


//Admin Google Auth
const adminGoogleAuth = async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId, email_verified } = payload;
    if (!email_verified) {
      return res.status(400).json({ message: "Email not verified" });
    }
    let admin = await Admin.findOne({
      $or: [{ email }, { googleId }],
    });

    if (!admin) {
      admin = new Admin({
        email,
        fullName: name,
        googleId,
        profileImage: picture,
        isGoogleAuth: true,
      });
      await admin.save();
    } else {
      admin.googleId = googleId;
      admin.profileImage = picture;
      admin.isGoogleAuth = true;
      if (!admin.fullName) {
        admin.fullName = name;
      }

      await admin.save();
    }
    const authToken = jwt.sign(
      { id: admin._id, role: "admin", isGoogleAuth: true },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.cookie("adminToken", authToken, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    console.log("Sending admin data to frontend:", {
      email: admin.email,
      fullName: admin.fullName,
      profileImage: admin.profileImage,
    });
    return res.status(200).json({
      message: "Google authentication successful",
      token: authToken,
      admin: {
        email: admin.email,
        fullName: admin.fullName,
        profileImage: admin.profileImage,
      },
    });
  } catch (error) {
    console.error("Google authentication error:", error);
    return res.status(500).json({ message: "Google authentication failed" });
  }
};


//Refreshtoken Generator
const refreshAccessToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    let user;
    if (decoded.role === "user") {
      user = await User.findById(decoded.id);
    } else if (decoded.role === "tutor") {
      user = await Tutor.findById(decoded.id);
    } else if (decoded.role === "admin") {
      user = await Admin.findById(decoded.id);
    }

    if (!user) {
      return res.status(403).json({ message: `${decoded.role} not found` });
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ accessToken });
  } catch (error) {
    console.error("Error in refreshing access token:", error);
    res.status(500).json({ message: "Failed to refresh access token" });
  }
};

module.exports = {
  googleAuth,
  tutorGoogleAuth,
  adminGoogleAuth,
  refreshAccessToken,
};
