import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/users.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefereshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;

    await user.save({ validateBeforSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "something went wrong");
  }
};

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

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0];
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  // Upload avatar and cover image to Cloudinary
  const avatarUrl = await uploadOnCloudinary(avatarLocalPath);
  let coverImageUrl = "";
  if (coverImageLocalPath)
    coverImageUrl = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatarUrl) {
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

export const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username && !email) {
    throw new Error(401, "Username or email not provided");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "invalid credentials");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefereshToken(
    user._id
  );
  const loggedINUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedINUser, accessToken, refreshToken },
        "user logged in successfully"
      )
    );
});

export const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken;

  if (incomingRefreshToken) {
    throw new ApiError(401, "Please login first");
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  
    const user = await User.findById(decodedToken?._id)
  
    if(!user) {
      throw new ApiError(401, "Invalid refresh token")
    }
  
    if(incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Invalid refresh token")
    }
    
    const options={
      httpOnly: true,
      secure: true
    }
    const { accessToken ,newRefreshToken} = await generateAccessAndRefereshToken(user._id)
  
    return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options).json(new ApiResponse(200, { accessToken, refreshToken:newRefreshToken }, "Access token refreshed successfully"));
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }
});
