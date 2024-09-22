import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/users.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, userName, password } = req.body;

  console.log(fullName, email, userName, password);

  // Check if any required fields are missing
  if (
    [fullName, email, userName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required, including userName");
  }

  // Check if user already exists with email or username
  const existed = await User.findOne({
    $or: [{ email }, { userName: userName.toLowerCase() }], // Ensure usernames are case-insensitive
  });

  if (existed) {
    throw new ApiError(409, "User with this email or username already exists");
  }

  // Retrieve file paths for avatar and cover image
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
  let coverImageLocalPath;
  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
    coverImageLocalPath = req.files.coverImage[0];
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }
 

  // Upload avatar and cover image to Cloudinary
  const avatarUrl = await uploadOnCloudinary(avatarLocalPath);
  let coverImageUrl="";
  if(coverImageLocalPath)
   coverImageUrl = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatarUrl ) {
    throw new ApiError(400, "Failed to upload avatar or cover image");
  }

  // Create a new user
  const user = await User.create({
    fullName,
    email,
    password,
    avatar: avatarUrl.url,
    coverImage: coverImageUrl.url || "",
    userName: userName.toLowerCase(), // Store usernames in lowercase for consistency
  });

  // Retrieve the created user without sensitive fields like password
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Internal server error");
  }


  // Return the response with the created user data
  return res.json(
    new ApiResponse(200, "User created successfully", createdUser)
  );
});
