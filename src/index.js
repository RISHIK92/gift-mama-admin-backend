import express from "express";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import adminAuth from "../auth/adminAuth.js";
import multer from "multer";
import { uploadFileToS3 } from "./s3config.js";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const JWT_SECRET = "123123";

const upload = multer({ storage: multer.memoryStorage() });

app.post("/admin/register", async (req, res) => {
  const { firstName, lastName, phone, email, password } = req.body;

  try {
    const adminExists = await prisma.admin.findUnique({
      where: { email },
    });

    if (adminExists) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await prisma.admin.create({
      data: { firstName, lastName, email, password: hashedPassword, phone },
    });

    res
      .status(201)
      .json({ message: "Admin registered successfully", admin: newAdmin });
  } catch (error) {
    console.error("Error registering admin:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin Sign-In
app.post("/admin/signin", async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET);
    res.status(200).json({ message: "Admin logged in successfully", token });
  } catch (error) {
    console.error("Error signing in admin:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/admin/dashboard", adminAuth, async (req, res) => {
  const email = req.admin.email;

  try {
    const admin = await prisma.admin.findUnique({
      where: { email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    const users = await prisma.user.count();
    const products = await prisma.product.count();

    if (!admin) {
      return res.status(400).json({ message: "Admin not found" });
    }

    res.status(200).json({
      message: "Welcome to the Admin Dashboard",
      admin,
      users,
      products,
    });
  } catch (error) {
    console.error("Error fetching admin dashboard:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/admin/get-users", adminAuth, async (req, res) => {
  try {
    const admin = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    if (!admin) {
      return res.status(400).json({ message: "Admin not found" });
    }

    res
      .status(200)
      .json({ message: "Welcome to the Admin Dashboard", admin: admin });
  } catch (error) {
    console.error("Error fetching admin dashboard:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/admin/add-users", adminAuth, async (req, res) => {});

app.delete("/admin/delete-user/:userId", adminAuth, async (req, res) => {
  const { userId } = req.params;

  try {
    const userExists = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.user.delete({
      where: { id: parseInt(userId) },
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/admin/get-products", adminAuth, async (req, res) => {
  try {
    const product = await prisma.product.findMany({
      include: { images: true },
    });

    if (!product) {
      return res.status(400).json({ message: "Admin not found" });
    }

    res
      .status(200)
      .json({ message: "Welcome to the Admin Dashboard", product });
  } catch (error) {
    console.error("Error fetching admin dashboard:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/admin/get-sections", adminAuth, async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.status(200).json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Add a new category
app.post("/admin/add-section", adminAuth, async (req, res) => {
  const { category } = req.body;

  try {
    // Check if category already exists
    const existingCategory = await prisma.category.findFirst({
      where: { category: { equals: category, mode: "insensitive" } },
    });

    if (existingCategory) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const newCategory = await prisma.category.create({
      data: {
        category,
        subCategory: [],
      },
    });

    res
      .status(201)
      .json({ message: "Category added successfully", category: newCategory });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.put("/admin/update-section/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  const { category } = req.body;

  try {
    const existingCategory = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) },
    });

    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    const nameExists = await prisma.category.findFirst({
      where: {
        category: { equals: category, mode: "insensitive" },
        id: { not: parseInt(categoryId) },
      },
    });

    if (nameExists) {
      return res.status(400).json({ message: "Category name already exists" });
    }

    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(categoryId) },
      data: { category },
    });

    res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete a category
app.delete("/admin/delete-section/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;

  try {
    // Check if the category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) },
    });

    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Delete the category
    await prisma.category.delete({
      where: { id: parseInt(categoryId) },
    });

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/admin/add-subsection", adminAuth, async (req, res) => {
  const { categoryId, subcategoryName } = req.body;

  try {
    const category = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) },
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (category.subCategory.includes(subcategoryName)) {
      return res
        .status(400)
        .json({ message: "Subcategory already exists in this category" });
    }

    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(categoryId) },
      data: {
        subCategory: {
          push: subcategoryName,
        },
      },
    });

    res.status(201).json({
      message: "Subcategory added successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error adding subcategory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update a subcategory
app.put("/admin/update-subsection", adminAuth, async (req, res) => {
  const { categoryId, oldSubcategoryName, newSubcategoryName } = req.body;

  try {
    // Check if the category exists
    const category = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) },
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (!category.subCategory.includes(oldSubcategoryName)) {
      return res.status(404).json({ message: "Subcategory not found" });
    }

    if (
      category.subCategory.includes(newSubcategoryName) &&
      oldSubcategoryName !== newSubcategoryName
    ) {
      return res
        .status(400)
        .json({ message: "Subcategory name already exists in this category" });
    }

    const updatedSubcategories = category.subCategory.map((sub) =>
      sub === oldSubcategoryName ? newSubcategoryName : sub
    );

    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(categoryId) },
      data: {
        subCategory: updatedSubcategories,
      },
    });

    res.status(200).json({
      message: "Subcategory updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating subcategory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.delete("/admin/delete-subsection", adminAuth, async (req, res) => {
  const { categoryId, subcategoryName } = req.body;

  try {
    const category = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) },
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    if (!category.subCategory.includes(subcategoryName)) {
      return res.status(404).json({ message: "Subcategory not found" });
    }

    const updatedSubcategories = category.subCategory.filter(
      (sub) => sub !== subcategoryName
    );

    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(categoryId) },
      data: {
        subCategory: updatedSubcategories,
      },
    });

    res.status(200).json({
      message: "Subcategory deleted successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get all categories (includes categories, occasions, and recipients)
app.get("/admin/get-categories", adminAuth, async (req, res) => {
  try {
    const categories = await prisma.allCategories.findMany();
    res.status(200).json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/admin/get-category", adminAuth, async (req, res) => {
  try {
    const categories = await prisma.categories.findMany();
    res.status(200).json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Add a new category
app.post("/admin/add-category", adminAuth, async (req, res) => {
  const { categories, subCategories = [] } = req.body;

  try {
    // Check if category already exists
    const existingCategory = await prisma.categories.findFirst({
      where: { categories: { equals: categories, mode: "insensitive" } },
    });

    if (existingCategory) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const newCategory = await prisma.categories.create({
      data: {
        categories,
        subCategories,
      },
    });

    res
      .status(201)
      .json({ message: "Category added successfully", category: newCategory });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update a category
app.put("/admin/update-category/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  const { categories, subCategories } = req.body;

  try {
    // Check if the category exists
    const existingCategory = await prisma.categories.findUnique({
      where: { id: parseInt(categoryId) },
    });

    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Check if the new name already exists (excluding the current category)
    if (categories) {
      const nameExists = await prisma.categories.findFirst({
        where: {
          categories: { equals: categories, mode: "insensitive" },
          id: { not: parseInt(categoryId) },
        },
      });

      if (nameExists) {
        return res
          .status(400)
          .json({ message: "Category name already exists" });
      }
    }

    // Prepare update data
    const updateData = {};
    if (categories) updateData.categories = categories;
    if (subCategories) updateData.subCategories = subCategories;

    const updatedCategory = await prisma.categories.update({
      where: { id: parseInt(categoryId) },
      data: updateData,
    });

    res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete a category
app.delete(
  "/admin/delete-category/:categoryId",
  adminAuth,
  async (req, res) => {
    const { categoryId } = req.params;

    try {
      // Check if the category exists
      const existingCategory = await prisma.categories.findUnique({
        where: { id: parseInt(categoryId) },
      });

      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Delete the category
      await prisma.categories.delete({
        where: { id: parseInt(categoryId) },
      });

      res.status(200).json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

// app.get("/admin/get-categories", adminAuth, async (req, res) => {
//   try {
//     const occasions = await prisma.allCategories.findMany();
//     res.status(200).json({ occasions });
//   } catch (error) {
//     console.error("Error fetching categories:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

app.get("/admin/get-occasion", adminAuth, async (req, res) => {
  try {
    const occasions = await prisma.occasions.findMany();
    res.status(200).json({ occasions });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/admin/add-occasion", adminAuth, async (req, res) => {
  const { occasions } = req.body;

  try {
    const existingOccasion = await prisma.occasions.findFirst({
      where: { occasions: { equals: occasions, mode: "insensitive" } },
    });

    if (existingOccasion) {
      return res.status(400).json({ message: "Occasion already exists" });
    }

    const newOccasion = await prisma.occasions.create({
      data: {
        occasions,
      },
    });

    res
      .status(201)
      .json({ message: "Category added successfully", category: newOccasion });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.put("/admin/update-occasion/:occasionId", adminAuth, async (req, res) => {
  const { occasionId } = req.params;
  const { occasions } = req.body;

  try {
    const existingOccasion = await prisma.occasions.findUnique({
      where: { id: parseInt(occasionId) },
    });

    if (!existingOccasion) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (occasions) {
      const nameExists = await prisma.occasions.findFirst({
        where: {
          occasions: { equals: occasions, mode: "insensitive" },
          id: { not: parseInt(occasionId) },
        },
      });

      if (nameExists) {
        return res
          .status(400)
          .json({ message: "Occasion name already exists" });
      }
    }

    const updateData = {};
    if (occasions) updateData.occasions = occasions;

    const updatedOccasion = await prisma.occasions.update({
      where: { id: parseInt(occasionId) },
      data: updateData,
    });

    res.status(200).json({
      message: "Category updated successfully",
      occasion: updatedOccasion,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.delete(
  "/admin/delete-occasion/:occasionId",
  adminAuth,
  async (req, res) => {
    const { occasionId } = req.params;

    try {
      const existingOccasion = await prisma.occasions.findUnique({
        where: { id: parseInt(occasionId) },
      });

      if (!existingOccasion) {
        return res.status(404).json({ message: "Category not found" });
      }

      await prisma.occasions.delete({
        where: { id: parseInt(occasionId) },
      });

      res.status(200).json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

app.get("/admin/get-recipient", adminAuth, async (req, res) => {
  try {
    const recipients = await prisma.recipients.findMany();
    res.status(200).json({ recipients });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/admin/add-recipient", adminAuth, async (req, res) => {
  const { recipients } = req.body;

  try {
    const existingRecipient = await prisma.recipients.findFirst({
      where: { recipients: { equals: recipients, mode: "insensitive" } },
    });

    if (existingRecipient) {
      return res.status(400).json({ message: "Recipient already exists" });
    }

    const newRecipient = await prisma.recipients.create({
      data: {
        recipients,
      },
    });

    res.status(201).json({
      message: "Recipient added successfully",
      recipient: newRecipient,
    });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.put("/admin/update-recipient/:recipientId", adminAuth, async (req, res) => {
  const { recipientId } = req.params;
  const { recipients } = req.body;

  try {
    const existingRecipient = await prisma.recipients.findUnique({
      where: { id: parseInt(recipientId) },
    });

    if (!existingRecipient) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (recipients) {
      const nameExists = await prisma.recipients.findFirst({
        where: {
          recipients: { equals: recipients, mode: "insensitive" },
          id: { not: parseInt(recipientId) },
        },
      });

      if (nameExists) {
        return res
          .status(400)
          .json({ message: "Recipients name already exists" });
      }
    }

    const updateData = {};
    if (recipients) updateData.recipients = recipients;

    const updatedRecipient = await prisma.recipients.update({
      where: { id: parseInt(recipientId) },
      data: updateData,
    });

    res.status(200).json({
      message: "Recipient updated successfully",
      recipient: updatedRecipient,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.delete(
  "/admin/delete-recipient/:recipientId",
  adminAuth,
  async (req, res) => {
    const { recipientId } = req.params;

    try {
      const existingRecipients = await prisma.recipients.findUnique({
        where: { id: parseInt(recipientId) },
      });

      if (!existingRecipients) {
        return res.status(404).json({ message: "Recipient not found" });
      }

      await prisma.recipients.delete({
        where: { id: parseInt(recipientId) },
      });

      res.status(200).json({ message: "Recipient deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

app.post("/admin/add-subcategory/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  const { subcategory } = req.body;

  if (!subcategory) {
    return res.status(400).json({ message: "Subcategory name is required" });
  }

  try {
    const category = await prisma.categories.findUnique({
      where: { id: parseInt(categoryId) },
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (category.subCategories.includes(subcategory)) {
      return res
        .status(400)
        .json({ message: "Subcategory already exists in this category" });
    }

    // Add the subcategory
    const updatedCategory = await prisma.categories.update({
      where: { id: parseInt(categoryId) },
      data: {
        subCategories: {
          push: subcategory,
        },
      },
    });

    res.status(201).json({
      message: "Subcategory added successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error adding subcategory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete a subcategory from a category
app.delete(
  "/admin/delete-subcategory/:categoryId",
  adminAuth,
  async (req, res) => {
    const { categoryId } = req.params;
    const { subcategory } = req.body;

    if (!subcategory) {
      return res.status(400).json({ message: "Subcategory name is required" });
    }

    try {
      // Check if the category exists
      const category = await prisma.categories.findUnique({
        where: { id: parseInt(categoryId) },
      });

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      if (!category.subCategories.includes(subcategory)) {
        return res
          .status(404)
          .json({ message: "Subcategory not found in this category" });
      }

      const updatedSubcategories = category.subCategories.filter(
        (sub) => sub !== subcategory
      );

      const updatedCategory = await prisma.categories.update({
        where: { id: parseInt(categoryId) },
        data: {
          subCategories: updatedSubcategories,
        },
      });

      res.status(200).json({
        message: "Subcategory deleted successfully",
        category: updatedCategory,
      });
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

// Add a new item to any of the arrays (categories, occasions, or recipients)
app.post("/admin/add-category", adminAuth, async (req, res) => {
  const { type, name } = req.body;

  if (!type || !name) {
    return res.status(400).json({ message: "Type and name are required" });
  }

  // Validate type value
  if (!["categories", "occasions", "recipients"].includes(type)) {
    return res.status(400).json({
      message:
        "Invalid type. Must be 'categories', 'occasions', or 'recipients'",
    });
  }

  try {
    // Get the current categories document
    const categoriesDoc = await prisma.allCategories.findFirst();

    if (!categoriesDoc) {
      // If no document exists, create a new one with the item in the appropriate array
      const newData = {
        categories: type === "categories" ? [name] : [],
        occasions: type === "occasions" ? [name] : [],
        recipients: type === "recipients" ? [name] : [],
      };

      const newCategoriesDoc = await prisma.allCategories.create({
        data: newData,
      });

      return res.status(201).json({
        message: `${type.slice(0, -1)} added successfully`,
        categories: newCategoriesDoc,
      });
    }

    // Check if the item already exists in the specified array
    if (categoriesDoc[type] && categoriesDoc[type].includes(name)) {
      return res
        .status(400)
        .json({ message: `${name} already exists in ${type}` });
    }

    // Add the new item to the specified array
    const updatedArray = [...(categoriesDoc[type] || []), name];

    // Update the document with the new array
    const updatedDoc = await prisma.allCategories.update({
      where: { id: categoriesDoc.id },
      data: { [type]: updatedArray },
    });

    res.status(201).json({
      message: `${type.slice(0, -1)} added successfully`,
      categories: updatedDoc,
    });
  } catch (error) {
    console.error(`Error adding ${type}:`, error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update an item in any of the arrays
app.put("/admin/update-category/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  const { type, category, oldName, newName } = req.body;

  if (!type || (!category && (!oldName || !newName))) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  // Validate type value
  if (!["categories", "occasions", "recipients"].includes(type)) {
    return res.status(400).json({
      message:
        "Invalid type. Must be 'categories', 'occasions', or 'recipients'",
    });
  }

  try {
    // Get the current categories document
    const categoriesDoc = await prisma.allCategories.findUnique({
      where: { id: parseInt(categoryId) },
    });

    if (!categoriesDoc) {
      return res.status(404).json({ message: "Categories document not found" });
    }

    // For backward compatibility, handle both old and new parameter styles
    const itemToUpdate = oldName || category;
    const updatedName = newName || category;

    // Check if the item exists in the specified array
    if (!categoriesDoc[type] || !categoriesDoc[type].includes(itemToUpdate)) {
      return res
        .status(404)
        .json({ message: `${itemToUpdate} not found in ${type}` });
    }

    // Check if the new name already exists (only if it's different from the old name)
    if (
      itemToUpdate !== updatedName &&
      categoriesDoc[type].includes(updatedName)
    ) {
      return res
        .status(400)
        .json({ message: `${updatedName} already exists in ${type}` });
    }

    // Update the item in the array
    const updatedArray = categoriesDoc[type].map((item) =>
      item === itemToUpdate ? updatedName : item
    );

    // Update the document with the modified array
    const updatedDoc = await prisma.allCategories.update({
      where: { id: parseInt(categoryId) },
      data: { [type]: updatedArray },
    });

    res.status(200).json({
      message: `${type.slice(0, -1)} updated successfully`,
      categories: updatedDoc,
    });
  } catch (error) {
    console.error(`Error updating ${type}:`, error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete an item from any of the arrays
app.delete(
  "/admin/delete-category/:categoryId",
  adminAuth,
  async (req, res) => {
    const { categoryId } = req.params;
    const { type, name } = req.body;

    if (!type || !name) {
      return res.status(400).json({ message: "Type and name are required" });
    }

    // Validate type value
    if (!["categories", "occasions", "recipients"].includes(type)) {
      return res.status(400).json({
        message:
          "Invalid type. Must be 'categories', 'occasions', or 'recipients'",
      });
    }

    try {
      // Get the current categories document
      const categoriesDoc = await prisma.allCategories.findUnique({
        where: { id: parseInt(categoryId) },
      });

      if (!categoriesDoc) {
        return res
          .status(404)
          .json({ message: "Categories document not found" });
      }

      // Check if the item exists in the specified array
      if (!categoriesDoc[type] || !categoriesDoc[type].includes(name)) {
        return res
          .status(404)
          .json({ message: `${name} not found in ${type}` });
      }

      // Remove the item from the array
      const updatedArray = categoriesDoc[type].filter((item) => item !== name);

      // Update the document with the modified array
      const updatedDoc = await prisma.allCategories.update({
        where: { id: parseInt(categoryId) },
        data: { [type]: updatedArray },
      });

      res.status(200).json({
        message: `${type.slice(0, -1)} deleted successfully`,
        categories: updatedDoc,
      });
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

// Alternative delete endpoint that supports ID-based deletion for compatibility with frontend
app.delete(
  "/admin/delete-category-by-id/:itemId",
  adminAuth,
  async (req, res) => {
    const { itemId } = req.params;
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({ message: "Type parameter is required" });
    }

    // Validate type value
    if (!["categories", "occasions", "recipients"].includes(type)) {
      return res.status(400).json({
        message:
          "Invalid type. Must be 'categories', 'occasions', or 'recipients'",
      });
    }

    try {
      // Parse the item ID to extract the index
      // Assuming format like "cat-0", "occ-1", "rec-2"
      const parts = itemId.split("-");
      if (parts.length !== 2) {
        return res.status(400).json({ message: "Invalid item ID format" });
      }

      const index = parseInt(parts[1]);
      if (isNaN(index)) {
        return res.status(400).json({ message: "Invalid item ID format" });
      }

      // Get the current categories document
      const categoriesDoc = await prisma.allCategories.findFirst();

      if (!categoriesDoc) {
        return res
          .status(404)
          .json({ message: "Categories document not found" });
      }

      // Check if the index is valid
      if (!categoriesDoc[type] || index >= categoriesDoc[type].length) {
        return res
          .status(404)
          .json({ message: `Item at index ${index} not found in ${type}` });
      }

      // Get the item name to be deleted
      const itemName = categoriesDoc[type][index];

      // Remove the item from the array
      const updatedArray = categoriesDoc[type].filter((_, i) => i !== index);

      // Update the document with the modified array
      const updatedDoc = await prisma.allCategories.update({
        where: { id: categoriesDoc.id },
        data: { [type]: updatedArray },
      });

      res.status(200).json({
        message: `${type.slice(0, -1)} '${itemName}' deleted successfully`,
        categories: updatedDoc,
      });
    } catch (error) {
      console.error(`Error deleting from ${type}:`, error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

app.use(adminAuth);

// Get Home Page Data - Updated for new schema
app.get("/admin/home", adminAuth, async (req, res) => {
  try {
    const homeData = await prisma.homeImages.findFirst({
      include: {
        customSections: true,
      },
    });

    if (!homeData) {
      return res.status(404).json({ message: "Homepage data not found" });
    }

    // Transform the data to match the frontend state structure
    const formattedHomeData = {
      heroBanner: {
        images: homeData.heroImages,
        titles: homeData.heroTitles,
        subtitles: homeData.heroSubtitles,
      },
      flashSale: {
        description: homeData.flashSaleDescription,
        enabled: homeData.flashSaleEnabled,
      },
      advert: {
        images: homeData.advertImages,
      },
      customSections: homeData.customSections.map((section) => ({
        category: section.category,
        title: section.title,
        enabled: section.enabled,
      })),
    };

    // Get occasions data separately
    const occasionsData = await prisma.occasion.findFirst();
    if (occasionsData) {
      formattedHomeData.occasions = {
        occasionName: occasionsData.occasionName,
        occasionImages: occasionsData.occasionImages,
      };
    } else {
      formattedHomeData.occasions = {
        occasionName: [],
        occasionImages: [],
      };
    }

    res.status(200).json(formattedHomeData);
  } catch (error) {
    console.error("Error fetching homepage data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update Home Page Data - Updated for new schema
app.post("/admin/home", adminAuth, async (req, res) => {
  const { heroBanner, flashSale, advert, occasions, customSections } = req.body;

  try {
    let homeData = await prisma.homeImages.findFirst();

    if (homeData) {
      homeData = await prisma.homeImages.update({
        where: { id: homeData.id },
        data: {
          heroImages: heroBanner.images,
          heroTitles: heroBanner.titles,
          heroSubtitles: heroBanner.subtitles,
          flashSaleEnabled: flashSale.enabled,
          flashSaleDescription: flashSale.description,
          advertImages: advert.images,
          customSections: {
            deleteMany: {},
          },
        },
        include: {
          customSections: true,
        },
      });

      if (customSections && customSections.length > 0) {
        for (const section of customSections) {
          await prisma.customSection.create({
            data: {
              homeImagesId: homeData.id,
              category: section.category,
              title: section.title,
              enabled: section.enabled,
            },
          });
        }
      }
    } else {
      homeData = await prisma.homeImages.create({
        data: {
          heroImages: heroBanner.images,
          heroTitles: heroBanner.titles,
          heroSubtitles: heroBanner.subtitles,
          flashSaleEnabled: flashSale.enabled,
          flashSaleDescription: flashSale.description,
          advertImages: advert.images,
        },
      });

      // Add custom sections
      if (customSections && customSections.length > 0) {
        for (const section of customSections) {
          await prisma.customSection.create({
            data: {
              homeImagesId: homeData.id,
              category: section.category,
              title: section.title,
              enabled: section.enabled,
            },
          });
        }
      }
    }

    if (occasions) {
      const occasionData = await prisma.occasion.findFirst();

      if (occasionData) {
        await prisma.occasion.update({
          where: { id: occasionData.id },
          data: {
            occasionName: occasions.occasionName,
            occasionImages: occasions.occasionImages,
          },
        });
      } else {
        await prisma.occasion.create({
          data: {
            occasionName: occasions.occasionName,
            occasionImages: occasions.occasionImages,
          },
        });
      }
    }

    // Fetch the updated home data with custom sections
    const updatedHomeData = await prisma.homeImages.findFirst({
      include: {
        customSections: true,
      },
    });

    res.status(200).json({
      message: "Homepage data saved successfully",
      data: updatedHomeData,
    });
  } catch (error) {
    console.error("Error saving homepage data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post(
  "/admin/upload-s3-image",
  adminAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = await uploadFileToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.json({ message: "File uploaded successfully", url: fileUrl });
    } catch (error) {
      res
        .status(500)
        .json({ error: "File upload failed", details: error.message });
    }
  }
);

app.get("/admin/flash-sales", async (req, res) => {
  try {
    const flashSales = await prisma.flashSale.findMany({
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            salePrice: true,
            discount: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formattedSales = flashSales.map((sale) => ({
      ...sale,
      items: sale.items.map((item) => ({
        ...item,
        productName: item.product.name,
      })),
    }));

    res.json(formattedSales);
  } catch (error) {
    console.error("Error fetching flash sales:", error);
    res.status(500).json({ error: "Failed to fetch flash sales" });
  }
});

app.post("/admin/flash-sales", async (req, res) => {
  const { title, description, startTime, endTime, items } = req.body;

  try {
    const flashSale = await prisma.flashSale.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            salePrice: item.salePrice,
            discount: item.discount,
          })),
        },
      },
      include: { items: true },
    });

    res
      .status(201)
      .json({ message: "Flash sale created successfully", flashSale });
  } catch (error) {
    console.error("Error creating flash sale:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/admin/flash-sales/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const flashSale = await prisma.flashSale.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                price: true,
                images: true,
              },
            },
          },
        },
      },
    });

    if (!flashSale) {
      return res.status(404).json({ error: "Flash sale not found" });
    }

    res.json(flashSale);
  } catch (error) {
    console.error("Error fetching flash sale:", error);
    res.status(500).json({ error: "Failed to fetch flash sale" });
  }
});

app.put("/admin/flash-sales/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, startTime, endTime, items } = req.body;

    if (!title || !startTime || !endTime || !items) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const updatedFlashSale = await prisma.$transaction(async (prisma) => {
      await prisma.flashSaleItem.deleteMany({
        where: {
          flashSaleId: parseInt(id),
        },
      });

      const flashSale = await prisma.flashSale.update({
        where: { id: parseInt(id) },
        data: {
          title,
          description,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              salePrice: item.salePrice,
              discount: item.discount,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return flashSale;
    });

    res.json(updatedFlashSale);
  } catch (error) {
    console.error("Error updating flash sale:", error);
    res.status(500).json({ error: "Failed to update flash sale" });
  }
});

app.patch("/admin/flash-sales/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    const updatedFlashSale = await prisma.flashSale.update({
      where: { id: parseInt(id) },
      data: { active },
    });

    res.json(updatedFlashSale);
  } catch (error) {
    console.error("Error toggling flash sale status:", error);
    res.status(500).json({ error: "Failed to update flash sale status" });
  }
});

app.delete("/admin/flash-sales/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.flashSale.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Flash sale deleted successfully" });
  } catch (error) {
    console.error("Error deleting flash sale:", error);
    res.status(500).json({ error: "Failed to delete flash sale" });
  }
});

app.get("/admin/orders", adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const search = req.query.search || "";

    const skip = (page - 1) * limit;

    let whereCondition = {};

    if (status && status !== "ALL") {
      whereCondition.status = status;
    }

    if (search) {
      whereCondition.OR = [
        { razorpayOrderId: { contains: search, mode: "insensitive" } },
        {
          user: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const totalOrders = await prisma.order.count({
      where: whereCondition,
    });

    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(totalOrders / limit);

    res.json({
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/admin/orders/:id", adminAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                discount: true,
                discountedPrice: true,
                images: {
                  select: {
                    displayImage: true,
                  },
                  take: 1,
                },
              },
            },
          },
        },
        shippingAddress: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ error: "Failed to fetch order details" });
  }
});

app.put("/admin/orders/:id/status", adminAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;

    if (!["INITIATED", "PAID", "FAILED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // If cancelling an order that was previously paid, refund to wallet
    if (status === "CANCELLED" && order.status === "PAID") {
      // First, create or update user's wallet
      const wallet = await prisma.wallet.upsert({
        where: { userId: order.userId },
        update: {
          balance: {
            increment: order.amount,
          },
        },
        create: {
          userId: order.userId,
          balance: order.amount,
        },
      });

      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amount: order.amount,
          type: "CREDIT",
          description: `Refund for cancelled order #${orderId}`,
        },
      });
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

app.put("/admin/orders/:id/delivery", async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { delivery } = req.body;

    if (!["Ordered", "Shipped", "Delivered", "Cancelled"].includes(delivery)) {
      return res.status(400).json({ error: "Invalid delivery status value" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { delivery },
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating delivery status:", error);
    res.status(500).json({ error: "Failed to update delivery status" });
  }
});

app.get("admin/orders/stats/summary", async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { delivery } = req.body;

    if (!["Ordered", "Shipped", "Delivered", "Cancelled"].includes(delivery)) {
      return res.status(400).json({ error: "Invalid delivery status value" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { delivery },
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating delivery status:", error);
    res.status(500).json({ error: "Failed to update delivery status" });
  }
});

const validateCouponDates = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, message: "Invalid date format" };
  }

  if (end < start) {
    return { valid: false, message: "End date must be after start date" };
  }

  return { valid: true };
};

app.get("/admin/coupons", adminAuth, async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    // Format the data for the frontend
    const formattedCoupons = coupons.map((coupon) => ({
      ...coupon,
      discountValue: parseFloat(coupon.discountValue),
      minPurchaseAmount: coupon.minPurchaseAmount
        ? parseFloat(coupon.minPurchaseAmount)
        : null,
      maxDiscountAmount: coupon.maxDiscountAmount
        ? parseFloat(coupon.maxDiscountAmount)
        : null,
    }));

    res.json(formattedCoupons);
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
});

// CREATE a new coupon
app.post("/admin/coupons", adminAuth, async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      isActive,
      usageLimit,
      perUserLimit,
      applicableUserIds,
      applicableProductIds,
      applicableCategories,
      applicableOccasions,
      applicableRecipients,
    } = req.body;

    // Validate required fields
    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    // Validate code format (uppercase letters and numbers only)
    if (!/^[A-Z0-9]+$/.test(code)) {
      return res.status(400).json({
        error: "Coupon code must contain only uppercase letters and numbers",
      });
    }

    // Check if code already exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code },
    });

    if (existingCoupon) {
      return res.status(400).json({ error: "Coupon code already exists" });
    }

    // Validate dates
    const dateValidation = validateCouponDates(startDate, endDate);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.message });
    }

    // Validate discount value
    if (
      discountType === "PERCENTAGE" &&
      (discountValue <= 0 || discountValue > 100)
    ) {
      return res
        .status(400)
        .json({ error: "Percentage discount must be between 0 and 100" });
    }

    if (discountType === "FIXED" && discountValue <= 0) {
      return res
        .status(400)
        .json({ error: "Fixed discount must be greater than 0" });
    }

    // Create the coupon
    const newCoupon = await prisma.coupon.create({
      data: {
        code,
        description,
        discountType,
        discountValue,
        minPurchaseAmount: minPurchaseAmount || null,
        maxDiscountAmount: maxDiscountAmount || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive,
        usageLimit: usageLimit || null,
        perUserLimit: perUserLimit || null,
        applicableUserIds: applicableUserIds || [],
        applicableProductIds: applicableProductIds || [],
        applicableCategories: applicableCategories || [],
        applicableOccasions: applicableOccasions || [],
        applicableRecipients: applicableRecipients || [],
      },
    });

    res.status(201).json(newCoupon);
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({ error: "Failed to create coupon" });
  }
});

// UPDATE an existing coupon
app.put("/admin/coupons/:id", adminAuth, async (req, res) => {
  try {
    const couponId = parseInt(req.params.id);
    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      isActive,
      usageLimit,
      perUserLimit,
      applicableUserIds,
      applicableProductIds,
      applicableCategories,
      applicableOccasions,
      applicableRecipients,
    } = req.body;

    // Validate required fields
    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    // Validate code format
    if (!/^[A-Z0-9]+$/.test(code)) {
      return res.status(400).json({
        error: "Coupon code must contain only uppercase letters and numbers",
      });
    }

    // Check if coupon exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!existingCoupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    // Check if updated code already exists (ignore if it's the same coupon)
    if (code !== existingCoupon.code) {
      const codeExists = await prisma.coupon.findUnique({
        where: { code },
      });

      if (codeExists) {
        return res.status(400).json({ error: "Coupon code already exists" });
      }
    }

    // Validate dates
    const dateValidation = validateCouponDates(startDate, endDate);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.message });
    }

    // Validate discount value
    if (
      discountType === "PERCENTAGE" &&
      (discountValue <= 0 || discountValue > 100)
    ) {
      return res
        .status(400)
        .json({ error: "Percentage discount must be between 0 and 100" });
    }

    if (discountType === "FIXED" && discountValue <= 0) {
      return res
        .status(400)
        .json({ error: "Fixed discount must be greater than 0" });
    }

    // Update the coupon
    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        code,
        description,
        discountType,
        discountValue,
        minPurchaseAmount: minPurchaseAmount || null,
        maxDiscountAmount: maxDiscountAmount || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive,
        usageLimit: usageLimit || null,
        perUserLimit: perUserLimit || null,
        applicableUserIds: applicableUserIds || [],
        applicableProductIds: applicableProductIds || [],
        applicableCategories: applicableCategories || [],
        applicableOccasions: applicableOccasions || [],
        applicableRecipients: applicableRecipients || [],
      },
    });

    res.json(updatedCoupon);
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({ error: "Failed to update coupon" });
  }
});

// DELETE a coupon
app.delete("/admin/coupons/:id", adminAuth, async (req, res) => {
  try {
    const couponId = parseInt(req.params.id);

    // Check if coupon exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: { usages: true },
    });

    if (!existingCoupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    // Delete the coupon
    await prisma.coupon.delete({
      where: { id: couponId },
    });

    res.json({ message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ error: "Failed to delete coupon" });
  }
});

// Get all users (for coupon targeting)
app.get("/admin/users", adminAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: {
        firstName: "asc",
      },
    });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.get("/admin/admins", adminAuth, async (req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: {
        firstName: "asc",
      },
    });
    res.json(admins);
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ error: "Failed to fetch admins" });
  }
});

app.get("/admin/admins/:id", adminAuth, async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: {
        id: parseInt(req.params.id),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    res.json(admin);
  } catch (error) {
    console.error("Error fetching admin:", error);
    res.status(500).json({ error: "Failed to fetch admin" });
  }
});

app.post("/admin/admins", adminAuth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    if (!firstName || !email || !phone || !password) {
      return res
        .status(400)
        .json({ error: "First name, email, phone and password are required" });
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: {
        email,
      },
    });

    if (existingAdmin) {
      return res.status(400).json({ error: "Email is already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await prisma.admin.create({
      data: {
        firstName,
        lastName: lastName || null,
        email,
        phone: phone,
        password: hashedPassword,
      },
    });

    const { password: _, ...adminWithoutPassword } = newAdmin;
    res.status(201).json(adminWithoutPassword);
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ error: "Failed to create admin" });
  }
});

app.put("/admin/admins/:id", adminAuth, async (req, res) => {
  try {
    const adminId = parseInt(req.params.id);
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !email) {
      return res
        .status(400)
        .json({ error: "First name and email are required" });
    }

    const existingAdmin = await prisma.admin.findFirst({
      where: {
        email,
        id: {
          not: adminId,
        },
      },
    });

    if (existingAdmin) {
      return res.status(400).json({ error: "Email is already in use" });
    }

    const updateData = {
      firstName,
      lastName: lastName || null,
      email,
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedAdmin = await prisma.admin.update({
      where: {
        id: adminId,
      },
      data: updateData,
    });

    // Return admin without password
    const { password: _, ...adminWithoutPassword } = updatedAdmin;
    res.json(adminWithoutPassword);
  } catch (error) {
    console.error("Error updating admin:", error);
    res.status(500).json({ error: "Failed to update admin" });
  }
});

app.delete("/admin/admins/:id", adminAuth, async (req, res) => {
  try {
    const adminId = parseInt(req.params.id);

    const admin = await prisma.admin.findUnique({
      where: {
        id: adminId,
      },
    });

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const adminCount = await prisma.admin.count();
    if (adminCount <= 1) {
      return res
        .status(400)
        .json({ error: "Cannot delete the last admin account" });
    }

    await prisma.admin.delete({
      where: {
        id: adminId,
      },
    });

    res.status(200).json({ message: "Admin deleted successfully" });
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).json({ error: "Failed to delete admin" });
  }
});

app.get("/admin/products", adminAuth, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        price: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const formattedProducts = products.map((product) => ({
      ...product,
      price: parseFloat(product.price),
    }));

    res.json(formattedProducts);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get("/admin/products/:id", adminAuth, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
      },
      include: {
        images: true,
        customizationTemplates: {
          include: {
            customizableAreas: true,
          },
          orderBy: {
            orderIndex: "asc",
          },
        },
        productMasks: {
          include: {
            mask: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Format the product data to match frontend expectations
    const formattedProduct = {
      ...product,
      price: parseFloat(product.price),
      discount: product.discount ? parseFloat(product.discount) : null,
      discountedPrice: product.discountedPrice
        ? parseFloat(product.discountedPrice)
        : null,
      deliveryFee: product.deliveryFee ? parseFloat(product.deliveryFee) : 0,
      categoryId: product.categories[0]?.id || null,
      subsectionId: product.subCategories[0]?.id || null,
    };

    res.json({ product: formattedProduct });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

app.get("/admin/subcategories", adminAuth, async (req, res) => {
  try {
    const subcategories = await prisma.subsection.findMany({
      select: {
        id: true,
        subsection: true,
      },
      orderBy: {
        subsection: "asc",
      },
    });
    res.json(subcategories);
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({ error: "Failed to fetch subcategories" });
  }
});

app.get("/admin/categories", adminAuth, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        category: true,
      },
      orderBy: {
        category: "asc",
      },
    });
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Create a function to generate dynamic field names
const getUploadFields = (maxTemplates = 10) => {
  const fields = [
    { name: "mainImage", maxCount: 1 },
    { name: "displayImage", maxCount: 1 },
    { name: "images", maxCount: 5 },
  ];

  // Add dynamic template fields
  for (let i = 0; i < maxTemplates; i++) {
    fields.push(
      { name: `customizationTemplates[${i}][thumbnail]`, maxCount: 1 },
      { name: `customizationTemplates[${i}][svg]`, maxCount: 1 }
    );
  }

  return fields;
};

app.post("/admin/products", adminAuth, upload.any(), async (req, res) => {
  try {
    const files = req.files;
    const productData = req.body || {};

    // Validate required fields
    const requiredFields = ["name", "description", "price", "stock"];
    const missingFields = requiredFields.filter((field) => !productData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        missingFields,
        message: `The following fields are required: ${missingFields.join(
          ", "
        )}`,
      });
    }

    // Validate numeric fields
    const numericFields = [
      "price",
      "discount",
      "discountedPrice",
      "stock",
      "deliveryFee",
    ];
    const invalidNumericFields = numericFields.filter((field) => {
      if (!productData[field]) return false;
      return isNaN(parseFloat(productData[field]));
    });

    if (invalidNumericFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid numeric values",
        invalidFields: invalidNumericFields,
        message: `The following fields must be numbers: ${invalidNumericFields.join(
          ", "
        )}`,
      });
    }

    // Validate images
    const mainImage = files.find((f) => f.fieldname === "mainImage");
    const displayImage = files.find((f) => f.fieldname === "displayImage");

    if (!mainImage || !displayImage) {
      return res.status(400).json({
        success: false,
        error: "Image validation failed",
        message: "Main image and display image are required",
      });
    }

    // Validate image types
    const validImageTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validImageTypes.includes(mainImage.mimetype)) {
      return res.status(400).json({
        success: false,
        error: "Invalid image type",
        field: "mainImage",
        message: "Main image must be JPEG, PNG, or WebP",
      });
    }

    if (!validImageTypes.includes(displayImage.mimetype)) {
      return res.status(400).json({
        success: false,
        error: "Invalid image type",
        field: "displayImage",
        message: "Display image must be JPEG, PNG, or WebP",
      });
    }

    // Validate additional images
    const additionalImages = files.filter((f) => f.fieldname === "images");
    if (additionalImages.length > 5) {
      return res.status(400).json({
        success: false,
        error: "Too many images",
        message: "Maximum 5 additional images allowed",
      });
    }

    // Process customization templates if product is customizable
    let templates = {};
    if (productData.isCustomizable === "true") {
      files.forEach((file) => {
        const match = file.fieldname.match(
          /customizationTemplates\[(\d+)\]\[(thumbnail|svg)\]/
        );
        if (match) {
          const [_, index, type] = match;
          if (!templates[index]) templates[index] = {};
          templates[index][type] = file;
        }
      });

      // Validate each template has both thumbnail and SVG
      Object.entries(templates).forEach(([index, templateFiles]) => {
        if (!templateFiles.thumbnail || !templateFiles.svg) {
          throw new Error(`Template ${index} is missing required files`);
        }

        if (!validImageTypes.includes(templateFiles.thumbnail.mimetype)) {
          throw new Error(`Template ${index} thumbnail has invalid image type`);
        }

        if (templateFiles.svg.mimetype !== "image/svg+xml") {
          throw new Error(`Template ${index} must be an SVG file`);
        }
      });
    }

    // Upload all images in parallel
    const uploadPromises = [
      uploadFileToS3(
        mainImage.buffer,
        `products/main-${Date.now()}-${mainImage.originalname}`,
        mainImage.mimetype
      ),
      uploadFileToS3(
        displayImage.buffer,
        `products/display-${Date.now()}-${displayImage.originalname}`,
        displayImage.mimetype
      ),
      ...additionalImages.map((img) =>
        uploadFileToS3(
          img.buffer,
          `products/additional-${Date.now()}-${img.originalname}`,
          img.mimetype
        )
      ),
    ];

    // Upload template files if they exist
    if (productData.isCustomizable === "true") {
      Object.values(templates).forEach((templateFiles) => {
        uploadPromises.push(
          uploadFileToS3(
            templateFiles.thumbnail.buffer,
            `templates/thumbnail-${Date.now()}-${
              templateFiles.thumbnail.originalname
            }`,
            templateFiles.thumbnail.mimetype
          ),
          uploadFileToS3(
            templateFiles.svg.buffer,
            `templates/svg-${Date.now()}-${templateFiles.svg.originalname}`,
            templateFiles.svg.mimetype
          )
        );
      });
    }

    const uploadedUrls = await Promise.all(uploadPromises);
    const [mainImageUrl, displayImageUrl, ...additionalImageUrls] =
      uploadedUrls.splice(0, 2 + additionalImages.length);

    // Create product transaction
    const product = await prisma.$transaction(async (prisma) => {
      // Create the product
      const product = await prisma.product.create({
        data: {
          name: productData.name,
          description: productData.description,
          price: parseFloat(productData.price),
          discount: productData.discount
            ? parseFloat(productData.discount)
            : null,
          discountedPrice: productData.discountedPrice
            ? parseFloat(productData.discountedPrice)
            : null,
          deliveryFee: parseInt(productData.deliveryFee) || 0,
          stock: parseInt(productData.stock) || 0,
          youtubeLink: productData.youtubeLink,
          inclusiveOfTaxes: productData.inclusiveOfTaxes === "true",
          requirements: productData.requirements,
          categories: productData.categoryId ? [productData.categoryId] : [],
          subCategories: productData.subsectionId
            ? [productData.subsectionId]
            : [],
          occasion: productData.occasion
            ? JSON.parse(productData.occasion)
            : [],
          recipients: productData.recipients
            ? JSON.parse(productData.recipients)
            : [],
          isCustomizable: productData.isCustomizable === "true",
          images: {
            create: {
              mainImage: mainImageUrl,
              displayImage: displayImageUrl,
              subImages: additionalImageUrls,
            },
          },
        },
        include: {
          images: true,
        },
      });

      // Create customization templates if needed
      if (
        productData.isCustomizable === "true" &&
        productData.customizationTemplates
      ) {
        const templateUrls = uploadedUrls.splice(
          0,
          Object.keys(templates).length * 2
        );
        let templateIndex = 0;

        for (const [index, templateData] of Object.entries(
          JSON.parse(productData.customizationTemplates)
        )) {
          const thumbnailUrl = templateUrls[templateIndex++];
          const svgUrl = templateUrls[templateIndex++];

          await prisma.customizationTemplate.create({
            data: {
              productId: product.id,
              name: templateData.name,
              thumbnailUrl,
              svgData: svgUrl,
              isActive: true,
              customizableAreas: {
                create:
                  templateData.customizableAreas?.map((area) => ({
                    name: area.name,
                    description: area.description || "",
                    shape: area.shape || "rectangle",
                    centerX: parseFloat(area.centerX) || 50,
                    centerY: parseFloat(area.centerY) || 50,
                    width: area.width ? parseFloat(area.width) : null,
                    height: area.height ? parseFloat(area.height) : null,
                    radius: area.radius ? parseFloat(area.radius) : null,
                    defaultScale: parseFloat(area.defaultScale) || 1.0,
                    defaultRotation: parseFloat(area.defaultRotation) || 0.0,
                    defaultPositionX: parseFloat(area.defaultPositionX) || 0.0,
                    defaultPositionY: parseFloat(area.defaultPositionY) || 0.0,
                    maxFileSizeMB: parseFloat(area.maxFileSizeMB) || 5.0,
                    allowedFormats: area.allowedFormats || [
                      "image/jpeg",
                      "image/png",
                    ],
                  })) || [],
              },
            },
          });
        }
      }

      return product;
    });

    res.status(201).json({
      success: true,
      product,
      message: "Product created successfully",
    });
  } catch (error) {
    console.error("Error creating product:", error);

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(400).json({
        success: false,
        error: "Database error",
        code: error.code,
        message: error.message,
      });
    }

    // Handle S3 upload errors
    if (error.name === "S3UploadError") {
      return res.status(500).json({
        success: false,
        error: "File upload failed",
        message: "Failed to upload files to storage",
      });
    }

    // Handle validation errors
    if (
      error.message.includes("validation") ||
      error.message.includes("invalid")
    ) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: error.message,
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to create product",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

app.put(
  "/admin/update-product/:id",
  adminAuth,
  upload.any(),
  async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const files = req.files;
      const productData = req.body || "{}";

      if (isNaN(productId)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }

      // Check if product exists
      const existingProduct = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          images: true,
          customizationTemplates: {
            include: {
              customizableAreas: true,
            },
          },
        },
      });

      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Process uploaded files
      const mainImage = files.find((f) => f.fieldname === "mainImage");
      const displayImage = files.find((f) => f.fieldname === "displayImage");
      const additionalImages = files.filter((f) => f.fieldname === "images");

      // Handle customization template files
      const templates = {};
      files.forEach((file) => {
        const match = file.fieldname.match(
          /customizationTemplates\[(\d+)\]\[(thumbnail|svg)\]/
        );
        if (match) {
          const [_, index, type] = match;
          if (!templates[index]) templates[index] = {};
          templates[index][type] = file;
        }
      });

      // Initialize image update data
      let imageUpdateData = {};

      // If new main image or display image provided, upload and update
      if (mainImage || displayImage || additionalImages.length > 0) {
        // Get existing image IDs
        const existingImageId = existingProduct.images[0]?.id;

        // Process main image if uploaded
        let mainImageUrl = existingProduct.images[0]?.mainImage;
        if (mainImage) {
          mainImageUrl = await uploadFileToS3(
            mainImage.buffer,
            `products/main-${Date.now()}-${mainImage.originalname}`,
            mainImage.mimetype
          );
        }

        // Process display image if uploaded
        let displayImageUrl = existingProduct.images[0]?.displayImage;
        if (displayImage) {
          displayImageUrl = await uploadFileToS3(
            displayImage.buffer,
            `products/display-${Date.now()}-${displayImage.originalname}`,
            displayImage.mimetype
          );
        }

        // Process additional images if uploaded
        let subImages = existingProduct.images[0]?.subImages || [];
        if (additionalImages.length > 0) {
          const newAdditionalImageUrls = await Promise.all(
            additionalImages.map((img) =>
              uploadFileToS3(
                img.buffer,
                `products/additional-${Date.now()}-${img.originalname}`,
                img.mimetype
              )
            )
          );

          // If keepExistingImages flag is true, append new images, otherwise replace
          if (productData.keepExistingImages === "true") {
            subImages = [...subImages, ...newAdditionalImageUrls];
          } else {
            subImages = newAdditionalImageUrls;
          }
        }

        // Create update for existing images or create new images entry
        if (existingImageId) {
          imageUpdateData = {
            images: {
              update: {
                where: { id: existingImageId },
                data: {
                  mainImage: mainImageUrl,
                  displayImage: displayImageUrl,
                  subImages: subImages,
                },
              },
            },
          };
        } else {
          imageUpdateData = {
            images: {
              create: {
                mainImage: mainImageUrl,
                displayImage: displayImageUrl,
                subImages: subImages,
              },
            },
          };
        }
      }

      // Update basic product data
      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: {
          name: productData.name,
          description: productData.description,
          price: parseFloat(productData.price),
          discount: productData.discount
            ? parseFloat(productData.discount)
            : null,
          discountedPrice: productData.discountedPrice
            ? parseFloat(productData.discountedPrice)
            : null,
          categories: productData.categoryId
            ? [productData.categoryId]
            : existingProduct.categories,
          subCategories: productData.subsectionId
            ? [productData.subsectionId]
            : existingProduct.subCategories,
          occasion: productData.occasion
            ? Array.isArray(productData.occasion)
              ? productData.occasion
              : [productData.occasion]
            : existingProduct.occasion,
          recipients: productData.recipients
            ? Array.isArray(productData.recipients)
              ? productData.recipients
              : [productData.recipients]
            : existingProduct.recipients,
          isCustomizable: productData.isCustomizable === "true",
          deliveryFee: productData.deliveryFee
            ? parseFloat(productData.deliveryFee)
            : existingProduct.deliveryFee,
          ...imageUpdateData,
        },
        include: {
          images: true,
        },
      });

      if (productData.isCustomizable === "true") {
        if (productData.deleteTemplates === "true") {
          await prisma.customizationTemplate.deleteMany({
            where: { productId },
          });
        }

        if (productData.customizationTemplates?.length) {
          for (const [
            index,
            templateData,
          ] of productData.customizationTemplates.entries()) {
            const templateId = parseInt(templateData.id);
            const isUpdate = !isNaN(templateId) && templateId > 0;

            const templateFiles = templates[index];
            let thumbnailUrl = null;
            let svgUrl = null;

            if (templateFiles?.thumbnail) {
              thumbnailUrl = await uploadFileToS3(
                templateFiles.thumbnail.buffer,
                `templates/thumbnail-${Date.now()}-${
                  templateFiles.thumbnail.originalname
                }`,
                templateFiles.thumbnail.mimetype
              );
            }

            if (templateFiles?.svg) {
              svgUrl = await uploadFileToS3(
                templateFiles.svg.buffer,
                `templates/svg-${Date.now()}-${templateFiles.svg.originalname}`,
                templateFiles.svg.mimetype
              );
            }

            const templateUpdateData = {
              name: templateData.name,
              isActive: templateData.isActive !== false,
              orderIndex: parseInt(templateData.orderIndex || index),
            };

            if (thumbnailUrl) templateUpdateData.thumbnailUrl = thumbnailUrl;
            if (svgUrl) templateUpdateData.svgData = svgUrl;

            if (isUpdate) {
              await prisma.customizationTemplate.update({
                where: { id: templateId },
                data: templateUpdateData,
              });

              if (templateData.customizableAreas?.length) {
                for (const areaData of templateData.customizableAreas) {
                  const areaId = parseInt(areaData.id);
                  const isAreaUpdate = !isNaN(areaId) && areaId > 0;

                  const areaUpdateData = {
                    name: areaData.name,
                    description: areaData.description || "",
                    shape: areaData.shape || "rectangle",
                    centerX: parseFloat(areaData.centerX) || 50,
                    centerY: parseFloat(areaData.centerY) || 50,
                    width: areaData.width ? parseFloat(areaData.width) : null,
                    height: areaData.height
                      ? parseFloat(areaData.height)
                      : null,
                    radius: areaData.radius
                      ? parseFloat(areaData.radius)
                      : null,
                    defaultScale: parseFloat(areaData.defaultScale) || 1.0,
                    defaultRotation:
                      parseFloat(areaData.defaultRotation) || 0.0,
                    defaultPositionX:
                      parseFloat(areaData.defaultPositionX) || 0.0,
                    defaultPositionY:
                      parseFloat(areaData.defaultPositionY) || 0.0,
                    maxFileSizeMB: parseFloat(areaData.maxFileSizeMB) || 5.0,
                    orderIndex: parseInt(areaData.orderIndex) || 0,
                  };

                  if (isAreaUpdate) {
                    await prisma.customizableArea.update({
                      where: { id: areaId },
                      data: areaUpdateData,
                    });
                  } else {
                    await prisma.customizableArea.create({
                      data: {
                        ...areaUpdateData,
                        templateId: templateId,
                      },
                    });
                  }
                }

                // Handle area deletion if specified
                if (templateData.deleteAreaIds?.length) {
                  const deleteAreaIds = templateData.deleteAreaIds
                    .map((id) => parseInt(id))
                    .filter((id) => !isNaN(id));

                  if (deleteAreaIds.length > 0) {
                    await prisma.customizableArea.deleteMany({
                      where: {
                        id: { in: deleteAreaIds },
                        templateId: templateId,
                      },
                    });
                  }
                }
              }
            } else {
              const newTemplate = await prisma.customizationTemplate.create({
                data: {
                  ...templateUpdateData,
                  productId: productId,
                  customizableAreas: {
                    create:
                      templateData.customizableAreas?.map((area) => ({
                        name: area.name,
                        description: area.description || "",
                        shape: area.shape || "rectangle",
                        centerX: parseFloat(area.centerX) || 50,
                        centerY: parseFloat(area.centerY) || 50,
                        width: area.width ? parseFloat(area.width) : null,
                        height: area.height ? parseFloat(area.height) : null,
                        radius: area.radius ? parseFloat(area.radius) : null,
                        defaultScale: parseFloat(area.defaultScale) || 1.0,
                        defaultRotation:
                          parseFloat(area.defaultRotation) || 0.0,
                        defaultPositionX:
                          parseFloat(area.defaultPositionX) || 0.0,
                        defaultPositionY:
                          parseFloat(area.defaultPositionY) || 0.0,
                        maxFileSizeMB: parseFloat(area.maxFileSizeMB) || 5.0,
                        orderIndex: parseInt(area.orderIndex) || 0,
                      })) || [],
                  },
                },
              });
            }
          }
        }
      }

      const refreshedProduct = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          images: true,
          customizationTemplates: {
            include: {
              customizableAreas: true,
            },
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
      });

      res.status(200).json({
        success: true,
        product: refreshedProduct,
        message: "Product updated successfully",
      });
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update product",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

app.delete("/admin/delete-product/:id", adminAuth, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    // First, get the product with all related data we need to clean up
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: true,
        customizationTemplates: {
          include: {
            customizableAreas: true,
          },
        },
        // Include other relations that might need cleanup
        cartItems: true,
        wishlistItems: true,
        // Add other relations as needed
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Delete associated files from S3 (if using S3 storage)
    if (product.images && product.images.length > 0) {
      try {
        const image = product.images[0]; // Assuming one image record per product
        const filesToDelete = [
          image.mainImage,
          image.displayImage,
          ...(image.subImages || []),
        ].filter((url) => url); // Remove any null/undefined values

        // Delete each file from S3
        await Promise.all(
          filesToDelete.map((url) => {
            if (url.startsWith("https://your-bucket.s3.amazonaws.com/")) {
              const key = url.split("amazonaws.com/")[1];
              return deleteFileFromS3(key);
            }
            return Promise.resolve();
          })
        );
      } catch (s3Error) {
        console.error("Error deleting product images from S3:", s3Error);
        // Continue with deletion even if S3 deletion fails
      }
    }

    // Delete customization template SVGs from S3 if they exist
    if (
      product.customizationTemplates &&
      product.customizationTemplates.length > 0
    ) {
      try {
        const svgUrls = product.customizationTemplates
          .map((template) => template.svgData)
          .filter((url) => url);

        await Promise.all(
          svgUrls.map((url) => {
            if (url.startsWith("https://your-bucket.s3.amazonaws.com/")) {
              const key = url.split("amazonaws.com/")[1];
              return deleteFileFromS3(key);
            }
            return Promise.resolve();
          })
        );
      } catch (s3Error) {
        console.error("Error deleting template SVGs from S3:", s3Error);
      }
    }

    // Delete the product and all related data in a transaction
    await prisma.$transaction([
      // Delete customizable areas first (due to foreign key constraints)
      prisma.customizableArea.deleteMany({
        where: {
          templateId: {
            in: product.customizationTemplates.map((t) => t.id),
          },
        },
      }),

      // Delete customization templates
      prisma.customizationTemplate.deleteMany({
        where: { productId },
      }),

      // Delete product images
      prisma.productImage.deleteMany({
        where: { productId },
      }),

      // Delete cart items referencing this product
      prisma.cartItem.deleteMany({
        where: { productId },
      }),

      // Delete wishlist items referencing this product
      prisma.wishlistItem.deleteMany({
        where: { productId },
      }),

      // Add other relations that need to be cleaned up

      prisma.product.delete({
        where: { id: productId },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Product and all related data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete product",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

app.put("/admin/products", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const product = await prisma.product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Process display image if updated
    if (req.files?.displayImage?.[0]) {
      try {
        const displayImageUrl = await processImageUpload(
          req.files.displayImage[0]
        );
        updates.mainImage = displayImageUrl;
        updates.displayImage = displayImageUrl;
      } catch (error) {
        return res.status(400).json({ error: "Error uploading display image" });
      }
    }

    // Process additional images if updated
    if (req.files?.additionalImages) {
      try {
        const additionalImageUrls = await Promise.all(
          req.files.additionalImages.map((file) => processImageUpload(file))
        );
        updates.subImages = additionalImageUrls;
      } catch (error) {
        return res
          .status(400)
          .json({ error: "Error uploading additional images" });
      }
    }

    // Convert string values to appropriate types
    if (updates.price) updates.price = parseFloat(updates.price);
    if (updates.discountedPrice)
      updates.discountedPrice = parseFloat(updates.discountedPrice);
    if (updates.discount) updates.discount = parseFloat(updates.discount);
    if (updates.stock) updates.stock = parseInt(updates.stock);
    if (updates.deliveryFee)
      updates.deliveryFee = parseFloat(updates.deliveryFee);
    if (updates.inclusiveOfTaxes)
      updates.inclusiveOfTaxes = updates.inclusiveOfTaxes === "true";
    if (updates.isCustomizable)
      updates.isCustomizable = updates.isCustomizable === "true";

    // Handle arrays
    if (updates.categories && !Array.isArray(updates.categories)) {
      updates.categories = [updates.categories];
    }
    if (updates.subCategories && !Array.isArray(updates.subCategories)) {
      updates.subCategories = updates.subCategories
        ? [updates.subCategories]
        : [];
    }
    if (updates.occasion && !Array.isArray(updates.occasion)) {
      updates.occasion = updates.occasion ? [updates.occasion] : [];
    }
    if (updates.recipients && !Array.isArray(updates.recipients)) {
      updates.recipients = updates.recipients ? [updates.recipients] : [];
    }

    await product.update(updates);

    // Update product images if needed
    if (updates.mainImage || updates.subImages) {
      const productImage = await prisma.product.findFirst({
        where: { productId: id },
      });
      if (productImage) {
        await productImage.update({
          mainImage: updates.mainImage || productImage.mainImage,
          subImages: updates.subImages || productImage.subImages,
          displayImage: updates.mainImage || productImage.displayImage,
        });
      }
    }

    res.json(product);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all occasions (for coupon targeting)
app.get("/admin/occasions", adminAuth, async (req, res) => {
  try {
    const occasions = await prisma.occasions.findMany({
      select: {
        id: true,
        occasions: true,
      },
      orderBy: {
        occasions: "asc",
      },
    });
    res.json(occasions);
  } catch (error) {
    console.error("Error fetching occasions:", error);
    res.status(500).json({ error: "Failed to fetch occasions" });
  }
});

// Get all recipients (for coupon targeting)
app.get("/admin/recipients", adminAuth, async (req, res) => {
  try {
    const recipients = await prisma.recipients.findMany({
      select: {
        id: true,
        recipients: true,
      },
      orderBy: {
        recipients: "asc",
      },
    });
    res.json(recipients);
  } catch (error) {
    console.error("Error fetching recipients:", error);
    res.status(500).json({ error: "Failed to fetch recipients" });
  }
});

// Validate a coupon (for customer checkout)
app.post("/validate-coupon", async (req, res) => {
  try {
    const { code, userId, cartItems, totalAmount } = req.body;

    if (!code || !userId || !cartItems || !totalAmount) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    // Find the coupon by code
    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: {
        usages: {
          where: { userId: parseInt(userId) },
        },
      },
    });

    // Check if coupon exists
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return res.status(400).json({ error: "Coupon is not active" });
    }

    // Check if coupon is expired
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      return res
        .status(400)
        .json({ error: "Coupon is expired or not yet valid" });
    }

    // Check usage limits
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ error: "Coupon usage limit exceeded" });
    }

    // Check per-user limits
    if (coupon.perUserLimit && coupon.usages.length >= coupon.perUserLimit) {
      return res.status(400).json({
        error: "You have already used this coupon the maximum number of times",
      });
    }

    // Check minimum purchase amount
    if (
      coupon.minPurchaseAmount &&
      totalAmount < parseFloat(coupon.minPurchaseAmount)
    ) {
      return res.status(400).json({
        error: `Minimum purchase amount of ₹${parseFloat(
          coupon.minPurchaseAmount
        )} not met`,
      });
    }

    // Check user restrictions
    if (
      coupon.applicableUserIds.length > 0 &&
      !coupon.applicableUserIds.includes(parseInt(userId))
    ) {
      return res
        .status(400)
        .json({ error: "Coupon is not applicable for your account" });
    }

    // Check product restrictions
    if (coupon.applicableProductIds.length > 0) {
      const cartProductIds = cartItems.map((item) => item.productId);
      const hasApplicableProduct = cartProductIds.some((id) =>
        coupon.applicableProductIds.includes(parseInt(id))
      );

      if (!hasApplicableProduct) {
        return res.status(400).json({
          error: "Coupon is not applicable for the products in your cart",
        });
      }
    }

    // Calculate discount amount
    let discountAmount = 0;

    if (coupon.discountType === "PERCENTAGE") {
      discountAmount = totalAmount * (parseFloat(coupon.discountValue) / 100);

      // Apply maximum discount cap if applicable
      if (
        coupon.maxDiscountAmount &&
        discountAmount > parseFloat(coupon.maxDiscountAmount)
      ) {
        discountAmount = parseFloat(coupon.maxDiscountAmount);
      }
    } else {
      // FIXED discount
      discountAmount = parseFloat(coupon.discountValue);

      // Discount cannot be greater than the total amount
      if (discountAmount > totalAmount) {
        discountAmount = totalAmount;
      }
    }

    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;

    // Respond with the coupon details and calculated discount
    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: parseFloat(coupon.discountValue),
      },
      discountAmount,
      finalAmount: totalAmount - discountAmount,
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({ error: "Failed to validate coupon" });
  }
});

// Apply a coupon to an order (to be called during checkout)
app.post("/apply-coupon", async (req, res) => {
  try {
    const { couponId, userId, orderId } = req.body;

    if (!couponId || !userId || !orderId) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    // Find the coupon
    const coupon = await prisma.coupon.findUnique({
      where: { id: parseInt(couponId) },
    });

    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    // Record the coupon usage
    await prisma.couponUsage.create({
      data: {
        couponId: parseInt(couponId),
        userId: parseInt(userId),
        orderId: parseInt(orderId),
      },
    });

    // Increment the usage count
    await prisma.coupon.update({
      where: { id: parseInt(couponId) },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });

    res.json({ message: "Coupon applied successfully" });
  } catch (error) {
    console.error("Error applying coupon:", error);

    // Handle unique constraint violation
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "This coupon has already been applied to this order" });
    }

    res.status(500).json({ error: "Failed to apply coupon" });
  }
});

app.get("/admin/testimonials", async (req, res) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.json(testimonials);
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    res.status(500).json({ error: "Failed to fetch testimonials" });
  }
});

app.post("/admin/testimonials", async (req, res) => {
  try {
    const { name, content, rating, imageUrl } = req.body;
    const testimonial = await prisma.testimonial.create({
      data: {
        name,
        content,
        rating,
        imageUrl,
      },
    });
    res.json(testimonial);
  } catch (error) {
    console.error("Error creating testimonial:", error);
    res.status(500).json({ error: "Failed to create testimonial" });
  }
});

app.put("/admin/testimonials/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content, rating, imageUrl, isActive } = req.body;
    const testimonial = await prisma.testimonial.update({
      where: { id: parseInt(id) },
      data: {
        name,
        content,
        rating,
        imageUrl,
        isActive,
      },
    });
    res.json(testimonial);
  } catch (error) {
    console.error("Error updating testimonial:", error);
    res.status(500).json({ error: "Failed to update testimonial" });
  }
});

app.delete("/admin/testimonials/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.testimonial.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: "Testimonial deleted successfully" });
  } catch (error) {
    console.error("Error deleting testimonial:", error);
    res.status(500).json({ error: "Failed to delete testimonial" });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
