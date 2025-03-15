import jwt from 'jsonwebtoken';

export default function adminAuth(req, res, next) {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    console.log("Received Token:", token);
    console.log("Expected Secret:", process.env.JWT_SECRET);

    const verified = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    console.log("Verified Payload:", verified);

    req.admin = verified;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error);
    res.status(400).json({ message: "Invalid token" });
  }
}
